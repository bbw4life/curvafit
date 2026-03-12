// fetch-eprolo-products.js  ← VERSION AMÉLIORÉE (pagination + recherche)
const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  console.log("[EPROLO PRODUCTS] 🚀 Lancement avec recherche + pagination");

  try {
    const apiKey = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;
    const timestamp = Date.now();
    const sign = crypto.createHash('md5').update(apiKey + timestamp + apiSecret).digest('hex');

    // 🔥 Recherche automatique du Butterfly Pillow
    const keyword = "Butterfly";  // ou "Memory Neck" si tu veux être plus précis
    const page = 1;
    const limit = 100;

    const url = `https://openapi.eprolo.com/product_list.html?sign=${sign}&timestamp=${timestamp}&page=${page}&limit=${limit}&keyword=${encodeURIComponent(keyword)}`;

    console.log(`[EPROLO] URL utilisée : ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: { "apiKey": apiKey }
    });

    const responseText = await response.text();
    console.log("[EPROLO] Status:", response.status);
    console.log("[EPROLO] Response (premiers 800 chars):", responseText.substring(0, 800));

    let data;
    try { data = JSON.parse(responseText); } catch { data = {}; }

    if (response.ok && data.code === 0 && data.data && data.data.length > 0) {
      console.log(`✅ ${data.data.length} produit(s) trouvés pour "${keyword}" !`);

      data.data.forEach(product => {
        console.log(`\n=== PRODUIT TROUVÉ ===`);
        console.log(`Product ID (à utiliser dans get-eprolo-product-detail) : ${product.id}`);
        console.log(`Titre : ${product.title}`);
        console.log(`Variants disponibles :`);
        product.variantlist.forEach(v => {
          console.log(`   → variantsid (le BON à copier) : ${v.id} | ${v.title} | Cost: $${v.cost}`);
        });
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, products: data.data })
      };
    } else {
      console.error("[EPROLO] Pas de résultat ou erreur:", data.msg || responseText);
      return { statusCode: 200, body: JSON.stringify({ success: false, error: data.msg || "Aucun produit trouvé" }) };
    }
  } catch (error) {
    console.error("[EPROLO PRODUCTS ERROR]", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};