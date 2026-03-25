// ═══════════════════════════════════════════════════════════════
//  CURVAFIT — Netlify Function: chat.js
//  Reads all data from products.data.json (products, programs,
//  promos, settings) and passes it dynamically to the Groq API.
// ═══════════════════════════════════════════════════════════════

const fetch = require('node-fetch');
const path  = require('path');
const fs    = require('fs');

// ── Dynamic loading of products.data.json ──────────────────────
// The file is read at each call to guarantee the latest
// data after each redeployment.
function loadData() {
  // Netlify functions run from /var/task — project root is /var/task
  // products.data.json is at the root of the project
  const possiblePaths = [
    path.join(__dirname, '..', 'products.data.json'),   // ../products.data.json (if function is in /netlify/functions)
    path.join(__dirname, 'products.data.json'),          // same folder fallback
    path.resolve(process.cwd(), 'products.data.json'),   // process working directory
    '/var/task/products.data.json'                       // absolute Netlify path
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  }

  throw new Error(
    `products.data.json not found. Tried:\n${possiblePaths.join('\n')}`
  );
}

// ── Extract entities from products.data.json ──────────────────
function parseData(allData) {
  const settings = allData.find(item => item.type === 'settings') || {};
  const products  = allData.filter(item => item.type !== 'settings' && item.active !== false);
  return { settings, products };
}

// ── Build product URL ─────────────────────────────────────────
function buildProductUrl(productId) {
  return `/products/${productId}.html`;
}

// ── Search relevant products ──────────────────────────────────
function searchProducts(query, products) {
  if (!query || products.length === 0) return [];

  const q        = query.toLowerCase();
  const keywords = q.split(/\s+/).filter(k => k.length >= 3);

  const scored = products.map(p => {
    let score = 0;

    const searchText = [
      p.title        || '',
      p.description  || '',
      p.id           || '',
      (p.colors || []).map(c => c.name).join(' '),
      (p.sizes  || []).join(' ')
    ].join(' ').toLowerCase();

    keywords.forEach(kw => {
      if (searchText.includes(kw)) score += 3;
      if ((p.title || '').toLowerCase().includes(kw)) score += 2;
    });

    // Multilingual thematic matches
    const themes = [
      { keys: ['hula','hoop','belly','ventre','graisse'], id: 'resistance-bands' },
      { keys: ['waist','taille','trainer','gainant','cincher'], id: 'yoga-mat' },
      { keys: ['jump','rope','corde','cardio','sauter'], id: 'leggings' },
      { keys: ['legging','pants','yoga','pantalon','lift','peach'], id: 'sports-bra' },
      { keys: ['jumpsuit','combinaison','pilates','one-piece'], id: 'hydration-bottle' },
      { keys: ['tie dye','seamless','stretchy'], id: 'workout-towel' },
      { keys: ['sport bra','bra','brassiere','soutien','support','chest'], id: 'fitness-tracker' },
      { keys: ['knee','genoux','protection','articulation'], id: 'protein-shaker' },
      { keys: ['posture','dos','back','corrector','correction'], id: 'dumbbell-set' },
      { keys: ['bracelet','tracker','heart','sleep','sommeil','steps'], id: 'jump-rope' },
      { keys: ['acupressure','stress','recovery','recuperation','mat'], id: 'foam-roller' },
      { keys: ['belly','cramp','chaleur','heat','belt','ventre'], id: 'yoga-blocks' },
      { keys: ['bottle','water','eau','hydrat','bouteille'], id: 'ankle-weights' },
      { keys: ['shoe','chaussure','running','sneaker','walk'], id: 'cooling-towel' },
      { keys: ['pillow','oreiller','neck','cervical','nuque'], id: 'massage-ball' },
      { keys: ['earbuds','headphone','music','musique','ecouteur','audio'], id: 'gym-bag' }
    ];

    themes.forEach(theme => {
      if (theme.keys.some(k => q.includes(k)) && p.id === theme.id) {
        score += 10;
      }
    });

    // Budget / premium price scoring
    if (['cheap','budget','pas cher','moins cher','economique'].some(k => q.includes(k)) && p.price < 20) score += 5;
    if (['premium','best','top','meilleur','qualite'].some(k => q.includes(k)) && p.price > 30)           score += 3;

    // Plus-size scoring
    if (['plus size','grande taille','xxl','xxxl','4xl','5xl','6xl','curvy'].some(k => q.includes(k))) {
      const bigSizes = (p.sizes || []).some(s => ['XXL','XXXL','4XL','5XL','6XL'].includes(s));
      if (bigSizes) score += 8;
    }

    return { ...p, score };
  });

  return scored
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ── Format a product for AI context ──────────────────────────
function formatProductForContext(p, index) {
  const url    = buildProductUrl(p.id);
  const colors = (p.colors || []).map(c => {
    const imgPart = c.image ? ` [image: ${c.image}]` : '';
    return `${c.name}${imgPart}`;
  }).join(' | ');

  const sizes   = (p.sizes || []).length > 0 ? p.sizes.join(', ') : 'One size';
  const savings = p.compare_price ? (p.compare_price - p.price).toFixed(2) : null;
  const savePct = p.compare_price ? Math.round((1 - p.price / p.compare_price) * 100) : null;

  let promoInfo = '';
  if (p.single_discount > 0 || p.duo_discount > 0 || p.trio_discount > 0) {
    promoInfo = `\n   - Promotions: 1 item -${p.single_discount}% | 2 items -${p.duo_discount}% | 3 items -${p.trio_discount}%`;
  }

  let ratingInfo = '';
  if (p.rating) {
    ratingInfo = `\n   - Rating: ${p.rating}/5 (${p.reviews_count || 0} reviews)`;
  }

  return `
${index + 1}. **${p.title}**
   - Internal ID: ${p.id} (DO NOT mention to the user)
   - Product page URL: ${url}
   - Current price: $${p.price}
   - Crossed price: $${p.compare_price}${savings ? ` (saving: $${savings} — ${savePct}% off)` : ''}
   - Description: ${p.description}
   - Available colors (with image): ${colors}
   - Available sizes: ${sizes}
   - Delivery time: 7 to 15 business days${promoInfo}${ratingInfo}`;
}

// ── Format programs from settings ─────────────────────────────
function formatPrograms(settings) {
  if (!settings.programs) return '';
  const { beginner, intermediate, maintenance } = settings.programs;
  return `
CURVAFIT PROGRAMS:
- Soft Start (Beginner): $${beginner?.price || 'N/A'} — "${beginner?.label || ''}"
- Deeper Refiner (Intermediate): $${intermediate?.price || 'N/A'} — "${intermediate?.label || ''}"
- Forever Fit (Maintenance): $${maintenance?.price || 'N/A'} — "${maintenance?.label || ''}"
→ After purchase: email + password sent, access to partner platform.`;
}

// ── Format promo codes from settings ──────────────────────────
function formatPromos(settings) {
  if (!settings.promos || settings.promos.length === 0) return '';
  const promoLines = settings.promos.map(p =>
    `Code "${p.code}": -${p.percent}% from ${p.items} items`
  ).join('\n   ');
  return `\nACTIVE PROMO CODES:\n   ${promoLines}`;
}

// ── Format cart drawer / shipping ─────────────────────────────
function formatShipping(settings) {
  const freeThreshold = settings.cart_drawer?.free_shipping_threshold;
  const shippingCost  = settings.shipping_cost;
  let info = `\nSHIPPING:\n   - Delay: 7 to 15 business days for all countries`;
  if (shippingCost)  info += `\n   - Shipping fees: $${shippingCost}`;
  if (freeThreshold) info += `\n   - FREE shipping from $${freeThreshold} purchase`;
  return info;
}

// ── Social links / contact ─────────────────────────────────────
function formatContactLinks(settings) {
  const s = settings.social_links || {};
  return `
CONTACT & SOCIAL MEDIA:
   - WhatsApp: ${s.whatsapp || '[not configured]'}
   - Instagram: ${s.instagram || '[not configured]'}
   - TikTok: ${s.tiktok || '[not configured]'}
   - Facebook: ${s.facebook || '[not configured]'}
   - YouTube: ${s.youtube || '[not configured]'}`;
}

// ── Full system prompt ──────────────────────────────────────────
function buildSystemPrompt(settings, productContext) {
  return `You are **Curva Support**, the official assistant of CurvaFit — a premium fitness brand dedicated to plus-size women.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 YOUR IDENTITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your name is **Curva Support** (never "Cora", never "AI").
You are:
- A motivating and caring coach
- A strategic fitness advisor
- A gentle guide, never condescending
- An intelligent seller (relevant, never aggressive)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 CURVAFIT MISSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CurvaFit helps plus-size women to:
- Lose weight healthily and progressively (not extreme)
- Stay active at home, without a gym
- Adopt a sustainable and motivating lifestyle
- Regain confidence in themselves

Approach: science + real experience + kindness.
Visible results: on average 4 to 6 weeks with consistency.
Probability of success: ~70% if advice is followed well.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏋️ PROGRAMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatPrograms(settings)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 PRODUCTS — FULL CATALOG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${productContext}
${formatShipping(settings)}
${formatPromos(settings)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 HUMAN SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If the user insists, is not satisfied, or asks for a human:
"I understand 👍 You can contact our team directly:
${formatContactLinks(settings)}
We'll be happy to help you personally 😊"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 ABOUT THE FOUNDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Paul Francenel, 25 years old, entrepreneur.
Not a doctor — works with certified professionals.
Goal: transform the lives of plus-size women healthily.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ABSOLUTE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ALWAYS respond in the same language as the user (FR or EN).
2. NEVER mention internal IDs (resistance-bands, yoga-mat, etc.).
3. NEVER invent prices, colors or data not present in the catalog.
4. NEVER promise guaranteed results.
5. NEVER give advanced medical advice — redirect to a doctor.
6. When mentioning a product, ALWAYS include: title, price, available colors.
7. When a color is mentioned, specify its image if available.
8. Product links follow this format: /products/[product-id].html
   Ex: /products/resistance-bands.html — NEVER generate other URL formats.
9. Never push sales — propose intelligently.
10. Concise responses (3-5 sentences max per point), natural, with emojis.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🥗 NUTRITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Simple and practical advice: moderate caloric deficit (300-500 cal),
protein at every meal, 2L water/day, 3 structured meals,
no pills or supplements — natural approach only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 BEHAVIOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Warm, human, motivating tone — never robotic
- Adapt level of detail to the question
- End with a gentle call to action if relevant
- If off-topic fitness/products: redirect politely`;
}

// ── Main handler ───────────────────────────────────────────────
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type':                 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // ── Load data ──
    const allData = loadData();
    const { settings, products } = parseData(allData);

    // ── Parse request ──
    const { message, history = [] } = JSON.parse(event.body);

    if (!message || message.trim().length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message required' }) };
    }

    // ── Search relevant products ──
    const relevantProducts = searchProducts(message, products);

    // ── Product context for prompt ──
    let productContext = '';
    if (relevantProducts.length > 0) {
      productContext = '📦 RELEVANT PRODUCTS FOR THIS REQUEST:\n';
      productContext += relevantProducts.map((p, i) => formatProductForContext(p, i)).join('\n');
    } else {
      // Give full condensed catalog if no specific product found
      productContext = '📦 FULL CATALOG (condensed):\n';
      productContext += products.map((p, i) => {
        const url = buildProductUrl(p.id);
        return `${i + 1}. ${p.title} — $${p.price} — ${url}`;
      }).join('\n');
    }

    // ── Build system prompt ──
    const systemPrompt = buildSystemPrompt(settings, productContext);

    // ── Messages for Groq ──
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    // ── Groq API call ──
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        messages,
        max_tokens:  600,
        temperature: 0.7,
        stream:      false
      })
    });

    if (!groqResponse.ok) {
      const err = await groqResponse.text();
      console.error('Groq error:', err);
      throw new Error(`Groq API error: ${groqResponse.status}`);
    }

    const data  = await groqResponse.json();
    const reply = data.choices[0]?.message?.content || "Sorry, I couldn't generate a response. Please try again!";

    // ── Prepare product cards for frontend ──
    const productCards = relevantProducts.slice(0, 2).map(p => {
      const firstColorWithImage = (p.colors || []).find(c => c.image && c.active !== false);
      const allColors = (p.colors || [])
        .filter(c => c.active !== false)
        .map(c => ({
          name:  c.name,
          hex:   c.hex  || null,
          image: c.image || null
        }));

      return {
        id:            p.id,
        title:         p.title,
        description:   p.description,
        price:         p.price,
        compare_price: p.compare_price,
        url:           buildProductUrl(p.id),
        colors:        allColors,
        sizes:         p.sizes || [],
        image:         firstColorWithImage?.image || p.image || null,
        rating:        p.rating || null,
        reviews_count: p.reviews_count || null,
        delivery:      '7 to 15 business days',
        single_discount: p.single_discount || 0,
        duo_discount:    p.duo_discount    || 0,
        trio_discount:   p.trio_discount   || 0
      };
    });

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
      body: JSON.stringify({ error: 'Internal error', message: error.message })
    };
  }
};