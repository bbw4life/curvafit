const fetch  = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { cj_id } = event.queryStringParameters || {};

  if (!cj_id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Missing cj_id parameter' })
    };
  }

  try {
    const apiKey    = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;

    // Stratégie : parcourir les pages de product_list jusqu'à trouver le produit
    // (même logique que fetch-eprolo-products.js qui fonctionne)
    let page = 1;
    const limit = 100;
    let found = null;

    while (!found && page <= 20) { // max 20 pages = 2000 produits
      const timestamp = Date.now();
      const sign = crypto
        .createHash('md5')
        .update(apiKey + timestamp + apiSecret)
        .digest('hex');

      const url = `https://openapi.eprolo.com/product_list.html?sign=${sign}&timestamp=${timestamp}&page=${page}&limit=${limit}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'apiKey': apiKey }
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error('[get-product-stock] JSON parse error page', page);
        break;
      }

      if ((data.code === 0 || data.code === '0') && data.data && data.data.length > 0) {
        // Chercher le produit par son id
        found = data.data.find(p => String(p.id) === String(cj_id));

        if (data.data.length < limit) break; // dernière page
        page++;
      } else {
        break;
      }
    }

    if (!found) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success:    false,
          cj_id:      cj_id,
          totalStock: null,
          error:      'Product not found in EPROLO catalog'
        })
      };
    }

    // Additionner le stock de toutes les variantes
    const variants    = found.variantlist || [];
    const totalStock  = variants.reduce((sum, v) => {
      return sum + (parseInt(v.inventory_quantity) || 0);
    }, 0);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success:      true,
        cj_id:        cj_id,
        totalStock:   totalStock,
        variantCount: variants.length
      })
    };

  } catch (error) {
    console.error('[get-product-stock] Error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};