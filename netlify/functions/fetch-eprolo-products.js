// fetch-eprolo-products.js  ← VERSION CORRIGÉE & TRÈS STRICTE (couleurs nettoyées + debug structure)
const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  console.log("[EPROLO PRODUCTS] 🚀 Récupération de TOUS les produits (version stricte)");

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

    // === AFFICHAGE TRÈS STRICT & NETTOYÉ ===
    allProducts.forEach((product, index) => {
      console.log(`[${index+1}] Product ID interne : ${product.id}`);
      console.log(`Titre complet : ${product.title}`);
      console.log(`Variants retournés par l'API : ${product.variantlist ? product.variantlist.length : 0}`);

      if (product.variantlist && product.variantlist.length > 0) {
        console.log(`→ Variants (COULEUR NETTOYÉE → ID) :`);

        // Debug structure UNE SEULE FOIS (premier variant du premier produit)
        if (index === 0 && product.variantlist[0]) {
          const firstVariant = product.variantlist[0];
          console.log(`   [DEBUG STRUCTURE] Clés disponibles : ${Object.keys(firstVariant).join(' | ')}`);
        }

        product.variantlist.forEach((variant, vIndex) => {
          // Récupération brute
          let rawColor = variant.color || 
                        variant.option1 || 
                        variant.option_value || 
                        variant.name || 
                        variant.sku || 
                        'N/A';

          // NETTOYAGE STRICT :
          // 1. Supprime " one" à la fin
          // 2. Supprime espaces inutiles
          // 3. Capitalise la première lettre
          let cleanColor = rawColor
            .replace(/ one$/i, '')
            .replace(/ - Section \d+/i, '')   // supprime " - Section 21" si tu veux (décommente si besoin)
            .trim();

          cleanColor = cleanColor.charAt(0).toUpperCase() + cleanColor.slice(1);

          console.log(`   [${vIndex+1}] ${cleanColor} → ${variant.id}   (SKU: ${variant.sku || 'N/A'})`);
        });
      }
      console.log("─".repeat(90));
    });

    console.log(`\n✅ FIN DU LOG - Copie maintenant les lignes dont tu as besoin dans products.data.json`);
    console.log(`Note : Si tu ne vois pas "Black", c'est que ce variant n'est pas encore "Synced" dans l'API (même s'il apparaît dans My Products).`);

    return { statusCode: 200, body: JSON.stringify({ success: true, total: allProducts.length }) };

  } catch (error) {
    console.error("[EPROLO ERROR]", error.message);
  }
};