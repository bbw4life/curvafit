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
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = crypto.createHash('md5').update(apiKey + timestamp.toString() + apiSecret).digest('hex');
    const headers = {
      'apiKey': apiKey,
      'timestamp': timestamp.toString(),
      'sign': sign,
      'Content-Type': 'application/json'
    };
    const orderId = `EPROLO_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const orderNumber = orderId; // Can be adjusted if needed
    const orderItemlist = cart.map(item => ({
      variantsid: item.eprolo_variant_id || '',
      quantity: parseInt(item.quantity) || 1
    }));
    const countryCode = shipping.countryCode || 'US';
    const countryName = shipping.country || 'United States';
    const fullName = shipping.fullName || '';
    const email = shipping.email || '';
    let phone = shipping.phone || "0000000000";
    const address = shipping.address || '';
    const city = shipping.city || '';
    const state = shipping.state || '';
    const postalCode = shipping.postalCode || '';
    const orderBody = {
      order_id: orderId,
      order_number: orderNumber,
      note: "website order",
      shipping_name: fullName,
      shipping_phone: phone,
      shipping_country: countryName,
      shipping_country_code: countryCode,
      shipping_address: address,
      shipping_address2: "",
      shipping_city: city,
      shipping_province: state,
      shipping_province_code: shipping.province_code || state,
      shipping_zip: postalCode,
      logistics_id: 10,
      orderItemlist: orderItemlist
    };
    console.log("SENDING TO EPROLO:", orderBody);
    const eproloResponse = await fetch("https://openapi.eprolo.com/add_order.html", {
      method: "POST",
      headers: headers,
      body: JSON.stringify(orderBody)
    });
    const responseText = await eproloResponse.text();
    let data;
    try { data = JSON.parse(responseText); } catch { data = {}; }
    if (eproloResponse.ok && data.code === 0) {
      return response(200, { success: true, message: "Order sent to EPROLO successfully" });
    } else {
      const errorMsg = data.msg || responseText.trim() || "EPROLO order creation failed";
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