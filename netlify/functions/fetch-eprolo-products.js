// fetch-eprolo-products.js  ← VERSION FINALE (TOUS les produits + pagination complète + tous les variants)
const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  console.log("[EPROLO PRODUCTS] 🚀 Récupération de TOUS les produits (pagination automatique)");

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

      console.log(`[EPROLO] Fetch page ${page} → ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers: { "apiKey": apiKey }
      });

      const responseText = await response.text();
      let data;
      try { data = JSON.parse(responseText); } catch { data = {}; }

      console.log(`[EPROLO] Page ${page} | Status: ${response.status} | Code: ${data.code}`);

      if ((data.code === 0 || data.code === "0") && data.data && data.data.length > 0) {
        allProducts = allProducts.concat(data.data);
        console.log(`✅ Page ${page} : ${data.data.length} produits ajoutés (total actuel : ${allProducts.length})`);

        // Si on a récupéré moins de "limit", c'est la dernière page
        if (data.data.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        console.log(`[EPROLO] Fin de la pagination (page ${page} vide ou erreur)`);
        hasMore = false;
      }
    }

    console.log(`\n🎉 TOTAL PRODUITS RÉCUPÉRÉS DANS L'API : ${allProducts.length}\n`);

    if (allProducts.length > 0) {
      allProducts.forEach((product, index) => {
        console.log(`[${index+1}] Product ID interne (à copier) : ${product.id}`);
        console.log(`Titre : ${product.title}`);
        console.log(`Nombre de variants : ${product.variantlist ? product.variantlist.length : 0}`);

        if (product.variantlist && product.variantlist.length > 0) {
          console.log(`→ TOUS les variantsid (copie ceux que tu veux dans data.json) :`);
          product.variantlist.forEach((variant, vIndex) => {
            console.log(`   [${vIndex+1}] Variant ID → ${variant.id}   ${variant.sku ? `(SKU: ${variant.sku})` : ''}`);
          });
        }
        console.log("─".repeat(80));
      });

      // Détection Butterfly sur TOUS les produits
      const butterfly = allProducts.find(p => 
        p.title.toLowerCase().includes("butterfly") || 
        p.title.toLowerCase().includes("memory neck") ||
        p.title.toLowerCase().includes("neck pillow")
      );

      if (butterfly) {
        console.log(`\n🎯 PRODUIT BUTTERFLY TROUVÉ !`);
        console.log(`→ Product ID : ${butterfly.id}`);
        console.log(`→ Variants à copier :`);
        butterfly.variantlist.forEach((v, i) => {
          console.log(`   [${i+1}] ${v.id}   ${v.sku ? `(SKU: ${v.sku})` : ''}`);
        });
      } else {
        console.log(`\n❌ Butterfly Pillow toujours pas visible (il faut qu'il soit bien "Pushed to Store" et synced dans My Products).`);
      }

    } else {
      console.log("❌ Aucun produit trouvé dans l'API.");
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, total: allProducts.length }) };

  } catch (error) {
    console.error("[EPROLO PRODUCTS ERROR]", error.message);
  }
};