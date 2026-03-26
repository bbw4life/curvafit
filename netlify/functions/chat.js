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
    const colorsWithImages = (item.colors || [])
      .filter(c => c.active !== false)
      .map(c => ({ name: c.name, hex: c.hex || '', image: c.image || item.image || '' }));

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
      variants:      (item.variants || []).map(v => ({
        vid:   v.vid,
        color: v.color || null,
        size:  v.size  || null,
        price: v.price || item.price,
        image: v.image || colorsWithImages.find(c => c.name === v.color)?.image || item.image || ''
      })),
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

/* ══════════════════════════════════════════════════════
   LANGUAGE DETECTION
══════════════════════════════════════════════════════ */
function detectLanguage(message) {
  const text = message.toLowerCase().trim();

  const spanishPatterns = [
    /\b(hola|buenas|buenos|qué|que|cómo|como|puedo|quiero|necesito|tienes|tengo|gracias|por favor|ayuda|precio|envío|envio|producto|comprar|descuento|talla|color|disponible|cuánto|cuanto|dónde|donde|cuando|cuándo|si|también|tambien|estoy|peso|adelgazar|bajar|perder)\b/,
    /[áéíóúüñ¿¡]/
  ];

  const frenchPatterns = [
    /\b(bonjour|bonsoir|salut|merci|s'il vous|svp|comment|qu'est|c'est|je|vous|nous|les|des|une|pour|avec|dans|sur|mais|très|aussi|peut|plus|produit|livraison|taille|couleur|disponible|combien|où|quand|prix|acheter|réduction|programme)\b/,
    /[àâçèêëîïôùûü]/
  ];

  const englishPatterns = [
    /\b(hello|hi|hey|what|how|can|could|would|should|where|when|why|which|who|the|and|for|with|this|that|have|your|you|me|my|want|need|does|do|is|are|was|were|help|price|shipping|color|size|available|discount|program|product|buy|order)\b/
  ];

  let frScore = 0, esScore = 0, enScore = 0;

  frenchPatterns.forEach(p  => { if (p.test(text)) frScore += 3; });
  spanishPatterns.forEach(p => { if (p.test(text)) esScore += 3; });
  englishPatterns.forEach(p => { if (p.test(text)) enScore += 1; });

  // Count word matches for more accuracy
  const frWords = ['je','tu','il','elle','nous','vous','ils','elles','le','la','les','un','une','des','du','et','est','sont','avec','dans','pour','sur','pas','plus','très','bien','aussi','mais','ou','donc','car','que','qui','quoi','comment','quand','où','pourquoi','quel','quelle','bonjour','merci','oui','non','avoir','être','faire','aller','pouvoir','vouloir','savoir'];
  const esWords = ['yo','tú','él','ella','nosotros','vosotros','ellos','ellas','el','la','los','las','un','una','unos','unas','del','al','y','es','son','con','en','por','para','sobre','no','más','muy','bien','también','pero','o','porque','que','quien','como','cuando','donde','porque','qué','cómo','cuándo','dónde','hola','gracias','sí','tener','ser','estar','hacer','ir','poder','querer','saber'];
  const enWords = ['i','you','he','she','it','we','they','the','a','an','is','are','was','were','have','has','had','do','does','did','will','would','can','could','should','may','might','and','or','but','for','with','at','by','from','to','in','on','of','that','this','what','how','when','where','why','who','which'];

  const words = text.split(/\s+/);
  words.forEach(w => {
    const clean = w.replace(/[^a-záàâçèêëéíîïóôùûüñú]/gi, '');
    if (frWords.includes(clean)) frScore += 2;
    if (esWords.includes(clean)) esScore += 2;
    if (enWords.includes(clean)) enScore += 1;
  });

  if (frScore === 0 && esScore === 0 && enScore === 0) return 'en';
  if (frScore >= esScore && frScore >= enScore) return 'fr';
  if (esScore > frScore && esScore >= enScore) return 'es';
  return 'en';
}

/* ══════════════════════════════════════════════════════
   SMART INTENT DETECTION
══════════════════════════════════════════════════════ */
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
    /^(bonjour|bonsoir|salut|hello|hi|hey|hola|buenas|buenos|allo)\b/,
    /^(merci|thank|thanks|gracias|ok|okay|d.accord|super|parfait|génial|great|bien|bueno)\b/,
    // Spanish general
    /fundador|fundadora|quién.+(fund|cre)|equipo|misión/,
    /qué es curva|sobre curva/,
    /consejo|consejos|nutrición|alimentación|comida/,
    /programa|entrenamiento|coaching/,
    /contacto|soporte|ayuda.+equipo/,
    /envío|envio|tiempo.+entrega|costo.+envío/,
    /código.+descuento|descuento.+código|promo/,
  ];

  for (const pattern of generalPatterns) {
    if (pattern.test(q)) return 'general';
  }

  const productPatterns = [
    /acheter|buy|commander|order|comprar|pedir|ordenar/,
    /produit|product|article|producto|artículo/,
    /recommande.+(produit|article)|recommend.+(product|item)|recomienda.+(producto)/,
    /quel.+(produit|article)|which.+(product|item)|qué.+(producto)/,
    /montre.+(produit)|show.+(product|me)|muestra.+(producto)/,
    /meilleur.+(pour).+(ventre|belly|poids|weight|taille|waist)/,
    /best.+(for|pour).+(belly|ventre|weight|waist)/,
    /mejor.+(para).+(barriga|vientre|peso|cintura)/,
    /hula.?hoop|\bhoop\b/,
    /waist.?trainer|gainant|faja/,
    /jump.?rope|corde.+sauter|cuerda.+saltar/,
    /\blegging\b|\bpantalon.+sport\b|\byoga.+pant\b|\bmalla\b/,
    /\bjumpsuit\b|\bcombinaison.+sport\b|\bmono.+deporte\b/,
    /sport.?bra|\bbrassière\b|\bsujetador.+deporte\b|\btop.+deporte\b/,
    /knee.?pad|genouillère|rodillera/,
    /posture.?correct|correcteur.+posture|corrector.+postura/,
    /bracelet.+connect|smart.+bracelet|fitness.+track|pulsera.+inteligente/,
    /acupressure.?mat|tapis.+acupressure|esterilla.+acupresión/,
    /belly.?belt|ceinture.+(ventre|chaleur)|cinturón.+(vientre|calor)/,
    /water.?bottle|gourde|bouteille.+sport|botella.+agua/,
    /running.?shoe|chaussure.+running|\bsneaker\b|zapatilla.+running/,
    /neck.?pillow|oreiller.+nuque|almohada.+cervical/,
    /\bearbuds?\b|écouteur.+sport|auricular.+deporte/,
    /tie.?dye/,
    /quelle.+(couleur|taille).+disponible|available.+(color|size)|qué.+(color|talla).+disponible/,
    /existe.+(couleur|taille)|come in.+(color|size)|viene.+(color|talla)/,
    /\$\d+|under \$|moins de \$|budget.+(produit|product)|menos de \$|presupuesto/,
    /combien.+(coûte|cost).+(ce|this|le|la)|cuánto.+(cuesta|vale)/,
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
      { words: ['hula','hoop','belly','ventre','barriga','vientre'],             id: 'resistance-bands',  boost: 12 },
      { words: ['waist trainer','gainant','waist cinch','corset','faja'],        id: 'yoga-mat',          boost: 12 },
      { words: ['jump rope','corde','skip','sauter','cuerda','saltar'],          id: 'leggings',          boost: 12 },
      { words: ['legging','yoga pant','high waist','peach','malla'],             id: 'sports-bra',        boost: 12 },
      { words: ['jumpsuit','combinaison','pilates','mono'],                      id: 'hydration-bottle',  boost: 12 },
      { words: ['tie dye','seamless legging'],                                   id: 'workout-towel',     boost: 12 },
      { words: ['sport bra','bra','brassiere','soutien','sujetador','top'],      id: 'fitness-tracker',   boost: 12 },
      { words: ['knee','genoux','genouillère','pad','rodilla','rodillera'],      id: 'protein-shaker',    boost: 12 },
      { words: ['posture','dos','back','corrector','correcteur','postura'],      id: 'dumbbell-set',      boost: 12 },
      { words: ['bracelet','tracker','heart rate','sleep','pouls','pulsera'],    id: 'jump-rope',         boost: 12 },
      { words: ['acupressure','stress mat','recovery','tapis','esterilla'],      id: 'foam-roller',       boost: 12 },
      { words: ['belly belt','ceinture ventre','cramp','chaleur','cinturón'],    id: 'yoga-blocks',       boost: 12 },
      { words: ['bottle','water','gourde','bouteille','botella','agua'],         id: 'ankle-weights',     boost: 12 },
      { words: ['shoe','chaussure','running','sneaker','zapatilla'],             id: 'cooling-towel',     boost: 12 },
      { words: ['pillow','oreiller','neck','cervical','nuque','almohada'],       id: 'massage-ball',      boost: 12 },
      { words: ['earbuds','headphone','music','écouteur','auricular'],           id: 'gym-bag',           boost: 12 },
    ];

    themes.forEach(t => {
      if (p.id === t.id && t.words.some(w => q.includes(w))) score += t.boost;
    });

    if ((q.includes('cheap') || q.includes('budget') || q.includes('pas cher') || q.includes('barato') || q.includes('económico')) && p.price < 20) score += 5;

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
Use emojis naturally but do not overuse them.
KEEP RESPONSES SHORT AND PRECISE — max 4-5 lines. No long texts.

═══════════════════════════════════════
🌍 LANGUAGE RULE — ABSOLUTE PRIORITY — NO EXCEPTION EVER
═══════════════════════════════════════
This is your MOST IMPORTANT rule. You MUST follow it without any exception.

Step 1: READ the user's message carefully.
Step 2: IDENTIFY the language they used.
  - If they write in ENGLISH  → you MUST reply 100% in ENGLISH
  - If they write in FRENCH   → you MUST reply 100% in FRENCH
  - If they write in SPANISH  → you MUST reply 100% in SPANISH
Step 3: REPLY only in that detected language. NEVER in another language.

EXAMPLES:
  User: "hello how are you" → Reply in ENGLISH only
  User: "bonjour comment ça va" → Reply in FRENCH only
  User: "hola cómo estás" → Reply in SPANISH only
  User: "imbeciles" → This is English → Reply in ENGLISH only

NEVER default to French. NEVER mix languages. NEVER ignore this rule.
If unsure about the language, default to ENGLISH.

═══════════════════════════════════════
✏️ FORMATTING RULES
═══════════════════════════════════════
Use **bold** (double asterisks) for:
- Founder name: always write **Paul Francenel**
- Brand name: always write **CurvaFit**
- All promo codes: always write **CODE** in bold
- Product names when mentioned
- Key prices and important numbers
- Important warnings or key facts

NEVER display raw URLs like /products/product1.html in your text responses.
If you need to reference a product page, just say "see the button below".

═══════════════════════════════════════
🚦 CRITICAL BEHAVIOR RULE
═══════════════════════════════════════
NEVER suggest or display products for:
- Brand info, founder, team questions
- Health, hormones, nutrition advice
- Program info, coaching plans
- Contact / support requests
- Discount code questions (just list codes, no cards)
- General motivation, greetings, small talk

ONLY suggest products when user explicitly asks to buy, see a product, or mentions a specific product type.

═══════════════════════════════════════
🏢 ABOUT CURVAFIT
═══════════════════════════════════════
Founder: **Paul Francenel**, 25 years old, entrepreneur. Not a doctor.
Goal: Help plus-size women transform their lives healthily and sustainably.

═══════════════════════════════════════
💪 PROGRAMS
═══════════════════════════════════════
${programsText}

═══════════════════════════════════════
🎟️ PROMO CODES
═══════════════════════════════════════
${promosText}

Free shipping over $${shipping.free_shipping_threshold || 120}

═══════════════════════════════════════
🛍️ PRODUCT CATALOG
═══════════════════════════════════════
NEVER use internal IDs. ALWAYS use exact product Title and prices.
${catalogText}

═══════════════════════════════════════
🥗 NUTRITION
═══════════════════════════════════════
- Protein at every meal, cut liquid sugars, 2L water/day
- Target: 300–500 calorie daily deficit, sleep 7-8h

═══════════════════════════════════════
🤝 HUMAN SUPPORT
═══════════════════════════════════════
"Notre équipe: **WhatsApp**: ${socials.whatsapp || 'https://wa.me/contact'} | page **/contact.html**"

═══════════════════════════════════════
🚫 NEVER
═══════════════════════════════════════
- Write long responses (be short & direct)
- Display raw URLs in text — buttons handle navigation
- Invent prices or data
- Promise guaranteed results
- Reply in a different language than the user's message`;
}

/* ── Detect language for fallback messages ── */
function getFallbackMessage(lang) {
  if (lang === 'fr') return "Je suis très sollicitée en ce moment 😅 Réessayez dans quelques secondes!";
  if (lang === 'es') return "Estoy muy ocupada en este momento 😅 ¡Por favor, inténtalo de nuevo en unos segundos!";
  return "I'm a bit overloaded right now 😅 Please try again in a few seconds!";
}

function getErrorMessage(lang) {
  if (lang === 'fr') return "Désolée, j'ai un petit problème technique. Réessayez dans un instant! 🙏";
  if (lang === 'es') return "Lo siento, tengo un pequeño problema técnico. ¡Inténtalo de nuevo en un momento! 🙏";
  return "Sorry, I'm having a little trouble right now. Please try again in a moment! 🙏";
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

    /* Detect language FIRST — used for fallback messages */
    const userLang = detectLanguage(message);

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

    /* Inject explicit language instruction into every request */
    const langInstruction = userLang === 'fr'
      ? 'REMINDER: The user wrote in FRENCH. Your entire reply MUST be in FRENCH.'
      : userLang === 'es'
      ? 'REMINDER: The user wrote in SPANISH. Your entire reply MUST be in SPANISH.'
      : 'REMINDER: The user wrote in ENGLISH. Your entire reply MUST be in ENGLISH.';

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: `${message}\n\n[${langInstruction}]` }
    ];

    /* ══════════════════════════════════════════════════════
       CASCADE MODEL SYSTEM
       - Toujours essayer 70b en premier (meilleure qualité)
       - Si 429 → basculer sur 8b-instant (14x plus de quota)
       - Au prochain message, on réessaie 70b automatiquement
         (le quota se renouvelle à minuit UTC)
    ══════════════════════════════════════════════════════ */
    const MODELS = [
      'llama-3.3-70b-versatile',  // Priorité 1 — meilleure qualité (1K/jour)
      'llama-3.1-8b-instant'      // Priorité 2 — backup (14.4K/jour)
    ];

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let groqResponse = null;
    let usedModel    = null;
    let reply        = null;

    for (let mi = 0; mi < MODELS.length; mi++) {
      const model = MODELS[mi];
      let modelSuccess = false;

      for (let attempt = 1; attempt <= 2; attempt++) {
        groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type':  'application/json'
          },
          body: JSON.stringify({
            model,
            messages:    groqMessages,
            max_tokens:  400,
            temperature: 0.70,
            stream:      false
          })
        });

        if (groqResponse.status === 429) {
          console.log(`[Chat] 429 on ${model} attempt ${attempt}`);
          if (attempt < 2) { await sleep(2000); continue; }
          // Both attempts failed → try next model
          console.log(`[Chat] ${model} quota exhausted → switching to next model`);
          break;
        }

        if (!groqResponse.ok) {
          console.error(`[Chat] ${model} error: ${groqResponse.status}`);
          break;
        }

        usedModel    = model;
        modelSuccess = true;
        break;
      }

      if (modelSuccess) break;

      // All models exhausted
      if (mi === MODELS.length - 1) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            reply:    getFallbackMessage(userLang),
            products: [],
            intent:   'general'
          })
        };
      }
    }

    console.log(`[Chat] Answered using: ${usedModel}`);

    const data  = await groqResponse.json();
    const reply_text = data.choices?.[0]?.message?.content || getErrorMessage(userLang);
    reply = reply_text;

    /* Send product cards with color variant images */
    const productCards = relevantProducts.map(p => ({
      title:         p.title,
      description:   p.description,
      price:         p.price,
      compare_price: p.compare_price,
      url:           p.url,
      image:         p.image,
      colors:        p.colors.map(c => ({ name: c.name, hex: c.hex, image: c.image })),
      variants:      p.variants,
      sizes:         p.sizes,
      delivery:      formatDelivery(p.startDate, p.endDate),
      rating:        p.rating,
      discounts:     p.discounts
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: reply, products: productCards, intent })
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