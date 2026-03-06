const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    if (!event.body) {
      return response(400, { success: false, error: "No data received" });
    }

    if (!process.env.CJ_ACCESS_TOKEN) {
      throw new Error("Missing CJ_ACCESS_TOKEN");
    }

    const { cj_variant_id } = JSON.parse(event.body);
    if (!cj_variant_id) {
      throw new Error("Missing cj_variant_id");
    }

    // URL OFFICIELLE 2026 (c'était le bug principal)
    const url = `https://developers.cjdropshipping.com/api2.0/v1/product/stock/queryByVid?vid=${cj_variant_id}`;

    console.log(`[CJ STOCK] Checking variant: ${cj_variant_id}`);

    const cjResponse = await fetch(url, {
      method: "GET",
      headers: {
        "CJ-Access-Token": process.env.CJ_ACCESS_TOKEN
      }
    });

    const responseText = await cjResponse.text();
    console.log(`[CJ STOCK] Status: ${cjResponse.status}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("[CJ STOCK] Raw response (HTML ou erreur):", responseText.substring(0, 400));
      throw new Error(`CJ API returned invalid JSON (status ${cjResponse.status})`);
    }

    if (!cjResponse.ok || data.code !== 200) {
      throw new Error(data.message || `CJ API error - code: ${data.code}`);
    }

    const warehouses = data.data || [];
    let totalStock = 0;
    for (const warehouse of warehouses) {
      totalStock += parseInt(warehouse.totalInventoryNum || 0);
    }

    const inStock = totalStock > 0;

    console.log(`[CJ STOCK] ${cj_variant_id} → Stock: ${totalStock} | InStock: ${inStock}`);

    return response(200, {
      success: true,
      stock: totalStock,
      inStock: inStock
    });

  } catch (error) {
    console.error("CJ STOCK ERROR:", error.message);
    return response(500, {
      success: false,
      error: error.message
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