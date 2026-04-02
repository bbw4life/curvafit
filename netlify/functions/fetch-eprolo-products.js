// fetch-eprolo-products.js — VERSION COMPLÈTE (couleur + taille + prix + stock)
const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  const logs = [];

  const log = (msg) => {
    console.log(msg);
    logs.push(msg);
  };

  log("[EPROLO PRODUCTS] 🚀 Récupération de TOUS les produits");

  try {
    const apiKey = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;

    let allProducts = [];
    let page = 1;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = crypto.createHash('md5')
        .update(apiKey + apiSecret + timestamp)
        .digest('hex');
      const url = `https://openapi.eprolo.com/product_list.html?sign=${sign}&timestamp=${timestamp}&page=${page}&limit=${limit}&type=1`;

      log(`[EPROLO] Page ${page} → ${url}`);

      const response = await fetch(url, { method: "GET", headers: { "apiKey": apiKey } });
      const responseText = await response.text();
      let data = {};
      try { data = JSON.parse(responseText); } catch {}
      log(`[RAW RESPONSE] ${responseText.substring(0, 500)}`);

      if ((data.code === 0 || data.code === "0") && data.data && data.data.length > 0) {
        allProducts = allProducts.concat(data.data);
        log(`✅ Page ${page} : +${data.data.length} produits (total : ${allProducts.length})`);
        if (data.data.length < limit) hasMore = false;
        else page++;
      } else {
        hasMore = false;
      }
    }

    log(`\n🎉 TOTAL PRODUITS : ${allProducts.length}\n`);

    allProducts.forEach((product, index) => {
      log("═".repeat(90));
      log(`🔹 [${index + 1}] ${product.title}`);
      log(`   Product ID : ${product.id}`);
      log(`   Variants   : ${product.variantlist ? product.variantlist.length : 0}`);
      log("─".repeat(90));

      if (product.variantlist && product.variantlist.length > 0) {

        // Debug structure — une seule fois sur le premier produit
        if (index === 0) {
          const keys = Object.keys(product.variantlist[0]);
          log(`   [DEBUG KEYS] ${keys.join(' | ')}`);
          log("─".repeat(90));
        }

        // Grouper les variants par couleur (option1)
        const colorGroups = {};

        product.variantlist.forEach((variant) => {
          let color = (variant.option1 || variant.color || 'N/A')
            .replace(/ one$/i, '')
            .trim();
          color = color.charAt(0).toUpperCase() + color.slice(1);

          const size    = (variant.option2 || '').trim();
          const option3 = (variant.option3 || '').trim();

          if (!colorGroups[color]) colorGroups[color] = [];
          colorGroups[color].push({
            size,
            option3,
            id:     variant.id,
            sku:    variant.sku               || 'N/A',
            price:  variant.cost              || 'N/A',
            weight: variant.weight            || 'N/A',
            stock:  variant.inventory_quantity || 'N/A'
          });
        });

        // Affichage groupé par couleur
        Object.entries(colorGroups).forEach(([color, variants]) => {
          log(`   🎨 ${color} (${variants.length} taille(s))`);
          variants.forEach((v) => {
            const sizeStr   = v.size    ? `SIZE: ${v.size}`        : 'SIZE: —';
            const opt3Str   = v.option3 ? ` | OPT3: ${v.option3}` : '';
            log(`      → ID: ${v.id} | ${sizeStr}${opt3Str} | SKU: ${v.sku} | PRIX: ${v.price} | POIDS: ${v.weight} | STOCK: ${v.stock}`);
          });
          log('');
        });
      }
    });

    log("═".repeat(90));
    log("✅ FIN DU LOG");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        total: allProducts.length,
        logs: logs
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