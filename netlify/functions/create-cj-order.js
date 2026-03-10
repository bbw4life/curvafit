// create-cj-order.js
const fetch = require("node-fetch");

// === CACHE GLOBAL DU TOKEN ===
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;
  if (!process.env.CJ_API_KEY) throw new Error("Missing CJ_API_KEY");
  const tokenRes = await fetch("https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: process.env.CJ_API_KEY })
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || tokenData.code !== 200) throw new Error(tokenData.message || "Failed to get CJ access token");
  cachedToken = tokenData.data.accessToken;
  tokenExpiry = now + 1000 * 60 * 110;
  return cachedToken;
}

exports.handler = async (event) => {
  console.log("[CJ ORDER] Function invoked");
  try {
    if (!event.body) throw new Error("No data received");
    const { cart, shipping } = JSON.parse(event.body);
    if (!Array.isArray(cart) || cart.length === 0) throw new Error("Invalid cart data");

    const accessToken = await getAccessToken();
    const orderNumber = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const products = cart.map(item => ({
      vid: item.cj_variant_id || '',
      quantity: parseInt(item.quantity) || 1
    }));

    // === NETTOYAGE TÉLÉPHONE ULTRA-AGRESSIF ===
    let rawPhone = (shipping.phone || "").toString().trim();
    let phone = rawPhone
      .replace(/[\s\n\r\t\-\(\)\.\,\\\/]+/g, '')
      .replace(/^00/, '+');

    console.log(`[CJ PHONE DEBUG] Raw: "${rawPhone}" → Cleaned: "${phone}"`);

    if (!phone || phone.length < 8) {
      console.warn("[CJ PHONE] Numéro invalide ou manquant → fallback");
      phone = "0000000000";
    }

    const orderBody = {
      orderNumber: orderNumber,
      shippingCountryCode: shipping.countryCode || 'US',
      shippingCountry: shipping.country || 'United States',
      shippingProvince: shipping.state || '',
      shippingCity: shipping.city || '',
      shippingCustomerName: shipping.fullName || '',
      shippingAddress: shipping.address || '',
      email: shipping.email || '',
      logisticName: "CJPacket",
      fromCountryCode: "CN",
      products: products,
      payType: 2,
      shippingZip: shipping.postalCode || '',
      shippingPhone: phone
    };

    console.log("SENDING TO CJ:", orderBody);

    const cjResponse = await fetch("https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2", {
      method: "POST",
      headers: { "CJ-Access-Token": accessToken, "Content-Type": "application/json" },
      body: JSON.stringify(orderBody)
    });

    const responseText = await cjResponse.text();
    let data;
    try { data = JSON.parse(responseText); } catch { data = {}; }

    if (cjResponse.ok && data.code === 200) {
      const cjResult = data.data?.[0] || {};
      return response(200, { success: true, cjOrderId: cjResult.orderId || '', message: "Order sent to CJ successfully" });
    } else {
      const errorMsg = data.message || responseText.trim() || "CJ order creation failed";
      return response(200, { success: false, error: errorMsg, code: data.code || cjResponse.status });
    }
  } catch (error) {
    console.error("[CJ ORDER ERROR]", error.message);
    return response(500, { success: false, error: error.message });
  }
};

function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}