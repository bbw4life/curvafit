// get-eprolo-product-detail.js
const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  console.log("[EPROLO PRODUCT DETAIL] Function invoked");
  try {
    let productId;
    if (event.body) {
      const body = JSON.parse(event.body);
      productId = body.productid || body.productId;
    } else if (event.queryStringParameters) {
      productId = event.queryStringParameters.productid || event.queryStringParameters.productId;
    }

    if (!productId) throw new Error("Missing productid in body or ?productid=xxx");

    const apiKey = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;
    if (!apiKey || !apiSecret) throw new Error("EPROLO keys missing");

    const timestamp = Date.now();
    const sign = crypto.createHash('md5').update(apiKey + timestamp + apiSecret).digest('hex');

    const url = `https://openapi.eprolo.com/getproduct.html?sign=${sign}&timestamp=${timestamp}&productid=${productId}`;

    console.log(`[EPROLO] Fetching productid: ${productId}`);
    console.log(`[EPROLO] URL: ${url}`);

    const res = await fetch(url, {
      method: "GET",
      headers: { "apiKey": apiKey }
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error("Invalid JSON"); }

    console.log(`[EPROLO] Status: ${res.status}`);

    if (data.code !== "0") {
      throw new Error(data.msg || "Eprolo error");
    }

    const product = data.data;
    console.log(`\n=== PRODUIT ${product.title} (ID: ${product.id}) ===`);
    console.log("VARIANTSID À UTILISER (copie-colle ces numéros) :");

    product.variantlist.forEach(v => {
      console.log(`   → variantsid: ${v.id} | ${v.title} | Cost: $${v.cost} | Stock: ${v.inventory_quantity}`);
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        productId: product.id,
        title: product.title,
        variantsCount: product.variantlist.length,
        message: "Check the logs above for the correct variantsid"
      })
    };

  } catch (error) {
    console.error("[EPROLO PRODUCT DETAIL ERROR]", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};