// verify-payment.js
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
    if (!paymentId) throw new Error("Missing payment ID");
    // ====================== PROTECTION DOUBLE PROCESSING ======================
    const alreadyProcessed = await isAlreadyProcessed(paymentId);
    if (alreadyProcessed) {
      console.log(`🚫 DUPLICATE DETECTED (${paymentId}) → SKIP (already processed)`);
      return response(200, { success: true, message: "Duplicate - already processed" });
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
      const PAYPAL_BASE = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");
      const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
      const { access_token } = await tokenRes.json();
      const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, { method: "POST", headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" } });
      if (!captureRes.ok) {
        const errData = await captureRes.json();
        if (errData.name === "RESOURCE_CONFLICT" && errData.details[0].issue === "DUPLICATE_INVOICE_ID") {
          console.log("PayPal already captured - treating as completed");
        } else {
          throw new Error("PayPal capture failed");
        }
      }
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
        phone: payer.phone?.phone_number?.national_number || "",
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
    // Séparer les items prêts et pending
    const readyItems = cart.filter(item => item.cj_variant_id);
    const pendingItems = cart.filter(item => !item.cj_variant_id);
    // Sauvegarder les pending sans variant
    for (const item of pendingItems) {
      console.log(" → Pas de variant_id → save pending");
      await saveAsPending(item, shipping, BASE_URL, provider, paymentId);
    }
    // Traiter les ready en groupe
    if (readyItems.length > 0) {
      console.log("=== DÉBUT FULFILLMENT GROUPÉ ===");
      const cjUrl = `${BASE_URL}/.netlify/functions/create-cj-order`;
      console.log(` 📡 Appel create-cj-order → ${cjUrl}`);
      const cjRes = await fetch(cjUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart: readyItems, shipping })
      });
      console.log(` 📥 CJ Order status: ${cjRes.status}`);
      const cjData = await cjRes.json();
      console.log(` 📊 CJ Order success: ${cjData.success || false}`);
      if (cjData.success) {
        console.log(` 🎉 SUCCÈS CJ pour l'ordre groupé`);
      } else {
        const errorMsg = cjData.error || '';
        const code = cjData.code || 0;
        const isRateLimit = [1600200, 1600201].includes(code) || errorMsg.includes("Too much") || errorMsg.includes("Quota") || errorMsg.includes("Many Requests");
        const saveStatus = isRateLimit ? "pending_rate_limit" : "pending_stock";
        console.log(` ❌ CJ Order failed ${isRateLimit ? '(RATE LIMIT)' : ''} → save each as ${saveStatus}`);
        for (const item of readyItems) {
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
// ====================== FONCTION ANTI-DOUBLE ======================
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
    const rangesToTry = ["PendingOrders!C:C", "Sheet1!C:C", "Feuille 1!C:C"];
    for (const range of rangesToTry) {
      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: range
        });
        const rows = res.data.values || [];
        if (rows.some(row => row[0] === paymentId)) {
          return true;
        }
      } catch (e) {
        // pass to next
      }
    }
    return false;
  } catch (e) {
    console.error("[DUPLICATE CHECK ERROR]", e.message);
    return false;
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