// verify-payment.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    if (!event.body) return response(400, { success: false, error: "No data" });

    const { provider, sessionId, orderID } = JSON.parse(event.body);
    let cart = [];
    let shipping = {};
    let paymentVerified = false;

    /* ==================== STRIPE ==================== */
    if (provider === "stripe") {
      if (!sessionId) throw new Error("Missing sessionId");
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") throw new Error("Stripe not paid");
      cart = JSON.parse(session.metadata.cart);
      shipping = JSON.parse(session.metadata.shipping || "{}");
      paymentVerified = true;
    }
    /* ==================== PAYPAL ==================== */
    else if (provider === "paypal") {
      if (!orderID) throw new Error("Missing orderID");
      const PAYPAL_BASE = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");

      const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, { /* ... même que avant */ });
      const { access_token } = await tokenRes.json();

      const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" }
      });
      const orderData = await captureRes.json();
      if (orderData.status !== "COMPLETED") throw new Error("PayPal not completed");

      // reconstruction cart + shipping (inchangé)
      const purchaseUnit = orderData.purchase_units[0];
      const storedCj = purchaseUnit.custom_id ? purchaseUnit.custom_id.split('|') : [];
      cart = purchaseUnit.items.map((ppItem, i) => {
        const [prod, varId] = storedCj[i] ? storedCj[i].split(':') : ['', ''];
        return {
          title: ppItem.name,
          price: parseFloat(ppItem.unit_amount.value),
          quantity: parseInt(ppItem.quantity),
          cj_product_id: prod || null,
          cj_variant_id: varId || null
        };
      });
      // shipping reconstruction (inchangé)
      paymentVerified = true;
    } else {
      throw new Error("Invalid provider");
    }

    if (!paymentVerified) return response(400, { success: false, paymentVerified: false });

    /* ==================== FULFILLMENT (corrigé) ==================== */
    let inStockItems = [];
    let pendingItems = [];

    for (const item of cart) {
      if (!item.cj_variant_id) {
        pendingItems.push(item);
        continue;
      }

      const stockRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/check-cj-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cj_variant_id: item.cj_variant_id })
      });

      if (!stockRes.ok) throw new Error(`Stock check failed ${stockRes.status}`);
      const stockData = await stockRes.json();
      if (!stockData.success) throw new Error(stockData.error || "Stock error");

      stockData.inStock ? inStockItems.push(item) : pendingItems.push(item);
    }

    let allFulfilled = pendingItems.length === 0;

    // 1. Création CJ (tous les articles en stock en UNE seule commande)
    if (inStockItems.length > 0) {
      const createRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/create-cj-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart: inStockItems, shipping })
      });
      if (!createRes.ok) throw new Error(`Create order HTTP ${createRes.status}`);
      const createData = await createRes.json();
      if (!createData.success) throw new Error(createData.error || "CJ order failed");
    }

    // 2. Pending (un appel par article → compatible avec ton save-pending-order)
    if (pendingItems.length > 0) {
      const payment_provider = provider;
      const payment_id = provider === "stripe" ? sessionId : orderID;

      for (const item of pendingItems) {
        const pendingRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/save-pending-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shipping,
            item,
            payment_provider,
            payment_id
          })
        });
        if (!pendingRes.ok) throw new Error(`Save pending HTTP ${pendingRes.status}`);
        const pendingData = await pendingRes.json();
        if (!pendingData.success) throw new Error(pendingData.error || "Save pending failed");
      }
    }

    return response(200, {
      success: true,
      paymentVerified: true,
      fulfillmentStatus: allFulfilled ? "completed" : "pending_stock"
    });

  } catch (error) {
    console.error("VERIFY PAYMENT ERROR:", error.message);
    return response(500, { success: false, error: "Payment verification failed" });
  }
};

function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}