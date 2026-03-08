// create-cj-order.js
const fetch = require("node-fetch");

// ===== CACHE TOKEN (≈2h) =====
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();

  if (cachedToken && now < tokenExpiry) {
    console.log("[CJ AUTH] ✅ Token en cache utilisé");
    return cachedToken;
  }

  console.log("[CJ AUTH] 🔄 Demande nouveau token...");

  if (!process.env.CJ_API_KEY) {
    throw new Error("Missing CJ_API_KEY");
  }

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

  cachedToken = tokenData.data.accessToken;

  // token ≈ 120 minutes
  tokenExpiry = now + 1000 * 60 * 110;

  console.log("[CJ AUTH] ✅ Nouveau token mis en cache");

  return cachedToken;
}

// ===== NETLIFY FUNCTION =====
exports.handler = async (event) => {

  console.log("[CJ ORDER] Function invoked");

  try {

    if (!event.body) {
      throw new Error("No data received");
    }

    const { cart, shipping } = JSON.parse(event.body);

    console.log("[CJ ORDER] Cart received:", cart);
    console.log("[CJ ORDER] Shipping received:", shipping);

    if (!Array.isArray(cart) || cart.length === 0) {
      throw new Error("Invalid cart data");
    }

    const accessToken = await getAccessToken();

    const orderNumber = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // ===== FORMAT PRODUITS CJ =====
    const products = cart.map(item => ({
      vid: item.cj_variant_id,
      quantity: parseInt(item.quantity)
    }));

    // ===== ORDER BODY =====
    const orderBody = {
      orderNumber: orderNumber,
      products: products,
      shippingInfo: {
        name: shipping.fullName || "",
        email: shipping.email || "",
        phone: shipping.phone || "",
        countryCode: shipping.country || "US",
        province: shipping.state || "",
        city: shipping.city || "",
        address: shipping.address || "",
        zip: shipping.postalCode || ""
      }
    };

    console.log("[CJ ORDER] Payload envoyé:", orderBody);

    // ===== RETRY RATE LIMIT =====
    let attempt = 0;
    const maxAttempts = 3;
    const retryDelay = 60000;

    while (attempt < maxAttempts) {

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

      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        data = {};
      }

      console.log(
        `[CJ ORDER] API Response: status=${cjResponse.status}, code=${data.code || "N/A"}, message="${data.message || "No message"}"`
      );

      // ===== SUCCESS =====
      if (cjResponse.ok && data.code === 200) {

        const cjOrderId = data.data?.orderId || null;

        console.log("[CJ ORDER] 🎉 SUCCÈS CJ Order ID:", cjOrderId);

        return response(200, {
          success: true,
          cjOrderId
        });
      }

      // ===== RATE LIMIT =====
      const isRateLimit =
        data.code === 1600200 ||
        data.code === 1600201 ||
        cjResponse.status === 429 ||
        (data.message &&
          (data.message.includes("Too much") ||
           data.message.includes("Quota") ||
           data.message.includes("Many Requests")));

      if (isRateLimit) {

        attempt++;

        if (attempt < maxAttempts) {

          console.log(
            `[CJ ORDER] Rate limit → attente ${retryDelay / 1000}s (tentative ${attempt}/${maxAttempts})`
          );

          await delay(retryDelay);

          continue;
        }
      }

      // ===== AUTRE ERREUR =====
      return response(200, {
        success: false,
        error: data.message || "CJ order creation failed",
        code: data.code || "UNKNOWN"
      });
    }

    return response(200, {
      success: false,
      error: "Max retries reached for rate limit",
      code: 1600200
    });

  } catch (error) {

    console.error("[CJ ORDER ERROR]", error.message);

    return response(500, {
      success: false,
      error: error.message
    });
  }
};

// ===== UTILS =====
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}