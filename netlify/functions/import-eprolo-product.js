// import-eprolo-product.js
const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  try {
    if (!event.body) throw new Error("Envoie { productId: 'resistance-bands' } ou { all: true }");

    const { productId, all } = JSON.parse(event.body);
    const productsData = require('./products.data.json'); // ou fetch si tu veux

    let toImport = [];
    if (all) {
      toImport = productsData.filter(p => p.stock_managed_by === "eprolo" && p.active);
    } else {
      const found = productsData.find(p => p.id === productId);
      if (!found) throw new Error("Produit non trouvé dans products.data.json");
      toImport = [found];
    }

    const apiKey = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;
    const BASE_URL = process.env.BASE_URL || `https://${event.headers.host}`;

    for (const prod of toImport) {
      const timestamp = Date.now();
      const sign = crypto.createHash('md5').update(apiKey + timestamp + apiSecret).digest('hex');

      // Mapping parfait avec ton products.data.json
      const body = {
        title: prod.title,
        body_html: prod.description || "<p>Imported from CurvaFit</p>",
        product_id: prod.cj_id || prod.id,   // ← important : utilise ton cj_id
        optionList: prod.colors.length > 0 ? [{ name: "Color" }] : [],
        variantsList: prod.variants.map((v, i) => ({
          title: `${v.color} ${v.size || ''}`.trim(),
          sku: `CF-${prod.cj_id}-${i}`,           // tu peux changer
          option1: v.color || "",
          option2: v.size || "",
          image_id: "1"                           // on met 1 pour l’instant
        })),
        imageList: prod.media.slice(0, 5).map((src, i) => ({
          src: src,
          position: String(i + 1),
          images_id: String(i + 1)
        }))
      };

      const url = `https://openapi.eprolo.com/insert_product.html?sign=${sign}&timestamp=${timestamp}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "apiKey": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { code: -1 }; }

      if (data.code === "0") {
        console.log(`✅ IMPORTÉ : ${prod.title} → EPROLO ID: ${data.data.id}`);
        // Tu peux maintenant utiliser data.data.variantlist[0].id comme variantsid
      } else {
        console.error(`❌ ÉCHEC import ${prod.title} :`, data.msg || text);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, imported: toImport.length }) };

  } catch (error) {
    console.error("IMPORT ERROR", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};