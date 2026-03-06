const fetch = require('node-fetch');
exports.handler = async (event) => {
  try {
    if (!event.body) {
      return response(400, { success: false, error: "No data received" });
    }
    if (!process.env.CJ_ACCESS_TOKEN) {
      throw new Error("Missing CJ_ACCESS_TOKEN");
    }
    const { cart, shipping } = JSON.parse(event.body);
    if (!Array.isArray(cart) || cart.length === 0) {
      throw new Error("Invalid cart data");
    }
    if (!shipping || !shipping.fullName || !shipping.address) {
      throw new Error("Invalid shipping data");
    }
    const orderBody = {
      orders: [{
        orderId: `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
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
      }]
    };
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
    const data = await cjResponse.json();
    if (!cjResponse.ok || data.code !== 200) {
      throw new Error(data.message || "CJ order creation failed");
    }
    return response(200, {
      success: true,
      cjOrderId: data.data?.orderId || null
    });
  } catch (error) {
    console.error("CJ CREATE ORDER ERROR:", error.message);
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