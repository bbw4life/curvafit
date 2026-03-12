// fetch-eprolo-products.js (nouvelle function pour lister/valider variantsid)
const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  console.log("[EPROLO PRODUCTS] Function invoked");
  try {
    const apiKey = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;
    const timestamp = Date.now();
    const sign = crypto.createHash('md5').update(apiKey + timestamp + apiSecret).digest('hex');

    console.log("[EPROLO] apiKey: Set");
    console.log("[EPROLO] apiSecret: Set");
    console.log("[EPROLO] Timestamp:", timestamp);
    console.log("[EPROLO] Sign:", sign);

    // Utilise product_list.html (ajuste si tu as un param spécifique, ex: page=1&limit=100)
    const url = `https://openapi.eprolo.com/product_list.html?sign=${sign}&timestamp=${timestamp}`;
    const response = await fetch(url, {
      method: "GET",  // Ou POST si needed, check doc
      headers: {
        "apiKey": apiKey,
        "Content-Type": "application/json"
      }
    });
    const responseText = await response.text();
    console.log("[EPROLO] Response status:", response.status);
    console.log("[EPROLO] Response text:", responseText);

    let data;
    try { data = JSON.parse(responseText); } catch { data = {}; }
    if (response.ok && data.code === 0) {
      // Retourne la liste des produits avec leurs variantsid
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, products: data.data || [] })
      };
    } else {
      const errorMsg = data.msg || responseText.trim() || "Eprolo products fetch failed";
      console.error("[EPROLO] Error:", errorMsg);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: errorMsg, code: data.code || response.status })
      };
    }
  } catch (error) {
    console.error("[EPROLO PRODUCTS ERROR]", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};