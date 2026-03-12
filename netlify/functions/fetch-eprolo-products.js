// fetch-eprolo-products.js  ← VERSION FINALE (liste complète + détection Butterfly)
const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  console.log("[EPROLO PRODUCTS] 🚀 Liste complète des produits (sans filtre)");

  try {
    const apiKey = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;
    const timestamp = Date.now();
    const sign = crypto.createHash('md5').update(apiKey + timestamp + apiSecret).digest('hex');

    const url = `https://openapi.eprolo.com/product_list.html?sign=${sign}&timestamp=${timestamp}&page=1&limit=100`;

    console.log(`[EPROLO] URL utilisée : ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: { "apiKey": apiKey }
    });

    const responseText = await response.text();
    let data;
    try { data = JSON.parse(responseText); } catch { data = {}; }

    console.log(`[EPROLO] Status: ${response.status} | Code: ${data.code}`);

    if ((data.code === 0 || data.code === "0") && data.data && data.data.length > 0) {
      console.log(`✅ ${data.data.length} produits trouvés dans l'API !\n`);

      data.data.forEach((product, index) => {
        console.log(`[${index+1}] Product ID interne (à copier) : ${product.id}`);
        console.log(`Titre : ${product.title}`);
        console.log(`Variants : ${product.variantlist ? product.variantlist.length : 0}`);
        if (product.variantlist && product.variantlist.length > 0) {
          console.log(`→ Premier variantsid (le BON) : ${product.variantlist[0].id}`);
        }
        console.log("─".repeat(50));
      });

      // Détection automatique du Butterfly Pillow
      const butterfly = data.data.find(p => 
        p.title.toLowerCase().includes("butterfly") || 
        p.title.toLowerCase().includes("memory neck") ||
        p.title.toLowerCase().includes("neck pillow")
      );

      if (butterfly) {
        console.log(`\n🎯 PRODUIT BUTTERFLY TROUVÉ !`);
        console.log(`→ Product ID interne à utiliser dans get-eprolo-product-detail : ${butterfly.id}`);
        console.log(`Titre : ${butterfly.title}`);
        console.log(`Variantsid à copier dans products.data.json : ${butterfly.variantlist.map(v => v.id).join(', ')}`);
      } else {
        console.log(`\n❌ Le Butterfly Pillow n'apparaît pas encore dans l'API (il est peut-être encore en "Not synced").`);
      }

      return { statusCode: 200, body: JSON.stringify({ success: true, count: data.data.length }) };
    } else {
      console.error("[EPROLO] Erreur :", data.msg || responseText.substring(0, 500));
    }
  } catch (error) {
    console.error("[EPROLO PRODUCTS ERROR]", error.message);
  }
};