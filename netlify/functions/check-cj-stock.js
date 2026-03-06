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
    const cjResponse = await fetch(
      `https://api.cjdropshipping.com/api2.0/v1/product/stock/queryByVid?vid=${cj_variant_id}`,
      {
        method: "GET",
        headers: {
          "CJ-Access-Token": process.env.CJ_ACCESS_TOKEN
        }
      }
    );
    const data = await cjResponse.json();
    if (!cjResponse.ok || data.code !== 200) {
      throw new Error(data.message || "CJ stock API error");
    }
    // CJ peut retourner plusieurs warehouses
    const warehouses = data.data || [];
    let totalStock = 0;
    for (const warehouse of warehouses) {
      totalStock += parseInt(warehouse.totalInventoryNum || 0);
    }
    const inStock = totalStock > 0;
    return response(200, {
      success: true,
      stock: totalStock,
      inStock: inStock
    });
  } catch (error) {
    console.error("CJ STOCK ERROR:", error.message);
    return response(500, {
      success: false,
      error: "Failed to check CJ stock"
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