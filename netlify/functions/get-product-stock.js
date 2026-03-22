// netlify/functions/get-product-stock.js
// Retourne le stock total d'un produit EPROLO via son cj_id (product ID EPROLO)

const fetch  = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // OPTIONS preflight
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

    const timestamp = Date.now();
    const sign      = crypto
      .createHash('md5')
      .update(apiKey + timestamp + apiSecret)
      .digest('hex');

    // Appel API EPROLO — détail d'un produit
    const url = `https://openapi.eprolo.com/product_detail.html?sign=${sign}&timestamp=${timestamp}&product_id=${cj_id}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'apiKey': apiKey }
    });

    const data = await response.json();

    if ((data.code === 0 || data.code === '0') && data.data) {
      const product  = data.data;
      const variants = product.variantlist || [];

      // Additionner le stock de toutes les variantes
      const totalStock = variants.reduce((sum, v) => {
        const qty = parseInt(v.inventory_quantity) || 0;
        return sum + qty;
      }, 0);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success:     true,
          cj_id:       cj_id,
          totalStock:  totalStock,
          variantCount: variants.length
        })
      };
    } else {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success:    false,
          cj_id:      cj_id,
          totalStock: null,
          error:      data.message || 'Product not found'
        })
      };
    }

  } catch (error) {
    console.error('[get-product-stock] Error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};