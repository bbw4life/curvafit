// verify-payment.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');

exports.handler = async (event) => {
  console.log("🚀 VERIFY-PAYMENT STARTED with body:", event.body);

  try {
    if (!event.body) {
      return response(400, { success: false, error: "No data" });
    }

    const { provider, sessionId, orderID } = JSON.parse(event.body);
    let cart = [];
    let shipping = {};
    let paymentVerified = false;
    const paymentId = sessionId || orderID;

    console.log("📋 Provider:", provider, "Payment ID:", paymentId);

    /* =========================
       STRIPE
    ==========================*/
    if (provider === "stripe") {
      if (!sessionId) throw new Error("Missing Stripe sessionId");
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log("✅ Stripe session retrieved:", session.payment_status);
      if (session.payment_status !== "paid") {
        throw new Error("Stripe payment not completed");
      }
      if (!session.metadata?.cart) {
        throw new Error("Missing Stripe metadata");
      }
      cart = JSON.parse(session.metadata.cart);
      shipping = JSON.parse(session.metadata.shipping || "{}");
      paymentVerified = true;
    }
    /* =========================
       PAYPAL
    ==========================*/
    else if (provider === "paypal") {
      if (!orderID) throw new Error("Missing PayPal orderID");
      const PAYPAL_BASE =
        process.env.PAYPAL_ENV === "live"
          ? "https://api-m.paypal.com"
          : "https://api-m.sandbox.paypal.com";
      const auth = Buffer
        .from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`)
        .toString("base64");
      const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
      });
      const { access_token } = await tokenRes.json();
      const captureRes = await fetch(
        `${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json"
          }
        }
      );
      const orderData = await captureRes.json();
      console.log("✅ PayPal captured:", orderData.status);
      if (orderData.status !== "COMPLETED") {
        throw new Error("PayPal payment not completed");
      }
      const purchaseUnit = orderData.purchase_units[0];
      // ====================== RECONSTRUCT CJ DATA FROM COMPACT CUSTOM_ID ======================
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
      const payer = orderData.payer;
      shipping = {
        fullName:
          shippingDetails.name?.full_name ||
          `${payer.name.given_name} ${payer.name.surname}`,
        email: payer.email_address,
        address: shippingDetails.address?.address_line_1 || "",
        city: shippingDetails.address?.admin_area_2 || "",
        state: shippingDetails.address?.admin_area_1 || "",
        postalCode: shippingDetails.address?.postal_code || "",
        country: shippingDetails.address?.country_code || ""
      };
      paymentVerified = true;
    }
    else {
      throw new Error("Invalid provider");
    }

    if (!paymentVerified) {
      return response(400, { success: false, paymentVerified: false });
    }

    console.log("✅ Payment verified! Cart items:", cart.length);

    /* =========================
       FULFILLMENT LOGIC
    ==========================*/
    let allFulfilled = true;
    for (const item of cart) {
      try {
        console.log(`🔍 Processing item: ${item.title} (CJ: ${item.cj_product_id}:${item.cj_variant_id})`);

        if (!item.cj_variant_id) {
          console.warn("⚠️ No CJ variant ID, skipping to pending");
          allFulfilled = false;
          continue;
        }

        const stockResponse = await fetch(`${process.env.BASE_URL}/.netlify/functions/check-cj-stock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cj_variant_id: item.cj_variant_id
          })
        });
        const stockData = await stockResponse.json();
        console.log("📦 Stock for item:", stockData);

        if (stockData.inStock) {
          const createResponse = await fetch(`${process.env.BASE_URL}/.netlify/functions/create-cj-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cart: [item], shipping })
          });
          const createData = await createResponse.json();
          console.log("🛒 CJ Order created:", createData);
          if (!createData.success) throw new Error("CJ create failed");
        } else {
          const pendingResponse = await fetch(`${process.env.BASE_URL}/.netlify/functions/save-pending-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              item,
              shipping,
              payment_provider: provider,
              payment_id: paymentId
            })
          });
          const pendingData = await pendingResponse.json();
          console.log("⏳ Saved to pending:", pendingData);
          if (!pendingData.success) throw new Error("Save pending failed");
          allFulfilled = false;
        }
      } catch (itemError) {
        console.error(`❌ Error for item ${item.title}:`, itemError.message);
        allFulfilled = false;
      }
    }

    console.log("✅ Fulfillment done! Status:", allFulfilled ? "completed" : "pending_stock");

    return response(200, {
      success: true,
      paymentVerified: true,
      fulfillmentStatus: allFulfilled ? "completed" : "pending_stock"
    });
  } catch (error) {
    console.error("❌ VERIFY ERROR:", error.message);
    return response(500, {
      success: false,
      error: "Payment verification failed"
    });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}