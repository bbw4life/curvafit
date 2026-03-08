// check-cj-stock.js
const fetch = require('node-fetch');
async function getAccessToken() {
  const tokenRes = await fetch(
    "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: process.env.CJ_API_KEY }) }
  );
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || tokenData.code !== 200) throw new Error(tokenData.message || "Token failed");
  return tokenData.data.accessToken;
}
exports.handler = async (event) => {
  console.log("[CJ STOCK] Function invoked");
  try {
    const { cj_variant_id } = JSON.parse(event.body || "{}");
    if (!cj_variant_id) throw new Error("Missing cj_variant_id");
    const accessToken = await getAccessToken();
    const url = `https://developers.cjdropshipping.com/api2.0/v1/product/stock/queryBySku?sku=${cj_variant_id}`;
    let attempt = 0;
    while (attempt < 3) {
      const cjResponse = await fetch(url, {
        method: "GET",
        headers: { "CJ-Access-Token": accessToken }
      });
      const text = await cjResponse.text();
      let data;
      try { data = JSON.parse(text); } catch { data = {}; }
      if (cjResponse.ok && data.code === 200) {
        const warehouses = Array.isArray(data.data) ? data.data : [];
        const totalStock = warehouses.reduce((sum, w) => {
          return sum + parseInt(w.inventoryNum || w.totalInventoryNum || 0);
        }, 0);
        console.log(`[CJ STOCK] ${cj_variant_id} → Stock total: ${totalStock}`);
        return response(200, { success: true, stock: totalStock, inStock: totalStock > 0 });
      }
      if (data.message && data.message.includes("Too Many Requests")) {
        attempt++;
        if (attempt < 3) {
          console.log(`[CJ STOCK] Rate limit → attente 310s (tentative ${attempt}/3)`);
          await delay(310000);
          continue;
        }
      }
      throw new Error(data.message || "CJ stock API error");
    }
  } catch (error) {
    console.error("[CJ STOCK ERROR]", error.message);
    // On distingue le rate limit pour le retry futur
    const isRateLimit = error.message.includes("Too Many Requests");
    return response(200, {
      success: false,
      error: error.message,
      isRateLimit,
      stock: 0,
      inStock: false
    });
  }
};
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}