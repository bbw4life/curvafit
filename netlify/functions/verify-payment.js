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

    // URL ABSOLUE AUTOMATIQUE (fonctionne toujours)
    const BASE_URL = process.env.URL || `https://${event.headers.host}`;

    // ====================== STRIPE ======================
    if (provider === "stripe") {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") throw new Error("Stripe not paid");
      cart = JSON.parse(session.metadata.cart || "[]");
      shipping = JSON.parse(session.metadata.shipping || "{}");
      paymentVerified = true;

    // ====================== PAYPAL ======================
    } else if (provider === "paypal") {
      if (!orderID) throw new Error("Missing PayPal orderID");

      const PAYPAL_BASE = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");

      const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials"
      });
      const { access_token } = await tokenRes.json();

      // Capture
      await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" }
      });

      // Récupération fiable des données (custom_id + items)
      const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}`, {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const orderData = await orderRes.json();
      console.log("PayPal final status:", orderData.status);

      if (orderData.status !== "COMPLETED") throw new Error("PayPal payment not completed");

      const purchaseUnit = orderData.purchase_units?.[0];
      if (!purchaseUnit) throw new Error("No purchase unit found");

      const storedCj = purchaseUnit.custom_id ? purchaseUnit.custom_id.split('|') : [];
      console.log("Stored CJ data:", storedCj);

      const itemsArray = purchaseUnit.items || [];
      cart = itemsArray.map((item, i) => {
        const [cj_product_id, cj_variant_id] = storedCj[i] ? storedCj[i].split(':') : ['', ''];
        return {
          title: item.name,
          price: parseFloat(item.unit_amount.value),
          quantity: parseInt(item.quantity),
          cj_product_id: cj_product_id || null,
          cj_variant_id: cj_variant_id || null
        };
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

    // ====================== FULFILLMENT CJ (URLs ABSOLUES) ======================
    let fulfilled = 0, pending = 0;

    for (const item of cart) {
      try {
        if (!item.cj_variant_id) {
          await saveAsPending(item, shipping, BASE_URL);
          pending++;
          continue;
        }

        const stockRes = await fetch(`${BASE_URL}/.netlify/functions/check-cj-stock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cj_variant_id: item.cj_variant_id })
        });
        const stockData = await stockRes.json();

        if (stockData.success && stockData.inStock) {
          const cjRes = await fetch(`${BASE_URL}/.netlify/functions/create-cj-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cart: [item], shipping })
          });
          if ((await cjRes.json()).success) fulfilled++;
          else pending++;
        } else {
          await saveAsPending(item, shipping, BASE_URL);
          pending++;
        }
      } catch (e) {
        console.error("Item error:", e.message);
        await saveAsPending(item, shipping, BASE_URL);
        pending++;
      }
    }

    return response(200, {
      success: true,
      fulfillmentStatus: pending > 0 ? "pending_stock" : "completed"
    });

  } catch (error) {
    console.error("=== VERIFY PAYMENT ERROR ===", error.message);
    return response(500, { success: false, error: error.message });
  }
};

async function saveAsPending(item, shipping, BASE_URL) {
  try {
    await fetch(`${BASE_URL}/.netlify/functions/save-pending-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipping, item, payment_provider: "paypal", payment_id: "auto" })
    });
  } catch (e) {
    console.error("saveAsPending failed:", e.message);
  }
}

function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}