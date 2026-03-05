// netlify/functions/check-cj-stock.js  ← VERSION AVEC LOGS DÉTAILLÉS
const fetch = require('node-fetch');

exports.handler = async (event) => {
  console.log("[CJ-STOCK] === DÉBUT DE LA REQUÊTE ===");
  
  try {
    if (!event.body) {
      console.error("[CJ-STOCK] ERREUR: Aucun body reçu");
      return response(400, { success: false, error: "No data received" });
    }

    if (!process.env.CJ_ACCESS_TOKEN) {
      console.error("[CJ-STOCK] ERREUR: CJ_ACCESS_TOKEN manquant");
      throw new Error("Missing CJ_ACCESS_TOKEN");
    }

    const { cj_variant_id } = JSON.parse(event.body);
    console.log(`[CJ-STOCK] Variant ID reçu: ${cj_variant_id}`);

    if (!cj_variant_id) {
      console.error("[CJ-STOCK] ERREUR: cj_variant_id manquant");
      throw new Error("Missing cj_variant_id");
    }

    const url = `https://api.cjdropshipping.com/api2.0/v1/product/stock/queryByVid?vid=${cj_variant_id}`;
    console.log(`[CJ-STOCK] Appel API CJ: ${url}`);

    const cjResponse = await fetch(url, {
      method: "GET",
      headers: { "CJ-Access-Token": process.env.CJ_ACCESS_TOKEN }
    });

    const data = await cjResponse.json();
    console.log(`[CJ-STOCK] Réponse CJ (code ${cjResponse.status}):`, JSON.stringify(data, null, 2));

    if (!cjResponse.ok || data.code !== 200) {
      console.error("[CJ-STOCK] ERREUR API CJ:", data.message || "Unknown error");
      throw new Error(data.message || "CJ stock API error");
    }

    const warehouses = data.data || [];
    let totalStock = 0;
    warehouses.forEach((wh, i) => {
      const stock = parseInt(wh.totalInventoryNum || 0);
      totalStock += stock;
      console.log(`[CJ-STOCK] Warehouse ${i+1}: ${stock} unités`);
    });

    const inStock = totalStock > 0;
    console.log(`[CJ-STOCK] TOTAL STOCK: ${totalStock} → inStock: ${inStock}`);

    return response(200, {
      success: true,
      stock: totalStock,
      inStock: inStock,
      variant_id: cj_variant_id
    });

  } catch (error) {
    console.error("[CJ-STOCK] CRITICAL ERROR:", error.message);
    return response(500, {
      success: false,
      error: "Failed to check CJ stock",
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