// create-cj-order.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  console.log('[CJ ORDER] Function invoked with event:', event); // Added entry log

  try {
    if (!event.body) {
      console.log('[CJ ORDER] No body in event');
      return response(400, { success: false, error: "No data received" });
    }

    if (!process.env.CJ_ACCESS_TOKEN) {
      console.log('[CJ ORDER] Missing CJ_ACCESS_TOKEN env var');
      throw new Error("Missing CJ_ACCESS_TOKEN");
    }

    const { cart, shipping } = JSON.parse(event.body);
    if (!Array.isArray(cart) || cart.length === 0) {
      console.log('[CJ ORDER] Invalid cart:', cart);
      throw new Error("Invalid cart data");
    }

    if (!shipping || !shipping.fullName || !shipping.address) {
      console.log('[CJ ORDER] Invalid shipping:', shipping);
      throw new Error("Invalid shipping data");
    }

    // Generate a unique orderId (client-side generated, must be unique)
    const orderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // Correct body structure for batchCreateOrder (expects array of orders)
    const orderBody = [{
      orderId: orderId, // Unique order ID
      products: cart.map(item => ({
        productId: item.cj_product_id,
        variantId: item.cj_variant_id,
        quantity: parseInt(item.quantity)
      })),
      shippingInfo: {
        countryCode: shipping.country || "US",
        province: shipping.state || "",
        city: shipping.city || "",
        address: shipping.address,
        zip: shipping.postalCode || "",
        phone: shipping.phone || "",
        name: shipping.fullName,
        email: shipping.email || ""
      }
    }];

    console.log('[CJ ORDER] Sending body:', JSON.stringify(orderBody));

    const cjResponse = await fetch(
      "https://developers.cjdropshipping.com/api2.0/v1/shopping/order/batchCreateOrder",
      {
        method: "POST",
        headers: {
          "CJ-Access-Token": process.env.CJ_ACCESS_TOKEN,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderBody)
      }
    );

    console.log(`[CJ ORDER] API response status: ${cjResponse.status}`);

    const data = await cjResponse.json();
    console.log('[CJ ORDER] API response data:', data);

    if (!cjResponse.ok || data.code !== 200) {
      console.error('[CJ ORDER] API error:', data);
      throw new Error(data.message || "CJ order creation failed");
    }

    // For batch, data.data is an array; assume single order, take first
    const cjOrderId = data.data?.[0]?.orderId || null;

    return response(200, {
      success: true,
      cjOrderId: cjOrderId
    });

  } catch (error) {
    console.error("CJ CREATE ORDER ERROR:", error.message, error.stack);
    return response(500, {
      success: false,
      error: "CJ order creation failed"
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