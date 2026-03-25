// ═══════════════════════════════════════════════════════════════
//  CurvaFit AI Chatbot — Netlify Function  (/.netlify/functions/chat)
//  File: netlify/functions/chat.js
// ═══════════════════════════════════════════════════════════════

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── Helper: HTTPS POST (no external dependency) ──────────────────
function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u   = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request(
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
          catch (e) { reject(new Error('JSON parse error: ' + raw.slice(0, 200))); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Load products.data.json at cold start ────────────────────────
let PRODUCTS = [];
let SETTINGS = {};

function loadProducts() {
  if (PRODUCTS.length > 0) return; // already loaded
  try {
    // Netlify deploys static files at process.cwd() / publish dir
    // Try several possible paths
    const candidates = [
      path.join(process.cwd(), 'products.data.json'),
      path.join(process.cwd(), 'public', 'products.data.json'),
      path.join(__dirname, '..', '..', 'products.data.json'),
      path.join(__dirname, '..', '..', 'public', 'products.data.json'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const all  = JSON.parse(raw);
        SETTINGS   = all.find(x => x.type === 'settings') || {};
        PRODUCTS   = all.filter(x => x.type !== 'settings' && x.active !== false);
        console.log(`[chat] Loaded ${PRODUCTS.length} products from ${p}`);
        return;
      }
    }
    console.warn('[chat] products.data.json not found in any candidate path');
  } catch (e) {
    console.error('[chat] Failed to load products.data.json:', e.message);
  }
}

// ── Build a clean product summary for the system prompt ─────────
function buildProductCatalog() {
  if (!PRODUCTS.length) return 'No products available.';

  return PRODUCTS.map((p) => {
    // Colors with images
    const colorList = (p.colors || [])
      .filter(c => c.active !== false)
      .map(c => `${c.name} (hex:${c.hex}, image:${c.image || ''})`)
      .join(' | ');

    // Sizes
    const sizeList = (p.sizes || []).join(', ') || 'One size';

    // Discounts
    const discounts = [];
    if (p.single_discount > 0) discounts.push(`single -${p.single_discount}%`);
    if (p.duo_discount    > 0) discounts.push(`duo -${p.duo_discount}%`);
    if (p.trio_discount   > 0) discounts.push(`trio -${p.trio_discount}%`);

    // Delivery dates
    const delivery = (p.start_date && p.end_date)
      ? `Estimated delivery: ${p.start_date} → ${p.end_date}`
      : '';

    // Product URL slug (index in array → product{N}.html)
    const idx       = PRODUCTS.indexOf(p) + 1;
    const productUrl = `/products/product${idx}.html`;

    return [
      `PRODUCT_ID: ${p.id}`,
      `TITLE: ${p.title}`,
      `DESCRIPTION: ${p.description}`,
      `PRICE: $${p.price.toFixed(2)}  (was $${p.compare_price.toFixed(2)})`,
      `SIZES: ${sizeList}`,
      `COLORS: ${colorList || 'N/A'}`,
      `DISCOUNTS: ${discounts.join(', ') || 'none'}`,
      delivery,
      `URL: ${productUrl}`,
      `MAIN_IMAGE: ${p.image}`,
      `RATING: ${p.rating || 'N/A'} (${p.reviews_count || 0} reviews)`,
      `SKU: ${p.sku_internal}`,
      `CURRENCY: ${p.currency || 'USD'}`,
    ].filter(Boolean).join('\n');
  }).join('\n\n---\n\n');
}

// ── Build programs summary ───────────────────────────────────────
function buildProgramsSummary() {
  const progs = SETTINGS.programs || {};
  return Object.entries(progs)
    .map(([k, v]) => `${k.toUpperCase()}: "${v.label}" — $${v.price}`)
    .join('\n') || 'Programs info not available.';
}

// ── Build promo codes summary ────────────────────────────────────
function buildPromoSummary() {
  const promos = SETTINGS.promos || [];
  return promos
    .map(p => `Code "${p.code}": ${p.percent}% off on ${p.items}+ items`)
    .join('\n') || 'No active promo codes.';
}

// ── Extract product mentions from AI reply ───────────────────────
// Returns [{title, price, compare_price, url, image, colors}]
function extractProductsFromReply(replyText) {
  const found = [];
  const seen  = new Set();

  for (const p of PRODUCTS) {
    // Match by title keywords (case-insensitive)
    const keywords = p.title.split(/\s+/).filter(w => w.length > 3);
    const mentioned = keywords.some(kw =>
      replyText.toLowerCase().includes(kw.toLowerCase())
    );

    if (mentioned && !seen.has(p.id)) {
      seen.add(p.id);
      const idx = PRODUCTS.indexOf(p) + 1;
      found.push({
        id:            p.id,
        title:         p.title,
        description:   p.description,
        price:         p.price,
        compare_price: p.compare_price,
        url:           `/products/product${idx}.html`,
        image:         p.image,
        colors:        (p.colors || []).filter(c => c.active !== false).map(c => ({
          name:  c.name,
          hex:   c.hex,
          image: c.image || p.image
        })),
        sizes:         p.sizes || [],
        rating:        p.rating || null,
        reviews_count: p.reviews_count || 0
      });
    }
    if (found.length >= 3) break; // max 3 cards per reply
  }

  return found;
}

// ── System prompt ────────────────────────────────────────────────
function buildSystemPrompt() {
  loadProducts();

  const catalog  = buildProductCatalog();
  const programs = buildProgramsSummary();
  const promos   = buildPromoSummary();
  const whatsapp = (SETTINGS.social_links || {}).whatsapp || '#';
  const telegram = (SETTINGS.social_links || {}).telegram || '#';

  return `You are Curva, the official AI support assistant for CurvaFit — a fitness brand specializing in plus-size women's weight loss.

YOUR NAME IS CURVA. Never call yourself "Cora", "AI", or any other name.

════════════════════════════════════
PERSONALITY & TONE
════════════════════════════════════
- Warm, motivating, never judgmental
- Human and natural — never robotic
- Speak English always, regardless of the user's language
- Keep responses concise but complete
- Use emojis sparingly and naturally

════════════════════════════════════
CRITICAL RULES — PRODUCT RESPONSES
════════════════════════════════════
1. NEVER mention internal IDs (resistance-bands, yoga-mat, leggings, etc.)
2. ALWAYS use the full TITLE when referring to a product (e.g. "Smart Hula Hoop — Waist Burner")
3. When a user asks about a product's colors, ALWAYS list:
   - The color NAME
   - The color's IMAGE URL (from the COLORS field)
   Format example: "Available in Blue (image: https://...) and Pink (image: https://...)"
4. When mentioning a product, include:
   - Full title
   - Price
   - Sizes available
   - Colors available (with image URLs)
   - Delivery estimate if available
   - Discount info if applicable
5. NEVER invent prices, stock, or features not listed below
6. Product links must use the URL field exactly as provided — NEVER construct your own URLs

════════════════════════════════════
LINK FORMAT (IMPORTANT)
════════════════════════════════════
When you want the user to view a product, write it as plain text like:
"You can view it here: [product URL]"
The frontend will automatically create a button — you do NOT need to write HTML or Markdown links.
Just mention the product naturally and the system will display a card with the correct link.

════════════════════════════════════
PRODUCT CATALOG (LIVE DATA)
════════════════════════════════════
${catalog}

════════════════════════════════════
PROGRAMS
════════════════════════════════════
${programs}
Programs page: /programs.html

════════════════════════════════════
PROMO CODES
════════════════════════════════════
${promos}

════════════════════════════════════
HUMAN SUPPORT
════════════════════════════════════
If user asks to speak to a human, is frustrated, or has a complex issue:
- Respond calmly
- Offer: WhatsApp: ${whatsapp}
- Or visit: /contact.html

════════════════════════════════════
HEALTH DISCLAIMER
════════════════════════════════════
CurvaFit is NOT a medical service. Always recommend consulting a doctor for health issues.

════════════════════════════════════
ABOUT CURVAFIT
════════════════════════════════════
Founded by Paul Francenel (25, entrepreneur). Mission: help plus-size women transform their lives safely.
No pills. 100% natural. Home workouts. Results in 4-6 weeks with consistency (~70% success rate when followed).
Expected results: visible in 4-6 weeks.

════════════════════════════════════
FORBIDDEN
════════════════════════════════════
- Never invent prices or product data
- Never promise guaranteed results
- Never give advanced medical advice
- Never expose internal product IDs
- Never ignore a human support request
`;
}

// ── Main handler ─────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GROQ_API_KEY not configured' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { message = '', history = [] } = body;

  if (!message.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Empty message' }) };
  }

  // Ensure products are loaded
  loadProducts();

  // Build messages array for Groq
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];

  try {
    const groqResponse = await httpsPost(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        'Authorization':  `Bearer ${GROQ_API_KEY}`,
        'Content-Type':   'application/json',
      },
      {
        model:       'llama-3.3-70b-versatile',
        messages,
        max_tokens:  600,
        temperature: 0.7,
      }
    );

    if (groqResponse.error) {
      throw new Error(groqResponse.error.message || 'Groq API error');
    }

    const reply = groqResponse.choices?.[0]?.message?.content || '';

    // Extract product cards to attach to the response
    const products = extractProductsFromReply(reply);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply, products })
    };

  } catch (err) {
    console.error('[chat] Groq error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error:   'AI service error',
        details: err.message
      })
    };
  }
};