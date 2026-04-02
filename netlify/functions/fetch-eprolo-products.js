// fetch-eprolo-products.js — VERSION LISTE HARDCODÉE (cj_id)
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

const SEP  = "═".repeat(80);
const SEP2 = "─".repeat(80);

exports.handler = async (event) => {
  const logs = [];
  const log = (msg) => { console.log(msg); logs.push(msg); };

  log(SEP);
  log("  EPROLO — RÉCUPÉRATION DES PRODUITS");
  log(`  Liste : ${MY_PRODUCT_IDS.length} produits`);
  log(SEP);

  try {
    const apiKey    = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;

    // ── 1. FETCH DE CHAQUE PRODUIT ─────────────────────────────────────────
    const allProducts = [];

    for (const productId of MY_PRODUCT_IDS) {
      try {
        const timestamp = Date.now();
        const sign = crypto
          .createHash('md5')
          .update(apiKey + timestamp + apiSecret)
          .digest('hex');

        const url = `https://openapi.eprolo.com/getproduct.html?sign=${sign}&timestamp=${timestamp}&id=${productId}`;

        const response     = await fetch(url, { method: "GET", headers: { "apiKey": apiKey } });
        const responseText = await response.text();

        let data = {};
        try { data = JSON.parse(responseText); } catch {}

        if ((data.code === 0 || data.code === "0") && data.data) {
          allProducts.push(data.data);
          log(`  ✅  ${productId}  →  OK`);
        } else {
          const errMsg = data.msg || 'réponse invalide';
          log(`  ⚠️  ${productId}  →  ERREUR : ${errMsg}`);
        }

      } catch (err) {
        log(`  ❌  ${productId}  →  EXCEPTION : ${err.message}`);
      }
    }

    // ── 2. RÉCAPITULATIF ───────────────────────────────────────────────────
    log(SEP);
    log(`  TOTAL RÉCUPÉRÉS : ${allProducts.length} / ${MY_PRODUCT_IDS.length}`);
    log(SEP);

    // ── 3. DÉTAIL PRODUITS ─────────────────────────────────────────────────
    allProducts.forEach((product, index) => {
      const varCount = product.variantlist ? product.variantlist.length : 0;

      log("");
      log(SEP);
      log(`  [${String(index + 1).padStart(2, '0')}]  ${product.title}`);
      log(`        ID : ${product.id}    |    Variants : ${varCount}`);
      log(SEP2);

      if (varCount === 0) {
        log("        Aucun variant.");
        return;
      }

      // Grouper les variants par couleur (option1)
      const colorGroups = {};

      product.variantlist.forEach((variant) => {
        let color = (variant.option1 || 'N/A').replace(/ one$/i, '').trim();
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
        log(`        🎨  ${color}  (${variants.length} taille(s))`);
        variants.forEach((v) => {
          const sizeStr = v.size    ? `SIZE: ${v.size.padEnd(6)}` : `SIZE: ${'—'.padEnd(6)}`;
          const opt3Str = v.option3 ? `  |  OPT3: ${v.option3}` : '';
          log(`              ID: ${v.id}  |  ${sizeStr}  |  SKU: ${v.sku}  |  PRIX: $${v.price}  |  POIDS: ${v.weight}g  |  STOCK: ${v.stock}${opt3Str}`);
        });
        log("");
      });
    });

    log(SEP);
    log("  ✅  FIN DU LOG");
    log(SEP);

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