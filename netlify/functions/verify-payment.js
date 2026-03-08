// netlify/functions/verify-payment.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');
const { google } = require('googleapis');

exports.handler = async (event) => {
  console.log("=== VERIFY PAYMENT STARTED ===");

  try {
    if (!event.body) throw new Error("No data received");
    const { provider, sessionId, orderID } = JSON.parse(event.body);
    console.log(`Provider: ${provider} | OrderID: ${orderID || 'N/A'}`);

    const paymentId = sessionId || orderID;

    // ====================== PROTECTION DOUBLE WEBHOOK (PayPal + Stripe) ======================
    const alreadyProcessed = await isAlreadyProcessed(paymentId);
    if (alreadyProcessed) {
      console.log(`🚫 DOUBLE WEBHOOK DÉTECTÉ (${paymentId}) → SKIP (déjà traité)`);
      return response(200, { success: true, message: "Duplicate webhook - already processed" });
    }
    // ============================================================================

    let cart = [];
    let shipping = {};
    let paymentVerified = false;

    const BASE_URL = process.env.BASE_URL || process.env.URL || `https://${event.headers.host}`;
    console.log(`🔗 BASE_URL utilisée : ${BASE_URL}`);

    // ====================== STRIPE ======================
    if (provider === "stripe") {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") throw new Error("Stripe not paid");

      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 });
      const storedCj = JSON.parse(session.metadata.cj_data || "[]");

      cart = lineItems.data.map((li, i) => {
        const cjItem = storedCj[i] || {};
        return {
          title: li.description,
          price: (li.amount_total / 100) / li.quantity,
          quantity: li.quantity,
          cj_product_id: cjItem.cj_product_id || null,
          cj_variant_id: cjItem.cj_variant_id || null
        };
      });

      shipping = JSON.parse(session.metadata.shipping || "{}");
      paymentVerified = true;

    // ====================== PAYPAL ======================
    } else if (provider === "paypal") {
      if (!orderID) throw new Error("Missing PayPal orderID");

      const PAYPAL_BASE = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");

      const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
      const { access_token } = await tokenRes.json();

      await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, { method: "POST", headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" } });
      const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}`, { headers: { Authorization: `Bearer ${access_token}` } });
      const orderData = await orderRes.json();

      if (orderData.status !== "COMPLETED") throw new Error("PayPal payment not completed");

      const purchaseUnit = orderData.purchase_units?.[0];
      const storedCj = purchaseUnit?.custom_id ? purchaseUnit.custom_id.split('|') : [];
      console.log("Stored CJ data:", storedCj);

      const itemsArray = purchaseUnit?.items || [];
      cart = itemsArray.map((item, i) => {
        const [cj_product_id, cj_variant_id] = storedCj[i] ? storedCj[i].split(':') : ['', ''];
        return { title: item.name, price: parseFloat(item.unit_amount.value), quantity: parseInt(item.quantity), cj_product_id: cj_product_id || null, cj_variant_id: cj_variant_id || null };
      });

      if (cart.length === 0 && storedCj.length > 0) {
        cart = storedCj.map((str, i) => {
          const [p, v] = str.split(':');
          return { title: `Product ${i+1}`, price: 0, quantity: 1, cj_product_id: p || null, cj_variant_id: v || null };
        });
      }

      const payer = orderData.payer || {};
      const ship = purchaseUnit.shipping || {};
      shipping = {
        fullName: ship.name?.full_name || `${payer.name?.given_name || ''} ${payer.name?.surname || ''}`.trim(),
        email: payer.email_address || "",
        address: ship.address?.address_line_1 || "",
        city: ship.address?.admin_area_2 || "",
        state: ship.address?.admin_area_1 || "",
        postalCode: ship.address?.postal_code || "",
        country: ship.address?.country_code || "US"
      };
      paymentVerified = true;
    }

    if (!paymentVerified || cart.length === 0) throw new Error("Payment verification failed or cart empty");

    console.log(`✅ ${cart.length} item(s) ready for CJ`);

    console.log("=== DÉBUT FULFILLMENT BATCHÉ ===");

    const inStockItems = [];
    let rateLimitHit = false;

    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      console.log(`🔄 [ITEM ${i+1}/${cart.length}] Vérification stock pour ${item.cj_variant_id || 'NO_VARIANT'}`);

      if (!item.cj_variant_id) {
        console.log("   → Pas de variant_id → save pending");
        await saveAsPending(item, shipping, BASE_URL, provider, paymentId);
        continue;
      }

      if (i > 0) {
        console.log("   ⏳ Attente 310s pour rate limit CJ...");
        await delay(310000);
      }

      // === CHECK STOCK ===
      const stockUrl = `${BASE_URL}/.netlify/functions/check-cj-stock`;
      console.log(`   📡 Appel check-cj-stock → ${stockUrl}`);

      const stockRes = await fetch(stockUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cj_variant_id: item.cj_variant_id })
      });

      console.log(`   📥 Stock status: ${stockRes.status}`);
      const stockData = await stockRes.json();
      console.log(`   📊 Stock result → success: ${stockData.success} | inStock: ${stockData.inStock}`);

      if (!stockData.success) {
        if (stockData.isRateLimit) {
          console.log(`   ⚠️ Rate limit CJ (stock) → save en pending_rate_limit`);
          rateLimitHit = true;
          await saveAsPending(item, shipping, BASE_URL, provider, paymentId, "pending_rate_limit");
        } else {
          console.log(`   ❌ Erreur stock → save pending`);
          await saveAsPending(item, shipping, BASE_URL, provider, paymentId);
        }
        continue;
      }

      if (stockData.inStock) {
        inStockItems.push(item);
      } else {
        console.log("   ❌ Stock insuffisant → save pending");
        await saveAsPending(item, shipping, BASE_URL, provider, paymentId);
      }
    }

    // === CRÉER UNE SEULE COMMANDE CJ POUR TOUS LES IN-STOCK (si pas de rate limit pendant stock check) ===
    if (inStockItems.length > 0 && !rateLimitHit) {
      console.log(`   ⏳ Attente 310s avant create-cj-order...`);
      await delay(310000);

      const cjUrl = `${BASE_URL}/.netlify/functions/create-cj-order`;
      console.log(`   📡 Appel create-cj-order (batch ${inStockItems.length} items) → ${cjUrl}`);

      const cjRes = await fetch(cjUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart: inStockItems, shipping })
      });

      console.log(`   📥 CJ Order status: ${cjRes.status}`);
      const cjData = await cjRes.json();
      console.log(`   📊 CJ Order success: ${cjData.success || false}`);

      if (cjData.success) {
        console.log(`   🎉 SUCCÈS CJ pour batch !`);
      } else {
        const errorMsg = cjData.error || '';
        const isRateLimit = errorMsg.includes("Too Many Requests");
        const saveStatus = isRateLimit ? "pending_rate_limit" : "pending_stock";

        console.log(`   ❌ CJ Order failed ${isRateLimit ? '(RATE LIMIT)' : ''} → save batch as ${saveStatus}`);
        for (const item of inStockItems) {
          await saveAsPending(item, shipping, BASE_URL, provider, paymentId, saveStatus);
        }
      }
    }

    console.log("🎯 Fulfillment terminé");

    return response(200, {
      success: true,
      fulfillmentStatus: "processing"
    });

  } catch (error) {
    console.error("=== VERIFY PAYMENT ERROR ===", error.message);
    return response(500, { success: false, error: error.message });
  }
};

// ====================== FONCTION ANTI-DOUBLE WEBHOOK ======================
async function isAlreadyProcessed(paymentId) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const range = "PendingOrders!C:C";  // Standardisé

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });
    const rows = res.data.values || [];
    return rows.some(row => row[0] === paymentId);

  } catch (e) {
    console.error("[DUPLICATE CHECK ERROR]", e.message);
    return false; // Laisse passer en cas d'erreur
  }
}
// ============================================================================

async function saveAsPending(item, shipping, BASE_URL, provider, paymentId, status = "pending_stock") {
  try {
    await fetch(`${BASE_URL}/.netlify/functions/save-pending-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipping, item, payment_provider: provider, payment_id: paymentId || "auto", status })
    });
  } catch (e) { console.error("saveAsPending failed:", e.message); }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}