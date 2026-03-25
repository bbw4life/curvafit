// ═══════════════════════════════════════════════════════════════
//  CurvaFit AI Chatbot — Netlify Function
//  File: netlify/functions/chat.js  (or functions/chat/chat.js)
//
//  products.data.json is fetched via HTTP from the same Netlify
//  domain at runtime → always in sync with your deployed JSON.
//  Path used: /products.data.json  (root of your published site)
// ═══════════════════════════════════════════════════════════════

const https = require('https');
const http  = require('http');

// ── Generic GET (returns parsed JSON) ───────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('JSON parse error in: ' + url + ' — ' + raw.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

// ── HTTPS POST (for Groq API) ────────────────────────────────────
function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u    = new URL(url);
    const data = JSON.stringify(body);
    const req  = https.request(
      {
        hostname: u.hostname,
        path:     u.pathname + u.search,
        method:   'POST',
        headers:  { ...headers, 'Content-Length': Buffer.byteLength(data) }
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch (e) { reject(new Error('Groq JSON parse error: ' + raw.slice(0, 200))); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── In-memory cache ──────────────────────────────────────────────
let PRODUCTS  = [];
let SETTINGS  = {};
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Load products.data.json via HTTP from the live site ─────────
async function loadProducts(siteUrl) {
  const now = Date.now();
  if (PRODUCTS.length > 0 && (now - cacheTime) < CACHE_TTL) return;

  const url = `${siteUrl}/products.data.json`;
  console.log('[chat] Fetching:', url);

  const all = await httpGet(url);
  SETTINGS  = all.find(x => x.type === 'settings') || {};
  PRODUCTS  = all.filter(x => x.type !== 'settings' && x.active !== false);
  cacheTime = now;
  console.log(`[chat] Loaded ${PRODUCTS.length} products, settings keys:`, Object.keys(SETTINGS));
}

// ── Product page URL ─────────────────────────────────────────────
function getProductUrl(product) {
  const idx = PRODUCTS.indexOf(product);
  return idx === -1 ? '/shop.html' : `/products/product${idx + 1}.html`;
}

// ── Build catalog string for system prompt ───────────────────────
function buildProductCatalog() {
  if (!PRODUCTS.length) return 'No products loaded yet.';

  return PRODUCTS.map((p) => {

    // Colors — name + hex + variant image
    const colors = (p.colors || [])
      .filter(c => c.active !== false)
      .map(c => `${c.name} [hex:${c.hex}] [img:${c.image || p.image}]`)
      .join(' | ');

    // Sizes
    const sizes = (p.sizes || []).join(', ') || 'One size';

    // Variants (color + size + price)
    const variants = (p.variants || [])
      .filter(v => v.active !== false)
      .slice(0, 8) // keep prompt length reasonable
      .map(v => {
        const parts = [];
        if (v.color) parts.push(v.color);
        if (v.size)  parts.push(v.size);
        parts.push(`$${Number(v.price).toFixed(2)}`);
        return parts.join('/');
      })
      .join(' | ');

    // Discounts
    const discounts = [];
    if ((p.single_discount || 0) > 0) discounts.push(`×1 item: -${p.single_discount}%`);
    if ((p.duo_discount    || 0) > 0) discounts.push(`×2 items: -${p.duo_discount}%`);
    if ((p.trio_discount   || 0) > 0) discounts.push(`×3 items: -${p.trio_discount}%`);

    // Delivery
    const delivery = (p.start_date && p.end_date)
      ? `Estimated delivery: ${p.start_date} → ${p.end_date}`
      : 'Standard delivery';

    // Rating
    const rating = p.rating
      ? `${p.rating}/5 (${p.reviews_count || 0} reviews)`
      : '';

    return [
      `--- PRODUCT ---`,
      `TITLE: ${p.title}`,
      `DESCRIPTION: ${p.description}`,
      `PRICE: $${Number(p.price).toFixed(2)}  (was: $${Number(p.compare_price).toFixed(2)})`,
      `SIZES: ${sizes}`,
      `COLORS: ${colors || 'N/A'}`,
      `VARIANTS: ${variants || 'N/A'}`,
      `DISCOUNTS: ${discounts.length ? discounts.join(', ') : 'none'}`,
      delivery,
      rating ? `RATING: ${rating}` : '',
      `PAGE_URL: ${getProductUrl(p)}`,
      `MAIN_IMAGE: ${p.image}`,
    ].filter(Boolean).join('\n');

  }).join('\n\n');
}

// ── Programs string ──────────────────────────────────────────────
function buildProgramsText() {
  const progs = SETTINGS.programs || {};
  if (!Object.keys(progs).length) return 'Programs data not available.';
  return Object.entries(progs)
    .map(([key, v]) => `  - ${key.charAt(0).toUpperCase() + key.slice(1)}: "${v.label}" — $${v.price}`)
    .join('\n');
}

// ── Promo codes string ───────────────────────────────────────────
function buildPromosText() {
  const promos = SETTINGS.promos || [];
  if (!promos.length) return 'No active promo codes.';
  return promos
    .map(p => `  - Code "${p.code}": ${p.percent}% off on ${p.items}+ items`)
    .join('\n');
}

// ── Shipping string ──────────────────────────────────────────────
function buildShippingText() {
  const cd        = SETTINGS.cart_drawer || {};
  const threshold = cd.free_shipping_threshold;
  return threshold
    ? `Free shipping on orders over $${threshold}. Standard shipping cost: $${(SETTINGS.shipping_cost || 10).toFixed(2)}.`
    : `Standard shipping: $${(SETTINGS.shipping_cost || 10).toFixed(2)}.`;
}

// ── Extract product cards to attach to AI reply ──────────────────
function extractProductCards(replyText) {
  const found = [];
  const seen  = new Set();
  const lower = replyText.toLowerCase();

  for (const p of PRODUCTS) {
    if (seen.has(p.id)) continue;

    // Match product title words (ignore short words)
    const words   = p.title.toLowerCase().split(/[\s\-—,]+/).filter(w => w.length > 3);
    const matched = words.some(w => lower.includes(w));
    if (!matched) continue;

    seen.add(p.id);
    found.push({
      id:              p.id,
      title:           p.title,
      description:     p.description,
      price:           Number(p.price),
      compare_price:   Number(p.compare_price),
      url:             getProductUrl(p),
      image:           p.image,
      rating:          p.rating        || null,
      reviews_count:   p.reviews_count || 0,
      sizes:           p.sizes         || [],
      single_discount: p.single_discount || 0,
      duo_discount:    p.duo_discount    || 0,
      trio_discount:   p.trio_discount   || 0,
      delivery_start:  p.start_date || null,
      delivery_end:    p.end_date   || null,
      colors: (p.colors || [])
        .filter(c => c.active !== false)
        .map(c => ({
          name:  c.name,
          hex:   c.hex,
          image: c.image || p.image
        })),
    });

    if (found.length >= 3) break;
  }

  return found;
}

// ── Full system prompt ───────────────────────────────────────────
function buildSystemPrompt() {
  const social   = SETTINGS.social_links || {};
  const whatsapp = social.whatsapp || 'https://wa.me/XXXXXXXX';
  const telegram = social.telegram || null;

  return `You are Curva, the official AI support assistant for CurvaFit.
Your display name is "Curva Support". NEVER call yourself "Cora", "Claude", "AI", or anything else.
Always respond in English, in a warm, motivating, and human tone.

════════════════════════════════
YOUR ROLE
════════════════════════════════
You help plus-size women lose weight safely and sustainably.
You are: a motivating coach, a strategic advisor, a kind guide, and a smart seller.

You always:
• Motivate without judging
• Simplify advice
• Encourage consistency
• Adapt to beginners
• Never sound robotic

════════════════════════════════
⚠️ CRITICAL — PRODUCT RULES
════════════════════════════════
1. NEVER mention internal IDs like: resistance-bands, yoga-mat, leggings, sports-bra,
   hydration-bottle, workout-towel, fitness-tracker, protein-shaker, dumbbell-set,
   jump-rope, foam-roller, yoga-blocks, ankle-weights, cooling-towel, massage-ball, gym-bag.
   These are invisible backend codes — customers must never see them.

2. ALWAYS use the full TITLE when referring to any product.

3. When asked about colors: list each COLOR NAME and note that its image is available.

4. When describing a product, include:
   • Full title
   • Description
   • Price (and original price)
   • Available sizes
   • Available colors (with names)
   • Delivery estimate
   • Active discounts

5. Never invent any product info not in the catalog below.

6. For product links: just mention the product naturally. The frontend renders
   a "View Product" button automatically using the PAGE_URL — do not write raw URLs.

════════════════════════════════
🛍️ LIVE PRODUCT CATALOG
════════════════════════════════
${buildProductCatalog()}

════════════════════════════════
💪 PROGRAMS (live data)
════════════════════════════════
${buildProgramsText()}
Programs page: /programs.html
After purchase: email + password sent → access to partner platform.
Can update account info later.

════════════════════════════════
🎟️ PROMO CODES (live data)
════════════════════════════════
${buildPromosText()}

════════════════════════════════
🚚 SHIPPING
════════════════════════════════
${buildShippingText()}

════════════════════════════════
🤝 HUMAN SUPPORT
════════════════════════════════
If the user asks for a human, is unsatisfied, or insists:
1. Respond calmly and reassure
2. Immediately offer:
   👉 WhatsApp: ${whatsapp}${telegram ? '\n   👉 Telegram: ' + telegram : ''}
   👉 Contact page: /contact.html

════════════════════════════════
🥗 NUTRITION
════════════════════════════════
Give simple, practical, daily-applicable advice.
Focus on: calorie deficit 300-500 cal/day, protein at every meal, 2L water, no extreme diets.
Always recommend a doctor for medical conditions.

════════════════════════════════
💬 RESULTS & TRUST
════════════════════════════════
• Results visible in 4-6 weeks with consistency
• ~70% success rate when advice is followed
• NEVER promise guaranteed results
• CurvaFit is science-based, founded by Paul Francenel (25, entrepreneur, not a doctor)

════════════════════════════════
🚫 FORBIDDEN
════════════════════════════════
• Exposing internal product IDs
• Inventing product data or prices
• Promising miracle results
• Advanced medical advice
• Ignoring human support requests
`;
}

// ════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════
exports.handler = async (event) => {
  const corsHeaders = {
    'Content-Type':                 'application/json',
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'GROQ_API_KEY not configured on server' }) };
  }

  // Parse body
  let reqBody;
  try { reqBody = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { message = '', history = [] } = reqBody;
  if (!message.trim()) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Empty message' }) };
  }

  // ── Resolve site URL from the request host header ────────────
  // This automatically works on Netlify, Netlify Dev, and custom domains.
  const host    = event.headers?.host || event.headers?.Host || '';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  const proto   = isLocal ? 'http' : 'https';
  const siteUrl = `${proto}://${host}`;

  // Load product data (cached 5 min)
  try {
    await loadProducts(siteUrl);
  } catch (err) {
    console.error('[chat] loadProducts failed:', err.message);
    // Continue — system prompt will say catalog not available
  }

  // Build Groq messages
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...history.slice(-10).map(h => ({ role: h.role, content: String(h.content || '') })),
    { role: 'user', content: message },
  ];

  try {
    const groqRes = await httpsPost(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type':  'application/json',
      },
      {
        model:       'llama-3.3-70b-versatile',
        messages,
        max_tokens:  700,
        temperature: 0.7,
      }
    );

    if (groqRes.error) throw new Error(groqRes.error.message || 'Groq API error');

    const reply    = groqRes.choices?.[0]?.message?.content || '';
    const products = extractProductCards(reply);

    return {
      statusCode: 200,
      headers:    corsHeaders,
      body:       JSON.stringify({ reply, products }),
    };

  } catch (err) {
    console.error('[chat] Groq error:', err.message);
    return {
      statusCode: 500,
      headers:    corsHeaders,
      body:       JSON.stringify({ error: 'AI service error', details: err.message }),
    };
  }
};