// create-eprolo-order.js
const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  console.log("[EPROLO ORDER] Function invoked");
  try {
    if (!event.body) throw new Error("No data received");
    const { cart, shipping } = JSON.parse(event.body);
    if (!Array.isArray(cart) || cart.length === 0) throw new Error("Invalid cart data");
    const apiKey = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;
    const timestamp = Date.now();
    const sign = crypto.createHash('md5').update(apiKey + apiSecret + timestamp).digest('hex');
    const uniqueOrderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const orderNumber = uniqueOrderId;
    const orderBody = {
      order_id: uniqueOrderId,
      order_number: orderNumber,
      note: "website order",
      shipping_name: shipping.fullName || '',
      shipping_phone: shipping.phone || "0000000000",
      shipping_country: shipping.country || 'United States',
      shipping_country_code: shipping.countryCode || 'US',
      shipping_address: shipping.address || '',
      shipping_address2: "",
      shipping_city: shipping.city || '',
      shipping_province: shipping.state || '',
      shipping_province_code: shipping.provinceCode || '',
      shipping_zip: shipping.postalCode || '',
      logistics_id: 10,
      orderItemlist: cart.map(item => ({
        variantsid: item.variantsid || '',
        quantity: parseInt(item.quantity) || 1
      }))
    };
    console.log("SENDING TO EPROLO:", orderBody);
    const eproloResponse = await fetch("https://openapi.eprolo.com/add_order.html", {
      method: "POST",
      headers: {
        "apiKey": apiKey,
        "timestamp": timestamp.toString(),
        "sign": sign,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(orderBody)
    });
    const responseText = await eproloResponse.text();
    let data;
    try { data = JSON.parse(responseText); } catch { data = {}; }
    if (eproloResponse.ok && data.code === 0) {
      return response(200, { success: true, message: data.msg || "Order sent to Eprolo successfully" });
    } else {
      const errorMsg = data.msg || responseText.trim() || "Eprolo order creation failed";
      return response(200, { success: false, error: errorMsg, code: data.code || eproloResponse.status });
    }
  } catch (error) {
    console.error("[EPROLO ORDER ERROR]", error.message);
    return response(500, { success: false, error: error.message });
  }
};
function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}