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

    console.log("[CJ ORDER] Cart received:", cart);
    console.log("[CJ ORDER] Shipping received:", shipping);

    if (!Array.isArray(cart) || cart.length === 0) throw new Error("Invalid cart data");

    const accessToken = await getAccessToken();

    const orderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const products = cart.map(item => ({
      productId: item.cj_product_id,
      variantId: item.cj_variant_id,
      quantity: parseInt(item.quantity)
    }));

    const singleOrder = {
      orderId: orderId,
      products: products,
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
    };

    const orderBody = { orders: [singleOrder] };

    // === Retry sur rate limit ===
    let attempt = 0;
    while (attempt < 3) {
      const cjResponse = await fetch(
        "https://developers.cjdropshipping.com/api2.0/v1/shopping/order/batchCreateOrder",
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
      try { data = JSON.parse(responseText); } catch { data = {}; }

      if (cjResponse.ok && data.code === 200) {
        const cjResult = data.data?.[0];
        console.log(`[CJ ORDER] 🎉 SUCCÈS - CJ Order ID: ${cjResult.orderId}`);
        return response(200, { success: true, cjOrderId: cjResult.orderId });
      }

      if (data.message && data.message.includes("Too Many Requests")) {
        attempt++;
        console.log(`[CJ ORDER] Rate limit → attente 10s (tentative ${attempt}/3)`);
        await delay(310000);
        continue;
      }

      throw new Error(data.message || "CJ order creation failed");
    }

  } catch (error) {
    console.error("[CJ ORDER ERROR]", error.message);
    return response(500, { success: false, error: error.message });
  }
};

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