const { notifyTelegram } = require('./_lib/notify-telegram');
const { generateChatId, appendLiveChatRow } = require('./_lib/live-chat-sheet');


async function loadProductsData(env) {
  const siteUrl = env.SITE_URL || env.URL || 'https://curvafit.com';
  const res = await fetch(`${siteUrl}/products.data.json`);
  if (!res.ok) throw new Error(`Cannot load products.data.json: ${res.status}`);
  return res.json();
}

async function loadSearchData(env) {
  try {
    const siteUrl = env.SITE_URL || env.URL || 'https://curvafit.com';
    const res = await fetch(`${siteUrl}/search.data.json`);
    if (res.ok) return res.json();
  } catch (e) {  }
  return null;
}

async function loadBlogArticles(env) {
  try {
    const siteUrl = env.SITE_URL || env.URL || 'https://curvafit.com';
    const res = await fetch(`${siteUrl}/blog/blog-articles.json`);
    if (res.ok) return res.json();
  } catch (e) {  }
  return null;
}


function buildProductIndex(rawData) {
  const allActive = rawData.filter(p => p.type !== 'settings' && p.id && p.active);
  const settings  = rawData.find(p => p.type === 'settings') || {};

  const products = allActive.map(item => {
    const colorsWithImages = (item.colors || [])
      .filter(c => c.active !== false)
      .map(c => ({ name: c.name, hex: c.hex || '', image: c.image || item.image || '' }));

    const variantPrices = (item.variants || []).map(v => v.price).filter(Boolean);
    const minPrice = variantPrices.length ? Math.min(...variantPrices) : item.price;
    const maxPrice = variantPrices.length ? Math.max(...variantPrices) : item.price;

    return {
      id:            item.id,
      title:         item.title,
      description:   item.description,
      price:         minPrice,
      maxPrice,
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
      badge:        item.badge ? (item.badge.text || '') : '',
      url:          item.url || `/products/product${index + 1}.html`,
      eprolo_id:        item.eprolo_id
    };
  });

  return { products, settings };
}

/* ══════════════════════════════════════════════════════
   BADGE DETECTION
══════════════════════════════════════════════════════ */
function buildBadgeMap(products) {
  const map = new Map();
  for (const p of products) {
    const b = (p.badge || '').trim();
    if (b) map.set(b.toLowerCase(), b);
  }
  return map;
}

function detectBadgeQuery(message, badgeMap) {
  if (!badgeMap.size) return null;
  const q = message.toLowerCase().trim();
  const sorted = [...badgeMap.keys()].sort((a, b) => b.length - a.length);
  for (const badgeLower of sorted) {
    if (q.includes(badgeLower)) return badgeLower;
  }
  return null;
}

/* ══════════════════════════════════════════════════════
   LANGUAGE DETECTION
══════════════════════════════════════════════════════ */
function detectLanguage(message, allowedLanguages) {
  const text = message.toLowerCase().trim();
  const words = text.split(/\s+/).map(w => w.replace(/[^a-záàâçèêëéíîïóôùûüñúkouwòèe]/gi, ''));

  let scores = { en: 0, fr: 0, es: 0, ar: 0, zh: 0, hi: 0, pt: 0, ru: 0, de: 0, ja: 0, ht: 0 };

  if (/[\u0600-\u06FF]/.test(text)) scores.ar += 10;
  if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text)) scores.zh += 10;
  if (/[\u0900-\u097F]/.test(text)) scores.hi += 10;
  if (/[\u0400-\u04FF]/.test(text)) scores.ru += 10;
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) scores.ja += 10;

  if (/\b(bonjou|bonswa|mesi|kijan|koman|ki|sa|ou|mwen|nou|yo|ak|nan|pou|sou|gen|pa|fe|di|ale|vini|achte|pri|livrezon|koulè|gwosè|disponib|konbyen|kote|ki lè|ki sa|pwodwi|bèl|chèk|kado|rabi|promo|kòd|réduksyon|kite|rete|deja|toujou|ansanm|zanmi|fanmi|ede|sipò|ekip|kontak|whatsapp|telegram|wap|map|pap|tap)\b/.test(text)) scores.ht += 5;
  if (/\b(m pa|m vle|m bezwen|m renmen|m ap|ou a|li a|nou yo|yo pa|sa a|kisa|poukisa|eske|wi|non|oui|mersi|tanpri|plis|mwens|gwo|piti|bèl|cho|fre)\b/.test(text)) scores.ht += 3;
  ['bonjou','bonswa','mesi','kijan','mwen','nou','ak','nan','pou','sou','gen','pa','fe','di','ale','vini','wi','non'].forEach(w => { if (words.includes(w)) scores.ht += 2; });

  if (/\b(bonjour|bonsoir|salut|merci|comment|c'est|je|vous|nous|les|des|une|pour|avec|dans|sur|mais|très|aussi|peut|plus|produit|livraison|taille|couleur|disponible|combien|où|quand|prix|acheter|réduction)\b/.test(text)) scores.fr += 3;
  if (/[àâçèêëîïôùûü]/.test(text)) scores.fr += 3;
  ['je','tu','il','elle','nous','vous','ils','elles','le','la','les','un','une','des','du','et','est','sont','avec','dans','pour','sur','pas','plus','très','bien','aussi','mais','ou','donc','car','que','qui','quoi','comment','quand','où','pourquoi','quel','quelle','bonjour','merci','oui','non'].forEach(w => { if (words.includes(w)) scores.fr += 2; });

  if (/\b(hola|buenas|buenos|cómo|como|puedo|quiero|necesito|tienes|tengo|gracias|ayuda|precio|envío|producto|comprar|descuento|talla|disponible|cuánto|dónde|también)\b/.test(text)) scores.es += 3;
  if (/[áéíóúüñ¿¡]/.test(text)) scores.es += 3;
  ['yo','él','ella','nosotros','ellos','ellas','los','las','del','al','con','por','para','sobre','más','muy','también','pero','porque','quien','cuando','donde','hola','gracias','sí','tener','ser','estar','hacer','poder','querer'].forEach(w => { if (words.includes(w)) scores.es += 2; });

  if (/\b(olá|oi|obrigado|obrigada|como|você|produto|preço|comprar|ajuda|envio|disponível|desconto)\b/.test(text)) scores.pt += 3;
  if (/[ãõâêôáéíóúàü]/.test(text)) scores.pt += 2;
  ['você','nós','eles','elas','uma','por','para','com','mas','também','não','sim','obrigado','como','onde','quando','porque','produto','preço'].forEach(w => { if (words.includes(w)) scores.pt += 2; });

  if (/\b(hallo|guten|danke|bitte|wie|was|wo|wann|warum|ich|sie|wir|der|die|das|und|für|mit|auf|ist|sind|haben|kaufen|produkt|preis|versand|verfügbar|rabatt)\b/.test(text)) scores.de += 3;
  if (/[äöüß]/.test(text)) scores.de += 3;
  ['ich','du','er','sie','es','wir','ihr','der','die','das','und','ist','sind','mit','auf','für','von','zu','an','ein','eine','nicht','auch','aber','oder','wie','was','wo','wann'].forEach(w => { if (words.includes(w)) scores.de += 2; });

  if (/\b(hello|hi|hey|what|how|can|could|would|should|where|when|why|which|who|the|and|for|with|this|that|have|your|you|want|need|does|do|is|are|was|were|help|price|shipping|color|size|available|discount|product|buy|order)\b/.test(text)) scores.en += 3;
  ['i','you','he','she','it','we','they','the','a','an','is','are','was','were','have','has','had','do','does','did','will','would','can','could','should','may','might','and','or','but','for','with','at','by','from','to','in','on','of','that','this','what','how','when','where','why','who','which'].forEach(w => { if (words.includes(w)) scores.en += 1; });

  let detected = 'en';
  let best = 0;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > best) { best = score; detected = lang; }
  }
  if (best === 0) detected = 'en';

  if (allowedLanguages && allowedLanguages.length > 0) {
    if (allowedLanguages.includes(detected)) return detected;
    if (allowedLanguages.includes('en')) return 'en';
    return allowedLanguages[0];
  }

  return detected;
}

function getLangName(code) {
  const names = {
    en: 'ENGLISH', fr: 'FRENCH', es: 'SPANISH', ar: 'ARABIC',
    zh: 'CHINESE', hi: 'HINDI', pt: 'PORTUGUESE', ru: 'RUSSIAN',
    de: 'GERMAN', ja: 'JAPANESE', ht: 'HAITIAN CREOLE'
  };
  return names[code] || 'ENGLISH';
}

/* ══════════════════════════════════════════════════════
   SMART INTENT DETECTION
══════════════════════════════════════════════════════ */
function detectIntent(message) {
  const q = message.toLowerCase();
  const generalPatterns = [
    /^(bonjour|bonsoir|salut|hello|hi|hey|hola|buenas|buenos|bonjou|bonswa)\b/,
    /^(merci|thanks|thank you|gracias|mesi|ok|okay|super|parfait|great)\b/,
    /contact|contacter|joindre|support|human|real person|whatsapp|telegram|email|customer service|service client|hablar con alguien/i,
    /shipping|delivery|livraison|env[ií]o|order tracking|track my order|suivre.+commande|rastrear.+pedido/i,
    /refund|return|remboursement|retour|reembolso|devoluci[oó]n/i,
    /payment|checkout|paiement|pago|card|carte bancaire/i,
    /privacy|confidentialit|terms|conditions|policy|politique|pol[ií]tica|cookies|disclaimer|avertissement/i,
    /account|compte|cuenta|password|mot de passe|contrase[nñ]a|profile|profil/i,
    /founder|foundatrice|fondateur|founder|about curvafit|what is curvafit|c'est quoi curvafit|qu[eé] es curvafit|mission|histoire|our story|qui a cr[eé][eé]/i,
    /blog|article|journal|read.+article/i,
    /catalog|catalogue|all products|tous les produits|todos los productos/i
  ];
  if (generalPatterns.some(pattern => pattern.test(q))) return 'general';

  const productPatterns = [
    /product|produit|producto|item|article|buy|shop|purchase|acheter|comprar|price|prix|precio|cost|coste|costar|how much|combien/i,
    /ebook|e-book|digital guide|guide|gu[ií]a|walking|walk plan|marche|caminata|meal planner|meal plan|shopping list|plan repas|planificador de comidas/i,
    /workout|exercise|fitness|movement|ejercicio|rutina|yoga|dumbbell|hand weight|water bottle|botella|gourde|halt[eè]re|mancuerna|hydration|leggings|shorts|skort|sports bra|soutien.gorge|sujetador|yoga vest|hip belt|ceinture|yoga mat|tapis|colchoneta|smart bracelet|fitness tracker|step counter|training|entrenamiento/i,
    /size|sizing|taille|talla|color|couleur|colour|available|disponible|disponibilit[eé]|variant|option|material|fabric|dimensions|measurement/i,
    /discount|promotion|promo|sale|offer|badge|deal|best seller|meilleure vente|oferta|promoci[oó]n/i
  ];
  return productPatterns.some(pattern => pattern.test(q)) ? 'product' : 'general';
}

/* ══════════════════════════════════════════════════════
   TOP STARTER REQUEST
══════════════════════════════════════════════════════ */
function isTopStarterRequest(message) {
  const q = message.toLowerCase();
  const patterns = [
    /products?.+for (a )?(beginner|starting|getting started)/,
    /produits?.+pour (commencer|débuter|démarrer)/,
    /pour.+(commencer|débuter|démarrer).+(routine|mouvement|marche|exercice|entraînement)/,
    /par où commencer/,
    /que me recommandes.+pour commencer/,
    /quels? produits?.+commencer/,
    /pour bien commencer/,
    /je (suis |)nouveau.+(ici|cliente?)/,
    /kit.+(départ|débutant|starter)/,
    /pack.+(débutant|commencer|démarrer)/,
    /products?.+to (get started|start my journey|begin my journey)/,
    /where (do i |should i |can i |)(start|begin)/,
    /what.*recommend.*to start/,
    /best products?.+for (absolute )?beginners?/,
    /starter.+products?/,
    /i('m| am) new (here|to curvafit)/,
    /to start my (routine|walking|workout|wellness) journey/,
    /get started (with|on) curvafit/,
    /productos?.+(para empezar|para comenzar|para iniciar)/,
    /por dónde empezar/,
    /qué me recomiendas para empezar/,
    /soy nueva?.+((aqu[ií])|cliente)/,
  ];
  return patterns.some(p => p.test(q));
}

/* ══════════════════════════════════════════════════════
   GREETING DETECTION
══════════════════════════════════════════════════════ */
function isGreeting(message) {
  const q = message.toLowerCase().trim();
  return /^(bonjour|bonsoir|salut|hello|hi|hey|hola|buenas|buenos|allo|yow|yo|wesh|cc|good morning|good evening|good afternoon|buenos días|buenas noches|buenas tardes|bonjou|bonswa)[\s!.,]*$/.test(q);
}

/* ══════════════════════════════════════════════════════
   SHORT ACK DETECTION
══════════════════════════════════════════════════════ */
function isShortAck(message) {
  const q = message.toLowerCase().trim();
  const wordCount = q.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount > 5) return false;
  return /^(ok|okay|k|oui|non|wi|non|merci|mesi|thanks|thx|ty|super|parfait|génial|great|bien|bueno|nice|cool|perfect|noted|got it|compris|alright|sure|yep|yup|nope|d'accord|ça marche|ça va|bien reçu|reçu|👍|🙏|❤️|😊|🥰|ah|oh|wow|true|right|correct|exactly|absolutely|definitely|of course|bien sûr|exactement|np|no problem|no worries|pas de problème|c'est bon)[\s!.,🙏❤️😊🥰]*$/.test(q);
}

/* ══════════════════════════════════════════════════════
   GENDER DETECTION
══════════════════════════════════════════════════════ */


function isBrandQuery(message) {
  const q = message.toLowerCase();
  return /your own brand|your own collection|do you design|who makes your products|votre propre marque|votre propre collection|qui fabrique vos produits|vous concevez|su propia marca|su propia colecci[oó]n|qui[eé]n fabrica sus productos|fabrican sus propios productos/.test(q);
}

/* ══════════════════════════════════════════════════════
   PRODUCT SEARCH
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

    if (/meilleur|best|top|plus vendu|most sold|más vendido|popular|populaire/.test(q)) {
      if (p.rating && p.rating >= 4.5) score += 8;
      if (p.reviewsCount && p.reviewsCount >= 50) score += 5;
    }

    const badgeLower = (p.badge || '').toLowerCase();
    if ((q.includes('best seller') || q.includes('meilleure vente') || q.includes('meilleur vente') || q.includes('top vente') || q.includes('más vendido')) && badgeLower.includes('best seller')) score += 15;
    if ((q.includes('promotion') || q.includes('promo') || q.includes('on sale') || q.includes('en promo') || q.includes('in promotion')) && badgeLower.includes('promotion')) score += 15;
    if ((q.includes('new arrival') || q.includes('new arriv') || q.includes('nouvel') || q.includes('nouveau') || q.includes('nueva llegada')) && badgeLower.includes('new')) score += 15;
    if ((q.includes('top sale') || q.includes('top deal') || q.includes('meilleure offre') || q.includes('mejor oferta')) && (badgeLower.includes('top sale') || badgeLower.includes('best deal'))) score += 15;

    const aliases = [
      { id: 'Pdg-Francenel-product1', words: ['walking guide', 'walk plan', 'walking plan', 'walking routine', 'step tracking', 'marche douce', 'guide marche', 'caminata', 'guia de caminata'] },
      { id: 'Pdg-Francenel-product2', words: ['meal planner', 'meal plan', 'meal planning', 'shopping list', 'planificateur repas', 'plan de repas', 'planificador de comidas', 'lista de compras'] },
      { id: 'Pdg-Francenel-product3', words: ['home workout', 'workout at home', 'chair workout', 'gentle exercise', 'movement guide', 'exercices maison', 'entraînement maison', 'ejercicios en casa', 'entrenamiento en casa'] },
      { id: 'Pdg-Francenel-product4', words: ['yoga pants', 'high waisted pants', 'leggings', 'pantalon yoga', 'pantalones yoga'] },
      { id: 'Pdg-Francenel-product5', words: ['sports bra', 'sport bra', 'support bra', 'soutien gorge sport', 'brassiere sport', 'sujetador deportivo'] },
      { id: 'Pdg-Francenel-product6', words: ['yoga vest', 'nylon vest', 'debardeur yoga', 'chaleco yoga'] },
      { id: 'Pdg-Francenel-product7', words: ['tennis skort', 'tennis skirt', 'skort', 'jupe short tennis', 'falda pantalon tenis'] },
      { id: 'Pdg-Francenel-product8', words: ['sports shorts', 'workout shorts', 'quick drying shorts', 'short sport', 'shorts deportivos'] },
      { id: 'Pdg-Francenel-product9', words: ['hip belt', 'shaping belt', 'training belt', 'ceinture hanche', 'cinturon cadera'] },
      { id: 'Pdg-Francenel-product10', words: ['yoga mat', 'non slip mat', 'pilates mat', 'exercise mat', 'tapis yoga', 'tapete yoga', 'colchoneta yoga'] },
      { id: 'Pdg-Francenel-product11', words: ['water bottle', '1.3l bottle', 'hydration bottle', 'gourde', 'bouteille eau', 'botella agua', 'botella deportiva'] },
      { id: 'Pdg-Francenel-product12', words: ['dumbbells', 'dumbbell pair', 'hand weights', 'fitness weights', 'halteres', 'mancuernas', 'pesas mano'] },
      { id: 'Pdg-Francenel-product13', words: ['smart bracelet', 'fitness tracker', 'step counter', 'm4 bracelet', 'bracelet intelligent', 'pulsera inteligente', 'contador pasos'] },
      { id: 'Pdg-Francenel-product14', words: ['pocket leggings', 'cropped leggings', 'leggings with pockets', 'legging poches', 'leggings bolsillos'] },
      { id: 'Pdg-Francenel-product15', words: ['back on track', 'restart guide', '14 day guide', '14-day guide', 'reprendre le cap', 'guia reinicio'] }
    ];

    aliases.forEach(alias => {
      if (p.id === alias.id && alias.words.some(word => q.includes(word))) score += 12;
    });

    if ((q.includes('cheap') || q.includes('budget') || q.includes('pas cher') || q.includes('barato') || q.includes('économico')) && p.price < 20) score += 5;
    return { ...p, score };
  });

  const filtered = scored.filter(p => p.score > 0).sort((a, b) => b.score - a.score);
  if (filtered.length === 0) return { results: [], isVague: false };

  const topScore    = filtered[0].score;
  const secondScore = filtered[1]?.score || 0;
  const gap         = topScore - secondScore;

  if (topScore >= 14 && gap >= 6) return { results: filtered.slice(0, 1), isVague: false };
  if (filtered.length >= 3 && gap <= 4) return { results: filtered.slice(0, 4), isVague: true };
  return { results: filtered.slice(0, 2), isVague: false };
}


function formatDelivery(startDate, endDate) {
  if (!startDate || !endDate) return null;
  try {
    const opts = { day: '2-digit', month: '2-digit', year: '2-digit' };
    const s = new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', opts);
    const e = new Date(endDate   + 'T00:00:00').toLocaleDateString('en-GB', opts);
    return `${s} – ${e}`;
  } catch (_) { return null; }
}

function buildSearchDataContext(searchData) {
  if (!searchData || !Array.isArray(searchData)) return '';
  const pages    = searchData.filter(i => i.type === 'page');
  const policies = searchData.filter(i => i.type === 'policy');
  const blogs    = searchData.filter(i => i.type === 'blog');
  let text = '';
  if (pages.length)    { text += '\nSITE PAGES:\n';    pages.forEach(p    => { text += `  • ${p.title} → ${p.url}\n`; }); }
  if (policies.length) { text += '\nPOLICIES:\n';      policies.forEach(p => { text += `  • ${p.title} → ${p.url}\n`; }); }
  if (blogs.length)    { text += '\nBLOG ARTICLES:\n'; blogs.forEach(p    => { text += `  • ${p.title} → ${p.url}\n`; }); }
  return text;
}

function buildBlogContext(blogData) {
  if (!blogData) return '';
  let articles = [];
  if (Array.isArray(blogData)) { articles = blogData; }
  else if (blogData.articles && Array.isArray(blogData.articles)) { articles = blogData.articles; }
  else if (typeof blogData === 'object') {
    for (const key of Object.keys(blogData)) { if (Array.isArray(blogData[key])) { articles = blogData[key]; break; } }
  }
  if (!articles.length) return '';
  let text = '\nBLOG ARTICLES:\n';
  articles.forEach(a => {
    const title   = a.title    || a.name    || 'Untitled';
    const url     = a.url      || a.slug    || a.link    || '/blog/blog.html';
    const summary = a.summary  || a.excerpt || a.description || '';
    const cat     = a.category || a.tag     || '';
    const date    = a.date     || a.published_at || '';
    text += `  • "${title}"`;
    if (cat)  text += ` [${cat}]`;
    if (date) text += ` (${date})`;
    text += ` → ${url}`;
    if (summary) text += `\n    Summary: ${summary.substring(0, 150)}${summary.length > 150 ? '...' : ''}`;
    text += '\n';
  });
  return text;
}

/* ══════════════════════════════════════════════════════
   PAGE_MAP — toutes les pages connues du site
══════════════════════════════════════════════════════ */
const PAGE_MAP = {
  '/': { label: 'Home', icon: '🏠' },
  '/index.html': { label: 'Home', icon: '🏠' },
  '/collections/bbw4life-all-product.html': { label: 'Shop All Curvafit Products', icon: '🛍️' },
  '/cart.html': { label: 'Cart', icon: '🛒' },
  '/account.html': { label: 'My Account', icon: '👤' },
  '/search-results.html': { label: 'Search', icon: '🔎' },
  '/page/contact.html': { label: 'Contact Curvafit', icon: '✉️' },
  '/page/faq.html': { label: 'FAQ', icon: '❓' },
  '/page/order-tracking.html': { label: 'Order Tracking', icon: '📦' },
  '/page/medical-disclaimer.html': { label: 'Wellness Guide Safety', icon: 'ℹ️' },
  '/policies/privacy.html': { label: 'Privacy Policy', icon: '🔒' },
  '/policies/refund.html': { label: 'Returns and Refunds', icon: '↩️' },
  '/policies/shipping.html': { label: 'Shipping Information', icon: '🚚' },
  '/policies/terms.html': { label: 'Terms and Conditions', icon: '📄' },
  '/blog/blog.html': { label: 'Curvafit Journal', icon: '📝' },
  '/coming-soon.html': { label: 'Coming Soon', icon: '✨' }
};

/* ══════════════════════════════════════════════════════
   BUILD SYSTEM PROMPT
══════════════════════════════════════════════════════ */
function buildSystemPrompt(products, settings, contactInfo, searchData, blogData, badgeMap, allowedLanguages) {
  const catalogText = products.map(p => {
    const colors = p.colors.map(c => c.name).filter(Boolean).join(', ') || 'Not specified';
    const sizes = p.sizes.length ? p.sizes.join(', ') : 'Not applicable';
    const variants = p.variants.map(v => {
      const option = [v.color, v.size].filter(Boolean).join(' / ');
      return option ? option + ' — $' + v.price : '';
    }).filter(Boolean);
    return [
      'Product: ' + p.title,
      'Description: ' + (p.description || 'No further description provided.'),
      'Price: $' + p.price + (p.maxPrice !== p.price ? '–$' + p.maxPrice : ''),
      p.compare_price ? 'Compare-at price: $' + p.compare_price : '',
      'Colors: ' + colors,
      'Sizes/options: ' + sizes,
      variants.length ? 'Available variants: ' + [...new Set(variants)].join(', ') : '',
      p.badge ? 'Current label: ' + p.badge : '',
      p.url ? 'Product page: 🔗[PAGE:' + p.url + ']' : ''
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const starter = settings.top_starter_products || {};
  const starterList = (starter.product_ids || [])
    .map(id => products.find(p => p.id === id))
    .filter(Boolean)
    .map(p => '- ' + p.title + ': 🔗[PAGE:' + p.url + ']')
    .join('\n');
  const searchContext = buildSearchDataContext(searchData);
  const blogContext = buildBlogContext(blogData);
  const emailSettings = settings.contact_emails || {};
  const supportEmail = emailSettings.general || '';
  const billingEmail = emailSettings.billing || supportEmail;
  const ebookIds = settings.digital_ebook_product_ids || [];
  const digitalTitles = ebookIds.map(id => products.find(p => p.id === id)).filter(Boolean).map(p => p.title);
  const shippingStandard = '10–20 days';
  const shippingFaster = '2–10 days';
  const policyPages = (Array.isArray(searchData) ? searchData : [])
    .filter(p => p.type === 'policy')
    .map(p => '- ' + p.title + ': 🔗[PAGE:' + p.url + ']')
    .join('\n');
  const contactWays = [
    contactInfo.hasWhatsapp ? 'WhatsApp' : '',
    contactInfo.hasTelegram ? 'Telegram' : '',
    supportEmail ? 'email ' + supportEmail : '',
    contactInfo.contactPage ? 'contact page 🔗[PAGE:' + contactInfo.contactPage + ']' : ''
  ].filter(Boolean).join(', ') || 'the contact page';

  return [
    'You are Sherline, Curvafit’s warm, practical virtual shopping and wellness-guide assistant.',
    '',
    'ABOUT CURVAFIT',
    'Curvafit offers gentle wellness guides and practical movement products. Help people find clear product information and choose an option that fits their routine, preferences, and budget. Be inclusive, calm, and encouraging. Do not use shame, pressure, body-size judgments, or exaggerated transformation language. Never promise weight loss, fitness results, medical benefits, or guaranteed outcomes. You are not a doctor, dietitian, or healthcare professional; give general information only and encourage medical advice for health concerns.',
    '',
    'YOUR KNOWLEDGE',
    'Use the current product catalog, policies, settings, page directory, and article summaries below as the source of truth. The catalog may change; do not rely on old product numbers, old brand information, or memory. The current catalog is Curvafit wellness guides and movement products. Do not invent stock, features, materials, compatibility, measurements, prices, discounts, shipping costs, or policy exceptions. If the available information does not answer the question, say so and direct the customer to Curvafit support.',
    '',
    'CURVAFIT PRODUCT CATALOG',
    catalogText || '(No active products are available.)',
    '',
    'DIGITAL GUIDES AND DELIVERY',
    'Digital products currently configured: ' + (digitalTitles.join('; ') || 'none listed') + '.',
    'After successful payment, the ebook download is available on the Thank You page. It is not delivered by email. Ebooks have no shipping time or shipping fee. If a customer wants a printed copy, they can ask Curvafit support; a physical copy would cost extra and availability must be confirmed.',
    'Digital ebooks are non-refundable, including when a buyer expected different content. If a guide does not cover something they expected, invite them to contact support. The team may be able to prepare relevant extra pages or explain the topic further; do not promise this can always be done and do not offer a refund.',
    '',
    'PHYSICAL ORDERS AND SHIPPING',
    'Standard physical-product shipping: approximately ' + shippingStandard + '. Paid faster shipping: approximately ' + shippingFaster + '; cost and availability vary by destination/distance and are shown at checkout. Estimates can vary by destination; direct the customer to the shipping policy or checkout for applicable options and costs.',
    'Ebook orders are digital downloads and are not shipped. For a printed copy of an ebook, the customer must contact support to ask about availability and additional cost.',
    '',
    'RETURNS AND REFUNDS',
    'Digital ebooks are non-refundable. For eligible physical products, explain that the return policy applies and link it; do not promise a return/refund will be approved. If an item arrives damaged, defective, or incorrect, ask the customer to contact support with their order number and a brief description or photo.',
    policyPages || '(No policy links are available; do not invent any.)',
    '',
    'SUPPORT AND ORDERS',
    'For account, payment, delivery, order, or product problems, listen to the details and give the next practical step. Do not claim to access or change an order. Ask for an order number only when it is needed. Never request full card numbers, passwords, or other sensitive credentials. Offer only these configured contact methods: ' + contactWays + '.',
    billingEmail && billingEmail !== supportEmail ? 'Billing contact: ' + billingEmail + '.' : '',
    '',
    'RECOMMENDATIONS',
    'When a customer asks for a product, use the catalog details above and the backend product cards. Recommend only items that fit the request. If the request is broad, ask one short clarifying question or show a small relevant selection. For “what should I start with?” use the configured starter list below. Do not imply a product includes something that is not listed.',
    'Configured starter products:',
    starterList || '(No starter products configured.)',
    '',
    'PAGES AND ARTICLES',
    'Only link pages that appear in this directory. Use exact button syntax 🔗[PAGE:/exact-path] and never print a raw URL or file path. When asked about a policy, answer briefly and include its policy link. Do not invent pages or links.',
    searchContext || '(Page directory unavailable; do not invent links.)',
    '',
    'ARTICLE DIRECTORY',
    blogContext || '(No article data is currently available.)',
    '',
    'RESPONSE RULES',
    '- Reply in the customer’s language. Supported language codes: ' + ((allowedLanguages || []).join(', ') || 'English, French, and Spanish') + '.',
    '- Sound human, attentive, concise, and specific. Address what they actually asked, including follow-ups in the conversation.',
    '- Use only the facts supplied in this prompt. Clearly say when a detail is unknown.',
    '- Product cards are rendered separately. Do not output internal IDs, raw catalog records, or product-number labels. A brief natural sentence is enough.',
    '- Do not make up promotions or promo codes. Mention an offer only if it is clearly present in current product data or visible to the customer.',
    '- Do not provide technical implementation details or claim to inspect customer accounts, payments, or shipment systems.',
    '- For simple greetings or acknowledgements, answer with one short friendly sentence and no product cards or page links.',
    '- If a customer explicitly asks to speak with a person, acknowledge that and end with 👇 on its own line so the site can show its support options.',
    '- For support issues, remain on the same issue in follow-up replies; acknowledge misunderstandings and correct them.',
    '- Do not claim Curvafit manufactures products or owns designs unless the supplied information explicitly confirms it.',
    '- Avoid medical, nutrition, or exercise prescriptions. For movement questions, keep advice general and encourage a comfortable pace.'
  ].filter(Boolean).join('\n');
}
function getFallbackMessage(lang) {
  const msgs = {
    fr: "Je suis très sollicitée en ce moment 😅 Réessayez dans quelques secondes !",
    es: "Estoy muy ocupada en este momento 😅 ¡Inténtalo de nuevo en unos segundos!",
    de: "Ich bin gerade sehr beschäftigt 😅 Bitte versuche es in ein paar Sekunden erneut!",
    pt: "Estou muito ocupada agora 😅 Tente novamente em alguns segundos!",
    ar: "أنا مشغولة جداً الآن 😅 يرجى المحاولة مرة أخرى بعد ثوانٍ!",
    zh: "我现在很忙 😅 请几秒后再试！",
    hi: "मैं अभी बहुत व्यस्त हूँ 😅 कृपया कुछ सेकंड बाद पुनः प्रयास करें!",
    ru: "Я сейчас очень занята 😅 Пожалуйста, повторите попытку через несколько секунд!",
    ja: "ただいま混み合っています 😅 数秒後にもう一度お試しください！",
    ht: "Mwen trè okipe kounye a 😅 Tanpri eseye ankò nan kèk segonn!",
  };
  return msgs[lang] || "I'm a bit overloaded right now 😅 Please try again in a few seconds!";
}

function getErrorMessage(lang) {
  const msgs = {
    fr: "Désolée, j'ai un petit problème technique. Réessayez dans un instant ! 🙏",
    es: "Lo siento, tengo un pequeño problema técnico. ¡Inténtalo de nuevo! 🙏",
    de: "Entschuldigung, ich habe ein kleines technisches Problem. Bitte versuche es erneut! 🙏",
    pt: "Desculpe, estou com um pequeno problema técnico. Tente novamente! 🙏",
    ar: "عذراً، أواجه مشكلة تقنية بسيطة. يرجى المحاولة مرة أخرى! 🙏",
    zh: "抱歉，我遇到了一个小技术问题。请再试一次！🙏",
    hi: "क्षमा करें, मुझे एक छोटी तकनीकी समस्या है। कृपया पुनः प्रयास करें! 🙏",
    ru: "Извините, у меня небольшая техническая проблема. Пожалуйста, попробуйте снова! 🙏",
    ja: "申し訳ありません、少し技術的な問題が発生しています。もう一度お試しください！🙏",
    ht: "Eskize mwen, gen yon ti pwoblèm teknik. Tanpri eseye ankò! 🙏",
  };
  return msgs[lang] || "Sorry, I'm having a little trouble right now. Please try again in a moment! 🙏";
}

/* ══════════════════════════════════════════════════════
   CLAUDE (ANTHROPIC) — PRIMARY PROVIDER
   Falls back to Groq automatically on ANY failure (see callClaude
   caller). No persisted "Claude is down" state on purpose: every
   request retries Claude first, so service resumes immediately
   once credit/quota is restored — no manual intervention needed.
══════════════════════════════════════════════════════ */
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

function isClaudeCreditError(status, bodyText) {
  if (status === 402) return true;
  const t = (bodyText || '').toLowerCase();
  return status === 429 && (
    t.includes('credit') || t.includes('quota') || t.includes('billing') || t.includes('insufficient')
  );
}

async function callClaude(systemPrompt, history, userMessage, imageBase64, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return { ok: false, creditError: false, reply: null };
  }

  const userContent = [];
  if (imageBase64) {
    const matches = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (matches) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: matches[1], data: matches[2] }
      });
    }
  }
  userContent.push({ type: 'text', text: userMessage });

  const claudeMessages = [
    ...history.slice(-8).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
    { role: 'user', content: userContent }
  ];

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 500,
        temperature: 0.70,
        system: systemPrompt,
        messages: claudeMessages
      })
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      console.error(`[Chat] Claude HTTP ${res.status}: ${bodyText.slice(0, 300)}`);
      return { ok: false, creditError: isClaudeCreditError(res.status, bodyText), reply: null };
    }

    const data  = await res.json();
    const reply = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('') || null;
    if (!reply) return { ok: false, creditError: false, reply: null };

    return { ok: true, creditError: false, reply };
  } catch (fetchErr) {
    console.error('[Chat] Claude fetch error:', fetchErr.message);
    return { ok: false, creditError: false, reply: null };
  }
}

/* ══════════════════════════════════════════════════════
   GOOGLE GEMINI — SECONDARY PROVIDER (fallback #1)
   Tried when Claude fails for any reason (credit exhausted, HTTP
   error, network error). Same shape as callClaude() on purpose —
   the caller doesn't need to know which provider answered.
══════════════════════════════════════════════════════ */
// gemini-3.5-flash-lite : 15 req/min en niveau gratuit sur ce compte,
// contre 5 req/min pour gemini-2.5-flash (vérifié dans AI Studio > Limite
// de débit) — plus de marge avant de retomber sur Groq.
const GEMINI_MODEL = 'gemini-3.5-flash-lite';

function isGeminiCreditError(status, bodyText) {
  if (status === 402 || status === 429) return true;
  const t = (bodyText || '').toLowerCase();
  return t.includes('quota') || t.includes('billing') || t.includes('resource_exhausted');
}

async function callGemini(systemPrompt, history, userMessage, imageBase64, env) {
  if (!env.GOOGLE_AI_API_KEY) {
    return { ok: false, creditError: false, reply: null };
  }

  const userParts = [];
  if (imageBase64) {
    const matches = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (matches) {
      userParts.push({ inline_data: { mime_type: matches[1], data: matches[2] } });
    }
  }
  userParts.push({ text: userMessage });

  const contents = [
    ...history.slice(-8).map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }]
    })),
    { role: 'user', parts: userParts }
  ];

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { maxOutputTokens: 500, temperature: 0.70 }
        })
      }
    );

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      console.error(`[Chat] Gemini HTTP ${res.status}: ${bodyText.slice(0, 300)}`);
      return { ok: false, creditError: isGeminiCreditError(res.status, bodyText), reply: null };
    }

    const data  = await res.json();
    const reply = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim() || null;
    if (!reply) return { ok: false, creditError: false, reply: null };

    return { ok: true, creditError: false, reply };
  } catch (fetchErr) {
    console.error('[Chat] Gemini fetch error:', fetchErr.message);
    return { ok: false, creditError: false, reply: null };
  }
}

/* ══════════════════════════════════════════════════════
   HUMAN ESCALATION —
══════════════════════════════════════════════════════ */
async function handleHumanEscalation(body, headers, env) {
  const firstName = (body.firstName || '').trim();
  const lastName  = (body.lastName  || '').trim();
  const email     = (body.email     || '').trim();
  const phone     = (body.phone     || '').trim();
  const deviceId  = (body.deviceId  || '').trim();

  if (!firstName || !email) {
    return new Response(JSON.stringify({ error: 'firstName and email are required' }), { status: 400, headers });
  }

  const chatId = generateChatId();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');


  let openedOk = false;
  for (let attempt = 1; attempt <= 2 && !openedOk; attempt++) {
    try {
      await appendLiveChatRow(chatId, 'client', `[Live chat started by ${fullName}]`, 'pending', deviceId, env);
      openedOk = true;
    } catch (e) {
      console.error(`[live-chat] Failed to open session in sheet (attempt ${attempt}):`, e.message);
      if (attempt < 2) await new Promise(r => setTimeout(r, 800));
    }
  }

  const message =
    `${fullName} — un client persiste pour te parler, PDG Francenel.\n` +
    `Il est en ligne maintenant, tu peux lui écrire.\n` +
    `Email : ${email}\n` +
    `Téléphone/WhatsApp : ${phone || 'non fourni'}\n\n` +
    `💬 Pour lui répondre EN DIRECT dans son chat sur le site, commence chaque message par :\n` +
    `<code>${chatId}:</code> ton message\n` +
    `Exemple : <code>${chatId}: Bonjour ! Comment puis-je vous aider ?</code>\n\n` +
    `Pour terminer la conversation live : <code>${chatId}: CLOSE</code>`;

  await notifyTelegram(message, env);

  return new Response(JSON.stringify({ success: true, chatId }), { status: 200, headers });
}

async function handleLiveChatMessage(body, headers, env) {
  const chatId = (body.chatId || '').trim();
  const text    = (body.message || '').trim();

  if (!chatId || !text) {
    return new Response(JSON.stringify({ error: 'chatId and message are required' }), { status: 400, headers });
  }

  try {
    await appendLiveChatRow(chatId, 'client', text, '', '', env);
  } catch (e) {
    console.error('[live-chat] Failed to save client message:', e.message);
    return new Response(JSON.stringify({ error: 'Failed to send message' }), { status: 500, headers });
  }

  await notifyTelegram(`💬 <code>${chatId}</code> — nouveau message du client :\n${text}`, env);

  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
}


const MODELS = [
  'qwen/qwen3.8-27b',
];
let currentModelIndex = 0;

/* ══════════════════════════════════════════════════════
   MAIN HANDLER
══════════════════════════════════════════════════════ */
export async function onRequestOptions(context) {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  return new Response('', { status: 200, headers });
}

export async function onRequestGet(context) {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    const bodyText = await request.text();
    const { message, history = [], image = null, action = null } = JSON.parse(bodyText);

    if (action === 'human_escalation') {
      return await handleHumanEscalation(JSON.parse(bodyText), headers, env);
    }

    if (action === 'live_chat_message') {
      return await handleLiveChatMessage(JSON.parse(bodyText), headers, env);
    }

    if (!message || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400, headers });
    }

    let products = [], settings = {};
    try {
      const rawData = await loadProductsData(env);
      const built   = buildProductIndex(rawData);
      products = built.products;
      settings = built.settings;
    } catch (err) {
      console.error('Could not load products.data.json:', err.message);
    }

    const allowedLanguages = (settings.allowed_languages && settings.allowed_languages.length > 0)
      ? settings.allowed_languages
      : ['en', 'fr', 'es', 'ar', 'zh', 'ht', 'hi', 'pt', 'ru', 'de', 'ja'];

    const userLang = detectLanguage(message, allowedLanguages);

    let searchData = null, blogData = null;
    try {
      [searchData, blogData] = await Promise.all([
        loadSearchData(env).catch(e   => { console.warn('search.data.json failed:', e.message);   return null; }),
        loadBlogArticles(env).catch(e => { console.warn('blog-articles.json failed:', e.message); return null; })
      ]);
    } catch (err) { console.warn('Could not load search/blog data:', err.message); }

    const contactSettings = settings.contact      || {};
    const socials         = settings.social_links || {};
    const contactInfo = {
      hasWhatsapp: !!(contactSettings.whatsapp_url || socials.whatsapp),
      hasTelegram: !!(contactSettings.telegram_url),
      whatsappUrl: contactSettings.whatsapp_url || socials.whatsapp || '',
      telegramUrl: contactSettings.telegram_url || '',
      contactPage: '/page/contact.html'
    };

    const visibleProducts = products;
    const badgeMap = buildBadgeMap(visibleProducts);

    const intent            = detectIntent(message);
    const topStarterRequest = isTopStarterRequest(message);
    const brandRequest      = isBrandQuery(message);
    const shortAck          = isShortAck(message);

    const matchedBadge = (!topStarterRequest && !brandRequest && !shortAck) ? detectBadgeQuery(message, badgeMap) : null;
    const isBadgeQuery = !!matchedBadge;

    let relevantProducts = [], isVague = false;

    if (!shortAck) {
      if (isBadgeQuery) {
        relevantProducts = visibleProducts.filter(p => (p.badge || '').toLowerCase().trim() === matchedBadge);
        isVague = false;
      } else if (topStarterRequest) {
        const topStarterIds = (settings.top_starter_products || {}).product_ids || [];
        relevantProducts = topStarterIds
          .map(id => visibleProducts.find(p => p.id === id))
          .filter(Boolean);
        isVague = false;
      } else if (intent === 'product' && !brandRequest) {
        const searchResult = searchProducts(message, visibleProducts);
        relevantProducts   = searchResult.results;
        isVague            = searchResult.isVague;
      }
    }

    const EXPLICIT_CONTACT_PATTERNS = [
      /parler\s+(à\s+)?(un\s+)?(humain|agent|conseiller|quelqu|personne)/i,
      /joindre\s+(votre|l['']|notre)?\s*(équipe|support|service)/i,
      /contacter\s+(votre|l['']|notre)?\s*(équipe|support|service|team)/i,
      /laisser\s+un\s+message/i,
      /service\s+client/i,
      /comment\s+(vous\s+)?(contacter|joindre|écrire|rejoindre)/i,
      /je\s+veux\s+(vous\s+)?(contacter|écrire|parler)/i,
      /moyen\s+de\s+contact/i,
      /votre\s+(whatsapp|telegram|email|mail)\b/i,
      /speak\s+(to\s+)?(a\s+)?(human|agent|person|someone|real)/i,
      /contact\s+(your|the|our)?\s*(team|support|us|service)/i,
      /leave\s+(a\s+)?message/i,
      /customer\s+serv/i,
      /how\s+(can\s+I\s+)?(contact|reach|message)\s+(you|the\s+team)/i,
      /I\s+want\s+to\s+(contact|reach|talk\s+to)/i,
      /how\s+do\s+I\s+reach\s+you/i,
      /get\s+in\s+touch/i,
      /your\s+(whatsapp|telegram|email)\b/i,
      /hablar\s+(con\s+)?(un\s+)?(humano|agente|persona|alguien)/i,
      /contactar\s+(a\s+)?(su|tu|el|nuestro)?\s*(equipo|soporte|servicio)/i,
      /dejar\s+un\s+mensaje/i,
      /servicio\s+al\s+cliente/i,
      /cómo\s+(puedo\s+)?(contactar|escribir|hablar)/i,
      /su\s+(whatsapp|telegram|email)\b/i,
    ];

    const isContactIntent = !topStarterRequest && !isBadgeQuery && !brandRequest && !shortAck
      && intent !== 'product'
      && EXPLICIT_CONTACT_PATTERNS.some(p => p.test(message));

    const systemPrompt = buildSystemPrompt(
      visibleProducts, settings, contactInfo, searchData, blogData, badgeMap, allowedLanguages
    );

    const contactInstruction = isContactIntent
      ? '\n[CONTACT REQUEST: User wants to reach the team. You MUST end your reply with 👇 on its own line — no exception.]'
      : '';

    const vagueInstruction = isVague
      ? '\n[VAGUE PRODUCT: Show up to 4 products and ask which one they mean.]'
      : '\n[SPECIFIC PRODUCT: Show ONLY the 1 most relevant product.]';

    const topStarterInstruction = topStarterRequest
      ? '\n[TOP STARTER REQUEST: User asks which products to discover first or start with. Show ALL the top starter products from the TOP STARTER PRODUCTS section. Introduce them warmly. This is NOT a badge/best-seller question.]'
      : '';

    const badgeInstruction = isBadgeQuery
      ? `\n[BADGE QUERY: Backend detected badge "${matchedBadge}" and injected ONLY products with exactly this badge. Present ONLY those products. If none injected, say honestly no product has this badge right now. Translate the badge name naturally in the user's language.]`
      : '';

    const brandInstruction = brandRequest
      ? '\n[BRAND QUERY: The customer asks who owns or makes Curvafit products. Do not claim ownership, design, or manufacturing facts that are not stated in the product/page information. Do not show product cards for this question.]'
      : '';

    const shortAckInstruction = shortAck
      ? '\n[SHORT ACK: The user sent a very short acknowledgement (ok, merci, thanks, super, 👍, mesi, oke, etc.). Reply with EXACTLY ONE short warm friendly sentence in their language. NO products. NO page buttons. NO explanations. NO lists. Just a warm human response like a friend would say. Maximum 10 words.]'
      : '';


    const langName    = getLangName(userLang);
    const otherLangs  = ['ENGLISH','FRENCH','SPANISH','ARABIC','CHINESE','HINDI','PORTUGUESE','RUSSIAN','GERMAN','JAPANESE','HAITIAN CREOLE']
      .filter(l => l !== langName).join(', ');
    const langInstruction = `CRITICAL — ABSOLUTE RULE: You MUST reply 100% in ${langName}. NOT a single word in ${otherLangs}. The user wrote in ${langName} — respond ONLY in ${langName}, no exception, no matter what.`;

    const noRawUrlInstruction = '\n[CRITICAL — NO RAW URLS: Do not write raw URLs, file paths, or page filenames in your reply. Use only the 🔗[PAGE:/exact-path] button format at the end when a page link is needed.]';

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
      {
        role: 'user',
        content: `${message}\n\n[${langInstruction}]${noRawUrlInstruction}${shortAckInstruction}${(intent === 'product' && !topStarterRequest && !isBadgeQuery && !brandRequest && !shortAck) ? vagueInstruction : ''}${topStarterInstruction}${badgeInstruction}${brandInstruction}${contactInstruction}`
      }
    ];

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const userTurnContent = `${message}\n\n[${langInstruction}]${noRawUrlInstruction}${shortAckInstruction}${(intent === 'product' && !topStarterRequest && !isBadgeQuery && !brandRequest && !shortAck) ? vagueInstruction : ''}${topStarterInstruction}${badgeInstruction}${brandInstruction}${contactInstruction}`;

    let groqResponse = null, usedModel = null, modelSuccess = false, reply = null;

    /* ── 1. TRY CLAUDE FIRST (primary provider) ── */
    const claudeResult = await callClaude(systemPrompt, history, userTurnContent, image, env);
    if (claudeResult.ok) {
      reply        = claudeResult.reply;
      usedModel    = CLAUDE_MODEL;
      modelSuccess = true;
    } else {
      console.log(`[Chat] Claude unavailable (creditError: ${claudeResult.creditError}) — falling back to Gemini`);
    }

    /* ── 2. FALLBACK TO GEMINI — runs on ANY Claude failure ── */
    if (!modelSuccess) {
      const geminiResult = await callGemini(systemPrompt, history, userTurnContent, image, env);
      if (geminiResult.ok) {
        reply        = geminiResult.reply;
        usedModel    = GEMINI_MODEL;
        modelSuccess = true;
      } else {
        console.log(`[Chat] Gemini unavailable (creditError: ${geminiResult.creditError}) — falling back to Groq`);
      }
    }

    /* ── 3. FALLBACK TO GROQ (unchanged existing logic) — runs if Claude AND Gemini both failed ── */
    if (!modelSuccess) {
      for (let attempt = 0; attempt < MODELS.length; attempt++) {
        const idx   = (currentModelIndex + attempt) % MODELS.length;
        const model = MODELS[idx];
        let modelOk = false;

        for (let retry = 1; retry <= 2; retry++) {
          try {
            groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model, messages: groqMessages, max_tokens: 400, temperature: 0.70, stream: false })
            });

            if (groqResponse.status === 429) {
              console.log(`[Chat] 429 on "${model}" (retry ${retry}/2)`);
              if (retry < 2) { await sleep(1500); continue; }
              currentModelIndex = (idx + 1) % MODELS.length;
              break;
            }
            if (!groqResponse.ok) { console.error(`[Chat] HTTP ${groqResponse.status} on "${model}"`); break; }

            usedModel = model; modelOk = true; modelSuccess = true; currentModelIndex = idx;
            break;
          } catch (fetchErr) {
            console.error(`[Chat] Fetch error on "${model}" (retry ${retry}/2):`, fetchErr.message);
            if (retry < 2) { await sleep(1000); continue; }
            break;
          }
        }
        if (modelOk) break;
      }

      if (!modelSuccess) {
        return new Response(JSON.stringify({
          reply: getFallbackMessage(userLang), products: [], intent: 'general',
          isVague: false, showContact: false, contactInfo: null, pageButtons: []
        }), { status: 200, headers });
      }

      const data = await groqResponse.json();
      reply = data.choices?.[0]?.message?.content || getErrorMessage(userLang);
    }

    console.log(`[Chat] Model: ${usedModel} | Lang: ${userLang} | Badge: ${matchedBadge || 'none'} | TopStarter: ${topStarterRequest} | Brand: ${brandRequest} | ShortAck: ${shortAck}`);
    const founderPhotoUrl = settings.founder?.photo || '';

    // Détecter si c'est une question sur le fondateur
    const isFounderQuery = /fondateur|founder|francenel|paul|admin|créateur|creator|histoire|story|about|à propos|qui est|who is/i.test(message);
    const shouldShowFounderPhoto = isFounderQuery && founderPhotoUrl && !shortAck && intent !== 'product' && relevantProducts.length === 0 && !topStarterRequest && !isBadgeQuery;

    const showContactButtons = !topStarterRequest && !isBadgeQuery && !brandRequest && !shortAck
      && intent !== 'product'
      && (isContactIntent || reply.includes('👇'));

    /* Safety net: strip any raw catalog dump the model might echo back
       (e.g. "PRODUCT 43:", "- Badge: X", "- Prè:", "- Koule:") — the real
       product cards are rendered separately by the frontend from productCards. */
    const sanitizedReply = reply
      .replace(/^\s*(?:\*\*)?PRODUCT\s+\d+(?:\*\*)?\s*:.*$/gim, '')
      .replace(/^\s*-\s*(?:Prix|Prè|Price|Precio|Koule|Colors?|Couleurs?|Nòt|Rating|Note|Badge|Deskripsyon|Description|Descripción)\s*:.*$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const cleanReply = (sanitizedReply || reply).replace(/👇[\s]*/g, '').trim();

    const suppressPages = isGreeting(message) || isShortAck(message);
    const pageMatches   = suppressPages ? [] : [...cleanReply.matchAll(/🔗\[PAGE:([^\]]+)\]/g)];
    const pageButtons   = pageMatches.map(m => {
      const url = m[1].trim();
      if (PAGE_MAP[url]) return { url, label: PAGE_MAP[url].label, icon: PAGE_MAP[url].icon };
      const matchingProduct = visibleProducts.find(product => product.url === url);
      if (matchingProduct) return { url, label: matchingProduct.title, icon: '🛍️' };
      const pm = url.match(/^\/products\/product(\d+)\.html$/);
      if (pm) {
        const prod = visibleProducts[parseInt(pm[1], 10) - 1];
        return { url, label: prod ? prod.title : `Product ${pm[1]}`, icon: '🛍️' };
      }
      return { url, label: 'Visit Page', icon: '🔗' };
    });

    const finalReply = cleanReply.replace(/🔗\[PAGE:([^\]]+)\]/g, '').trim();

    const productCards = relevantProducts.map(p => ({
      title:         p.title,
      description:   p.description,
      price:         p.price,
      compare_price: p.compare_price,
      url:           p.url,
      image:         p.image,
      badge:         p.badge || '',
      colors:        p.colors.map(c => ({ name: c.name, hex: c.hex, image: c.image })),
      variants:      p.variants,
      sizes:         p.sizes,
      delivery:      formatDelivery(p.startDate, p.endDate),
      rating:        p.rating,
      reviewsCount:  p.reviewsCount,
      discounts:     p.discounts
    }));

    return new Response(JSON.stringify({
      reply:       finalReply,
      products:    productCards,
      intent:      (topStarterRequest || isBadgeQuery) ? 'product' : intent,
      isVague,
      showContact: showContactButtons,
      contactInfo: showContactButtons ? {
        whatsapp: contactInfo.hasWhatsapp ? contactInfo.whatsappUrl : null,
        telegram: contactInfo.hasTelegram ? contactInfo.telegramUrl : null,
        page:     contactInfo.contactPage
      } : null,
      pageButtons,
      founderPhoto: shouldShowFounderPhoto ? {
        url:  founderPhotoUrl,
        name: settings.founder?.full_name || 'Paul Francenel',
        title: settings.founder?.title   || 'CEO & Founder'
      } : null
    }), { status: 200, headers });

  } catch (error) {
    console.error('Chat function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', message: error.message }), { status: 500, headers });
  }
}
