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
    const sign = crypto.createHash('md5').update(apiKey + timestamp + apiSecret).digest('hex');

    // Logs pour debug auth
    console.log("[EPROLO] apiKey:", apiKey ? 'Set' : 'Missing!');
    console.log("[EPROLO] apiSecret:", apiSecret ? 'Set' : 'Missing!');
    console.log("[EPROLO] Timestamp:", timestamp);
    console.log("[EPROLO] Sign:", sign);

    const uniqueOrderId = `ORDER_${timestamp}_${Math.floor(Math.random() * 10000)}`;
    const orderBody = {
      tax_cost: 0.0,  // REQUIS : Mets à 0.0 ou calcule si taxes
      order_id: uniqueOrderId,
      order_number: uniqueOrderId,
      note: "website order",
      shipping_name: shipping.fullName || `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim(),
      shipping_last_name: shipping.lastName || '',  // Optionnel, mais ajouté
      shipping_phone: shipping.phone || "0000000000",
      shipping_company: "",  // Optionnel
      shipping_country: shipping.country || 'United States',
      shipping_country_code: shipping.countryCode || 'US',
      shipping_address: shipping.address || '',
      shipping_address2: "",
      shipping_city: shipping.city || '',
      shipping_province: shipping.state || shipping.city || '',  // Si pas de province, use city comme doc
      shipping_province_code: shipping.provinceCode || '',
      shipping_post_code: shipping.postalCode || '',  // RENOMMÉ de shipping_zip
      email: shipping.email || '',  // Optionnel, ajouté
      logistics_id: 10,
      orderItemlist: cart.map(item => ({
        variantsid: item.variantsid || '',
        quantity: parseInt(item.quantity) || 1
      }))
    };
    console.log("[EPROLO] Body sent:", JSON.stringify(orderBody));

    // Auth : apiKey en headers, sign/timestamp en query
    const url = `https://openapi.eprolo.com/add_order.html?sign=${sign}&timestamp=${timestamp.toString()}`;
    const eproloResponse = await fetch(url, {
      method: "POST",
      headers: {
        "apiKey": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(orderBody)
    });
    const responseText = await eproloResponse.text();
    console.log("[EPROLO] Response status:", eproloResponse.status);
    console.log("[EPROLO] Response text:", responseText);  // Log full response pour debug

    let data;
    try { data = JSON.parse(responseText); } catch { data = {}; }
    if (eproloResponse.ok && data.code === 0) {
      console.log("[EPROLO] Success:", data.msg);
      return response(200, { success: true, message: data.msg || "Order sent to Eprolo successfully" });
    } else {
      const errorMsg = data.msg || responseText.trim() || "Eprolo order creation failed";
      console.error("[EPROLO] Error:", errorMsg);
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