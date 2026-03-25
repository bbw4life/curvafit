/* ================================================================
   CURVAFIT AI CHATBOT — Netlify Function
   File: netlify/functions/chat.js

   ✅ Fetches products.data.json dynamically at runtime
   ✅ Correct product URLs (no internal IDs sent to user)
   ✅ Color images included in product cards
   ✅ Full system prompt: coach + nutrition + programs + support
   ✅ Assistant name: Curva Support
   ✅ Responds in user's language (FR/EN)
================================================================ */

const fetch = require('node-fetch');
const path  = require('path');
const fs    = require('fs');

/* ── Helper: load products.data.json from the published site ── */
async function loadProductsData() {
  // Try local file first (works in Netlify build environment)
  const localPaths = [
    path.join(process.cwd(), 'products.data.json'),
    path.join(process.cwd(), 'public', 'products.data.json'),
    path.join(process.cwd(), 'dist', 'products.data.json'),
    path.join(__dirname, '..', '..', 'products.data.json'),
    path.join(__dirname, '..', '..', 'public', 'products.data.json'),
  ];

  for (const p of localPaths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      // continue
    }
  }

  // Fallback: fetch from deployed site URL (set SITE_URL env var in Netlify)
  const siteUrl = process.env.SITE_URL || process.env.URL || 'https://curvafit.com';
  const res = await fetch(`${siteUrl}/products.data.json`);
  if (!res.ok) throw new Error(`Cannot load products.data.json: ${res.status}`);
  return res.json();
}

/* ── Build product index from raw data ── */
function buildProductIndex(rawData) {
  const products = [];
  const settings = rawData.find(p => p.type === 'settings') || {};

  rawData.forEach((item, index) => {
    if (item.type === 'settings' || !item.id || !item.active) return;

    const productNumber = rawData
      .filter(p => p.type !== 'settings' && p.id && p.active)
      .findIndex(p => p.id === item.id) + 1;

    // Build colors with images
    const colorsWithImages = (item.colors || [])
      .filter(c => c.active !== false)
      .map(c => ({
        name: c.name,
        hex:  c.hex  || '',
        image: c.image || item.image || ''
      }));

    // Delivery dates
    const startDate = item.start_date || '';
    const endDate   = item.end_date   || '';

    // Discounts
    const discounts = {
      single: item.single_discount || 0,
      duo:    item.duo_discount    || 0,
      trio:   item.trio_discount   || 0
    };

    // Price range (cheapest variant)
    const variantPrices = (item.variants || []).map(v => v.price).filter(Boolean);
    const minPrice = variantPrices.length ? Math.min(...variantPrices) : item.price;

    products.push({
      id:             item.id,
      productNumber,
      title:          item.title,
      description:    item.description,
      price:          minPrice,
      maxPrice:       item.price,
      compare_price:  item.compare_price,
      image:          item.image,
      colors:         colorsWithImages,
      sizes:          item.sizes || [],
      variants:       item.variants || [],
      discounts,
      startDate,
      endDate,
      rating:         item.rating        || null,
      reviewsCount:   item.reviews_count || null,
      url:            `/products/product${productNumber}.html`,
      cj_id:          item.cj_id
    });
  });

  return { products, settings };
}

/* ── Search products by query ── */
function searchProducts(query, products) {
  if (!query) return [];
  const q = query.toLowerCase();
  const keywords = q.split(/\s+/).filter(k => k.length >= 2);

  const scored = products.map(p => {
    let score = 0;
    const searchText = `${p.title} ${p.description}`.toLowerCase();

    keywords.forEach(kw => {
      if (searchText.includes(kw)) score += 3;
      if (p.title.toLowerCase().includes(kw)) score += 2;
      p.colors.forEach(c => {
        if (c.name.toLowerCase().includes(kw)) score += 2;
      });
      p.sizes.forEach(s => {
        if (String(s).toLowerCase().includes(kw)) score += 1;
      });
    });

    // Thematic matching (FR + EN)
    const themes = [
      { words: ['hula','hoop','belly','ventre','waist burn','brûle'],  id: 'resistance-bands', boost: 10 },
      { words: ['waist trainer','gainant','waist cinch','corset','taille'], id: 'yoga-mat', boost: 10 },
      { words: ['jump rope','corde','cardio','skip'],                  id: 'leggings', boost: 10 },
      { words: ['legging','yoga pant','pantalon','high waist','peach'],id: 'sports-bra', boost: 10 },
      { words: ['jumpsuit','combinaison','pilates','zip'],             id: 'hydration-bottle', boost: 10 },
      { words: ['tie dye','seamless legging','legging'],               id: 'workout-towel', boost: 10 },
      { words: ['sport bra','bra','brassiere','soutien','shock'],      id: 'fitness-tracker', boost: 10 },
      { words: ['knee','genoux','protection genou','pad'],             id: 'protein-shaker', boost: 10 },
      { words: ['posture','dos','back','corrector','correcteur'],      id: 'dumbbell-set', boost: 10 },
      { words: ['bracelet','tracker','heart rate','sleep','sommeil','pouls'], id: 'jump-rope', boost: 10 },
      { words: ['acupressure','stress','recovery','récupération','tapis'], id: 'foam-roller', boost: 10 },
      { words: ['belly belt','ceinture','cramp','chaleur','heat','ventre chaud'], id: 'yoga-blocks', boost: 10 },
      { words: ['bottle','water','eau','gourde','bouteille','hydrat'], id: 'ankle-weights', boost: 10 },
      { words: ['shoe','chaussure','running','sneaker','basket'],      id: 'cooling-towel', boost: 10 },
      { words: ['pillow','oreiller','neck','cervical','nuque'],        id: 'massage-ball', boost: 10 },
      { words: ['earbuds','headphone','music','musique','écouteur','wireless'], id: 'gym-bag', boost: 10 },
    ];

    themes.forEach(t => {
      if (p.id === t.id && t.words.some(w => q.includes(w))) {
        score += t.boost;
      }
    });

    // Price filters
    if ((q.includes('cheap') || q.includes('budget') || q.includes('pas cher') || q.includes('moins de 20')) && p.price < 20) score += 5;
    if ((q.includes('premium') || q.includes('best') || q.includes('meilleur') || q.includes('top')) && p.price > 25) score += 3;
    if (q.includes('color') || q.includes('couleur')) score += 2;

    return { ...p, score };
  });

  return scored.filter(p => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
}

/* ── Format delivery dates ── */
function formatDelivery(startDate, endDate) {
  if (!startDate || !endDate) return 'Contact us for delivery times';
  try {
    const opts = { day: '2-digit', month: '2-digit', year: '2-digit' };
    const s = new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', opts);
    const e = new Date(endDate   + 'T00:00:00').toLocaleDateString('en-GB', opts);
    return `${s} – ${e}`;
  } catch (_) {
    return `${startDate} to ${endDate}`;
  }
}

/* ── Build system prompt ── */
function buildSystemPrompt(products, settings) {
  const programs  = settings.programs  || {};
  const promos    = settings.promos    || [];
  const socials   = settings.social_links || {};
  const shipping  = settings.cart_drawer  || {};

  // Programs info
  const programsText = Object.entries(programs).map(([key, val]) => (
    `• ${val.label}: $${val.price}`
  )).join('\n');

  // Promo codes
  const promosText = promos.map(p =>
    `• Code "${p.code}" → ${p.percent}% off on orders of ${p.items}+ items`
  ).join('\n');

  // Build product catalog for AI
  const catalogText = products.map((p, i) => {
    const colorsList = p.colors.map(c => `${c.name} (${c.hex})`).join(', ');
    const sizesList  = p.sizes.length ? p.sizes.join(', ') : 'No size needed';
    const discount   = p.discounts;
    const discountText = [
      discount.single ? `Single: -${discount.single}%` : '',
      discount.duo    ? `Buy 2: -${discount.duo}%`    : '',
      discount.trio   ? `Buy 3: -${discount.trio}%`   : '',
    ].filter(Boolean).join(' | ') || 'No active discount';
    const ratingText = p.rating ? `${p.rating}/5 (${p.reviewsCount || 0} reviews)` : 'No rating yet';
    const delivery   = formatDelivery(p.startDate, p.endDate);

    return `
PRODUCT ${i + 1}:
  Title: ${p.title}
  Description: ${p.description}
  Price: $${p.price}${p.maxPrice !== p.price ? ` – $${p.maxPrice}` : ''} (was $${p.compare_price})
  Rating: ${ratingText}
  Colors available: ${colorsList || 'N/A'}
  Sizes available: ${sizesList}
  Discounts: ${discountText}
  Delivery estimate: ${delivery}
  Product URL: ${p.url}`;
  }).join('\n');

  return `You are **Curva**, the official AI assistant and fitness coach of CurvaFit.

═══════════════════════════════════════
🎯 YOUR MAIN ROLE
═══════════════════════════════════════
You are NOT just a chatbot. You are:
- A warm and motivating fitness coach
- A strategic advisor for weight loss
- A kind body-positive guide
- An intelligent advisor (when relevant)

Always respond in the SAME LANGUAGE the user writes in (French or English).
Be human, warm, never robotic. Use emojis naturally.

═══════════════════════════════════════
🧠 PRIORITY 1 — CURVAFIT MISSION (Core)
═══════════════════════════════════════
CurvaFit helps plus-size women lose weight in a healthy, realistic and motivating way.
- Based on science, not extremes
- Progressive and sustainable approach
- No pills, no crash diets
- 100% at-home workouts
- Expected results: visible in 4–6 weeks with consistency
- Safe weight loss rate: 0.5–1 kg/week (2–4 kg/month)
- 70% chance of results if advice is followed consistently

Always:
- Motivate without judging
- Simplify advice
- Encourage consistency
- Adapt to beginners

═══════════════════════════════════════
🏋️ PRIORITY 2 — PROGRAMS
═══════════════════════════════════════
CurvaFit works with professional partners for fitness programs.

Available programs:
${programsText}

How it works:
- Plans available on the "Programs" page
- After purchase: email + password sent
- Access to partner platform
- Can update personal info later

Reassure users about security, explain the process simply.

═══════════════════════════════════════
🛍️ PRIORITY 3 — PRODUCTS
═══════════════════════════════════════
STRICT RULES FOR PRODUCTS:
1. ONLY recommend products from the catalog below — NEVER invent products
2. ALWAYS use the exact Title (never the internal ID like "resistance-bands")
3. ALWAYS use the exact Price from the catalog — never guess
4. ALWAYS mention colors by their exact name (e.g. "Purple Verbenaceae", "Dream Sky Blue")
5. ALWAYS give the product URL when recommending
6. NEVER send internal IDs (resistance-bands, yoga-mat, leggings, etc.) to the user
7. When asked about colors, list the color names clearly
8. Mention delivery dates when asked

DISCOUNT CODES:
${promosText}

Shipping:
- Free shipping on orders over $${shipping.free_shipping_threshold || 120}

FULL PRODUCT CATALOG:
${catalogText}

═══════════════════════════════════════
⚠️ PRIORITY 4 — HEALTH
═══════════════════════════════════════
CurvaFit is NOT a doctor or medical clinic.
Always add: "For any health concern, please consult a doctor."
Never give advanced medical advice.

═══════════════════════════════════════
🥗 PRIORITY 5 — NUTRITION
═══════════════════════════════════════
Give simple, practical nutrition advice:
- High protein at every meal (chicken, eggs, fish, legumes)
- Cut liquid sugars (sodas, juices, sweetened coffee)
- 3 structured meals per day — no uncontrolled snacking
- 2 liters of water daily
- Eat until 80% full
- A 300–500 calorie deficit is the target
- Sleep 7–8 hours (controls hunger hormones)

═══════════════════════════════════════
💬 PRIORITY 6 — CONFIDENCE & RESULTS
═══════════════════════════════════════
If a user doubts:
- Be honest: results depend on the person
- Average: visible results in 4–6 weeks
- 70% success rate if advice is followed
- Never promise miracles

═══════════════════════════════════════
👤 PRIORITY 7 — ABOUT CURVAFIT
═══════════════════════════════════════
Founder: Paul Francenel
- 25 years old, entrepreneur
- Not a doctor — works with real professionals
- Goal: help plus-size women transform their lives healthily

═══════════════════════════════════════
🤝 PRIORITY 8 — HUMAN SUPPORT
═══════════════════════════════════════
If the user:
- Asks to speak to a human
- Is not satisfied
- Has a complex specific request
- Insists multiple times

Respond calmly and offer:
👉 WhatsApp: ${socials.whatsapp || 'https://wa.me/contact'}
👉 Or visit the contact page: /contact.html

Say: "I understand 👍 If you prefer to speak directly with our team, you can reach us here:
👉 WhatsApp: [link]
We'll be happy to help you personally 😊"

═══════════════════════════════════════
🚫 ABSOLUTE RULES (NEVER BREAK)
═══════════════════════════════════════
- NEVER invent product prices or data
- NEVER send internal product IDs (resistance-bands, yoga-mat, etc.) to the user
- NEVER promise guaranteed results
- NEVER ignore a human support request
- NEVER give advanced medical advice
- NEVER recommend products not in the catalog
- ALWAYS use the product's Title, not its ID

═══════════════════════════════════════
💡 SMART BEHAVIOR
═══════════════════════════════════════
When relevant, naturally suggest:
- A product that matches the need
- A program
- A nutrition tip
- Human support if needed

Your goal: Help the user understand, get motivated, take action, and improve their life.
Guide them naturally toward CurvaFit solutions — or to a human when needed.`;
}

/* ── Main handler ── */
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { message, history = [] } = JSON.parse(event.body);

    if (!message || message.trim().length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message is required' }) };
    }

    // ── Load dynamic product data ──
    let products = [];
    let settings = {};
    try {
      const rawData = await loadProductsData();
      const built = buildProductIndex(rawData);
      products = built.products;
      settings = built.settings;
    } catch (err) {
      console.error('Could not load products.data.json:', err.message);
      // Continue with empty catalog — AI will still respond
    }

    // ── Find relevant products for this query ──
    const relevantProducts = searchProducts(message, products);

    // ── Build system prompt ──
    const systemPrompt = buildSystemPrompt(products, settings);

    // ── Build messages array for Groq ──
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    // ── Call Groq API ──
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 600,
        temperature: 0.72,
        stream: false
      })
    });

    if (!groqResponse.ok) {
      const err = await groqResponse.text();
      console.error('Groq API error:', err);
      throw new Error(`Groq API error: ${groqResponse.status}`);
    }

    const data  = await groqResponse.json();
    const reply = data.choices?.[0]?.message?.content
      || "I'm sorry, I couldn't generate a response. Please try again. 🙏";

    // ── Format product cards for frontend ──
    const productCards = relevantProducts.slice(0, 2).map(p => ({
      title:         p.title,
      description:   p.description,
      price:         p.price,
      compare_price: p.compare_price,
      url:           p.url,
      image:         p.image,
      colors: p.colors.map(c => ({
        name:  c.name,
        hex:   c.hex,
        image: c.image
      })),
      sizes:    p.sizes,
      delivery: formatDelivery(p.startDate, p.endDate),
      rating:   p.rating,
      discounts: p.discounts
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply, products: productCards })
    };

  } catch (error) {
    console.error('Chat function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};