// fetch-eprolo-products.js — VERSION LISTE HARDCODÉE (cj_id)
const fetch = require('node-fetch');
const crypto = require('crypto');

// ─────────────────────────────────────────────
// 📦 TA LISTE DE PRODUITS (cj_id uniquement)
// ─────────────────────────────────────────────
const MY_PRODUCT_IDS = [
  "31246341",  // resistance-bands
  "31246339",  // yoga-mat
  "31246387",  // leggings
  "31246342",  // sports-bra
  "31246386",  // hydration-bottle
  "31246330",  // workout-towel
  "31246232",  // fitness-tracker
  "31246385",  // protein-shaker
  "31246336",  // dumbbell-set
  "31246377",  // jump-rope
  "31246323",  // foam-roller
  "31246335",  // yoga-blocks
  "31246346",  // ankle-weights
  "31246417",  // cooling-towel
  "31246429",  // massage-ball
  "31246437",  // gym-bag
];

exports.handler = async (event) => {
  const logs = [];

  const log = (msg) => {
    console.log(msg);
    logs.push(msg);
  };

  log("[EPROLO PRODUCTS] 🚀 Récupération des produits depuis la liste hardcodée");
  log(`📋 ${MY_PRODUCT_IDS.length} produit(s) à récupérer`);

  try {
    const apiKey    = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;

    const allProducts = [];

    for (const productId of MY_PRODUCT_IDS) {
      try {
        const timestamp = Date.now();
        const sign = crypto
          .createHash('md5')
          .update(apiKey + timestamp + apiSecret)
          .digest('hex');

        // ✅ Bon endpoint + bon paramètre "id="
        const url = `https://openapi.eprolo.com/getproduct.html?sign=${sign}&timestamp=${timestamp}&id=${productId}`;

        log(`\n[EPROLO] Fetching product ID: ${productId} → ${url}`);

        const response     = await fetch(url, { method: "GET", headers: { "apiKey": apiKey } });
        const responseText = await response.text();

        let data = {};
        try { data = JSON.parse(responseText); } catch {}
        log(`[RAW RESPONSE] ${responseText.substring(0, 500)}`);

        if ((data.code === 0 || data.code === "0") && data.data) {
          allProducts.push(data.data);
          log(`✅ Produit ${productId} récupéré : ${data.data.title || '(sans titre)'}`);
        } else {
          log(`⚠️ Produit ${productId} non trouvé ou erreur : ${responseText.substring(0, 200)}`);
        }

      } catch (err) {
        log(`❌ Erreur pour le produit ${productId} : ${err.message}`);
      }
    }

    log(`\n🎉 TOTAL PRODUITS RÉCUPÉRÉS : ${allProducts.length} / ${MY_PRODUCT_IDS.length}\n`);

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
            sku:    variant.sku                || 'N/A',
            price:  variant.cost               || 'N/A',
            weight: variant.weight             || 'N/A',
            stock:  variant.inventory_quantity || 'N/A'
          });
        });

        // Affichage groupé par couleur
        Object.entries(colorGroups).forEach(([color, variants]) => {
          log(`   🎨 ${color} (${variants.length} taille(s))`);
          variants.forEach((v) => {
            const sizeStr = v.size    ? `SIZE: ${v.size}`        : 'SIZE: —';
            const opt3Str = v.option3 ? ` | OPT3: ${v.option3}` : '';
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
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success: true,
        total:   allProducts.length,
        logs:    logs
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