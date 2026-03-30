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

/* ── IMPROVEMENT #3: Load search.data.json ── */
async function loadSearchData() {
  const localPaths = [
    path.join(process.cwd(), 'search.data.json'),
    path.join(process.cwd(), 'public', 'search.data.json'),
    path.join(__dirname, '..', '..', 'search.data.json'),
    path.join(__dirname, '..', '..', 'public', 'search.data.json'),
  ];
  for (const p of localPaths) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) { /* continue */ }
  }
  try {
    const siteUrl = process.env.SITE_URL || process.env.URL || 'https://curvafit.com';
    const res = await fetch(`${siteUrl}/search.data.json`);
    if (res.ok) return res.json();
  } catch (e) { /* ignore */ }
  return null;
}

/* ── IMPROVEMENT #3: Load blog/blog-articles.json ── */
async function loadBlogArticles() {
  const localPaths = [
    path.join(process.cwd(), 'blog', 'blog-articles.json'),
    path.join(process.cwd(), 'public', 'blog', 'blog-articles.json'),
    path.join(__dirname, '..', '..', 'blog', 'blog-articles.json'),
    path.join(__dirname, '..', '..', 'public', 'blog', 'blog-articles.json'),
  ];
  for (const p of localPaths) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) { /* continue */ }
  }
  try {
    const siteUrl = process.env.SITE_URL || process.env.URL || 'https://curvafit.com';
    const res = await fetch(`${siteUrl}/blog/blog-articles.json`);
    if (res.ok) return res.json();
  } catch (e) { /* ignore */ }
  return null;
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
    /fondateur|founder|qui.+(fond|cre[aé]t)|paul|francenel/,
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
    /* ── BLOG patterns ── */
    /\bblog\b|\barticle\b|\bpost\b|\bread\b|\blire\b|\barticles?\b/,
    /derniers?.+article|latest.+article|nouveaux?.+article/,
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
    /* ── POLICY patterns ── */
    /politique.+(confidentialité|privac)|privacy.+polic|política.+privacidad/,
    /politique.+(remboursement|refund)|refund.+polic|política.+reembolso/,
    /conditions.+(utilisation|service|générales)|terms.+(condition|service|use)|términos.+(condiciones|servicio)/,
    /disclaimer|avertissement|descargo/,
    /données.+(personnel|privé)|personal.+data|datos.+personal/,
    /cookie|rgpd|gdpr/,
    /remboursement|refund|reembolso|rembours/,
    /retour.+(produit|commande)|product.+return|devolución/,
    /annuler|cancel|cancelar/,
    /garantie|warranty|garantía/,
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
   IMPROVEMENT #3: Build search data context
══════════════════════════════════════════════════════ */
function buildSearchDataContext(searchData) {
  if (!searchData || !Array.isArray(searchData)) return '';

  const pages    = searchData.filter(i => i.type === 'page');
  const programs = searchData.filter(i => i.type === 'program');
  const coaches  = searchData.filter(i => i.type === 'coach');
  const features = searchData.filter(i => i.type === 'feature');
  const products = searchData.filter(i => i.type === 'product');
  const policies = searchData.filter(i => i.type === 'policy');
  const blogs    = searchData.filter(i => i.type === 'blog');

  let text = '';

  if (pages.length) {
    text += '\nSITE PAGES:\n';
    pages.forEach(p => {
      text += `  • ${p.title} → ${p.url}\n`;
    });
  }

  if (programs.length) {
    text += '\nPROGRAMS:\n';
    programs.forEach(p => {
      text += `  • ${p.title} → ${p.url}\n`;
    });
  }

  if (coaches.length) {
    text += '\nCOACHES:\n';
    coaches.forEach(p => {
      text += `  • ${p.title} → ${p.url}\n`;
    });
  }

  if (features.length) {
    text += '\nFEATURES:\n';
    features.forEach(p => {
      text += `  • ${p.title} → ${p.url}\n`;
    });
  }

  if (products.length) {
    text += '\nPRODUCT PAGES (from search data):\n';
    products.forEach(p => {
      text += `  • ${p.title} → ${p.url}\n`;
    });
  }

  if (policies.length) {
    text += '\nPOLICIES:\n';
    policies.forEach(p => {
      text += `  • ${p.title} → ${p.url}\n`;
    });
  }

  if (blogs.length) {
    text += '\nBLOG ARTICLES (from search data):\n';
    blogs.forEach(p => {
      text += `  • ${p.title} → ${p.url}\n`;
    });
  }

  return text;
}

/* ══════════════════════════════════════════════════════
   IMPROVEMENT #3: Build blog articles context
══════════════════════════════════════════════════════ */
function buildBlogContext(blogData) {
  if (!blogData) return '';

  let articles = [];
  if (Array.isArray(blogData)) {
    articles = blogData;
  } else if (blogData.articles && Array.isArray(blogData.articles)) {
    articles = blogData.articles;
  } else if (typeof blogData === 'object') {
    const keys = Object.keys(blogData);
    for (const key of keys) {
      if (Array.isArray(blogData[key])) {
        articles = blogData[key];
        break;
      }
    }
  }

  if (!articles.length) return '';

  let text = '\nBLOG ARTICLES (live from blog-articles.json):\n';
  articles.forEach(a => {
    const title    = a.title    || a.name    || 'Untitled';
    const url      = a.url      || a.slug    || a.link    || '/blog/blog.html';
    const summary  = a.summary  || a.excerpt || a.description || '';
    const category = a.category || a.tag     || '';
    const date     = a.date     || a.published_at || '';

    text += `  • "${title}"`;
    if (category) text += ` [${category}]`;
    if (date)     text += ` (${date})`;
    text += ` → ${url}`;
    if (summary)  text += `\n    Summary: ${summary.substring(0, 150)}${summary.length > 150 ? '...' : ''}`;
    text += '\n';
  });

  return text;
}

/* ══════════════════════════════════════════════════════
   PAGE NAVIGATION MAP
   Maps page labels to their URLs and icons
══════════════════════════════════════════════════════ */
const PAGE_MAP = {
  '/index.html':                { label: 'Home',                 icon: '🏠' },
  '/shop.html':                 { label: 'Shop',                 icon: '🛍️' },
  '/programs.html':             { label: 'Programs',             icon: '💪' },
  '/nutrition.html':            { label: 'Nutrition',            icon: '🥗' },
  '/blog/blog.html':            { label: 'Blog',                 icon: '📝' },
  '/about.html':                { label: 'About Us',             icon: 'ℹ️' },
  '/contact.html':              { label: 'Contact',              icon: '📩' },
  '/account.html':              { label: 'My Account',           icon: '👤' },
  '/checkout.html':             { label: 'Checkout',             icon: '🛒' },
  '/success.html':              { label: 'Success Stories',      icon: '🏆' },
  '/community.html':            { label: 'Community',            icon: '👥' },
  '/method.html':               { label: 'Our Method',           icon: '🔬' },
  '/faq.html':                  { label: 'FAQ',                  icon: '❓' },
  '/careers.html':              { label: 'Careers',              icon: '💼' },
  '/policies/privacy.html':     { label: 'Privacy Policy',       icon: '🔒' },
  '/policies/refund.html':      { label: 'Refund Policy',        icon: '↩️' },
  '/policies/terms.html':       { label: 'Terms & Conditions',   icon: '📄' },
  '/disclaimer.html':           { label: 'Medical Disclaimer',   icon: '⚕️' },
};
// Product pages are handled dynamically (product1..product16)

/* ══════════════════════════════════════════════════════
   BUILD SYSTEM PROMPT
══════════════════════════════════════════════════════ */
function buildSystemPrompt(products, settings, contactInfo, searchData, blogData) {
  const contactEmails = settings.contact_emails || {};
  const emailsText = Object.entries(contactEmails)
    .map(([k, v]) => `• ${k}: ${v}`)
    .join('\n') || '• No emails configured';
  const programs = settings.programs     || {};
  const promos   = settings.promos       || [];
  const shipping = settings.cart_drawer  || {};

  const taxRate         = settings.tax_rate      || 0.1;
  const shippingCost    = settings.shipping_cost || 10.0;
  const taxPercent      = Math.round(taxRate * 100);
  const freeShipThresh  = shipping.free_shipping_threshold || 120;

  const programsText = Object.entries(programs)
    .map(([, val]) => `• ${val.label}: $${val.price}`)
    .join('\n');

  const promosText = promos.length
  ? promos.map(p => `• Code **[[${p.code}]]** → **${p.percent}% off** on ${p.items}+ items (Shop products only — NOT valid on programs)`)
    .join('\n')
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

  const searchContext = buildSearchDataContext(searchData);
  const blogContext   = buildBlogContext(blogData);

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
Use **bold** for: **Paul Francenel**, **CurvaFit**, product names, key prices.

🎟️ PROMO CODE FORMATTING — VERY IMPORTANT:
When displaying a promo code, ALWAYS use this exact format: **[[CODE]]**
Example: The code **[[CURVA15]]** gives you **20% off** on 4+ items.
The frontend will render [[CODE]] with a special highlighted style automatically.
NEVER display a promo code without the [[...]] markers.

🔗 PAGE NAVIGATION — VERY IMPORTANT:
When a user asks to go to or visit a specific page of the site, add a navigation marker at the END of your reply.
Use this exact format: 🔗[PAGE:/url]

Page URL reference:
  - Home page              → 🔗[PAGE:/index.html]
  - Shop / products        → 🔗[PAGE:/shop.html]
  - Programs               → 🔗[PAGE:/programs.html]
  - Nutrition              → 🔗[PAGE:/nutrition.html]
  - Blog                   → 🔗[PAGE:/blog/blog.html]
  - About us               → 🔗[PAGE:/about.html]
  - Contact                → 🔗[PAGE:/contact.html]
  - My Account             → 🔗[PAGE:/account.html]
  - Checkout               → 🔗[PAGE:/checkout.html]
  - Success stories        → 🔗[PAGE:/success.html]
  - Community              → 🔗[PAGE:/community.html]
  - Our Method             → 🔗[PAGE:/method.html]
  - FAQ                    → 🔗[PAGE:/faq.html]
  - Careers                → 🔗[PAGE:/careers.html]
  - Privacy Policy         → 🔗[PAGE:/policies/privacy.html]
  - Refund Policy          → 🔗[PAGE:/policies/refund.html]
  - Terms & Conditions     → 🔗[PAGE:/policies/terms.html]
  - Medical Disclaimer     → 🔗[PAGE:/disclaimer.html]
  - Specific product N     → 🔗[PAGE:/products/productN.html]

RULES for page navigation markers:
- Add the marker ONLY when the user explicitly asks to go to, visit, or navigate to a page.
- You can add multiple markers if the user asks for multiple pages: 🔗[PAGE:/shop.html] 🔗[PAGE:/programs.html]
- NEVER write the raw URL in your text. Only use the marker at the end.
- Say "use the button below" or "click the button below" to refer to the navigation button.
- The frontend will render this marker as a clickable button automatically.

EXAMPLES:
  User: "I want to go to the shop"             → end reply with 🔗[PAGE:/shop.html]
  User: "show me your programs"                → end reply with 🔗[PAGE:/programs.html]
  User: "take me to the home page"             → end reply with 🔗[PAGE:/index.html]
  User: "where is your blog?"                  → end reply with 🔗[PAGE:/blog/blog.html]
  User: "I want to see my account"             → end reply with 🔗[PAGE:/account.html]
  User: "show me the privacy policy"           → end reply with 🔗[PAGE:/policies/privacy.html]
  User: "where is the refund policy?"          → end reply with 🔗[PAGE:/policies/refund.html]
  User: "I want to read the terms"             → end reply with 🔗[PAGE:/policies/terms.html]
  User: "where is the medical disclaimer?"     → end reply with 🔗[PAGE:/disclaimer.html]

🚫 ABSOLUTE RULE — NEVER display any raw URL or link in your text.
   Examples of what is FORBIDDEN:
   ❌ "https://wa.me/1234567890"
   ❌ "https://t.me/curvafit"
   ❌ "/contact.html"
   ❌ "visit our page at https://..."
   ❌ "/account.html"
   ❌ "/checkout.html"
   ❌ "/policies/privacy.html"
   ❌ "/policies/refund.html"
   ❌ "/policies/terms.html"
   ❌ "/disclaimer.html"
   
   ALWAYS say "see the button below" or "use the buttons below".
   The frontend will automatically show the correct buttons.
   NEVER write a URL. NEVER write a phone number. Just reference "the button below".

═══════════════════════════════════════
🚦 CRITICAL BEHAVIOR RULES — NON-NEGOTIABLE
═══════════════════════════════════════
NEVER suggest products for: brand info, nutrition advice, program info,
contact requests, promo code questions, greetings, small talk,
account questions, checkout questions, shipping questions (general),
policy questions, legal questions.

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
❌ Any question about privacy policy, refund policy, terms, disclaimer

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

CONTACT EMAILS (use ONLY these — never invent emails):
${emailsText}

When a user asks to contact us, leave a message, speak to a human, needs support,
OR asks for an email address → reply warmly using the emails above when relevant.
Say the buttons below will also connect them directly.

RULES FOR EMAILS:
- general questions → use general email
- billing questions → use billing email
- tech issues → use tech email
- coach questions → use coaches email
- press → use press email
- NEVER invent or guess an email
- ALWAYS use exact emails from the list above

EXAMPLE response for contact requests:
EN: "Of course! You can reach our team using the buttons below or by email at the address matching your need. We reply within 24h! 😊"
FR: "Bien sûr ! Utilise les boutons ci-dessous ou écris-nous par email selon ton besoin. On répond en 24h ! 😊"
ES: "¡Por supuesto! Usa los botones de abajo o escríbenos al email correspondiente a tu necesidad. ¡Respondemos en 24h! 😊"

ALWAYS end contact-related replies with: "👇" on its own line (signals frontend to show contact buttons).

═══════════════════════════════════════
🏢 ABOUT CURVAFIT & THE FOUNDER
═══════════════════════════════════════
**Paul Francenel** is the visionary founder of **CurvaFit**, born in 2000. At just 25 years old, he
is one of the most inspiring young entrepreneurs in the wellness and transformation space.

Paul is not a doctor or a conventional fitness coach — and that is precisely his greatest strength.
Coming from a background deeply rooted in sport, personal growth, and human observation, he understood
something that most professionals miss: the women who need help the most are often the ones least
served by the fitness industry. Too much judgment. Too much pressure. Too little humanity.

So he built **CurvaFit** from scratch — not from a business plan, but from a genuine desire to create
real change. He assembled a team of qualified fitness coaches, wellness specialists, and trusted
partner platforms to deliver a science-based, low-impact, sustainable weight loss experience
designed specifically for plus-size women.

In just months since launching on **November 5, 2025**, CurvaFit has grown into a community of
real women achieving real transformations — without pills, without crash diets, and without shame.

**Paul's philosophy:** You don't need to be perfect to start. You need to start to become better.
CurvaFit exists because Paul believed that every woman, at every size, deserves a program that
respects her body, her pace, and her power.

When asked about his mission, Paul says it simply:
"I'm not here to sell programs. I'm here to change lives."

═══════════════════════════════════════
💪 PROGRAMS
═══════════════════════════════════════
${programsText}

═══════════════════════════════════════
🎟️ PROMO CODES — ALWAYS use [[CODE]] format when displaying
═══════════════════════════════════════
${promosText}

Free shipping over $${freeShipThresh}

═══════════════════════════════════════
💰 TAXES & SHIPPING (from live settings)
═══════════════════════════════════════
Tax rate: ${taxPercent}% applied at checkout
Standard shipping cost: $${shippingCost}
Free shipping on orders over $${freeShipThresh}
Returns accepted within 30 days.

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
- **Subtotal / Taxes (${taxPercent}%) / Shipping / Total**: Breakdown of the order cost
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
Free shipping on all orders over $${freeShipThresh}
Tax rate at checkout: ${taxPercent}%
Returns accepted within 30 days. Contact: paulfrance13@gmail.com

═══════════════════════════════════════
🔒 PRIVACY POLICY — /policies/privacy.html
═══════════════════════════════════════
Last updated: March 20, 2026 — Version 4.0

WHAT WE NEVER DO:
- We NEVER sell personal data to any third party
- We NEVER share health data (weight, measurements) with advertisers
- We NEVER use data to target users with external advertising
- We NEVER send marketing emails without explicit consent
- We NEVER store credit card or payment details on our servers
- We NEVER share email addresses without explicit permission

WHAT WE COLLECT AND WHY:
- Name & email: to create account, send program access, respond to support (required)
- Weight & measurements: personal progress tracker only, never shared (optional)
- Program purchased: to deliver correct content via partner platforms (required)
- Payment info: processed by Stripe or PayPal only, never stored by CurvaFit (required for purchase)
- Proof of use (photos/videos/logs): only for result-based refund requests (optional)
- Support messages: to respond to questions (when user contacts us)
- IP address: security and fraud prevention only (automatic)
- Browser/device type: ensure site displays correctly (automatic)
- Pages visited: anonymized aggregate data for site improvement (automatic)
- Newsletter subscription: tips and updates, only with explicit opt-in (optional)

HOW WE USE DATA:
- Program delivery via partner platforms (by email)
- Customer support responses
- Program emails (not marketing — part of program content)
- Newsletter (opt-in only, one-click unsubscribe)
- Refund verification (proof of use reviewed then deleted)
- Site improvement via anonymized analytics
- Fraud prevention
- Legal compliance (purchase records kept 5 years)

THIRD PARTIES WE SHARE WITH (minimum necessary only):
- Stripe & PayPal: payment processing
- Partner fitness platforms: name + email only, for program delivery
- Email provider: name + email for communications
- Google Analytics: anonymized browsing data only
- Legal authorities: minimum data, only if legally required

DATA SECURITY:
- SSL encryption on all data transfers
- Secure hosting with firewalls and intrusion detection
- Role-based access control (staff only see what they need)
- Passwords hashed (never stored in plain text)
- Health data stored separately from billing data
- Proof of use deleted after refund request is processed

DATA RETENTION:
- Account data: while active + 30 days after deletion
- Progress data: deleted immediately on account deletion
- Payment records: 5 years (legal requirement)
- Support conversations: 2 years after last interaction
- Proof of use (refunds): deleted within 30 days after decision
- Server logs: 90 days
- Newsletter data: deleted within 48 hours of unsubscribe
- Analytics data: 26 months (anonymized)

GDPR RIGHTS (EU/UK users):
- Right of Access: request copy of all data held
- Right of Rectification: request correction of inaccurate data
- Right to Erasure: request complete deletion ("right to be forgotten")
- Right to Portability: receive data in CSV or JSON format
- Right to Object: object to any specific use of data
- Right to Restriction: limit use without deleting account
- All rights exercised by emailing support — fulfilled within 30 days
- Right to complain to national data protection authority (ICO, CNIL, etc.)

COOKIES:
- Essential cookies: required for login, cart, checkout — cannot be disabled
- Analytics cookies: Google Analytics, fully anonymized — can be disabled
- Marketing cookies: only with explicit consent — can be disabled via cookie banner

CHILDREN: CurvaFit is for adults 18+. No data knowingly collected from minors.

Privacy contact: support@curvafit.com — All requests answered within 30 days (most within 5 business days).

When a user asks about privacy, data, cookies, GDPR, or personal information:
→ Answer from the knowledge above, warmly and clearly.
→ If they want to read the full policy, use the button below marker: 🔗[PAGE:/policies/privacy.html]
→ NEVER display the URL directly.

═══════════════════════════════════════
↩️ REFUND POLICY — /policies/refund.html
═══════════════════════════════════════
Last updated: March 20, 2026 — Version 2.0

OUR COMMITMENTS:
- Users can cancel subscription at any time, no penalty
- All valid refund requests processed honestly without delay
- Refunds via original payment method (or alternative requested 5 days in advance)
- We treat every refund request with respect

PRODUCT RETURNS (Shop items):
Eligibility:
- Product must be in original condition — unused, undamaged, original packaging
- Return request submitted within reasonable delay after reception (typically 14 days)
- Proof of purchase required (order confirmation or order number)

Return timeline:
1. Submit return request to billing@curvafit.com
2. Team reviews and sends return instructions within 5 business days
3. User returns item per instructions
4. Partner validates return and triggers refund — up to 30 days after validation

Important before ordering:
- Check size guide carefully before ordering apparel
- Verify delivery address before confirming order
- CurvaFit not responsible for delivery failures from incorrect address

RESULT-BASED REFUND (Programs):
CurvaFit states up to 70% chance of concrete results with serious program use.
Conditions for result-based refund:
- Must have used program regularly over required period (not sporadically)
- Must provide proof of use: photos, videos, or progress log covering up to 15 days
- Must share experience honestly
- Team reviews submission carefully
- If conditions verified → refund processed within up to 30 days

How to submit:
1. Email billing@curvafit.com with subject: "Result-Based Refund Request"
2. Include full name, purchase email, order number
3. Attach proof of use (photos, videos, or written progress log up to 15 days)
4. Describe experience briefly
5. Team confirms receipt within 48 hours, notifies outcome within 30 days

Note: The 15-day documentation is maximum required, not a waiting period. Existing documentation can be submitted immediately.

SUBSCRIPTION CANCELLATION:
- Cancel at any time — no minimum commitment, no penalty
- Request via email to support@curvafit.com
- CurvaFit initiates cancellation within 2 business days
- Full processing takes up to 10 days (partner-dependent)
- Unused subscription time calculated from cancellation date
- Partial refund for unused time may be issued via original payment method
- To change refund payment method: must request at least 5 days before processing begins

HOW REFUNDS ARE PROCESSED:
- Via same payment method as original purchase (Stripe, PayPal, Visa, Mastercard, Amex)
- Timeline: up to 30 days from validation
- Same currency as original transaction
- Email confirmation sent when refund initiated
- Bank may take additional 3–10 business days to reflect amount (outside CurvaFit control)
- Always include purchase email and order number in any request

NON-REFUNDABLE SITUATIONS:
- Products used, damaged, or returned without original packaging
- Digital program content already fully accessed and delivered
- Refund requests without required proof of use for result-based claims
- Requests after eligible return window without prior contact
- Incorrect address provided at checkout causing delivery failure
- Purchases under promotions that explicitly stated no refunds

Refund contact: billing@curvafit.com — Requests acknowledged within 48 hours, resolved within 30 days.

When a user asks about refunds, returns, cancellations, or money back:
→ Answer from the knowledge above, warmly and clearly.
→ If they want to read the full policy, use: 🔗[PAGE:/policies/refund.html]
→ NEVER display the URL directly.

═══════════════════════════════════════
📄 TERMS & CONDITIONS — /policies/terms.html
═══════════════════════════════════════
Last updated: March 20, 2026 — Version 2.0

OUR CORE COMMITMENTS:
- We never promise results we cannot prove — realistic timelines, honest numbers
- We never sell pills, supplements, or dangerous products — zero, ever
- You can cancel your subscription at any time — no penalty, no conditions
- Products can be returned in original condition — refunds within 30 days
- Payment processed by Stripe or PayPal — we never store card details
- We always recommend consulting a doctor before starting any program

HOW CURVAFIT WORKS:
- CurvaFit is NOT a direct course delivery platform
- We partner with specialized fitness platforms who deliver program content
- After purchase: user receives program access by email
- CurvaFit is responsible for purchase experience and customer support
- Partners are responsible for actual content delivery

PROGRAMS OFFERED:
- Beginner — Soft Start: for women starting out (weeks 1–8), 2–4 kg/month with full consistency
- Intermediate — Deeper Refiner: for women ready to accelerate (months 2–4), 3–5 kg/month
- Maintenance — Forever Fit: for women who reached their goal (month 5+), stable weight, no rebound
- All programs include: structured meal plans, low-impact workout videos, community access, weekly tracker
- Program access is personal and non-transferable

PAYMENTS:
- Accepted: Visa, Mastercard, Amex, all major cards (via Stripe), PayPal
- CurvaFit never stores full card details — all processed by Stripe (PCI DSS Level 1) or PayPal
- CurvaFit receives only transaction confirmation
- Failed payments: notified by email, access granted only after confirmed payment

SUBSCRIPTIONS & CANCELLATION:
- Cancel at any time — no minimum, no penalty
- Processing delay: up to 10 days with partner platforms
- User retains access for remainder of paid period
- Partial refund may be issued for unused time
- Refund via original payment method (Stripe or PayPal)
- Alternative refund method: must request at least 5 days before processing

REFUND & RETURN POLICY (summary — see full Refund Policy for details):
- Products: returned in original condition, within reasonable delay, with proof of purchase
- Programs: result-based refund requires proof of regular use (photos/videos/log up to 15 days)
- Refund processing: up to 30 days after validation
- Verify size before ordering; verify address before confirming

MEDICAL DISCLAIMER (in Terms):
- CurvaFit is NOT medical treatment
- Always consult a doctor before starting — especially with: diabetes, high blood pressure, thyroid disorders, PCOS, joint injuries, cardiovascular conditions
- Coaches are fitness/wellness specialists — not doctors
- Doctor's recommendations always take priority over CurvaFit programs

RESULTS DISCLAIMER (in Terms):
- Safe fat loss: 0.5 to 1 kg per week (medically recognized safe range)
- Results vary by individual — adherence is the primary variable
- Success stories represent members with complete, consistent adherence
- CurvaFit recommends measuring progress over 4-week periods, not daily

USER CONDUCT:
- Treat community with respect — no body shaming or discrimination
- No sharing of program access (personal, non-transferable)
- No copying or redistributing CurvaFit content without permission
- No promoting third-party products in the community
- Provide honest information in refund requests
- Violations may result in access termination without refund

INTELLECTUAL PROPERTY:
- All CurvaFit content is exclusive property of CurvaFit or licensed partners
- Personal use permitted
- Social sharing of personal results encouraged (with credit to CurvaFit)
- Unauthorized commercial use may result in legal action

LIMITATION OF LIABILITY:
- CurvaFit not liable for health complications from failure to consult doctor
- CurvaFit not liable for results varying from success stories
- CurvaFit not liable for delivery delays caused by third parties or incorrect address
- Maximum liability limited to amount paid for the product/program in question
- These limitations do not affect statutory consumer rights

Contact: support@curvafit.com / billing@curvafit.com — All requests answered within 5 business days.

When a user asks about terms, conditions, rules, user rights, liability, intellectual property, or legal matters:
→ Answer from the knowledge above, warmly and clearly.
→ If they want to read the full terms, use: 🔗[PAGE:/policies/terms.html]
→ NEVER display the URL directly.

═══════════════════════════════════════
⚕️ MEDICAL DISCLAIMER — /disclaimer.html
═══════════════════════════════════════
Last updated: March 20, 2026 — Version 2.0

WHAT CURVAFIT IS:
- A lifestyle education program based on science
- Structured guidance on nutrition, movement, hydration, and sleep
- A support community for plus-size women on a weight loss journey
- Low-impact home workout suggestions adapted to larger bodies
- General calorie and protein education to help understand fat loss
- A safe, judgment-free space that respects pace and body

WHAT CURVAFIT IS NOT:
- NOT a medical clinic, hospital, or licensed healthcare provider
- NOT a substitute for advice from a doctor or nutritionist
- NOT a treatment for any disease (diabetes, PCOS, thyroid, etc.)
- NOT a personalized medical nutrition therapy service
- NOT a guarantee of specific weight loss results for any individual
- NOT affiliated with or a replacement for any pharmaceutical product

MEDICAL DISCLAIMER:
- CurvaFit provides NO medical advice, diagnosis, or treatment
- ALWAYS consult a licensed healthcare professional before starting
- Especially important with: PCOS, Type 1 or 2 diabetes, thyroid disorders,
  cardiovascular disease or high blood pressure, chronic joint pain or arthritis,
  history of eating disorders, any condition requiring metabolism-affecting medication
- Doctor's instructions ALWAYS take priority over anything in CurvaFit programs

PREGNANCY & BREASTFEEDING:
- CurvaFit programs are for non-pregnant adults
- If pregnant, postpartum, or breastfeeding: consult obstetrician/midwife first
- Weight loss during pregnancy is NOT recommended
- Calorie restriction during breastfeeding can affect milk supply

FITNESS & EXERCISE DISCLAIMER:
- All exercises are low-impact and designed with plus-size bodies in mind
- BUT all physical activity carries inherent risk
- STOP immediately if: chest pain, dizziness, shortness of breath, or sharp joint pain
- Warm up before any session
- Listen to your body — effort discomfort is normal, injury pain is not
- Modify movements to current fitness level
- Rest days are part of the method

NUTRITION DISCLAIMER:
- All nutritional guidance is general educational information ONLY
- Not personalized medical nutrition therapy
- Calorie/macronutrient values are estimates based on population averages
- Individual needs vary by height, weight, age, activity level, medical history
- For specific dietary needs due to medical conditions: work with a registered dietitian
- CurvaFit does NOT promote extreme restriction, crash dieting, meal replacements, or unsafe fasting

RESULTS DISCLAIMER:
- Safe fat loss rate: 0.5 to 1 kg per week (or 2–4 kg per month)
- Faster is NOT better — often means muscle loss, not fat loss
- Results depend on starting weight, age, hormonal health, sleep, stress, consistency
- No two bodies are the same
- CurvaFit makes NO guarantees of specific weight loss outcomes
- Sustainable results take months, not days — anyone promising weeks is misleading

TESTIMONIALS DISCLAIMER:
- Success stories are real and individual
- They are NOT fabricated
- They are also NOT typical results guaranteed for every member
- Results shown require high consistency and absence of major medical obstacles
- These stories show what is POSSIBLE, not what is AUTOMATIC

SUPPLEMENTS & PILLS:
- CurvaFit does NOT recommend, endorse, or sell weight loss pills, detox teas, appetite suppressants, or unregulated supplements
- Most over-the-counter slimming products are unregulated and unproven
- If any product mentions supplementation, it refers only to standard nutritional support (vitamin D, magnesium etc.) — must be discussed with healthcare provider
- IMPORTANT: If any third party claims to sell "CurvaFit pills" or "CurvaFit supplements" — this is NOT affiliated with CurvaFit and should be reported

EXTERNAL LINKS & AFFILIATES:
- Some links may be affiliate links (small commission at no extra cost to user)
- Affiliate relationships NEVER influence health guidance
- CurvaFit not responsible for content of third-party sites

LIMITATION OF LIABILITY:
- CurvaFit, founders, coaches, team, and affiliates are NOT liable for injuries or health complications from use of content or programs
- By using CurvaFit, users voluntarily choose to follow the program and take personal responsibility

By using CurvaFit services, users confirm they have read and understood this disclaimer.

When a user asks about medical safety, pill safety, exercise risks, pregnancy, nutrition safety, results guarantees, testimonial authenticity, supplements, or whether CurvaFit is medically supervised:
→ Answer from the knowledge above, warmly, clearly, and responsibly.
→ If they want to read the full disclaimer, use: 🔗[PAGE:/disclaimer.html]
→ NEVER display the URL directly.
→ ALWAYS recommend consulting a doctor for any medical concern.

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
🌐 SITE NAVIGATION & CONTENT (live from search.data.json)
═══════════════════════════════════════
Use this to answer questions about pages, programs, coaches, features, blog articles, policies.
When a user asks about a page or topic, you can tell them where to find it on the site.
NEVER write the raw URL — say "see the [page name] section of the site" or reference the topic.
${searchContext || '(search.data.json not available)'}

═══════════════════════════════════════
📝 BLOG ARTICLES (live from blog-articles.json)
═══════════════════════════════════════
Use this to answer questions about blog content. If a user asks about articles, topics covered,
or specific blog posts — use this data. NEVER write raw URLs, just mention the article title.
${blogContext || '(blog-articles.json not available)'}

═══════════════════════════════════════
🚫 NEVER
═══════════════════════════════════════
- Write long responses (max 4-5 lines)
- Display any URL, link, or phone number — EVER
- Invent prices or data
- Promise guaranteed results
- Reply in a different language than the user's message
- Show multiple unrelated products when user asked for something specific
- Add 👇 unless the user is EXPLICITLY asking how to contact or reach the team
- Apply or suggest promo codes for programs — promo codes are ONLY valid on Shop products
- Display a promo code without the [[CODE]] format`;
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
   MODEL ROTATION STATE
   Persistent across warm Lambda invocations (in-memory)
══════════════════════════════════════════════════════ */
const MODELS = [
  'llama-3.3-70b-versatile',
  'moonshotai/kimi-k2-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'qwen/qwen3-32b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'moonshotai/kimi-k2-instruct-0905',
  'openai/gpt-oss-safeguard-20b',
  'llama-3.1-8b-instant',
  'meta-llama/llama-prompt-guard-2-22m',
  /* ── 5 new models added ── */
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'deepseek-r1-distill-llama-70b',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
  'llama3-70b-8192',
];

/* currentModelIndex persists as long as the Lambda container stays warm */
let currentModelIndex = 0;

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

    /* Load search.data.json and blog-articles.json in parallel */
    let searchData = null;
    let blogData   = null;
    try {
      [searchData, blogData] = await Promise.all([
        loadSearchData().catch(e => { console.warn('search.data.json load failed:', e.message); return null; }),
        loadBlogArticles().catch(e => { console.warn('blog-articles.json load failed:', e.message); return null; })
      ]);
    } catch (err) {
      console.warn('Could not load search/blog data:', err.message);
    }

    /* Read contact settings */
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

    /* Product search */
    let relevantProducts = [];
    let isVague = false;

    if (intent === 'product') {
      const searchResult = searchProducts(message, products);
      relevantProducts   = searchResult.results;
      isVague            = searchResult.isVague;
    }

    /* Contact intent detection */
    const EXPLICIT_CONTACT_PATTERNS = [
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
      /hablar\s+(con\s+)?(un\s+)?(humano|agente|persona|alguien)/i,
      /contactar\s+(a\s+)?(su|tu|el|nuestro)?\s*(equipo|soporte|servicio)/i,
      /dejar\s+un\s+mensaje/i,
      /servicio\s+al\s+cliente/i,
      /cómo\s+(puedo\s+)?(contactar|escribir|hablar\s+con)\s+(ustedes|el\s+equipo)/i,
      /medios?\s+de\s+contacto/i,
      /su\s+(whatsapp|telegram|email)\b/i,
    ];

    const isContactIntent = intent !== 'product' && EXPLICIT_CONTACT_PATTERNS.some(p => p.test(message));

    /* Build system prompt */
    const systemPrompt = buildSystemPrompt(products, settings, contactInfo, searchData, blogData);

    /* Language + vague instructions */
    const vagueInstruction = isVague
      ? '\n[VAGUE PRODUCT REQUEST: Show up to 4 products and ask the user to confirm which one they want.]'
      : '\n[SPECIFIC PRODUCT REQUEST: Show ONLY the 1 most relevant product. Do NOT show others.]';

    const langInstruction = userLang === 'fr'
      ? 'REMINDER: The user wrote in FRENCH. Your entire reply MUST be in FRENCH. End with 👇 ONLY if the user explicitly asked how to contact or reach the team.'
      : userLang === 'es'
      ? 'REMINDER: The user wrote in SPANISH. Your entire reply MUST be in SPANISH. End with 👇 ONLY if the user explicitly asked how to contact or reach the team.'
      : 'REMINDER: The user wrote in ENGLISH. Your entire reply MUST be in ENGLISH. End with 👇 ONLY if the user explicitly asked how to contact or reach the team.';

    const productContext = intent === 'product' ? vagueInstruction : '';

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: `${message}\n\n[${langInstruction}]${productContext}` }
    ];

    /* ══════════════════════════════════════════════════════
       CIRCULAR MODEL ROTATION SYSTEM
    ══════════════════════════════════════════════════════ */
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    let groqResponse = null;
    let usedModel    = null;
    let modelSuccess = false;

    for (let attempt = 0; attempt < MODELS.length; attempt++) {
      const idx   = (currentModelIndex + attempt) % MODELS.length;
      const model = MODELS[idx];

      let modelOk = false;
      for (let retry = 1; retry <= 2; retry++) {
        try {
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
            console.log(`[Chat] 429 rate-limited on model "${model}" (retry ${retry}/2)`);
            if (retry < 2) {
              await sleep(1500);
              continue;
            }
            console.log(`[Chat] Model "${model}" exhausted → moving to next`);
            currentModelIndex = (idx + 1) % MODELS.length;
            break;
          }

          if (!groqResponse.ok) {
            console.error(`[Chat] Model "${model}" HTTP error: ${groqResponse.status}`);
            break;
          }

          usedModel    = model;
          modelOk      = true;
          modelSuccess = true;
          currentModelIndex = idx;
          break;

        } catch (fetchErr) {
          console.error(`[Chat] Fetch error on model "${model}" (retry ${retry}/2):`, fetchErr.message);
          if (retry < 2) { await sleep(1000); continue; }
          break;
        }
      }

      if (modelOk) break;
    }

    if (!modelSuccess) {
      console.error('[Chat] All models exhausted — returning fallback message');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          reply:       getFallbackMessage(userLang),
          products:    [],
          intent:      'general',
          isVague:     false,
          showContact: false,
          contactInfo: null,
          pageButtons: []
        })
      };
    }

    console.log(`[Chat] Answered using model: ${usedModel} (index ${currentModelIndex})`);

    const data  = await groqResponse.json();
    const reply = data.choices?.[0]?.message?.content || getErrorMessage(userLang);

    /* Detect if AI signaled to show contact buttons (👇 at end) */
    const showContactButtons = intent !== 'product' && isContactIntent && reply.includes('👇');
    const cleanReply = reply.replace(/👇\s*$/m, '').trim();

    /* ── PAGE NAVIGATION: extract 🔗[PAGE:/url] markers from reply ── */
    const pageMarkerRegex = /🔗\[PAGE:([^\]]+)\]/g;
    const pageMatches = [...cleanReply.matchAll(pageMarkerRegex)];
    const pageButtons = pageMatches.map(m => {
      const url = m[1].trim();
      // Resolve label and icon from PAGE_MAP, or build a generic one for product pages
      if (PAGE_MAP[url]) {
        return { url, label: PAGE_MAP[url].label, icon: PAGE_MAP[url].icon };
      }
      // Handle product pages dynamically: /products/productN.html
      const productMatch = url.match(/^\/products\/product(\d+)\.html$/);
      if (productMatch) {
        const num = productMatch[1];
        const prod = products[parseInt(num, 10) - 1];
        return {
          url,
          label: prod ? prod.title : `Product ${num}`,
          icon: '🛍️'
        };
      }
      // Generic fallback
      return { url, label: 'Visit Page', icon: '🔗' };
    });

    /* Remove the 🔗[PAGE:...] markers from the final reply text */
    const finalReply = cleanReply.replace(pageMarkerRegex, '').trim();

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
        reply:       finalReply,
        products:    productCards,
        intent,
        isVague,
        showContact: showContactButtons,
        contactInfo: showContactButtons ? {
          whatsapp: contactInfo.hasWhatsapp ? contactInfo.whatsappUrl : null,
          telegram: contactInfo.hasTelegram ? contactInfo.telegramUrl : null,
          page:     contactInfo.contactPage
        } : null,
        pageButtons  /* ← array of { url, label, icon } */
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