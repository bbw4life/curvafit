// create-cj-order.js
const fetch = require("node-fetch");

async function getAccessToken() {

  if (!process.env.CJ_API_KEY) {
    throw new Error("Missing CJ_API_KEY environment variable");
  }

  console.log("[CJ AUTH] Requesting access token...");

  const tokenRes = await fetch(
    "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: process.env.CJ_API_KEY })
    }
  );

  const tokenData = await tokenRes.json();

  console.log("[CJ AUTH] Token response:", tokenData);

  if (!tokenRes.ok || tokenData.code !== 200) {
    throw new Error(tokenData.message || "Failed to get CJ access token");
  }

  return tokenData.data.accessToken;
}

exports.handler = async (event) => {

  console.log("[CJ ORDER] Function invoked");

  try {

    if (!event.body) {
      console.log("[CJ ORDER] No body received");
      return response(400, { success: false, error: "No data received" });
    }

    const { cart, shipping } = JSON.parse(event.body);

    console.log("[CJ ORDER] Cart received:", cart);
    console.log("[CJ ORDER] Shipping received:", shipping);

    if (!Array.isArray(cart) || cart.length === 0) {
      throw new Error("Invalid cart data");
    }

    if (!shipping || !shipping.fullName || !shipping.address) {
      throw new Error("Invalid shipping data");
    }

    const accessToken = await getAccessToken();

    console.log("[CJ ORDER] Access token received");

    const orderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const products = cart.map(item => {

      console.log("[CJ ORDER] Product sent to CJ:", item);

      return {
        productId: item.cj_product_id,
        variantId: item.cj_variant_id,
        quantity: parseInt(item.quantity)
      };

    });

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

    console.log("[CJ ORDER] Sending order body:", JSON.stringify(orderBody));

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

    console.log("[CJ ORDER] CJ API status:", cjResponse.status);

    const responseText = await cjResponse.text();

    console.log("[CJ ORDER] Raw CJ response:", responseText.substring(0, 400));

    let data;

    try {

      data = JSON.parse(responseText);

      console.log("[CJ ORDER] Parsed CJ response:", data);

    } catch (err) {

      console.error("[CJ ORDER] JSON parse error:", err.message);

      throw new Error("CJ returned invalid JSON");

    }

    if (!cjResponse.ok || data.code !== 200) {

      console.error("[CJ ORDER] CJ API error:", data);

      throw new Error(data.message || "CJ order creation failed");

    }

    const cjResult = data.data?.[0];

    console.log("[CJ ORDER] CJ result object:", cjResult);

    if (!cjResult || !cjResult.orderId) {

      console.error("[CJ ORDER] CJ did not return an orderId:", data);

      throw new Error("CJ order not created");

    }

    console.log("[CJ ORDER] SUCCESS - Order created in CJ:", cjResult.orderId);

    return response(200, {
      success: true,
      cjOrderId: cjResult.orderId
    });

  } catch (error) {

    console.error("[CJ ORDER ERROR]", error.message);
    console.error(error.stack);

    return response(500, {
      success: false,
      error: "CJ order creation failed"
    });

  }

};

function response(statusCode, body) {

  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };

}