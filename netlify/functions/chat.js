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

  const frWords = ['je','tu','il','elle','nous','vous','ils','elles','le','la','les','un','une','des','du','et','est','sont','avec','dans','pour','sur','pas','plus','très','bien','aussi','mais','ou','donc','car','que','qui','quoi','comment','quand','où','pourquoi','quel','quelle','bonjour','merci','oui','non','avoir','être','faire','aller','pouvoir','vouloir','savoir'];
  const esWords = ['yo','tú','él','ella','nosotros','vosotros','ellos','ellas','el','la','los','las','un','una','unos','unas','del','al','y','es','son','con','en','por','para','sobre','no','más','muy','bien','también','pero','o','porque','que','quien','como','cuando','donde','qué','cómo','cuándo','dónde','hola','gracias','sí','tener','ser','estar','hacer','ir','poder','querer','saber'];
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
    /contact|joindre|reach|parler.+(humain|person|quelqu)|message|whatsapp|telegram/,
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
    /fundador|fundadora|quién.+(fund|cre)|equipo|misión/,
    /qué es curva|sobre curva/,
    /consejo|consejos|nutrición|alimentación|comida/,
    /programa|entrenamiento|coaching/,
    /contacto|soporte|ayuda.+equipo/,
    /envío|envio|tiempo.+entrega|costo.+envío/,
    /código.+descuento|descuento.+código|promo/,
    /* ── ACCOUNT PAGE patterns ── */
    /\bcompte\b|\baccount\b|\bcuenta\b/,
    /mon profil|my profile|mi perfil/,
    /mes commandes|my orders|mis pedidos/,
    /historique.+(commande|order|pedido)/,
    /adresse.+(livraison|enregistr)|delivery address|dirección/,
    /mode.+paiement|payment method|método.+pago/,
    /changer.+(mot de passe|password|contraseña)/,
    /sécurité|security|seguridad/,
    /badge|niveau|level|membership|niveau.+membre/,
    /points|récompense|reward/,
    /wishlist|liste.+(souhaits|envie)|saved items/,
    /suivre.+(commande|colis)|track.+(order|package)|rastrear/,
    /* ── CHECKOUT PAGE patterns ── */
    /checkout|passer.+(commande|à la caisse)|proceder.+pago/,
    /panier|cart|carrito/,
    /payer|pay now|pagar/,
    /code promo|promo code|código.+descuento/,
    /frais.+(port|livraison)|shipping cost|costo.+envío/,
    /livraison standard|standard shipping|envío estándar/,
    /livraison express|express shipping|express dhl/,
    /livraison prioritaire|priority fedex|prioritaire/,
    /livraison économique|economy shipping|económico/,
    /délai.+livraison|delivery time|tiempo.+entrega/,
    /total.+(commande|order)|order total|total.+pedido/,
    /taxes|impôts|impuestos/,
    /stripe|paypal|apple pay|google pay|carte.+crédit|credit card|tarjeta/,
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

/* ══════════════════════════════════════════════════════
   PRODUCT SEARCH — MODIFIÉ : précision + limite intelligente
══════════════════════════════════════════════════════ */
function searchProducts(query, products) {
  if (!query) return { results: [], isVague: false };
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

    if ((q.includes('cheap') || q.includes('budget') || q.includes('pas cher') || q.includes('barato') || q.includes('économico')) && p.price < 20) score += 5;

    return { ...p, score };
  });

  const filtered = scored
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score);

  if (filtered.length === 0) return { results: [], isVague: false };

  const topScore    = filtered[0].score;
  const secondScore = filtered[1]?.score || 0;
  const gap         = topScore - secondScore;

  if (topScore >= 14 && gap >= 6) {
    return { results: filtered.slice(0, 1), isVague: false };
  }

  if (filtered.length >= 3 && gap <= 4) {
    return { results: filtered.slice(0, 4), isVague: true };
  }

  return { results: filtered.slice(0, 2), isVague: false };
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

/* ══════════════════════════════════════════════════════
   BUILD SYSTEM PROMPT
══════════════════════════════════════════════════════ */
function buildSystemPrompt(products, settings, contactInfo) {
  const programs = settings.programs     || {};
  const promos   = settings.promos       || [];
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

  const contactChannels = [];
  if (contactInfo.hasWhatsapp) contactChannels.push('WhatsApp (button below)');
  if (contactInfo.hasTelegram) contactChannels.push('Telegram (button below)');
  contactChannels.push('Contact page (button below)');
  const contactChannelsText = contactChannels.join(' · ');

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
  User: "hello how are you"       → Reply in ENGLISH only
  User: "bonjour comment ça va"   → Reply in FRENCH only
  User: "hola cómo estás"         → Reply in SPANISH only

NEVER default to French. NEVER mix languages. NEVER ignore this rule.
If unsure about the language, default to ENGLISH.

═══════════════════════════════════════
✏️ FORMATTING RULES — CRITICAL
═══════════════════════════════════════
Use **bold** for: **Paul Francenel**, **CurvaFit**, promo codes, product names, key prices.

🚫 ABSOLUTE RULE — NEVER display any raw URL or link in your text.
   Examples of what is FORBIDDEN:
   ❌ "https://wa.me/1234567890"
   ❌ "https://t.me/curvafit"
   ❌ "/contact.html"
   ❌ "visit our page at https://..."
   ❌ "/account.html"
   ❌ "/checkout.html"
   
   ALWAYS say "see the button below" or "use the buttons below".
   The frontend will automatically show the correct buttons.
   NEVER write a URL. NEVER write a phone number. Just reference "the button below".

═══════════════════════════════════════
🚦 CRITICAL BEHAVIOR RULES — NON-NEGOTIABLE
═══════════════════════════════════════
NEVER suggest products for: brand info, nutrition advice, program info,
contact requests, promo code questions, greetings, small talk,
account questions, checkout questions, shipping questions (general).

ONLY suggest products when user explicitly asks to buy or mentions a specific product type.

🚫 CONTACT BUTTONS — ABSOLUTE RULE — READ CAREFULLY:
The frontend shows contact buttons (WhatsApp, Telegram, Contact page) ONLY when you end your reply with 👇.

You MUST NEVER end with 👇 unless the user is EXPLICITLY asking HOW to contact the team,
HOW to send a message, or HOW to reach a human agent.

FORBIDDEN triggers for 👇 — these MUST NOT show contact buttons:
❌ "bonjour" / "hello" / "hola" — greetings NEVER show contact buttons
❌ "qui est Paul Francenel" — founder info is NOT a contact request
❌ "parle-moi de votre équipe" — team info is NOT a contact request
❌ "c'est quoi CurvaFit" — brand info is NOT a contact request
❌ "comment fonctionne votre programme" — program info is NOT a contact request
❌ "quels sont vos réseaux sociaux" — social links are NOT contact requests
❌ Any question about nutrition, products, shipping, pricing, results

ALLOWED triggers for 👇 — ONLY these may show contact buttons:
✅ "comment vous contacter / joindre / écrire"
✅ "je veux parler à un humain / agent / conseiller"
✅ "puis-je laisser un message à votre équipe"
✅ "quel est votre WhatsApp / Telegram / email"
✅ "j'ai besoin du service client / support"
✅ "how can I contact you / reach you / message you"
✅ "I want to speak to a human / real person / agent"
✅ "can I leave a message for your team"
✅ "what is your WhatsApp / Telegram / email"
✅ "I need customer support / customer service"
✅ "cómo los contacto / quiero hablar con alguien / servicio al cliente"

DEFAULT RULE: If in any doubt → do NOT add 👇.
Omitting the contact buttons is ALWAYS safer than showing them by mistake.

═══════════════════════════════════════
🛒 PRODUCT DISPLAY RULES — VERY IMPORTANT
═══════════════════════════════════════
RULE 1 — SPECIFIC REQUEST: If the user asks for a SPECIFIC product (e.g. "legging", "hula hoop", "jump rope"),
show ONLY that 1 product. Do NOT show other products.

RULE 2 — VAGUE REQUEST: If the user is CONFUSED or their request is VAGUE (e.g. "something for my belly",
"what's good for weight loss", "show me fitness products"), you MAY show up to 4 products
AND ask: "Is one of these what you're looking for? I can give you more details on any of them! 😊"

RULE 3 — NEVER show unrelated products just to fill space.

RULE 4 — If the backend marks a request as VAGUE (isVague=true), always add the clarification question.

═══════════════════════════════════════
🤝 HUMAN SUPPORT — CONTACT CHANNELS
═══════════════════════════════════════
Available contact channels: ${contactChannelsText}

When a user asks to contact us, leave a message, speak to a human, or needs
support — reply warmly and say the buttons below will connect them.

EXAMPLE response for contact requests:
EN: "Of course! You can reach our team using the buttons below. Choose WhatsApp, Telegram, or our contact page — we reply within 24h! 😊"
FR: "Bien sûr ! Utilise les boutons ci-dessous pour nous contacter. WhatsApp, Telegram ou notre page contact — on répond en 24h ! 😊"
ES: "¡Por supuesto! Usa los botones de abajo para contactarnos. WhatsApp, Telegram o nuestra página de contacto. ¡Respondemos en 24h! 😊"

ALWAYS end contact-related replies with: "👇" on its own line (signals frontend to show contact buttons).

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
👤 ACCOUNT PAGE — /account.html
═══════════════════════════════════════
The account page allows users to manage their profile. Key features:
- **Profile**: View name, email, membership level, points and badge
- **Orders**: Order history and total spent
- **Track Order**: Track a delivery using the order number (button in the page)
- **Addresses**: Add or update delivery address (button in the page)
- **Payment Methods**: Visa, Mastercard, PayPal, Apple Pay, Google Pay, Stripe (view in the page)
- **Security**: Change password (button in the page)
- **Wishlist / Cart**: See saved items (button in the page)
- **Contact Support**: Reach our team directly (button in the page)
- **Reorder**: Go back to shop (button in the page)
- **Membership Badge**: Bronze / Silver / Gold based on total spent and orders
- **Newsletter**: Subscribe at the bottom of the page

When a user asks about their account, orders, profile, address, payment, password, badge, points,
or wishlist → tell them warmly where to find it and that everything is accessible in their account area.
NEVER display the URL. Say "in your account area" or "use the button below" as appropriate.

═══════════════════════════════════════
🛍️ CHECKOUT PAGE — /checkout.html
═══════════════════════════════════════
The checkout page is where users complete their purchase. Key features:
- **Order Summary**: See all cart items, quantities and prices
- **Promo Code**: Enter a promo code to get a discount. Suggested code shown automatically
- **Subtotal / Taxes (10%) / Shipping / Total**: Breakdown of the order cost
- **Shipping Information**: Enter first name, last name, email, phone (with country code), country, city, state, postal code, address
- **Shipping Methods** (4 options):
    • Standard Shipping — 7–12 business days (free)
    • Express DHL — 3–5 business days
    • Priority FedEx — 1–3 business days
    • Economy Shipping — 10–15 business days
- **Payment Methods**: Credit Card via Stripe, or PayPal
- **Trust badges**: Fast Delivery, 30-Day Return Guarantee, Premium Quality, WhatsApp Support
- **Policies**: Refund Policy and Shipping Policy (links shown at bottom, open as popups)

When a user asks about checkout, payment, shipping methods, delivery times, promo codes at checkout,
taxes, or order total → explain the relevant part clearly and warmly.
NEVER display any URL. Direct them using "at checkout" or "on the checkout page".

═══════════════════════════════════════
🚚 SHIPPING METHODS DETAILS
═══════════════════════════════════════
• Standard Shipping: FREE, 7–12 business days
• Express DHL: Paid, 3–5 business days
• Priority FedEx: Paid, 1–3 business days
• Economy Shipping: Paid, 10–15 business days
Free shipping on all orders over $${shipping.free_shipping_threshold || 120}
Returns accepted within 30 days. Contact: paulfrance13@gmail.com

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
🚫 NEVER
═══════════════════════════════════════
- Write long responses (max 4-5 lines)
- Display any URL, link, or phone number — EVER
- Invent prices or data
- Promise guaranteed results
- Reply in a different language than the user's message
- Show multiple unrelated products when user asked for something specific
- Add 👇 unless the user is EXPLICITLY asking how to contact or reach the team`;
}

/* ── Fallback / Error messages ── */
function getFallbackMessage(lang) {
  if (lang === 'fr') return "Je suis très sollicitée en ce moment 😅 Réessayez dans quelques secondes !";
  if (lang === 'es') return "Estoy muy ocupada en este momento 😅 ¡Inténtalo de nuevo en unos segundos!";
  return "I'm a bit overloaded right now 😅 Please try again in a few seconds!";
}

function getErrorMessage(lang) {
  if (lang === 'fr') return "Désolée, j'ai un petit problème technique. Réessayez dans un instant ! 🙏";
  if (lang === 'es') return "Lo siento, tengo un pequeño problema técnico. ¡Inténtalo de nuevo! 🙏";
  return "Sorry, I'm having a little trouble right now. Please try again in a moment! 🙏";
}

/* ══════════════════════════════════════════════════════
   MAIN HANDLER
══════════════════════════════════════════════════════ */
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

    /* Detect language FIRST */
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

    /* ── Read contact settings ── */
    const contactSettings = settings.contact || {};
    const socials         = settings.social_links || {};
    const contactInfo = {
      hasWhatsapp:  !!(contactSettings.whatsapp_url || socials.whatsapp),
      hasTelegram:  !!(contactSettings.telegram_url),
      whatsappUrl:  contactSettings.whatsapp_url || socials.whatsapp || '',
      telegramUrl:  contactSettings.telegram_url || '',
      contactPage:  '/contact.html'
    };

    const intent = detectIntent(message);

    /* ── Recherche produits ── */
    let relevantProducts = [];
    let isVague = false;

    if (intent === 'product') {
      const searchResult = searchProducts(message, products);
      relevantProducts   = searchResult.results;
      isVague            = searchResult.isVague;
    }

    /* ══════════════════════════════════════════════════════
       CONTACT INTENT DETECTION — STRICT
       Boutons contact UNIQUEMENT si l'utilisateur demande
       EXPLICITEMENT comment contacter / joindre l'équipe.
       Jamais pour : salutations, infos fondateur, équipe,
       réseaux sociaux, programmes, nutrition, produits.
    ══════════════════════════════════════════════════════ */
    const EXPLICIT_CONTACT_PATTERNS = [
      // FRENCH — demande explicite de contact humain ou de message
      /parler\s+(à\s+)?(un\s+)?(humain|agent|conseiller|quelqu|personne\s+réelle)/i,
      /joindre\s+(votre|l['']|notre)?\s*(équipe|support|service)/i,
      /contacter\s+(votre|l['']|notre)?\s*(équipe|support|service|team)/i,
      /laisser\s+un\s+message/i,
      /envoyer\s+un\s+message\s+à\s+(l['']équipe|votre|curva)/i,
      /service\s+client/i,
      /comment\s+(vous\s+)?(contacter|joindre|écrire)/i,
      /je\s+veux\s+(vous\s+)?(contacter|écrire|parler\s+à)/i,
      /moyen\s+de\s+contact/i,
      /comment\s+vous\s+écrire/i,
      /comment\s+vous\s+rejoindre/i,
      /votre\s+(whatsapp|telegram|email|mail)\b/i,

      // ENGLISH — explicit request to contact or reach the team
      /speak\s+(to\s+)?(a\s+)?(human|agent|person|someone|real)/i,
      /contact\s+(your|the|our)?\s*(team|support|us|service)/i,
      /leave\s+(a\s+)?message/i,
      /send\s+(a\s+)?message\s+to\s+(the\s+)?(team|you|curva)/i,
      /customer\s+service/i,
      /how\s+(can\s+I\s+)?(contact|reach|message)\s+(you|the\s+team)/i,
      /I\s+want\s+to\s+(contact|reach|talk\s+to)\s+(you|the\s+team)/i,
      /how\s+do\s+I\s+reach\s+you/i,
      /ways?\s+to\s+contact/i,
      /get\s+in\s+touch/i,
      /your\s+(whatsapp|telegram|email)\b/i,

      // SPANISH — petición explícita de contacto
      /hablar\s+(con\s+)?(un\s+)?(humano|agente|persona|alguien)/i,
      /contactar\s+(a\s+)?(su|tu|el|nuestro)?\s*(equipo|soporte|servicio)/i,
      /dejar\s+un\s+mensaje/i,
      /servicio\s+al\s+cliente/i,
      /cómo\s+(puedo\s+)?(contactar|escribir|hablar\s+con)\s+(ustedes|el\s+equipo)/i,
      /medios?\s+de\s+contacto/i,
      /su\s+(whatsapp|telegram|email)\b/i,
    ];

    // STRICT: contact buttons only if the user EXPLICITLY asks to contact someone.
    // NOT for: greetings, founder info, team info, social media, general questions.
    const isContactIntent = intent !== 'product' && EXPLICIT_CONTACT_PATTERNS.some(p => p.test(message));

    const systemPrompt = buildSystemPrompt(products, settings, contactInfo);

    /* Inject language reminder + vague flag into every request */
    const vagueInstruction = isVague
      ? '\n[VAGUE PRODUCT REQUEST: Show up to 4 products and ask the user to confirm which one they want.]'
      : '\n[SPECIFIC PRODUCT REQUEST: Show ONLY the 1 most relevant product. Do NOT show others.]';

    const langInstruction = userLang === 'fr'
      ? 'REMINDER: The user wrote in FRENCH. Your entire reply MUST be in FRENCH. End with 👇 ONLY if the user explicitly asked how to contact or reach the team.'
      : userLang === 'es'
      ? 'REMINDER: The user wrote in SPANISH. Your entire reply MUST be in SPANISH. End with 👇 ONLY if the user explicitly asked how to contact or reach the team.'
      : 'REMINDER: The user wrote in ENGLISH. Your entire reply MUST be in ENGLISH. End with 👇 ONLY if the user explicitly asked how to contact or reach the team.';

    const productContext = intent === 'product'
      ? vagueInstruction
      : '';

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: `${message}\n\n[${langInstruction}]${productContext}` }
    ];

    /* ══════════════════════════════════════════════════════
       CASCADE MODEL SYSTEM — 3 models, automatic rotation
    ══════════════════════════════════════════════════════ */
    const MODELS = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'meta-llama/llama-4-scout-17b-16e-instruct'
    ];

    const sleep      = ms => new Promise(r => setTimeout(r, ms));
    let groqResponse = null;
    let usedModel    = null;

    for (let mi = 0; mi < MODELS.length; mi++) {
      const model        = MODELS[mi];
      let   modelSuccess = false;

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
          console.log(`[Chat] ${model} quota exhausted → next model`);
          break;
        }

        if (!groqResponse.ok) {
          console.error(`[Chat] ${model} HTTP error: ${groqResponse.status}`);
          break;
        }

        usedModel    = model;
        modelSuccess = true;
        break;
      }

      if (modelSuccess) break;

      if (mi === MODELS.length - 1) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            reply:         getFallbackMessage(userLang),
            products:      [],
            intent:        'general',
            isVague:       false,
            showContact:   false,
            contactInfo:   null
          })
        };
      }
    }

    console.log(`[Chat] Answered using model: ${usedModel}`);

    const data  = await groqResponse.json();
    const reply = data.choices?.[0]?.message?.content || getErrorMessage(userLang);

    /* Detect if AI signaled to show contact buttons (👇 at end)
       DOUBLE GUARD: intent !== 'product' AND isContactIntent must be true
       OR the AI added 👇 AND isContactIntent is true.
       NEVER show contact buttons based on 👇 alone — must be confirmed by isContactIntent. */
    const showContactButtons = intent !== 'product' && isContactIntent && reply.includes('👇');
    const cleanReply = reply.replace(/👇\s*$/m, '').trim();

    /* Product cards */
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
      body: JSON.stringify({
        reply:       cleanReply,
        products:    productCards,
        intent,
        isVague,
        showContact: showContactButtons,
        contactInfo: showContactButtons ? {
          whatsapp: contactInfo.hasWhatsapp ? contactInfo.whatsappUrl : null,
          telegram: contactInfo.hasTelegram ? contactInfo.telegramUrl : null,
          page:     contactInfo.contactPage
        } : null
      })
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