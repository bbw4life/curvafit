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
    /* ── POLICY pages patterns — FR/EN/ES ── */
    /confidentialit/,
    /privacy/,
    /politique.+confidential/,
    /données.+(personnelles|perso|privées)/,
    /personal.+data/,
    /gdpr|rgpd/,
    /mes.+droits.+(données|data)/,
    /supprim.+(compte|données)|delete.+(account|data)/,
    /\bremboursement\b/,
    /\brefund\b/,
    /politique.+rembours/,
    /retour.+produit|return.+policy/,
    /política.+devolu|devolución/,
    /\bannulation\b|\bannuler\b/,
    /cancel.+(order|subscription)/,
    /\bcancelar\b/,
    /conditions.+(utilisation|service|générales)/,
    /terms.+(service|condition|use)/,
    /\btérm[ei]nos\b/,
    /\bcgu\b|\bcgv\b/,
    /\bterms\b/,
    /\bconditions\b/,
    /\bdisclaimer\b/,
    /\bavertissement\b/,
    /déni.+responsabilité/,
    /médical.+avertissement|avis.+médical/,
    /medical.+(notice|disclaimer)/,
    /risque.+(exercice|sport)|exercise.+risk/,
    /\bpolitique\b/,
    /\bpolicy\b/,
    /política.+(privacidad|reembolso|términos)/,
    /reembolso/,
    /privacidad/,
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
  '/index.html':                { label: 'Home',              icon: '🏠' },
  '/shop.html':                 { label: 'Shop',              icon: '🛍️' },
  '/programs.html':             { label: 'Programs',          icon: '💪' },
  '/nutrition.html':            { label: 'Nutrition',         icon: '🥗' },
  '/blog/blog.html':            { label: 'Blog',              icon: '📝' },
  '/about.html':                { label: 'About Us',          icon: 'ℹ️' },
  '/contact.html':              { label: 'Contact',           icon: '📩' },
  '/account.html':              { label: 'My Account',        icon: '👤' },
  '/checkout.html':             { label: 'Checkout',          icon: '🛒' },
  '/success.html':              { label: 'Success Stories',   icon: '🏆' },
  '/community.html':            { label: 'Community',         icon: '👥' },
  '/method.html':               { label: 'Our Method',        icon: '🔬' },
  '/faq.html':                  { label: 'FAQ',               icon: '❓' },
  '/careers.html':              { label: 'Careers',           icon: '💼' },
  /* ── Policy pages ── */
  '/policies/privacy.html':     { label: 'Privacy Policy',    icon: '🔒' },
  '/policies/refund.html':      { label: 'Refund Policy',     icon: '↩️' },
  '/policies/terms.html':       { label: 'Terms & Conditions',icon: '📋' },
  '/disclaimer.html':           { label: 'Medical Disclaimer',icon: '⚕️' },
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
  User: "I want to see the privacy policy"         → end reply with 🔗[PAGE:/policies/privacy.html]
  User: "show me your refund policy"               → end reply with 🔗[PAGE:/policies/refund.html]
  User: "where are your terms and conditions"      → end reply with 🔗[PAGE:/policies/terms.html]
  User: "I want to read the medical disclaimer"    → end reply with 🔗[PAGE:/disclaimer.html]
  User: "I want to go to the shop"                 → end reply with 🔗[PAGE:/shop.html]
  User: "show me your programs"                    → end reply with 🔗[PAGE:/programs.html]
  User: "take me to the home page"                 → end reply with 🔗[PAGE:/index.html]
  User: "where is your blog?"                      → end reply with 🔗[PAGE:/blog/blog.html]
  User: "I want to see my account"                 → end reply with 🔗[PAGE:/account.html]

🚫 ABSOLUTE RULE — NEVER display any raw URL or link in your text.
   Examples of what is FORBIDDEN:
   ❌ "https://wa.me/1234567890"
   ❌ "https://t.me/curvafit"
   ❌ "/contact.html"
   ❌ "/policies/privacy.html"
   ❌ "/policies/refund.html"
   ❌ "/policies/terms.html"
   ❌ "/disclaimer.html"
   ❌ "visit our page at https://..."
   ❌ "/account.html"
   ❌ "/checkout.html"
   ❌ Any path that looks like a URL — FORBIDDEN
   
   ALWAYS say "use the button below" or "click the button below".
   The frontend renders the 🔗[PAGE:...] marker as a clickable button automatically.
   NEVER write a URL. NEVER write a phone number. NEVER write a path like /something.html.

🔗 CRITICAL — POLICY PAGE NAVIGATION:
When a user asks about OR asks to SEE any policy page, you MUST add the marker.
These requests ALWAYS require a marker:
  - "politique de confidentialité" / "privacy policy" / "privacidad"  → 🔗[PAGE:/policies/privacy.html]
  - "politique de remboursement" / "refund policy" / "reembolso"      → 🔗[PAGE:/policies/refund.html]
  - "conditions générales" / "terms" / "CGU" / "CGV" / "términos"    → 🔗[PAGE:/policies/terms.html]
  - "disclaimer" / "avertissement médical" / "aviso médico"           → 🔗[PAGE:/disclaimer.html]

The user does NOT need to say "je veux aller sur" — simply asking about or mentioning these pages
is enough to add the marker at the end of your reply.

═══════════════════════════════════════
🚦 CRITICAL BEHAVIOR RULES — NON-NEGOTIABLE
═══════════════════════════════════════
NEVER suggest products for: brand info, nutrition advice, program info,
contact requests, promo code questions, greetings, small talk,
account questions, checkout questions, shipping questions (general),
policy questions, disclaimer questions.

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
**Paul Francenel** is the visionary founder and CEO of **CurvaFit**, born and raised with an entrepreneurial spirit that led him — at just 25 years old — to build one of the most human-centered weight loss platforms for plus-size women.

His story is not the story of a doctor or a certified coach. It is something more powerful: the story of a young man who observed the real world, listened to real women, and refused to accept the lies the fitness industry had been selling for decades.

At 25, while his peers were following conventional paths, **Paul Francenel** chose to build something that mattered. He spent months studying the science of sustainable fat loss, interviewing plus-size women, understanding their pain points — the shame, the failed diets, the broken promises — and decided to create a solution that was radically different: no pills, no crash diets, no extreme pressure. Just science, structure, support, and respect.

**Paul Francenel** is not a doctor — and he is proud of it. Because it is precisely his position as an outsider to the medical establishment that allowed him to see what practitioners often miss: that the real obstacle to weight loss is not calories — it is the system, the psychology, and the lack of a support community that actually respects larger bodies.

Founded on **November 5, 2025**, **CurvaFit** has grown from a vision into a full wellness platform offering structured programs, expert nutrition guidance, low-impact workouts, and an inclusive community — all designed specifically for plus-size women who deserve to be seen, respected, and supported.

**Paul Francenel**'s mission is not just business. It is transformation — one woman at a time.

Key facts:
- Age: 25 years old
- Role: Founder & CEO of CurvaFit
- Founded CurvaFit: November 5, 2025
- Not a doctor — a human observer turned entrepreneur
- Mission: Help plus-size women achieve safe, sustainable, dignified fat loss
- Philosophy: No pills. No crash diets. No shame. Just results.

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

WHAT CURVAFIT NEVER DOES:
- Never sells personal data to any third party — ever
- Never shares health data (weight, measurements, progress) with advertisers
- Never uses data to target users with external advertising on other platforms
- Never sends marketing emails without explicit prior consent
- Never stores credit card or payment details on CurvaFit servers
- Never shares email addresses with other companies without explicit permission

WHAT WE COLLECT & WHY:
- Name & email → account management, program delivery, support
- Weight & body measurements → personal progress tracker only (never shared externally) — optional
- Program purchased → to deliver the correct content via partner platforms
- Payment info → processed entirely by Stripe or PayPal, never stored on CurvaFit servers
- Proof of use (photos/videos) → only for result-based refund requests
- IP address → security, fraud prevention, approximate geographic region only

DATA RETENTION:
- Account data: while active + 30 days after deletion
- Progress data: deleted immediately on account deletion
- Payment records: 5 years (legal requirement)
- Support conversations: 2 years after last interaction
- Proof of use: deleted within 30 days after refund decision

GDPR RIGHTS (for EU/UK users): Access, Rectification, Erasure, Portability, Object, Restriction
To exercise rights or for privacy questions: support@curvafit.com — answered within 30 days

COOKIES: Essential (required), Analytics via Google Analytics (anonymized), Marketing (consent-based)

THIRD PARTIES: Only Stripe & PayPal (payments), Partner fitness platforms (program delivery), Email provider (transactional emails), Google Analytics (anonymized analytics), Legal authorities (if legally required)

When asked about privacy, data, GDPR, cookies, or data deletion → summarize warmly and offer the button below to read the full policy.

═══════════════════════════════════════
↩️ REFUND POLICY — /policies/refund.html
═══════════════════════════════════════
Last updated: March 20, 2026 — Version 2.0

OUR COMMITMENT:
- Cancel subscription at any time — no penalty, no conditions
- All valid refund requests processed honestly and without unnecessary delay
- Refunds via original payment method — or an alternative requested at least 5 days before processing
- Up to 70% chance of real results if the program is followed seriously

PRODUCT RETURNS (Shop items):
- Must be returned in original condition — unused, undamaged, original packaging
- Return request must be submitted within a reasonable delay after reception (typically 14 days)
- Step 1: Submit request to billing@curvafit.com
- Step 2: Team reviews and sends return instructions (within 5 business days)
- Step 3: User returns the item following instructions
- Step 4: Partner validates and triggers the refund — up to 30 days after validation
- Always check size guides before ordering — CurvaFit cannot be responsible for incorrect address delivery failures

RESULT-BASED REFUND (Programs):
- Must have used the program regularly over the required period
- Must provide proof of use: photos, videos, or progress log covering up to 15 days
- Must share experience honestly
- Team reviews the submission — if conditions verified, refund processed within up to 30 days
- To submit: email billing@curvafit.com with subject "Result-Based Refund Request"
- Include: full name, purchase email, order number, proof of use, description of experience

SUBSCRIPTION CANCELLATION:
- Cancel at any time — no minimum commitment, no penalty
- Processing delay: up to 10 days (partner-dependent)
- Partial refund for unused time may be issued via original payment method
- To change refund payment method: request at least 5 days before processing starts

REFUND PROCESSING:
- Timeline: up to 30 days from validation
- Currency: same as original transaction
- Bank may take additional 3–10 business days after CurvaFit initiates

NON-REFUNDABLE:
- Used, damaged, or returned products without original packaging
- Fully accessed digital program content
- Requests without required proof of use for result-based claims
- Requests after eligible window without prior contact
- Incorrect address causing delivery failure

When asked about refunds, returns, cancellations → summarize the relevant part warmly.
For the full policy, offer the button below.

═══════════════════════════════════════
📋 TERMS & CONDITIONS — /policies/terms.html
═══════════════════════════════════════
Last updated: March 20, 2026 — Version 2.0

OUR CORE COMMITMENTS:
- Never promise results we cannot prove — realistic timelines, honest numbers
- Never sell pills, supplements, or dangerous products — zero, ever
- Cancel subscription at any time — no penalty
- Products returnable in original condition — refunds within 30 days
- Payment processed by Stripe or PayPal — card details never stored by CurvaFit
- Always recommend consulting a doctor before starting any program

HOW CURVAFIT WORKS:
- CurvaFit is NOT a platform that delivers fitness courses directly
- Partners with specialized fitness platforms to deliver programs
- Once a program is purchased: access information sent by email
- Sessions and advice available online through partner platforms
- CurvaFit = intermediary responsible for purchase experience, customer support, and program quality

PROGRAMS (3 levels):
- Beginner — Soft Start: weeks 1–8, 2–4 kg per month with full consistency
- Intermediate — Deeper Refiner: months 2–4, 3–5 kg per month with full consistency
- Maintenance — Forever Fit: month 5+, stable weight — no rebound
- All include: meal plans, low-impact home workout videos, community access, weekly progress tracker
- Content delivered digitally — no physical materials shipped as part of program purchase
- Access is personal and non-transferable

PAYMENTS: Visa, Mastercard, American Express, PayPal — processed by Stripe (PCI DSS Level 1) or PayPal
MEDICAL: Not medical treatment — always consult a doctor before starting, especially with diabetes, PCOS, thyroid disorders, cardiovascular conditions, joint injuries
RESULTS: Safe fat loss = 0.5 to 1 kg per week. Results vary by individual. No guaranteed outcomes.
INTELLECTUAL PROPERTY: All CurvaFit content is proprietary — no reproduction without written authorization
USER CONDUCT: No body shaming, no sharing of program access, no redistribution of content
LIABILITY: Max liability = amount paid for product or program in question

When asked about terms, CGU, service conditions, how CurvaFit works, or legal matters → summarize warmly.
For the full terms, offer the button below.

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
- A safe, judgment-free space that respects your pace and your body

WHAT CURVAFIT IS NOT:
- Not a medical clinic, hospital, or licensed healthcare provider
- Not a substitute for advice from your doctor or nutritionist
- Not a treatment for any disease (diabetes, PCOS, thyroid conditions, etc.)
- Not a personalized medical nutrition therapy service
- Not a guarantee of specific weight loss results for any individual
- Not affiliated with or a replacement for any pharmaceutical product

ALL CONTENT is for educational and informational purposes only — not professional medical advice.

CONSULT A DOCTOR BEFORE STARTING if you have:
PCOS, Type 1 or 2 diabetes, thyroid disorders, cardiovascular disease/high blood pressure,
chronic joint pain or arthritis, history of eating disorders, any condition requiring medication that affects metabolism or weight.

PREGNANCY & BREASTFEEDING: Consult obstetrician or midwife before following any guidance. Weight loss during pregnancy is not recommended.

EXERCISE SAFETY: Stop immediately if chest pain, dizziness, shortness of breath, or sharp joint pain. Always warm up. Listen to your body. Modify movements to your level.

NUTRITION: All nutritional guidance is general educational information — estimates based on population averages. Work with a registered dietitian if you have specific medical dietary needs.

RESULTS: Safe fat loss = 0.5 to 1 kg per week. Individual variation based on adherence, sleep, stress, medical conditions. No guaranteed outcomes. Measure progress over 4-week periods, not daily.

SUPPLEMENTS: CurvaFit does NOT recommend, endorse, or sell weight loss pills, detox teas, appetite suppressants, or unregulated supplements. If anyone claims to sell "CurvaFit pills" — that is NOT affiliated with CurvaFit.

TESTIMONIALS: Represent real individual experiences of specific members — not typical results for every member.

When asked about medical disclaimer, exercise risks, pregnancy, supplements, results disclaimers → summarize the relevant part warmly.
For the full disclaimer, offer the button below.

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

    /* ══════════════════════════════════════════════════════
       HARDCODED PAGE DETECTION — safety net
       Even if the AI forgets to add the marker, the backend
       injects the correct page button based on the user's message.
    ══════════════════════════════════════════════════════ */
    function detectForcedPageButtons(msg) {
      const q = msg.toLowerCase();
      const forced = [];

      if (/confidentialit|privacy|privacidad|données.+perso|personal.+data|gdpr|rgpd/.test(q)) {
        forced.push('/policies/privacy.html');
      }
      if (/remboursement|refund|reembolso|retour.+produit|return.+policy|annul|cancel/.test(q)) {
        forced.push('/policies/refund.html');
      }
      if (/conditions|terms|cgu|cgv|termin|términos|service.+condition/.test(q)) {
        forced.push('/policies/terms.html');
      }
      if (/disclaimer|avertissement|aviso.+med|médical|medical.+notice/.test(q)) {
        forced.push('/disclaimer.html');
      }
      if (/\bfaq\b|foire.+question|frequent/.test(q)) {
        forced.push('/faq.html');
      }
      if (/\bshop\b|boutique|tienda|produits?\b|productos?\b/.test(q) && !/programme|program/.test(q)) {
        forced.push('/shop.html');
      }
      if (/programme|program|coaching/.test(q) && !/conditions/.test(q)) {
        forced.push('/programs.html');
      }
      if (/\bblog\b|article/.test(q)) {
        forced.push('/blog/blog.html');
      }

      return [...new Set(forced)]; // deduplicate
    }

    const forcedUrls = detectForcedPageButtons(message);

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

    function urlToButton(url, productsList) {
      if (PAGE_MAP[url]) {
        return { url, label: PAGE_MAP[url].label, icon: PAGE_MAP[url].icon };
      }
      const productMatch = url.match(/^\/products\/product(\d+)\.html$/);
      if (productMatch) {
        const num  = productMatch[1];
        const prod = productsList[parseInt(num, 10) - 1];
        return { url, label: prod ? prod.title : `Product ${num}`, icon: '🛍️' };
      }
      return { url, label: 'Visit Page', icon: '🔗' };
    }

    /* Buttons detected by the AI via markers */
    const aiPageButtons = pageMatches.map(m => urlToButton(m[1].trim(), products));

    /* Buttons forced server-side — safety net — always correct regardless of AI output */
    const forcedPageButtons = forcedUrls
      .filter(url => !aiPageButtons.some(b => b.url === url))
      .map(url => urlToButton(url, products));

    /* Merge: forced buttons first, then any extra AI buttons */
    const pageButtons = [...forcedPageButtons, ...aiPageButtons];

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