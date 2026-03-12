// fetch-eprolo-products.js  ← VERSION ULTRA SIMPLE (TOUS les produits + couleur visible)
const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  console.log("[EPROLO PRODUCTS] 🚀 Récupération de TOUS les produits (sans aucun filtre)");

  try {
    const apiKey = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;

    let allProducts = [];
    let page = 1;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const timestamp = Date.now();
      const sign = crypto.createHash('md5').update(apiKey + timestamp + apiSecret).digest('hex');

      const url = `https://openapi.eprolo.com/product_list.html?sign=${sign}&timestamp=${timestamp}&page=${page}&limit=${limit}`;

      console.log(`[EPROLO] Page ${page} → ${url}`);

      const response = await fetch(url, { method: "GET", headers: { "apiKey": apiKey } });
      const responseText = await response.text();
      let data = {};
      try { data = JSON.parse(responseText); } catch {}

      if ((data.code === 0 || data.code === "0") && data.data && data.data.length > 0) {
        allProducts = allProducts.concat(data.data);
        console.log(`✅ Page ${page} : +${data.data.length} produits (total : ${allProducts.length})`);

        if (data.data.length < limit) hasMore = false;
        else page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`\n🎉 TOTAL PRODUITS VISIBLES DANS L'API : ${allProducts.length}\n`);

    // AFFICHAGE TRÈS CLAIR - TU COPIES CE QUE TU VEUX
    allProducts.forEach((product, index) => {
      console.log(`[${index+1}] Product ID interne (à copier) : ${product.id}`);
      console.log(`Titre complet : ${product.title}`);
      console.log(`Nombre de variants : ${product.variantlist ? product.variantlist.length : 0}`);

      if (product.variantlist && product.variantlist.length > 0) {
        console.log(`→ Variants (couleur → ID) :`);
        product.variantlist.forEach((variant, vIndex) => {
          const couleur = variant.color || variant.option1 || variant.option_value || variant.name || 'N/A';
          console.log(`   [${vIndex+1}] ${couleur} → ${variant.id}   (SKU: ${variant.sku || 'N/A'})`);
        });
      }
      console.log("─".repeat(90));
    });

    console.log(`\n✅ FIN DU LOG\n`);
    console.log(`Copie simplement les Product ID + les variants dont tu as besoin dans ton products.data.json`);

    return { statusCode: 200, body: JSON.stringify({ success: true, total: allProducts.length }) };

  } catch (error) {
    console.error("[EPROLO ERROR]", error.message);
  }
};