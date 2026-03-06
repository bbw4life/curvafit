// netlify/functions/verify-payment.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');

exports.handler = async (event) => {
  console.log("=== VERIFY PAYMENT STARTED ===");

  try {
    if (!event.body) throw new Error("No data received");

    const { provider, sessionId, orderID } = JSON.parse(event.body);
    console.log(`Provider: ${provider} | SessionID: ${sessionId || 'N/A'} | OrderID: ${orderID || 'N/A'}`);

    let cart = [];
    let shipping = {};
    let paymentVerified = false;

    // ====================== STRIPE ======================
    if (provider === "stripe") {
      if (!sessionId) throw new Error("Missing Stripe sessionId");
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log("Stripe session status:", session.payment_status);

      if (session.payment_status !== "paid") throw new Error("Stripe payment not completed");

      cart = JSON.parse(session.metadata.cart || "[]");
      shipping = JSON.parse(session.metadata.shipping || "{}");
      paymentVerified = true;

    // ====================== PAYPAL ======================
    } else if (provider === "paypal") {
      if (!orderID) throw new Error("Missing PayPal orderID");

      const PAYPAL_BASE = process.env.PAYPAL_ENV === "live" 
        ? "https://api-m.paypal.com" 
        : "https://api-m.sandbox.paypal.com";

      const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");

      const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials"
      });
      const { access_token } = await tokenRes.json();

      const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" }
      });
      const orderData = await captureRes.json();
      console.log("PayPal capture status:", orderData.status);

      if (orderData.status !== "COMPLETED") throw new Error("PayPal payment not completed");

      const purchaseUnit = orderData.purchase_units[0];
      const storedCj = purchaseUnit.custom_id ? purchaseUnit.custom_id.split('|') : [];

      cart = purchaseUnit.items.map((ppItem, index) => {
        const cjParts = storedCj[index] ? storedCj[index].split(':') : ['', ''];
        return {
          title: ppItem.name,
          price: parseFloat(ppItem.unit_amount.value),
          quantity: parseInt(ppItem.quantity),
          cj_product_id: cjParts[0] || null,
          cj_variant_id: cjParts[1] || null
        };
      });

      const shippingDetails = purchaseUnit.shipping || {};
      const payer = orderData.payer || {};
      shipping = {
        fullName: shippingDetails.name?.full_name || `${payer.name?.given_name || ''} ${payer.name?.surname || ''}`.trim(),
        email: payer.email_address,
        address: shippingDetails.address?.address_line_1 || "",
        city: shippingDetails.address?.admin_area_2 || "",
        state: shippingDetails.address?.admin_area_1 || "",
        postalCode: shippingDetails.address?.postal_code || "",
        country: shippingDetails.address?.country_code || "US"
      };
      paymentVerified = true;
    } else {
      throw new Error("Invalid payment provider");
    }

    if (!paymentVerified || cart.length === 0) {
      throw new Error("Payment verification failed or cart empty");
    }

    console.log(`✅ Payment verified - ${cart.length} item(s) to process`);

    // ====================== FULFILLMENT CJ ======================
    let fulfilled = 0;
    let pending = 0;

    for (const item of cart) {
      try {
        console.log(`→ Processing: ${item.title} | Variant: ${item.cj_variant_id}`);

        if (!item.cj_variant_id) {
          console.log("⚠️ Missing cj_variant_id → saved as pending");
          await saveAsPending(item, shipping);
          pending++;
          continue;
        }

        // === CHECK STOCK ===
        const stockRes = await fetch(`/.netlify/functions/check-cj-stock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cj_variant_id: item.cj_variant_id })
        });
        const stockData = await stockRes.json();

        if (stockData.success && stockData.inStock) {
          console.log(`✅ In stock → Creating CJ order`);
          const cjRes = await fetch(`/.netlify/functions/create-cj-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cart: [item], shipping })
          });
          const cjData = await cjRes.json();

          if (cjRes.ok && cjData.success) {
            console.log(`🎉 CJ Order CREATED → ${cjData.cjOrderId}`);
            fulfilled++;
          } else {
            throw new Error("CJ order creation failed");
          }
        } else {
          console.log(`⏳ Out of stock → Saved as pending`);
          await saveAsPending(item, shipping);
          pending++;
        }
      } catch (itemErr) {
        console.error(`❌ Error on item ${item.cj_variant_id}:`, itemErr.message);
        await saveAsPending(item, shipping).catch(() => {});
        pending++;
      }
    }

    return response(200, {
      success: true,
      paymentVerified: true,
      fulfillmentStatus: pending > 0 ? "pending_stock" : "completed",
      fulfilled,
      pending
    });

  } catch (error) {
    console.error("=== VERIFY PAYMENT ERROR ===", error.message);
    return response(500, { success: false, error: error.message });
  }
};

// Helper pour pending orders
async function saveAsPending(item, shipping) {
  await fetch(`/.netlify/functions/save-pending-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shipping,
      item,
      payment_provider: "auto",
      payment_id: "verified_via_verify-payment"
    })
  });
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}