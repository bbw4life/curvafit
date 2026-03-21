// fetch-eprolo-products.js
const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  const logs = []; // ← collecte tous les logs ici

  const log = (msg) => {
    console.log(msg);
    logs.push(msg);
  };

  log("[EPROLO PRODUCTS] 🚀 Récupération de TOUS les produits (version stricte)");

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

      log(`[EPROLO] Page ${page} → ${url}`);

      const response = await fetch(url, { method: "GET", headers: { "apiKey": apiKey } });
      const responseText = await response.text();
      let data = {};
      try { data = JSON.parse(responseText); } catch {}

      if ((data.code === 0 || data.code === "0") && data.data && data.data.length > 0) {
        allProducts = allProducts.concat(data.data);
        log(`✅ Page ${page} : +${data.data.length} produits (total : ${allProducts.length})`);

        if (data.data.length < limit) hasMore = false;
        else page++;
      } else {
        hasMore = false;
      }
    }

    log(`\n🎉 TOTAL PRODUITS VISIBLES DANS L'API : ${allProducts.length}\n`);

    allProducts.forEach((product, index) => {
      log(`[${index+1}] Product ID interne : ${product.id}`);
      log(`Titre complet : ${product.title}`);
      log(`Variants retournés par l'API : ${product.variantlist ? product.variantlist.length : 0}`);

      if (product.variantlist && product.variantlist.length > 0) {
        log(`→ Variants (COULEUR NETTOYÉE → ID) :`);

        if (index === 0 && product.variantlist[0]) {
          const firstVariant = product.variantlist[0];
          log(`   [DEBUG STRUCTURE] Clés disponibles : ${Object.keys(firstVariant).join(' | ')}`);
        }

        product.variantlist.forEach((variant, vIndex) => {
          let rawColor = variant.color ||
                        variant.option1 ||
                        variant.option_value ||
                        variant.name ||
                        variant.sku ||
                        'N/A';

          let cleanColor = rawColor
            .replace(/ one$/i, '')
            .replace(/ - Section \d+/i, '')
            .trim();

          cleanColor = cleanColor.charAt(0).toUpperCase() + cleanColor.slice(1);

          log(`   [${vIndex+1}] ${cleanColor} → ${variant.id}   (SKU: ${variant.sku || 'N/A'})`);
        });
      }
      log("─".repeat(90));
    });

    log(`\n✅ FIN DU LOG - Copie maintenant les lignes dont tu as besoin dans products.data.json`);
    log(`Note : Si tu ne vois pas "Black", c'est que ce variant n'est pas encore "Synced" dans l'API.`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        total: allProducts.length,
        logs: logs  // ← les logs sont maintenant dans la réponse
      })
    };

  } catch (error) {
    console.error("[EPROLO ERROR]", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message, logs })
    };
  }
};