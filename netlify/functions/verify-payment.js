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

    // ====================== PAYPAL (CORRIGÉ) ======================
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

      // Capture
      const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" }
      });
      const orderData = await captureRes.json();
      console.log("PayPal capture status:", orderData.status);

      if (orderData.status !== "COMPLETED") throw new Error("PayPal payment not completed");

      const purchaseUnit = orderData.purchase_units?.[0];
      if (!purchaseUnit) throw new Error("No purchase unit found");

      const storedCj = purchaseUnit.custom_id ? purchaseUnit.custom_id.split('|') : [];
      console.log("Stored CJ data from custom_id:", storedCj);

      // Reconstruction robuste (items peut être undefined)
      const itemsArray = purchaseUnit.items || [];
      cart = itemsArray.map((ppItem, index) => {
        const cjParts = storedCj[index] ? storedCj[index].split(':') : ['', ''];
        return {
          title: ppItem?.name || `Product ${index + 1}`,
          price: parseFloat(ppItem?.unit_amount?.value || 0),
          quantity: parseInt(ppItem?.quantity || 1),
          cj_product_id: cjParts[0] || null,
          cj_variant_id: cjParts[1] || null
        };
      });

      // Fallback si PayPal ne renvoie pas les items
      if (cart.length === 0 && storedCj.length > 0) {
        console.log("⚠️ No items in response → reconstructing from custom_id");
        cart = storedCj.map((cjStr, index) => {
          const [productId, variantId] = cjStr.split(':');
          return { title: `Product ${index+1}`, price: 0, quantity: 1, cj_product_id: productId || null, cj_variant_id: variantId || null };
        });
      }

      const shippingDetails = purchaseUnit.shipping || {};
      const payer = orderData.payer || {};
      shipping = {
        fullName: shippingDetails.name?.full_name || `${payer.name?.given_name || ''} ${payer.name?.surname || ''}`.trim() || "Customer",
        email: payer.email_address || "",
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

    if (!paymentVerified || cart.length === 0) throw new Error("Payment verification failed or cart empty");

    console.log(`✅ Payment OK - ${cart.length} item(s) to process`);

    // ====================== FULFILLMENT (inchangé) ======================
    let fulfilled = 0;
    let pending = 0;

    for (const item of cart) {
      try {
        if (!item.cj_variant_id) {
          await saveAsPending(item, shipping);
          pending++;
          continue;
        }

        const stockRes = await fetch(`/.netlify/functions/check-cj-stock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cj_variant_id: item.cj_variant_id })
        });
        const stockData = await stockRes.json();

        if (stockData.success && stockData.inStock) {
          const cjRes = await fetch(`/.netlify/functions/create-cj-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cart: [item], shipping })
          });
          const cjData = await cjRes.json();
          if (cjRes.ok && cjData.success) fulfilled++;
          else pending++;
        } else {
          await saveAsPending(item, shipping);
          pending++;
        }
      } catch (e) {
        console.error("Item error:", e.message);
        await saveAsPending(item, shipping);
        pending++;
      }
    }

    return response(200, {
      success: true,
      paymentVerified: true,
      fulfillmentStatus: pending > 0 ? "pending_stock" : "completed"
    });

  } catch (error) {
    console.error("=== VERIFY PAYMENT ERROR ===", error.message);
    return response(500, { success: false, error: error.message });
  }
};

async function saveAsPending(item, shipping) {
  await fetch(`/.netlify/functions/save-pending-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shipping, item, payment_provider: "auto", payment_id: "verified" })
  });
}

function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}