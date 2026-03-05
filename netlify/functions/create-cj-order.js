const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    if (!event.body) return response(400, { success: false, error: "No data" });

    if (!process.env.CJ_ACCESS_TOKEN) throw new Error("Missing CJ_ACCESS_TOKEN");

    const { cart, shipping } = JSON.parse(event.body);

    if (!Array.isArray(cart) || cart.length === 0) throw new Error("Invalid cart");
    if (!shipping || !shipping.fullName || !shipping.address) throw new Error("Invalid shipping");

    // Validation
    for (const item of cart) {
      if (!item.cj_variant_id) throw new Error(`Missing cj_variant_id for ${item.title}`);
    }

    const orderBody = {
      orderNumber: `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      shippingCountryCode: shipping.country || "US",
      shippingCountry: shipping.country || "US",           // ← si erreur "param error", remplace par le nom complet (ex: "United States")
      shippingProvince: shipping.state || "",
      shippingCity: shipping.city || "",
      shippingCounty: "",
      shippingPhone: shipping.phone || "",
      shippingCustomerName: shipping.fullName,
      shippingAddress: shipping.address,
      shippingAddress2: "",
      email: shipping.email || "",
      logisticName: "CJPacket",                            // ← change si besoin (ex: "ePacket", "USPS+", "CJPacket Sensitive")
      fromCountryCode: "CN",
      products: cart.map(item => ({
        vid: item.cj_variant_id,
        quantity: parseInt(item.quantity)
      })),
      shopLogisticsType: 2,   // 2 = Seller Logistics (plus simple, pas besoin de storageId)
      platform: "Api"
    };

    const cjResponse = await fetch(
      "https://api.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2",
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

    if (!cjResponse.ok || data.code !== 200 || !data.result) {
      throw new Error(data.message || "CJ order creation failed");
    }

    return response(200, {
      success: true,
      cjOrderId: data.data?.orderId || null
    });
  } catch (error) {
    console.error("CJ CREATE ORDER ERROR:", error.message);
    return response(500, { success: false, error: "CJ order creation failed" });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}