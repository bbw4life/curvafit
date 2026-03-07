// netlify/functions/verify-payment.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');

exports.handler = async (event) => {
  console.log("=== VERIFY PAYMENT STARTED ===");

  try {
    if (!event.body) throw new Error("No data received");
    const { provider, sessionId, orderID } = JSON.parse(event.body);
    console.log(`Provider: ${provider} | OrderID: ${orderID || 'N/A'}`);

    let cart = [];
    let shipping = {};
    let paymentVerified = false;

    const BASE_URL = process.env.URL || `https://${event.headers.host}`;
    const paymentId = sessionId || orderID;

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

      // Capture + détails
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

    // ====================== FULFILLMENT EN PARALLÈLE (anti-timeout) ======================
    const fulfillmentPromises = cart.map(async (item) => {
      try {
        if (!item.cj_variant_id) {
          await saveAsPending(item, shipping, BASE_URL, provider, paymentId);
          return { status: "pending" };
        }

        const stockRes = await fetch(`${BASE_URL}/.netlify/functions/check-cj-stock`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cj_variant_id: item.cj_variant_id })
        });
        const stockData = await stockRes.json();

        if (stockData.success && stockData.inStock) {
          const cjRes = await fetch(`${BASE_URL}/.netlify/functions/create-cj-order`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cart: [item], shipping })
          });
          const cjData = await cjRes.json();
          console.log(`🎉 CJ Order créé pour ${item.cj_variant_id}`);
          return { status: "fulfilled", cjOrderId: cjData.cjOrderId };
        } else {
          await saveAsPending(item, shipping, BASE_URL, provider, paymentId);
          return { status: "pending" };
        }
      } catch (e) {
        console.error(`Item error ${item.cj_variant_id}:`, e.message);
        await saveAsPending(item, shipping, BASE_URL, provider, paymentId);
        return { status: "pending" };
      }
    });

    // Lancement parallèle (ne bloque pas)
    Promise.all(fulfillmentPromises).then(results => {
      const fulfilled = results.filter(r => r.status === "fulfilled").length;
      console.log(`🎯 Fulfillment terminé : ${fulfilled}/${cart.length} envoyés à CJ`);
    });

    // On renvoie immédiatement le succès au client (pas de timeout)
    return response(200, {
      success: true,
      fulfillmentStatus: "processing"
    });

  } catch (error) {
    console.error("=== VERIFY PAYMENT ERROR ===", error.message);
    return response(500, { success: false, error: error.message });
  }
};

async function saveAsPending(item, shipping, BASE_URL, provider, paymentId) {
  try {
    await fetch(`${BASE_URL}/.netlify/functions/save-pending-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipping, item, payment_provider: provider, payment_id: paymentId || "auto" })
    });
  } catch (e) { console.error("saveAsPending failed:", e.message); }
}

function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}