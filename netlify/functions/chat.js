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
    // FIX 4: Récupérer toutes les images variantes par couleur
    const colorsWithImages = (item.colors || [])
      .filter(c => c.active !== false)
      .map(c => ({
        name:  c.name,
        hex:   c.hex || '',
        // FIX 4: utiliser l'image de la couleur en priorité, sinon fallback sur image principale
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
      // FIX 4: couleurs avec images variantes complètes
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

/* ══════════════════════════════════════════════════════
   SMART INTENT DETECTION
   Returns: 'product' | 'general'
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
      { words: ['hula','hoop','belly','ventre'],                      id: 'resistance-bands',  boost: 12 },
      { words: ['waist trainer','gainant','waist cinch','corset'],    id: 'yoga-mat',          boost: 12 },
      { words: ['jump rope','corde','skip','sauter'],                 id: 'leggings',          boost: 12 },
      { words: ['legging','yoga pant','high waist','peach'],          id: 'sports-bra',        boost: 12 },
      { words: ['jumpsuit','combinaison','pilates'],                  id: 'hydration-bottle',  boost: 12 },
      { words: ['tie dye','seamless legging'],                        id: 'workout-towel',     boost: 12 },
      { words: ['sport bra','bra','brassiere','soutien'],             id: 'fitness-tracker',   boost: 12 },
      { words: ['knee','genoux','genouillère','pad'],                 id: 'protein-shaker',    boost: 12 },
      { words: ['posture','dos','back','corrector','correcteur'],     id: 'dumbbell-set',      boost: 12 },
      { words: ['bracelet','tracker','heart rate','sleep','pouls'],   id: 'jump-rope',         boost: 12 },
      { words: ['acupressure','stress mat','recovery','tapis'],       id: 'foam-roller',       boost: 12 },
      { words: ['belly belt','ceinture ventre','cramp','chaleur'],    id: 'yoga-blocks',       boost: 12 },
      { words: ['bottle','water','gourde','bouteille'],               id: 'ankle-weights',     boost: 12 },
      { words: ['shoe','chaussure','running','sneaker'],              id: 'cooling-towel',     boost: 12 },
      { words: ['pillow','oreiller','neck','cervical','nuque'],       id: 'massage-ball',      boost: 12 },
      { words: ['earbuds','headphone','music','écouteur'],            id: 'gym-bag',           boost: 12 },
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
    const s = new Date(startDate + 'T00:00:00').toLocaleDateString('fr-FR', opts);
    const e = new Date(endDate   + 'T00:00:00').toLocaleDateString('fr-FR', opts);
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
    ? promos.map(p => `• Code "${p.code}" → ${p.percent}% de réduction sur ${p.items}+ articles`).join('\n')
    : '• Aucun code promo actif pour le moment';

  const catalogText = products.map((p, i) => {
    const colorsList = p.colors.map(c => `${c.name}${c.image ? ' [img:'+c.image+']' : ''}`).join(', ');
    const sizesList  = p.sizes.length ? p.sizes.join(', ') : 'Taille unique';
    const discounts  = [
      p.discounts.single ? `1 article: -${p.discounts.single}%` : '',
      p.discounts.duo    ? `2 articles: -${p.discounts.duo}%`   : '',
      p.discounts.trio   ? `3 articles: -${p.discounts.trio}%`  : '',
    ].filter(Boolean).join(' | ') || 'Pas de remise';
    const delivery = formatDelivery(p.startDate, p.endDate) || 'Nous contacter';
    const rating   = p.rating ? `${p.rating}/5 (${p.reviewsCount || 0} avis)` : 'N/A';

    return `
PRODUIT ${i + 1}:
  Titre: ${p.title}
  Description: ${p.description}
  Prix: $${p.price}${p.maxPrice !== p.price ? ` à $${p.maxPrice}` : ''} (était $${p.compare_price})
  Note: ${rating}
  Couleurs: ${colorsList || 'N/A'}
  Tailles: ${sizesList}
  Remises: ${discounts}
  Livraison: ${delivery}
  Page: ${p.url}`;
  }).join('\n');

  return `Tu es **Curva**, l'assistante IA officielle et coach fitness de CurvaFit.

═══════════════════════════════════════
🎯 TON IDENTITÉ
═══════════════════════════════════════
Tu es un coach chaleureux, motivant et précis.
Tu aides les femmes à perdre du poids de manière saine et durable.
Tu es calme, humaine et jamais robotique.
Tu réponds DANS LA MÊME LANGUE que l'utilisateur (français ou anglais).
Utilise les emojis naturellement mais sans en abuser.

RÈGLE IMPORTANTE DE FORMATAGE:
- Mets en GRAS (**mot**) les éléments importants:
  * Le nom du fondateur: **Paul Francenel**
  * Les codes promo: **PAUL81**, **CURVA15**, etc.
  * Les prix importants: **$29.99**
  * Les noms de produits recommandés
  * Les données clés (pourcentages, durées importantes)
  * Les liens/pages importantes

═══════════════════════════════════════
🚦 RÈGLE CRITIQUE DE COMPORTEMENT
═══════════════════════════════════════
Tu dois analyser chaque question soigneusement.

NE JAMAIS suggérer ou afficher des produits pour:
- Qui est le fondateur / l'équipe / à propos de la marque
- L'objectif/mission de CurvaFit
- Questions de santé, hormones, métabolisme, cortisol
- Conseils nutrition, repas, calories
- Conseils fitness et exercices
- Délais avant de voir des résultats
- Informations sur les programmes et plans de coaching
- Demandes de support humain/contact
- Codes promo (juste les lister, pas de fiches produits)
- Motivation générale, confiance, positivité corporelle
- Salutations et petite conversation

AFFICHER les produits UNIQUEMENT quand l'utilisateur:
- Demande explicitement à acheter ou commander quelque chose
- Demande "quel produit me conseilles-tu" / "que recommandes-tu"
- Mentionne un type de produit spécifique (hoop, leggings, bra, etc.)
- Pose des questions sur les couleurs, tailles ou prix d'un article précis

En cas de doute → répondre comme un coach. Sans produits.

═══════════════════════════════════════
🏢 À PROPOS DE CURVAFIT
═══════════════════════════════════════
Fondateur: **Paul Francenel**, 25 ans, entrepreneur. Pas médecin.
Travaille avec des professionnels de santé et fitness certifiés.
Objectif: Aider les femmes rondes à transformer leur vie de manière saine, durable et agréable.

Approche basée sur la science:
- Perte de poids saine: 0,5–1 kg par semaine (2–4 kg par mois)
- Pas de pilules, pas de régimes crash, pas d'entraînements extrêmes
- Approche 100% à domicile
- Résultats visibles en 4–6 semaines avec une vraie constance
- Taux de réussite de 70% lorsque les conseils sont suivis

═══════════════════════════════════════
💪 PROGRAMMES
═══════════════════════════════════════
${programsText}

Comment ça fonctionne:
- Plans disponibles sur [Voir les Programmes](/programs.html)
- Après achat: email + mot de passe envoyés automatiquement
- Accès à la plateforme partenaire professionnelle
- Peut mettre à jour ses informations personnelles à tout moment

═══════════════════════════════════════
🛍️ PRODUITS — RÈGLES
═══════════════════════════════════════
NE JAMAIS utiliser les IDs internes (resistance-bands, yoga-mat, leggings, etc.)
TOUJOURS utiliser le Titre exact du produit
TOUJOURS utiliser les prix exacts — ne jamais inventer
NE JAMAIS inventer des produits absents du catalogue

Codes de réduction:
${promosText}

Livraison gratuite à partir de $${shipping.free_shipping_threshold || 120}

CATALOGUE PRODUITS (utiliser uniquement pour les questions produits):
${catalogText}

═══════════════════════════════════════
🥗 NUTRITION (pour les questions de conseil)
═══════════════════════════════════════
- Protéines à chaque repas (poulet, œufs, poisson, légumineuses)
- Couper les sucres liquides (sodas, jus, café sucré) en premier
- 3 repas structurés/jour, limiter les grignotages non contrôlés
- 2 litres d'eau par jour
- Manger jusqu'à 80% de satiété — signal de satiété prend 20 minutes
- Objectif: déficit de 300–500 calories par jour
- Dormir **7–8 heures** — crucial pour les hormones de la faim (ghréline/leptine)
- Cortisol élevé dû au stress = plus de stockage de graisse abdominale → gérer le stress

═══════════════════════════════════════
⚠️ AVERTISSEMENT SANTÉ
═══════════════════════════════════════
CurvaFit n'est pas un service médical.
Toujours ajouter si nécessaire: "Pour tout problème de santé, consultez un médecin."

═══════════════════════════════════════
🤝 SUPPORT HUMAIN
═══════════════════════════════════════
Si l'utilisateur veut parler à un humain, est mécontent, ou insiste:
"Je comprends 😊 Notre équipe est là pour vous:
👉 **WhatsApp**: ${socials.whatsapp || 'https://wa.me/contact'}
👉 Page contact: [Nous Contacter](/contact.html)
Nous serons ravis de vous aider personnellement !"

═══════════════════════════════════════
🚫 JAMAIS
═══════════════════════════════════════
- Envoyer des IDs internes de produits à l'utilisateur
- Inventer des prix ou des données
- Promettre des résultats garantis
- Donner des conseils médicaux avancés
- Montrer des produits pour des questions non-produits
- Être robotique ou utiliser des phrases de remplissage`;
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

    // ── Load dynamic data ──
    let products = [], settings = {};
    try {
      const rawData = await loadProductsData();
      const built   = buildProductIndex(rawData);
      products = built.products;
      settings = built.settings;
    } catch (err) {
      console.error('Could not load products.data.json:', err.message);
    }

    // ── Detect intent ──
    const intent = detectIntent(message);

    // ── Search products ONLY for product intent ──
    const relevantProducts = (intent === 'product')
      ? searchProducts(message, products)
      : [];

    // ── Build prompt + call Groq ──
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
      || "Désolée, je n'ai pas pu générer une réponse. Veuillez réessayer. 🙏";

    // FIX 4: Format product cards avec images variantes
    const productCards = relevantProducts.map(p => ({
      title:         p.title,
      description:   p.description,
      price:         p.price,
      compare_price: p.compare_price,
      url:           p.url,
      image:         p.image,
      // FIX 4: inclure toutes les couleurs avec leurs images variantes
      colors:        p.colors.map(c => ({
        name:  c.name,
        hex:   c.hex,
        // FIX 4: image de la variante couleur (pas l'image principale)
        image: c.image || p.image
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