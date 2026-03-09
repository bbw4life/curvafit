// create-cj-order.js
const fetch = require("node-fetch");
const { google } = require('googleapis');

// Map pour country name fallback
const countryMap = {
  'US': 'United States',
  'CA': 'Canada',
  'DO': 'Dominican Republic',
  'BO': 'Bolivia',
  // Ajoute d'autres si besoin
};

// Fonction pour obtenir le token depuis Google Sheet
async function getAccessTokenFromSheet() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const now = Date.now();

  let token;
  let expiry;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Config!A1:A2'
    });
    const values = res.data.values || [];
    token = values[0] ? values[0][0] : null;
    expiry = values[1] ? parseInt(values[1][0]) : 0;
  } catch (e) {
    console.log("[CJ AUTH] Pas de Config sheet ou erreur lecture:", e.message);
  }

  if (token && now < expiry) {
    console.log("[CJ AUTH] ✅ Token en cache (sheet) utilisé");
    return token;
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
    throw new Error(tokenData.message || "Failed to get CJ access token");
  }
  const newToken = tokenData.data.accessToken;
  const newExpiry = now + 1000 * 60 * 110; // 110 minutes

  // Sauvegarder dans sheet, mais skip si erreur (fallback to no save)
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Config!A1:A2',
      valueInputOption: "RAW",
      resource: { values: [[newToken], [newExpiry]] }
    });
    console.log("[CJ AUTH] ✅ Nouveau token sauvé dans sheet");
  } catch (e) {
    console.error("[CJ AUTH] Erreur sauvegarde token dans sheet (skip):", e.message);
  }

  return newToken;
}

exports.handler = async (event) => {
  console.log("[CJ ORDER] Function invoked");
  try {
    if (!event.body) throw new Error("No data received");
    const { cart, shipping } = JSON.parse(event.body);
    console.log("[CJ ORDER] Cart received:", cart);
    console.log("[CJ ORDER] Shipping received:", shipping);
    if (!Array.isArray(cart) || cart.length === 0) throw new Error("Invalid cart data");

    // Validation des données d'expédition
    if (!shipping.countryCode || shipping.countryCode.length !== 2) {
      throw new Error("Invalid country code: must be ISO2 (e.g., 'US')");
    }
    if (!shipping.fullName || !shipping.address || !shipping.city || !shipping.state) {
      throw new Error("Missing required shipping fields: fullName, address, city, state");
    }

    const accessToken = await getAccessTokenFromSheet();
    const orderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const products = cart.map(item => ({
      vid: item.cj_variant_id,
      quantity: parseInt(item.quantity)
    }));
    const singleOrder = {
      orderNumber: orderId,
      products: products,
      shippingInfo: {
        shippingCountryCode: shipping.countryCode || "US",
        shippingCountry: shipping.countryName || countryMap[shipping.countryCode] || shipping.countryCode,
        shippingProvince: shipping.state || "",
        shippingCity: shipping.city || "",
        shippingAddress: shipping.address || "",
        shippingZip: shipping.postalCode || "",
        shippingPhone: shipping.phone || "",
        shippingCustomerName: shipping.fullName || "",
        shippingEmail: shipping.email || "",
        shippingAddress2: "",
        shippingCounty: ""
      }
    };
    const orderBody = { orders: [singleOrder] };
    const cjResponse = await fetch(
      "https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrder",
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
    console.log(`[CJ RESPONSE] Status HTTP: ${cjResponse.status}`);
    console.log(`[CJ RESPONSE] Body brut: ${responseText}`);
    let data;
    try { data = JSON.parse(responseText); } catch { data = {}; }
    if (data.code) console.log(`[CJ RESPONSE] Code d'erreur: ${data.code}`);
    if (data.message) console.log(`[CJ RESPONSE] Message d'erreur: ${data.message}`);
    if (cjResponse.ok && data.code === 200) {
      const cjResult = data.data?.[0];
      console.log(`[CJ ORDER] 🎉 SUCCÈS - CJ Order ID: ${cjResult.orderId}`);
      return response(200, { success: true, cjOrderId: cjResult.orderId });
    }
    const isRateLimit = data.code === 1600200 || data.code === 1600201 || (data.message && (data.message.includes("Too much") || data.message.includes("Quota") || data.message.includes("Many Requests"))) || cjResponse.status === 429;
    return response(200, { success: false, error: data.message || "CJ order creation failed", code: data.code, isRateLimit });
  } catch (error) {
    console.error("[CJ ORDER ERROR]", error.message);
    return response(500, { success: false, error: error.message });
  }
};
function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}