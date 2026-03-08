// create-cj-order.js

const fetch = require("node-fetch");

// ===============================
// CACHE GLOBAL DU TOKEN (≈2h)
// ===============================
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
    throw new Error("Missing CJ_API_KEY environment variable");
  }

  const tokenRes = await fetch(
    "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apiKey: process.env.CJ_API_KEY
      })
    }
  );

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || tokenData.code !== 200) {
    throw new Error(tokenData.message || "Failed to get CJ access token");
  }

  cachedToken = tokenData.data.accessToken;

  // token valable ~120 minutes
  tokenExpiry = now + (1000 * 60 * 110);

  console.log("[CJ AUTH] ✅ Nouveau token mis en cache");

  return cachedToken;
}


// ===============================
// MAIN FUNCTION
// ===============================
exports.handler = async (event) => {

  console.log("[CJ ORDER] Function invoked");

  try {

    if (!event.body) {
      throw new Error("No data received");
    }

    const { cart, shipping } = JSON.parse(event.body);

    if (!Array.isArray(cart) || cart.length === 0) {
      throw new Error("Invalid cart data");
    }

    if (!shipping || !shipping.address || !shipping.fullName) {
      throw new Error("Invalid shipping data");
    }

    console.log("[CJ ORDER] Cart:", cart);
    console.log("[CJ ORDER] Shipping:", shipping);

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

    const orderBody = {
      orders: [singleOrder]
    };


    // ===============================
    // RETRY SI RATE LIMIT
    // ===============================
    let attempt = 0;

    while (attempt < 3) {

      console.log(`[CJ ORDER] Attempt ${attempt + 1}`);

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

      try {
        data = JSON.parse(responseText);
      } catch {
        data = {};
      }

      if (cjResponse.ok && data.code === 200) {

        const cjResult = data.data?.[0];

        console.log(`[CJ ORDER] 🎉 SUCCESS - CJ Order ID: ${cjResult?.orderId}`);

        return response(200, {
          success: true,
          cjOrderId: cjResult?.orderId || null
        });

      }


      // ===============================
      // RATE LIMIT
      // ===============================
      if (data.message && data.message.includes("Too Many Requests")) {

        attempt++;

        if (attempt >= 3) break;

        console.log(`[CJ ORDER] ⚠️ Rate limit → attente 10s (tentative ${attempt}/3)`);

        await delay(10000);

        continue;
      }

      throw new Error(data.message || "CJ order creation failed");
    }

    throw new Error("CJ API rate limit reached after 3 attempts");

  }

  catch (error) {

    console.error("[CJ ORDER ERROR]", error.message);

    return response(500, {
      success: false,
      error: error.message
    });
  }

};


// ===============================
// UTILITIES
// ===============================

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}