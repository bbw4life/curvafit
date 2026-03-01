const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    if (!event.body) {
      return response(400, { success: false, error: "No data" });
    }

    const { provider, sessionId, orderID } = JSON.parse(event.body);

    let cart = [];
    let shipping = {};
    let paymentVerified = false;

    /* =========================
       STRIPE
    ==========================*/
    if (provider === "stripe") {

      if (!sessionId) throw new Error("Missing Stripe sessionId");

      const session = await stripe.checkout.sessions.retrieve(sessionId);

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

      if (orderData.status !== "COMPLETED") {
        throw new Error("PayPal payment not completed");
      }

      const purchaseUnit = orderData.purchase_units[0];

      cart = purchaseUnit.items.map(item => ({
        title: item.name,
        price: parseFloat(item.unit_amount.value),
        quantity: parseInt(item.quantity),
        cj_product_id: item.cj_product_id || null,
        cj_variant_id: item.cj_variant_id || null
      }));

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

    /* =========================
       FULFILLMENT LOGIC
    ==========================*/

    let allFulfilled = true;

    for (const item of cart) {

      const stockResponse = await fetch(`${process.env.BASE_URL}/.netlify/functions/check-cj-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cj_product_id: item.cj_product_id,
          cj_variant_id: item.cj_variant_id
        })
      });

      const stockData = await stockResponse.json();

      if (stockData.inStock) {

        await fetch(`${process.env.BASE_URL}/.netlify/functions/create-cj-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item, shipping })
        });

      } else {

        await fetch(`${process.env.BASE_URL}/.netlify/functions/save-pending-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item, shipping })
        });

        allFulfilled = false;
      }
    }

    return response(200, {
      success: true,
      paymentVerified: true,
      fulfillmentStatus: allFulfilled ? "completed" : "pending_stock"
    });

  } catch (error) {
    console.error("VERIFY PAYMENT ERROR:", error.message);
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