// create-cj-order.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  console.log('[CJ ORDER] Function invoked with event:', event);

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

    const orderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const singleOrder = {
      orderId: orderId,
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
    };

    const orderBody = { orders: [singleOrder] };

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

    const responseText = await cjResponse.text();
    console.log(`[CJ ORDER] Raw response (first 400 chars): ${responseText.substring(0, 400)}`);

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('[CJ ORDER] Parsed data:', data);
    } catch (e) {
      console.error("[CJ ORDER] JSON parse error:", e.message);
      throw new Error(`CJ API returned invalid JSON (status ${cjResponse.status}): ${responseText.substring(0, 200)}`);
    }

    if (!cjResponse.ok || data.code !== 200) {
      console.error('[CJ ORDER] API error:', data);
      throw new Error(data.message || "CJ order creation failed");
    }

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