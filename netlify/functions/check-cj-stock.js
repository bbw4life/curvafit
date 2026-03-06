// check-cj-stock.js (renamed for clarity, as it checks stock, not order)
const fetch = require('node-fetch');

exports.handler = async (event) => {
  console.log('[CJ STOCK] Function invoked with event:', event); // Added entry log

  try {
    if (!event.body) {
      console.log('[CJ STOCK] No body in event');
      return response(400, { success: false, error: "No data received" });
    }

    if (!process.env.CJ_ACCESS_TOKEN) {
      console.log('[CJ STOCK] Missing CJ_ACCESS_TOKEN env var');
      throw new Error("Missing CJ_ACCESS_TOKEN");
    }

    const { cj_variant_id } = JSON.parse(event.body);
    if (!cj_variant_id) {
      console.log('[CJ STOCK] Missing cj_variant_id in body');
      throw new Error("Missing cj_variant_id");
    }

    // Correct official URL for stock query by variant ID
    const url = `https://developers.cjdropshipping.com/api2.0/v1/product/stock/queryByVid?vid=${cj_variant_id}`;

    console.log(`[CJ STOCK] Checking variant: ${cj_variant_id} at URL: ${url}`);

    const cjResponse = await fetch(url, {
      method: "GET",
      headers: {
        "CJ-Access-Token": process.env.CJ_ACCESS_TOKEN
      }
    });

    console.log(`[CJ STOCK] API response status: ${cjResponse.status}`);

    const responseText = await cjResponse.text();
    console.log(`[CJ STOCK] Raw response (first 400 chars): ${responseText.substring(0, 400)}`);

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('[CJ STOCK] Parsed data:', data);
    } catch (e) {
      console.error("[CJ STOCK] JSON parse error:", e.message);
      throw new Error(`CJ API returned invalid JSON (status ${cjResponse.status})`);
    }

    if (!cjResponse.ok || data.code !== 200) {
      console.error('[CJ STOCK] API error:', data);
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
    console.error("CJ STOCK ERROR:", error.message, error.stack);
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