// verify-payment-background.js
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
    // ====================== PROTECTION DOUBLE WEBHOOK ======================
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
    } else if (provider === "paypal") {
      if (!orderID) throw new Error("Missing PayPal orderID");
      const PAYPAL_BASE = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");
      const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
      const { access_token } = await tokenRes.json();
      const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, { method: "POST", headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" } });
      if (!captureRes.ok) {
        const err = await captureRes.text();
        throw new Error(`PayPal capture failed: ${err}`);
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
        address: ship.address?.address_line_1 || "",
        city: ship.address?.admin_area_2 || "",
        state: ship.address?.admin_area_1 || "",
        postalCode: ship.address?.postal_code || "",
        country: ship.address?.country_code || "US"
      };
      paymentVerified = true;
    }
    if (!paymentVerified || cart.length === 0) throw new Error("Payment verification failed or cart empty");
    console.log(`✅ ${cart.length} item(s) ready for CJ - Saving as pending`);
    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      console.log(`🔄 [ITEM ${i+1}/${cart.length}] Saving ${item.cj_variant_id || 'NO_VARIANT'} as pending`);
      await saveAsPending(item, shipping, BASE_URL, provider, paymentId, "pending");
    }
    console.log("🎯 All items saved as pending for later fulfillment");
    return response(200, {
      success: true,
      fulfillmentStatus: "pending"
    });
  } catch (error) {
    console.error("=== VERIFY PAYMENT ERROR ===", error.message);
    return response(200, { success: true, message: "Order received, fulfillment pending due to error: " + error.message });
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
    const rangesToTry = ["PendingOrders!C:C", "Sheet1!C:C", "Feuille 1!C:C"];
    for (const range of rangesToTry) {
      try {
        let attempt = 0;
        while (attempt < 3) {
          const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: range
          });
          const rows = res.data.values || [];
          if (rows.some(row => row[0] === paymentId)) {
            return true;
          }
          attempt++;
          if (attempt < 3) {
            await delay(1000); // Wait 1s and retry check
          }
        }
      } catch (e) {
        // on passe au range suivant
      }
    }
    return false;
  } catch (e) {
    console.error("[DUPLICATE CHECK ERROR]", e.message);
    return false; // en cas d'erreur on laisse passer
  }
}
// ============================================================================
async function saveAsPending(item, shipping, BASE_URL, provider, paymentId, status = "pending") {
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