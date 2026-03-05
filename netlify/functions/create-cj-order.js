// netlify/functions/create-cj-order.js  ← VERSION AVEC LOGS DÉTAILLÉS
const fetch = require('node-fetch');

exports.handler = async (event) => {
  console.log("[CJ-ORDER] === DÉBUT CRÉATION COMMANDE CJ ===");

  try {
    if (!event.body) {
      console.error("[CJ-ORDER] ERREUR: Aucun body reçu");
      return response(400, { success: false, error: "No data received" });
    }

    if (!process.env.CJ_ACCESS_TOKEN) {
      console.error("[CJ-ORDER] ERREUR: CJ_ACCESS_TOKEN manquant");
      throw new Error("Missing CJ_ACCESS_TOKEN");
    }

    const { cart, shipping } = JSON.parse(event.body);
    console.log(`[CJ-ORDER] Articles reçus: ${cart.length}`);
    console.log(`[CJ-ORDER] Shipping pour: ${shipping.fullName} (${shipping.country})`);

    if (!Array.isArray(cart) || cart.length === 0) {
      throw new Error("Invalid cart data");
    }
    if (!shipping || !shipping.fullName || !shipping.address) {
      throw new Error("Invalid shipping data");
    }

    const orderBody = {
      orders: [{
        orderId: `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        products: cart.map(item => ({
          productId: item.cj_product_id,
          variantId: item.cj_variant_id,
          quantity: parseInt(item.quantity)
        })),
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
      }]
    };

    console.log("[CJ-ORDER] Body envoyé à CJ:", JSON.stringify(orderBody, null, 2));

    const cjResponse = await fetch(
      "https://api.cjdropshipping.com/api2.0/v1/shopping/order/batchCreateOrder",
      {
        method: "POST",
        headers: {
          "CJ-Access-Token": process.env.CJ_ACCESS_TOKEN,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderBody)
      }
    );

    const data = await cjResponse.json();
    console.log(`[CJ-ORDER] Réponse CJ (status ${cjResponse.status}):`, JSON.stringify(data, null, 2));

    if (!cjResponse.ok || data.code !== 200) {
      console.error("[CJ-ORDER] ÉCHEC création commande CJ:", data.message || "Unknown error");
      throw new Error(data.message || "CJ order creation failed");
    }

    const cjOrderId = data.data?.[0]?.orderId || data.data?.orderId || null;
    console.log(`[CJ-ORDER] SUCCÈS ! CJ Order ID: ${cjOrderId}`);

    return response(200, {
      success: true,
      cjOrderId: cjOrderId,
      message: "Commande créée avec succès chez CJ"
    });

  } catch (error) {
    console.error("[CJ-ORDER] CRITICAL ERROR:", error.message);
    return response(500, {
      success: false,
      error: "CJ order creation failed",
      details: error.message
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