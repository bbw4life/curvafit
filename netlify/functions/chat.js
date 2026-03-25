const fetch = require('node-fetch');
const path  = require('path');
const fs    = require('fs');

/* ── Load products.data.json ── */
async function loadProductsData() {
  const localPaths = [
    path.join(process.cwd(), 'products.data.json'),
    path.join(process.cwd(), 'public', 'products.data.json'),
    path.join(process.cwd(), 'dist', 'products.data.json'),
    path.join(__dirname, '..', '..', 'products.data.json'),
    path.join(__dirname, '..', '..', 'public', 'products.data.json'),
  ];
  for (const p of localPaths) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) { /* continue */ }
  }
  const siteUrl = process.env.SITE_URL || process.env.URL || 'https://curvafit.com';
  const res = await fetch(`${siteUrl}/products.data.json`);
  if (!res.ok) throw new Error(`Cannot load products.data.json: ${res.status}`);
  return res.json();
}

/* ── Build product index ── */
function buildProductIndex(rawData) {
  const allActive = rawData.filter(p => p.type !== 'settings' && p.id && p.active);
  const settings  = rawData.find(p => p.type === 'settings') || {};

  const products = allActive.map((item, index) => {
    // FIX 4 : images variantes par couleur
    const colorsWithImages = (item.colors || [])
      .filter(c => c.active !== false)
      .map(c => ({
        name:  c.name,
        hex:   c.hex   || '',
        image: c.image || item.image || ''
      }));

    const variantPrices = (item.variants || []).map(v => v.price).filter(Boolean);
    const minPrice = variantPrices.length ? Math.min(...variantPrices) : item.price;

    return {
      id:            item.id,
      productNumber: index + 1,
      title:         item.title,
      description:   item.description,
      price:         minPrice,
      maxPrice:      item.price,
      compare_price: item.compare_price,
      image:         item.image,
      colors:        colorsWithImages,
      sizes:         item.sizes || [],
      variants:      item.variants || [],
      discounts: {
        single: item.single_discount || 0,
        duo:    item.duo_discount    || 0,
        trio:   item.trio_discount   || 0
      },
      startDate:    item.start_date || '',
      endDate:      item.end_date   || '',
      rating:       item.rating        || null,
      reviewsCount: item.reviews_count || null,
      url:          `/products/product${index + 1}.html`,
      cj_id:        item.cj_id
    };
  });

  return { products, settings };
}

/* ── INTENT DETECTION ── */
function detectIntent(message) {
  const q = message.toLowerCase();

  const generalPatterns = [
    /fondateur|founder|qui.+(fond|creat|créat)|paul|francenel/,
    /objectif|mission|but de curva|about curva|à propos/,
    /\bequipe\b|\bteam\b|\bstaff\b/,
    /c.est quoi curva|what is curva|what.s curva/,
    /cortisol|hormone|métabolis|metabolism|yo.yo|famine/,
    /pourquoi.+(prise|grossi|gain)|why.+(gain|weight gain)/,
    /comment.+(perdre|lose|maigrir)|how to lose|tips.+(lose|weight)/,
    /conseils?|advice|astuce|tips?/,
    /sommeil|sleep.*weight|dormir/,
    /stress|anxiet|depress|mental|moral|confiance|confidence/,
    /plateau.+(normal|pourquoi|why)|normal.+plateau/,
    /programme?|program|plan.+coach|coaching|coach/,
    /beginner|débutant|intermédiaire|intermediate|maintenance/,
    /comment.+(fonctionne|work|works)|how.+(work|program)/,
    /s.inscrire|sign up|inscription/,
    /contact|joindre|reach|parler.+(humain|person|quelqu)/,
    /whatsapp|telegram|email.*support|mail.*support/,
    /support|aide.+(équipe|team)/,
    /nutrition|manger|what to eat|quoi manger|food|aliment/,
    /calorie|deficit|protéine|protein|régime|diet/,
    /eau|water.*drink|hydrat/,
    /repas|meal.*plan|plan.*repas/,
    /résultat|result|combien.+temps|how long|semaine|week/,
    /visible.+(result|résultat)|quand.+voir/,
    /code.+promo|promo.+code|discount.+code|code.+réduction/,
    /livraison|shipping.+info|delivery.+time|délai/,
    /fiable|reliable|trust|sûr|safe|médecin|doctor/,
    /pilule|pill|complément|supplement/,
    /^(bonjour|bonsoir|salut|hello|hi|hey|allo)\b/,
    /^(merci|thank|thanks|ok|okay|d.accord|super|parfait|génial|great)\b/,
  ];

  for (const pattern of generalPatterns) {
    if (pattern.test(q)) return 'general';
  }

  const productPatterns = [
    /acheter|buy|commander|order/,
    /produit|product|article/,
    /recommande.+(produit|article)|recommend.+(product|item)/,
    /quel.+(produit|article)|which.+(product|item)/,
    /montre.+(produit)|show.+(product|me)/,
    /meilleur.+(pour).+(ventre|belly|poids|weight|taille|waist)/,
    /best.+(for|pour).+(belly|ventre|weight|waist)/,
    /hula.?hoop|\bhoop\b/,
    /waist.?trainer|gainant/,
    /jump.?rope|corde.+sauter/,
    /\blegging\b|\bpantalon.+sport\b|\byoga.+pant\b/,
    /\bjumpsuit\b|\bcombinaison.+sport\b/,
    /sport.?bra|\bbrassière\b/,
    /knee.?pad|genouillère/,
    /posture.?correct|correcteur.+posture/,
    /bracelet.+connect|smart.+bracelet|fitness.+track/,
    /acupressure.?mat|tapis.+acupressure/,
    /belly.?belt|ceinture.+(ventre|chaleur)/,
    /water.?bottle|gourde|bouteille.+sport/,
    /running.?shoe|chaussure.+running|\bsneaker\b/,
    /neck.?pillow|oreiller.+nuque/,
    /\bearbuds?\b|écouteur.+sport/,
    /tie.?dye/,
    /quelle.+(couleur|taille).+disponible|available.+(color|size)/,
    /existe.+(couleur|taille)|come in.+(color|size)/,
    /\$\d+|under \$|moins de \$|budget.+(produit|product)/,
    /combien.+(coûte|cost).+(ce|this|le|la)/,
  ];

  for (const pattern of productPatterns) {
    if (pattern.test(q)) return 'product';
  }

  return 'general';
}

/* ── Search relevant products ── */
function searchProducts(query, products) {
  if (!query) return [];
  const q        = query.toLowerCase();
  const keywords = q.split(/\s+/).filter(k => k.length >= 2);

  const scored = products.map(p => {
    let score = 0;
    const searchText = `${p.title} ${p.description}`.toLowerCase();

    keywords.forEach(kw => {
      if (searchText.includes(kw)) score += 3;
      if (p.title.toLowerCase().includes(kw)) score += 2;
      p.colors.forEach(c => { if (c.name.toLowerCase().includes(kw)) score += 2; });
      p.sizes.forEach(s  => { if (String(s).toLowerCase().includes(kw)) score += 1; });
    });

    const themes = [
      { words: ['hula','hoop','belly','ventre'],                   id: 'resistance-bands', boost: 12 },
      { words: ['waist trainer','gainant','waist cinch','corset'], id: 'yoga-mat',         boost: 12 },
      { words: ['jump rope','corde','skip','sauter'],              id: 'leggings',         boost: 12 },
      { words: ['legging','yoga pant','high waist','peach'],       id: 'sports-bra',       boost: 12 },
      { words: ['jumpsuit','combinaison','pilates'],               id: 'hydration-bottle', boost: 12 },
      { words: ['tie dye','seamless legging'],                     id: 'workout-towel',    boost: 12 },
      { words: ['sport bra','bra','brassiere','soutien'],          id: 'fitness-tracker',  boost: 12 },
      { words: ['knee','genoux','genouillère','pad'],              id: 'protein-shaker',   boost: 12 },
      { words: ['posture','dos','back','corrector','correcteur'],  id: 'dumbbell-set',     boost: 12 },
      { words: ['bracelet','tracker','heart rate','sleep'],        id: 'jump-rope',        boost: 12 },
      { words: ['acupressure','stress mat','recovery','tapis'],    id: 'foam-roller',      boost: 12 },
      { words: ['belly belt','ceinture ventre','cramp','chaleur'], id: 'yoga-blocks',      boost: 12 },
      { words: ['bottle','water','gourde','bouteille'],            id: 'ankle-weights',    boost: 12 },
      { words: ['shoe','chaussure','running','sneaker'],           id: 'cooling-towel',    boost: 12 },
      { words: ['pillow','oreiller','neck','cervical','nuque'],    id: 'massage-ball',     boost: 12 },
      { words: ['earbuds','headphone','music','écouteur'],         id: 'gym-bag',          boost: 12 },
    ];

    themes.forEach(t => {
      if (p.id === t.id && t.words.some(w => q.includes(w))) score += t.boost;
    });

    if ((q.includes('cheap') || q.includes('budget') || q.includes('pas cher')) && p.price < 20) score += 5;

    return { ...p, score };
  });

  return scored
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
}

/* ── Format delivery dates ── */
function formatDelivery(startDate, endDate) {
  if (!startDate || !endDate) return null;
  try {
    const opts = { day: '2-digit', month: '2-digit', year: '2-digit' };
    const s = new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', opts);
    const e = new Date(endDate   + 'T00:00:00').toLocaleDateString('en-GB', opts);
    return `${s} – ${e}`;
  } catch (_) { return null; }
}

/* ── Build system prompt ── */
function buildSystemPrompt(products, settings) {
  const programs = settings.programs     || {};
  const promos   = settings.promos       || [];
  const socials  = settings.social_links || {};
  const shipping = settings.cart_drawer  || {};

  const programsText = Object.entries(programs)
    .map(([, val]) => `• ${val.label}: $${val.price}`)
    .join('\n');

  const promosText = promos.length
    ? promos.map(p => `• Code "${p.code}" → ${p.percent}% off on ${p.items}+ items`).join('\n')
    : '• No active promo codes at this time';

  const catalogText = products.map((p, i) => {
    const colorsList = p.colors.map(c => c.name).join(', ');
    const sizesList  = p.sizes.length ? p.sizes.join(', ') : 'No size needed';
    const discounts  = [
      p.discounts.single ? `1 item: -${p.discounts.single}%` : '',
      p.discounts.duo    ? `2 items: -${p.discounts.duo}%`   : '',
      p.discounts.trio   ? `3 items: -${p.discounts.trio}%`  : '',
    ].filter(Boolean).join(' | ') || 'No discount';
    const delivery = formatDelivery(p.startDate, p.endDate) || 'Contact us';
    const rating   = p.rating ? `${p.rating}/5 (${p.reviewsCount || 0} reviews)` : 'N/A';

    return `
PRODUCT ${i + 1}:
  Title: ${p.title}
  Description: ${p.description}
  Price: $${p.price}${p.maxPrice !== p.price ? ` to $${p.maxPrice}` : ''} (was $${p.compare_price})
  Rating: ${rating}
  Colors: ${colorsList || 'N/A'}
  Sizes: ${sizesList}
  Discounts: ${discounts}
  Delivery: ${delivery}
  Page: ${p.url}`;
  }).join('\n');

  return `You are **Curva**, the official AI assistant and fitness coach of CurvaFit.

═══════════════════════════════════════
🎯 YOUR IDENTITY
═══════════════════════════════════════
You are a warm, motivating, and precise fitness coach.
You help plus-size women lose weight in a healthy, sustainable way.
You are calm, human, and never robotic.
You respond in the SAME LANGUAGE the user writes in (French or English).
Use emojis naturally but do not overuse them.

═══════════════════════════════════════
🚦 CRITICAL BEHAVIOR RULE
═══════════════════════════════════════
NEVER suggest products for general questions.
ONLY suggest products when user explicitly asks to buy or mentions a product type.

═══════════════════════════════════════
✍️ FORMATTING — IMPORTANT
═══════════════════════════════════════
Always use **bold** (double asterisks) for:
- Founder name: always **Paul Francenel**
- All promo codes: **PAUL81**, **CURVA15**, **FITNESS25**, etc.
- Product titles when mentioned in text
- Key numbers: prices, percentages, weights
- Important phrases: **Order now**, **Free shipping**, **Click below**

═══════════════════════════════════════
🔗 LINKS — NEVER write raw URLs
═══════════════════════════════════════
NEVER write raw paths like /products/product1.html or index.html.
When referencing a page, ALWAYS use this exact format:
[BUTTON:Label:url]
Examples:
- [BUTTON:View this product:/products/product1.html]
- [BUTTON:Our Programs:/programs.html]
- [BUTTON:Contact us:/contact.html]
- [BUTTON:Shop now:/shop.html]

═══════════════════════════════════════
🏢 ABOUT CURVAFIT
═══════════════════════════════════════
Founder: **Paul Francenel**, 25 years old, entrepreneur. Not a doctor.
Works with certified health and fitness professionals.
Goal: Help plus-size women transform their lives sustainably.

Science-based:
- Safe weight loss: 0.5–1 kg/week
- No pills, no crash diets
- 100% at-home
- Results visible in **4–6 weeks**
- **70% success rate** when advice followed

═══════════════════════════════════════
💪 PROGRAMS
═══════════════════════════════════════
${programsText}

[BUTTON:See all programs:/programs.html]

═══════════════════════════════════════
🛍️ DISCOUNT CODES
═══════════════════════════════════════
${promosText}

Free shipping over $${shipping.free_shipping_threshold || 120}

═══════════════════════════════════════
📦 PRODUCT CATALOG
═══════════════════════════════════════
${catalogText}

═══════════════════════════════════════
🥗 NUTRITION
═══════════════════════════════════════
- Protein at every meal
- Cut liquid sugars first
- **2 liters** of water daily
- Sleep **7–8 hours**
- Target: **300–500 calorie** daily deficit

═══════════════════════════════════════
🤝 HUMAN SUPPORT
═══════════════════════════════════════
If user wants human support:
"Our team is here for you! 😊
👉 **WhatsApp:** ${socials.whatsapp || 'available on contact page'}
[BUTTON:Contact our team:/contact.html]"

═══════════════════════════════════════
🚫 NEVER
═══════════════════════════════════════
- Write raw URLs like /products/product1.html
- Use internal product IDs
- Invent prices or data
- Promise guaranteed results`;
}

/* ── Main handler ── */
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { message, history = [] } = JSON.parse(event.body);
    if (!message || message.trim().length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message is required' }) };
    }

    let products = [], settings = {};
    try {
      const rawData = await loadProductsData();
      const built   = buildProductIndex(rawData);
      products = built.products;
      settings = built.settings;
    } catch (err) {
      console.error('Could not load products.data.json:', err.message);
    }

    const intent = detectIntent(message);
    const relevantProducts = (intent === 'product')
      ? searchProducts(message, products)
      : [];

    const systemPrompt = buildSystemPrompt(products, settings);

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        messages:    groqMessages,
        max_tokens:  600,
        temperature: 0.70,
        stream:      false
      })
    });

    if (!groqResponse.ok) {
      throw new Error(`Groq API error: ${groqResponse.status}`);
    }

    const data  = await groqResponse.json();
    const reply = data.choices?.[0]?.message?.content
      || "I'm sorry, I couldn't generate a response. Please try again. 🙏";

    // FIX 4 : inclure images variantes par couleur
    const productCards = relevantProducts.map(p => ({
      title:         p.title,
      description:   p.description,
      price:         p.price,
      compare_price: p.compare_price,
      url:           p.url,
      image:         p.image,
      colors:        p.colors.map(c => ({
        name:  c.name,
        hex:   c.hex,
        image: c.image  // image spécifique à la couleur
      })),
      sizes:         p.sizes,
      delivery:      formatDelivery(p.startDate, p.endDate),
      rating:        p.rating,
      discounts:     p.discounts
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply, products: productCards, intent })
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