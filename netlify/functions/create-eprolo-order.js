// create-eprolo-order.js
const fetch = require("node-fetch");
const crypto = require('crypto');

exports.handler = async (event) => {
  console.log("[EPROLO ORDER] Function invoked");
  try {
    if (!event.body) throw new Error("No data received");
    const { cart, shipping } = JSON.parse(event.body);
    if (!Array.isArray(cart) || cart.length === 0) throw new Error("Invalid cart data");
    const apiKey = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;
    if (!apiKey || !apiSecret) throw new Error("Missing EPROLO credentials");
    const timestamp = Date.now().toString();
    const sign = crypto.createHash('md5').update(apiKey + timestamp + apiSecret).digest('hex');
    const orderNumber = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const orderItemlist = cart.map(item => ({
      variantsid: item.variantsid || '',
      quantity: parseInt(item.quantity) || 1
    }));
    // === CORRECTION : récupération nom + code ISO sans casser le reste ===
    const countryCode = shipping.countryCode || 'US';
    const countryName = shipping.country || 'United States';
    const fullName = shipping.fullName || '';
    let phone = shipping.phone || "0000000000";
    const address = shipping.address || '';
    const city = shipping.city || '';
    const state = shipping.state || '';
    const postalCode = shipping.postalCode || '';
    // US state code map
    const usStates = {
      'Alabama': 'AL', 'Alaska': 'AK', 'American Samoa': 'AS', 'Arizona': 'AZ', 'Arkansas': 'AR',
      'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'District of Columbia': 'DC',
      'Florida': 'FL', 'Georgia': 'GA', 'Guam': 'GU', 'Hawaii': 'HI', 'Idaho': 'ID',
      'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY',
      'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI',
      'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE',
      'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
      'North Carolina': 'NC', 'North Dakota': 'ND', 'Northern Mariana Islands': 'MP', 'Ohio': 'OH', 'Oklahoma': 'OK',
      'Oregon': 'OR', 'Palau': 'PW', 'Pennsylvania': 'PA', 'Puerto Rico': 'PR', 'Rhode Island': 'RI',
      'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Trust Territories': 'TT',
      'Utah': 'UT', 'Vermont': 'VT', 'Virgin Islands': 'VI', 'Virginia': 'VA', 'Washington': 'WA',
      'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
    };
    let provinceCode = '';
    if (countryCode === 'US') {
      const normalizedState = state.charAt(0).toUpperCase() + state.slice(1).toLowerCase();
      provinceCode = usStates[normalizedState] || '';
    }
    const orderBody = {
      order_id: orderNumber,
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
      shipping_province_code: provinceCode,
      shipping_zip: postalCode,
      logistics_id: 10,
      orderItemlist: orderItemlist
    };
    console.log("SENDING TO EPROLO:", orderBody);
    const eproloResponse = await fetch("https://openapi.eprolo.com/add_order.html", {
      method: "POST",
      headers: {
        "apiKey": apiKey,
        "timestamp": timestamp,
        "sign": sign,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(orderBody)
    });
    const responseText = await eproloResponse.text();
    let data;
    try { data = JSON.parse(responseText); } catch { data = {}; }
    if (eproloResponse.ok && data.code === 0 && data.msg === "order created successfully") {
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