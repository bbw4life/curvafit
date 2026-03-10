// create-cj-order.js
const fetch = require("node-fetch");
// === CACHE GLOBAL DU TOKEN (dure ~2 heures) ===
let cachedToken = null;
let tokenExpiry = 0;
async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    console.log("[CJ AUTH] ✅ Token en cache utilisé");
    return cachedToken;
  }
  console.log("[CJ AUTH] 🔄 Demande nouveau token...");
  if (!process.env.CJ_API_KEY) throw new Error("Missing CJ_API_KEY");
  const tokenRes = await fetch(
    "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: process.env.CJ_API_KEY })
    }
  );
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || tokenData.code !== 200) {
    console.error(`[CJ AUTH ERROR] Code: ${tokenData.code} | Message: ${tokenData.message}`);
    throw new Error(tokenData.message || "Failed to get CJ access token");
  }
  cachedToken = tokenData.data.accessToken;
  tokenExpiry = now + 1000 * 60 * 110; // 110 minutes
  console.log("[CJ AUTH] ✅ Nouveau token mis en cache");
  return cachedToken;
}
exports.handler = async (event) => {
  console.log("[CJ ORDER] Function invoked");
  try {
    if (!event.body) throw new Error("No data received");
    const { cart, shipping } = JSON.parse(event.body);
    console.log("[CJ ORDER] Cart received:", JSON.stringify(cart));
    console.log("[CJ ORDER] Shipping received:", JSON.stringify(shipping));
    if (!Array.isArray(cart) || cart.length === 0) throw new Error("Invalid cart data");
    const accessToken = await getAccessToken();
    const orderNumber = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const products = cart.map(item => ({
      vid: item.cj_variant_id || '',
      quantity: parseInt(item.quantity) || 1
    }));
    // Extract shipping data
    const fullName = shipping.fullName || '';
    const email = shipping.email || '';
    let phone = shipping.phone || "0000000000"; // Fallback if empty
    console.log("PHONE RECEIVED:", phone);
    const address = shipping.address || '';
    const city = shipping.city || '';
    const state = shipping.state || '';
    const postalCode = shipping.postalCode || '';
    const countryCode = shipping.countryCode || 'US';
    const countryName = shipping.country || 'Unknown Country';
    // Transform to CJ format (flat fields)
    const orderBody = {
      orderNumber: orderNumber,
      shippingCountryCode: countryCode,
      shippingCountry: countryName,
      shippingProvince: state,
      shippingCity: city,
      shippingCustomerName: fullName,
      shippingAddress: address,
      email: email,
      logisticName: "CJPacket", // Hardcoded as per example
      fromCountryCode: "CN",
      products: products,
      payType: 2, // Balance payment
      shippingZip: postalCode,
      shippingPhone: phone
    };
    console.log("SENDING TO CJ:", orderBody);
    const cjResponse = await fetch(
      "https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2",
      {
        method: "POST",
        headers: {
          "CJ-Access-Token": accessToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderBody)
      }
    );
    const responseText = await cjResponse.text();
    console.log(`[CJ RESPONSE] HTTP Status: ${cjResponse.status}`);
    console.log(`[CJ RESPONSE] Raw Body: ${responseText}`);
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = {};
    }
    if (data.code) console.log(`[CJ RESPONSE] Error Code: ${data.code}`);
    if (data.message) console.log(`[CJ RESPONSE] Error Message: ${data.message}`);
    if (cjResponse.ok && data.code === 200) {
      const cjResult = data.data?.[0] || {};
      console.log(`[CJ ORDER] 🎉 SUCCESS - CJ Order ID: ${cjResult.orderId}`);
      return response(200, {
        success: true,
        cjOrderId: cjResult.orderId || '',
        message: "Order sent to CJ successfully"
      });
    } else {
      const errorMsg = data.message || responseText.trim() || "CJ order creation failed";
      const errorCode = data.code || cjResponse.status;
      console.log(`[CJ ORDER] ❌ FAILURE - Code: ${errorCode} | Error: ${errorMsg}`);
      return response(200, {
        success: false,
        error: errorMsg,
        details: responseText,
        code: errorCode
      });
    }
  } catch (error) {
    console.error("[CJ ORDER ERROR]", error.message);
    return response(500, {
      success: false,
      error: error.message,
      details: error.stack || ''
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