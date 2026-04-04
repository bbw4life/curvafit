const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────
//  MAPPING : id interne → cj_id EPROLO
//  (extrait de products.data.json — mettre à jour si nouveaux produits)
// ─────────────────────────────────────────────────────────────────
const INTERNAL_TO_CJ = {
  'resistance-bands':  '31246341',
  'yoga-mat':          '31246339',
  'leggings':          '31246387',
  'sports-bra':        '31246342',
  'hydration-bottle':  '31246386',
  'workout-towel':     '31350659',
  'fitness-tracker':   '31246232',
  'protein-shaker':    '31246385',
  'dumbbell-set':      '31246336',
  'jump-rope':         '31246377',
  'foam-roller':       '31246323',
  'yoga-blocks':       '31246335',
  'ankle-weights':     '31246346',
  'cooling-towel':     '31246417',
  'massage-ball':      '31246429',
  'gym-bag':           '31246437',
};

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // ── Accepter ?cj_id=31246341  OU  ?cj_id=resistance-bands ──
  const { cj_id: rawParam } = event.queryStringParameters || {};

  if (!rawParam) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Missing cj_id parameter' })
    };
  }

  // Résoudre : si c'est un id interne → convertir en cj_id numérique
  const cj_id = INTERNAL_TO_CJ[rawParam] || rawParam;

  try {
    const apiKey    = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;

    if (!apiKey || !apiSecret) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'EPROLO API credentials not configured' })
      };
    }

    // ── Appel getproduct.html (même méthode que fetch-eprolo-products.js) ──
    const timestamp = Date.now();
    const sign = crypto
      .createHash('md5')
      .update(apiKey + timestamp + apiSecret)
      .digest('hex');

    const url = `https://openapi.eprolo.com/getproduct.html?sign=${sign}&timestamp=${timestamp}&id=${cj_id}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'apiKey': apiKey }
    });

    const responseText = await response.text();

    let data = {};
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[get-product-stock] JSON parse error:', responseText.slice(0, 200));
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid JSON from EPROLO API' })
      };
    }

    if ((data.code === 0 || data.code === '0') && data.data) {
      const product  = data.data;
      const variants = product.variantlist || [];

      const totalStock = variants.reduce((sum, v) => {
        return sum + (parseInt(v.inventory_quantity) || 0);
      }, 0);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success:      true,
          cj_id:        cj_id,
          internal_id:  rawParam,
          totalStock:   totalStock,
          variantCount: variants.length
        })
      };
    }

    // Produit non trouvé ou erreur EPROLO
    const errMsg = data.msg || 'Product not found';
    console.warn(`[get-product-stock] EPROLO error for cj_id=${cj_id}: ${errMsg}`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success:    false,
        cj_id:      cj_id,
        internal_id: rawParam,
        totalStock: null,
        error:      errMsg
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