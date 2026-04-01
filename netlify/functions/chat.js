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
      // ── MODIFICATION 2: récupère le badge depuis le champ badge de chaque produit ──
      badge:        item.badge ? item.badge.text || '' : '',
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
    /fondateur|founder|qui.+(fond|cre[aé]t)|paul|francenel|administrateur|admin/,
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
    /^(bonjour|bonsoir|salut|hello|hi|hey|hola|buenas|buenos|allo|yow|yo|wesh|cc)\b/,
    /^(merci|thank|thanks|gracias|ok|okay|d.accord|super|parfait|génial|great|bien|bueno)\b/,
    /fundador|fundadora|quién.+(fund|cre)|equipo|misión/,
    /qué es curva|sobre curva/,
    /consejo|consejos|nutrición|alimentación|comida/,
    /programa|entrenamiento|coaching/,
    /contacto|soporte|ayuda.+equipo/,
    /envío|envio|tiempo.+entrega|costo.+envío/,
    /código.+descuento|descuento.+código|promo/,
    /\bblog\b|\barticle\b|\bpost\b|\bread\b|\blire\b|\barticles?\b/,
    /derniers?.+article|latest.+article|nouveaux?.+article/,
    /\bcompte\b|\baccount\b|\bcuenta\b/,
    /mon profil|my profile|mi perfil/,
    /mes commandes|my orders|mis pedidos/,
    /historique.+(commande|order|pedido)/,
    /adresse.+(livraison|enregistr)|delivery address|dirección/,
    /mode.+paiement|payment method|método.+pago/,
    /changer.+(mot de passe|password|contraseña)/,
    /badge|niveau|level|membership|niveau.+membre/,
    /points|récompense|reward/,
    /wishlist|liste.+(souhaits|envie)|saved items/,
    /suivre.+(commande|colis)|track.+(order|package)|rastrear/,
    /checkout|passer.+(commande|à la caisse)|proceder.+pago/,
    /panier|cart|carrito/,
    /payer|pay now|pagar/,
    /frais.+(port|livraison)|shipping cost|costo.+envío/,
    /livraison standard|standard shipping|envío estándar/,
    /livraison express|express shipping|express dhl/,
    /livraison prioritaire|priority fedex|prioritaire/,
    /livraison économique|economy shipping|económico/,
    /délai.+livraison|delivery time|tiempo.+entrega/,
    /total.+(commande|order)|order total|total.+pedido/,
    /taxes|impôts|impuestos/,
    /stripe|paypal|apple pay|google pay|carte.+crédit|credit card|tarjeta/,
    /privacy|confidentialit|privacidad|données.+person|personal.+data|datos.+person/,
    /remboursement|refund|reembolso|retour|return|devolution/,
    /conditions.+(utilisation|service|vente)|terms.+(service|conditions|use)|términos/,
    /disclaimer|avertissement|advertencia|médical.+disclaimer|medical.+disclaimer/,
    /politique|policy|politica/,
    /vos droits|your rights|sus derechos|gdpr|rgpd/,
    /données.+(collecte|utilise)|data.+(collect|use)|datos.+(recopil)/,
    /cookies|tracking|pistage/,
    /sécurité.+données|data.+security|seguridad.+datos/,
    /annulation.+abonnement|cancel.+subscription|cancelar.+suscripci/,
    /preuve.+utilisation|proof.+use|prueba.+uso/,
    /non.+remboursable|non.+refundable|no.+reembolsable/,
    // ── MODIFICATION 3: détecter les demandes "top produits pour commencer" ──
    /meilleur.+(produit|article).+(commencer|début|démarrer|start)/,
    /best.+(product|item).+(start|begin|beginner)/,
    /mejor.+(producto).+(empezar|comenzar|inicio)/,
    /produit.+(pour commencer|pour débuter|pour démarrer)/,
    /pour.+(commencer|débuter|démarrer).+(perdre|mincir|maigrir|weight)/,
    /par où commencer|where to start|por dónde empezar/,
    /que me recommandes.+commencer|what.*recommend.*start/,
    /starter.+product|top.+starter|meilleur.+départ|top.+produit/,
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
   MODIFICATION 3: détecter si c'est une demande "top starter products"
══════════════════════════════════════════════════════ */
function isTopStarterRequest(message) {
  const q = message.toLowerCase();
  const patterns = [
    /meilleur.+(produit|article).+(commencer|début|démarrer|start)/,
    /best.+(product|item).+(start|begin|beginner)/,
    /mejor.+(producto).+(empezar|comenzar|inicio)/,
    /produit.+(pour commencer|pour débuter|pour démarrer)/,
    /pour.+(commencer|débuter|démarrer).+(perdre|mincir|maigrir|weight)/,
    /par où commencer|where to start|por dónde empezar/,
    /que me recommandes.+commencer|what.*recommend.*start/,
    /starter.+product|top.+starter|meilleur.+départ/,
    /pour bien commencer|to get started|para empezar bien/,
    /quels produits.+(commencer|début)|which products.+start/,
    /produits.+(recommand).+(commencer|start|debut)/,
    /je commence|i('m| am) starting|estoy empezando/,
    /nouveau.+(ici|client)|new here|nueva.+(aquí|cliente)/,
  ];
  return patterns.some(p => p.test(q));
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
      { words: ['hula','hoop','belly','ventre','barriga','vientre'],          id: 'resistance-bands', boost: 12 },
      { words: ['waist trainer','gainant','waist cinch','corset','faja'],     id: 'yoga-mat',         boost: 12 },
      { words: ['jump rope','corde','skip','sauter','cuerda','saltar'],       id: 'leggings',         boost: 12 },
      { words: ['legging','yoga pant','high waist','peach','malla'],          id: 'sports-bra',       boost: 12 },
      { words: ['jumpsuit','combinaison','pilates','mono'],                   id: 'hydration-bottle', boost: 12 },
      { words: ['tie dye','seamless legging'],                                id: 'workout-towel',    boost: 12 },
      { words: ['sport bra','bra','brassiere','soutien','sujetador','top'],   id: 'fitness-tracker',  boost: 12 },
      { words: ['knee','genoux','genouillère','pad','rodilla','rodillera'],   id: 'protein-shaker',   boost: 12 },
      { words: ['posture','dos','back','corrector','correcteur','postura'],   id: 'dumbbell-set',     boost: 12 },
      { words: ['bracelet','tracker','heart rate','sleep','pouls','pulsera'],id: 'jump-rope',         boost: 12 },
      { words: ['acupressure','stress mat','recovery','tapis','esterilla'],   id: 'foam-roller',      boost: 12 },
      { words: ['belly belt','ceinture ventre','cramp','chaleur','cinturón'],id: 'yoga-blocks',       boost: 12 },
      { words: ['bottle','water','gourde','bouteille','botella','agua'],      id: 'ankle-weights',    boost: 12 },
      { words: ['shoe','chaussure','running','sneaker','zapatilla'],          id: 'cooling-towel',    boost: 12 },
      { words: ['pillow','oreiller','neck','cervical','nuque','almohada'],    id: 'massage-ball',     boost: 12 },
      { words: ['earbuds','headphone','music','écouteur','auricular'],        id: 'gym-bag',          boost: 12 },
    ];
    themes.forEach(t => {
      if (p.id === t.id && t.words.some(w => q.includes(w))) score += t.boost;
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
  if (pages.length)    { text += '\nSITE PAGES:\n';    pages.forEach(p    => { text += `  • ${p.title} → ${p.url}\n`; }); }
  if (programs.length) { text += '\nPROGRAMS:\n';      programs.forEach(p => { text += `  • ${p.title} → ${p.url}\n`; }); }
  if (coaches.length)  { text += '\nCOACHES:\n';       coaches.forEach(p  => { text += `  • ${p.title} → ${p.url}\n`; }); }
  if (features.length) { text += '\nFEATURES:\n';      features.forEach(p => { text += `  • ${p.title} → ${p.url}\n`; }); }
  if (products.length) { text += '\nPRODUCT PAGES:\n'; products.forEach(p => { text += `  • ${p.title} → ${p.url}\n`; }); }
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
   PAGE NAVIGATION MAP
══════════════════════════════════════════════════════ */
const PAGE_MAP = {
  '/index.html':               { label: 'Home',               icon: '🏠' },
  '/shop.html':                { label: 'Shop',               icon: '🛍️' },
  '/programs.html':            { label: 'Programs',           icon: '💪' },
  '/nutrition.html':           { label: 'Nutrition',          icon: '🥗' },
  '/blog/blog.html':           { label: 'Blog',               icon: '📝' },
  '/about.html':               { label: 'About Us',           icon: 'ℹ️' },
  '/contact.html':             { label: 'Contact',            icon: '📩' },
  '/account.html':             { label: 'My Account',         icon: '👤' },
  '/checkout.html':            { label: 'Checkout',           icon: '🛒' },
  '/success.html':             { label: 'Success Stories',    icon: '🏆' },
  '/community.html':           { label: 'Community',          icon: '👥' },
  '/method.html':              { label: 'Our Method',         icon: '🔬' },
  '/faq.html':                 { label: 'FAQ',                icon: '❓' },
  '/careers.html':             { label: 'Careers',            icon: '💼' },
  '/policies/privacy.html':    { label: 'Privacy Policy',     icon: '🔒' },
  '/policies/refund.html':     { label: 'Refund Policy',      icon: '↩️' },
  '/policies/terms.html':      { label: 'Terms & Conditions', icon: '📄' },
  '/disclaimer.html':          { label: 'Medical Disclaimer', icon: '⚕️' },
};

/* ══════════════════════════════════════════════════════
   BUILD SYSTEM PROMPT
══════════════════════════════════════════════════════ */
function buildSystemPrompt(products, settings, contactInfo, searchData, blogData) {
  const contactEmails  = settings.contact_emails || {};
  const emailsText     = Object.entries(contactEmails).map(([k, v]) => `• ${k}: ${v}`).join('\n') || '• No emails configured';
  const programs       = settings.programs    || {};
  const promos         = settings.promos      || [];
  const shipping       = settings.cart_drawer || {};
  const taxRate        = settings.tax_rate      || 0.1;
  const shippingCost   = settings.shipping_cost || 10.0;
  const taxPercent     = Math.round(taxRate * 100);
  const freeShipThresh = shipping.free_shipping_threshold || 120;

  // ── MODIFICATION 1: lire plans_available depuis settings ──
  const plansAvailable = (settings.plans_available || 'Yes').trim().toLowerCase() === 'yes';

  const programsText = Object.entries(programs).map(([, val]) => `• ${val.label}: $${val.price}`).join('\n');
  const promosText   = promos.length
    ? promos.map(p => `• Code **[[${p.code}]]** → **${p.percent}% off** on ${p.items}+ items (Shop only — NOT valid on programs)`).join('\n')
    : '• No active promo codes at this time';

  // ── MODIFICATION 2: inclure le badge dans le catalogue ──
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
    const badgeText = p.badge ? `Badge: ${p.badge}` : '';
    return `
PRODUCT ${i + 1}:
  Title: ${p.title}
  Description: ${p.description}
  Price: $${p.price}${p.maxPrice !== p.price ? ` to $${p.maxPrice}` : ''} (was $${p.compare_price})
  Rating: ${rating}
  ${badgeText}
  Colors: ${colorsList || 'N/A'}
  Sizes: ${sizesList}
  Discounts: ${discounts}
  Delivery: ${delivery}
  Page: ${p.url}`;
  }).join('\n');

  // ── MODIFICATION 3: construire la liste des top starter products ──
  const topStarter      = settings.top_starter_products || {};
  const topStarterIds   = topStarter.product_ids || [];
  const topStarterLabel = topStarter.label || 'Best products to start your weight loss journey';
  const topStarterList  = topStarterIds.map(id => {
    const prod = products.find(p => p.id === id);
    return prod ? `  • ${prod.title} (${prod.url})` : null;
  }).filter(Boolean).join('\n');

  const contactChannels = [];
  if (contactInfo.hasWhatsapp) contactChannels.push('WhatsApp');
  if (contactInfo.hasTelegram) contactChannels.push('Telegram');
  contactChannels.push('Contact page');

  const searchContext = buildSearchDataContext(searchData);
  const blogContext   = buildBlogContext(blogData);

  // ── MODIFICATION 1: section programs avec plans_available ──
  const programsSection = plansAvailable
    ? `
═══════════════════════════════════════
💪 PROGRAMS
═══════════════════════════════════════
${programsText}
`
    : `
═══════════════════════════════════════
💪 PROGRAMS — COMING SOON
═══════════════════════════════════════
plans_available is currently set to NO.
When a user asks about programs, plans, prices of programs, or how to sign up:
DO NOT give any program prices or details.
Instead, reply warmly in the user's language with this message (adapt naturally):
- FR: "Nos plans sont en cours de finalisation ! Nous discutons actuellement avec nos partenaires pour vous offrir le meilleur service possible. Les prix de chaque plan seront disponibles très bientôt 🙏 En attendant, tu peux visiter notre page Programme et remplir le formulaire — tu seras parmi les premiers à être informé dès que c'est prêt !"
- EN: "Our plans are almost ready! We're currently working with our partners to bring you the best experience. Pricing for each plan will be available very soon 🙏 In the meantime, head to our Programs page and fill in the form — you'll be among the first to know when it launches!"
- ES: "¡Nuestros planes están casi listos! Estamos trabajando con nuestros socios para ofrecerte el mejor servicio. Los precios estarán disponibles muy pronto 🙏 Mientras tanto, visita nuestra página de Programas y completa el formulario — ¡serás de los primeros en enterarte!"
Always add 🔗[PAGE:/programs.html] at the end when programs are asked.
NEVER mention any program price when plans_available is No.
`;

  return `You are **Curva**, the official AI assistant and coach of CurvaFit.

═══════════════════════════════════════
🎯 YOUR IDENTITY & PERSONALITY
═══════════════════════════════════════
You are warm, human, motivating, and natural — never robotic or stiff.
Adapt your tone: casual when they are casual, caring when they share struggles.
You feel like a real friend who knows everything about CurvaFit.
Use emojis naturally — not on every sentence, only when it feels right.
KEEP RESPONSES SHORT — max 4-5 lines. No walls of text.

GREETINGS — when someone says hi, yow, hello, salut, hola, wesh, cc:
Reply warmly and naturally. Ask how you can help. No buttons, no lists. Just a human hello.
NEVER show contact or page buttons for simple greetings or small talk.

═══════════════════════════════════════
🌍 LANGUAGE RULE — ABSOLUTE — NO EXCEPTION
═══════════════════════════════════════
Detect the language from the user's message.
FRENCH → reply 100% in FRENCH.
SPANISH → reply 100% in SPANISH.
ENGLISH → reply 100% in ENGLISH.
Short/ambiguous (yow, ok, hi, cc) → default ENGLISH.
NEVER mix languages.

═══════════════════════════════════════
✏️ FORMATTING RULES
═══════════════════════════════════════
Bold: **Paul Francenel**, **CurvaFit**, product names, key prices.

🎟️ PROMO CODES — always: **[[CODE]]**
Example: Use **[[CURVA15]]** for **20% off** on 4+ items.
NEVER show a code without [[...]].

🔗 PAGE BUTTONS — place at END of reply: 🔗[PAGE:/url]
Frontend converts to a clickable button. NEVER write raw URLs. Say "button below".

Page URLs:
  Home → 🔗[PAGE:/index.html]
  Shop → 🔗[PAGE:/shop.html]
  Programs → 🔗[PAGE:/programs.html]
  Nutrition → 🔗[PAGE:/nutrition.html]
  Blog → 🔗[PAGE:/blog/blog.html]
  About → 🔗[PAGE:/about.html]
  Contact → 🔗[PAGE:/contact.html]
  My Account → 🔗[PAGE:/account.html]
  Checkout → 🔗[PAGE:/checkout.html]
  Success Stories → 🔗[PAGE:/success.html]
  Community → 🔗[PAGE:/community.html]
  Our Method → 🔗[PAGE:/method.html]
  FAQ → 🔗[PAGE:/faq.html]
  Careers → 🔗[PAGE:/careers.html]
  Privacy Policy → 🔗[PAGE:/policies/privacy.html]
  Refund Policy → 🔗[PAGE:/policies/refund.html]
  Terms & Conditions → 🔗[PAGE:/policies/terms.html]
  Medical Disclaimer → 🔗[PAGE:/disclaimer.html]
  Product N → 🔗[PAGE:/products/productN.html]

WHEN TO ADD 🔗[PAGE:...]:
✅ User asks to go to / visit a page → add that page button
✅ privacy / data / GDPR / cookies → add 🔗[PAGE:/policies/privacy.html]
✅ refund / return / remboursement / reembolso / cancel → add 🔗[PAGE:/policies/refund.html]
✅ terms / conditions / CGV / términos → add 🔗[PAGE:/policies/terms.html]
✅ disclaimer / medical / avertissement → add 🔗[PAGE:/disclaimer.html]
✅ account / orders / profile / password / badge → add 🔗[PAGE:/account.html]
✅ checkout / payment / shipping options → add 🔗[PAGE:/checkout.html]
❌ NEVER for greetings, small talk, founder questions, general fitness advice

👇 CONTACT BUTTONS — shown when reply ends with 👇 on its own line.
Backend uses this to show WhatsApp / Telegram / Contact page buttons.

WHEN TO ADD 👇 — EVERY TIME one of these is detected, add 👇 NO EXCEPTION:
✅ comment vous contacter / joindre / écrire / rejoindre
✅ je veux parler à quelqu'un / un humain / un agent / un conseiller
✅ service client / support / aide équipe
✅ votre whatsapp / telegram / email
✅ how to contact / reach / message you
✅ I want to speak to someone / a human / an agent
✅ customer service / support
✅ your whatsapp / telegram / email
✅ cómo contactarlos / hablar con alguien / servicio al cliente
✅ su whatsapp / telegram / email

IMPORTANT: Even if the user asked about contact before → ALWAYS add 👇 again.
The frontend needs it EVERY TIME to show the buttons. Never skip it.

❌ NEVER add 👇 for: greetings, founder info, products, nutrition, programs, policies, shipping, results.

═══════════════════════════════════════
🚦 PRODUCT DISPLAY RULES
═══════════════════════════════════════
Show products ONLY when user explicitly asks to buy or names a specific product type.
NEVER suggest products for: greetings, contact, policies, nutrition, programs, general info.
Specific → show 1 product only.
Vague (belly, weight loss, something good) → show up to 4, ask which one they mean.

═══════════════════════════════════════
🤝 CONTACT CHANNELS
═══════════════════════════════════════
Available: ${contactChannels.join(' · ')}

EMAILS — use ONLY these, NEVER invent:
${emailsText}

When contact is requested → reply warmly, mention buttons (👇), give right email if needed.
- General → general email | Billing/refund → billing email | Tech → tech email
- Coach → coaches email | Press → press email

Vary your contact reply wording naturally each time:
FR: "Bien sûr ! Écris-nous par email ou utilise les boutons ci-dessous 😊 On répond en 24h !"
EN: "Of course! Use the buttons below or email us — we reply within 24h 😊"
ES: "¡Claro! Usa los botones de abajo o escríbenos. ¡Respondemos en 24h! 😊"

Always end with 👇 on its own line for contact requests.

═══════════════════════════════════════
🏢 ABOUT CURVAFIT & THE FOUNDER
═══════════════════════════════════════
**CurvaFit** was born from a bold idea: what if weight loss was actually designed for real women?

**Paul Francenel** founded **CurvaFit** on November 5, 2025. At just 25, this young entrepreneur didn't build from a spreadsheet — he built from observation, empathy, and fire. Not a doctor, not a certified trainer — something rarer: someone who truly listened to the women the fitness industry had failed for years.

He saw them. Plus-size women who wanted to change, who had tried everything, and kept hitting walls — programs not designed for their bodies, advice that felt like shame in disguise. **Paul** refused to accept that. He brought together qualified coaches, wellness experts, and technology to create something different: a science-backed, judgment-free platform where transformation is not a dream, but a real plan.

Today, **CurvaFit** stands as proof that you don't need all the titles to create real impact. Just the right vision — and the courage to build it.

When asked about "administrateur" or "admin" → same answer as founder. It refers to **Paul Francenel**.
Give a warm, inspiring 3–4 line answer. Not too long. Make it feel real.

${programsSection}

═══════════════════════════════════════
🎟️ PROMO CODES
═══════════════════════════════════════
${promosText}
Free shipping over $${freeShipThresh}

═══════════════════════════════════════
💰 TAXES & SHIPPING
═══════════════════════════════════════
Tax: ${taxPercent}% at checkout. Standard shipping: $${shippingCost} (free over $${freeShipThresh}). Returns: 30 days.

═══════════════════════════════════════
👤 ACCOUNT PAGE
═══════════════════════════════════════
Profile, orders history, order tracking, delivery addresses, payment methods (Visa/MC/PayPal/Apple Pay/Google Pay/Stripe),
password change, wishlist, membership badge (Bronze/Silver/Gold), points, newsletter.
Everything is in the account area. → 🔗[PAGE:/account.html]

═══════════════════════════════════════
🛍️ CHECKOUT PAGE
═══════════════════════════════════════
Order summary, promo code field, taxes (${taxPercent}%), shipping choice, payment via Stripe or PayPal.
Shipping: Standard (free, 7–12d) · Express DHL (3–5d) · Priority FedEx (1–3d) · Economy (10–15d).
→ 🔗[PAGE:/checkout.html]

═══════════════════════════════════════
🔒 PRIVACY POLICY
═══════════════════════════════════════
- NEVER sell personal data. NEVER share health data with advertisers. NEVER store card details.
- Data: name, email, purchase info, IP (security), optional progress.
- GDPR: access, correction, deletion, portability, objection rights. Contact: support@curvafit.com.
- Cookies: essential (required) · analytics (anonymized) · marketing (opt-in only).
When asked → 2–3 line reassuring answer + 🔗[PAGE:/policies/privacy.html]

═══════════════════════════════════════
↩️ REFUND POLICY
═══════════════════════════════════════
- Cancel subscription anytime, no penalty.
- Product returns: original condition, ~14 days. Refund processed up to 30 days.
- Result-based refund: proof of use required (photos/videos/log, up to 15 days). 30 days to process.
- Refund via original payment method. Alternative possible if asked 5+ days before processing.
- Non-refundable: used/damaged products, fully-accessed digital content without proof.
- Contact: billing@curvafit.com with order number and purchase email.
When asked → 2–3 line clear answer + 🔗[PAGE:/policies/refund.html]

═══════════════════════════════════════
📄 TERMS & CONDITIONS
═══════════════════════════════════════
- CurvaFit works with partner platforms who deliver programs by email.
- Programs: Beginner (2–4 kg/month) · Intermediate (3–5 kg/month) · Maintenance (stable weight).
- Access is personal and non-transferable.
- Payments via Stripe or PayPal. Card details never stored by CurvaFit.
- Cancel subscription anytime. Partial refund for unused time.
- Results: safe rate 0.5–1 kg/week. Up to 70% success with full consistency. No guarantee.
When asked → 2–3 line clear answer + 🔗[PAGE:/policies/terms.html]

═══════════════════════════════════════
⚕️ MEDICAL DISCLAIMER
═══════════════════════════════════════
- Educational guidance only — NOT medical treatment.
- Consult a doctor first, especially with: diabetes, PCOS, thyroid, heart conditions, joint pain, eating disorder history.
- Pregnant or breastfeeding → consult OB/GYN first. Weight loss during pregnancy is not recommended.
- Stop exercise if: chest pain, dizziness, sharp joint pain.
- CurvaFit NEVER sells pills, detox teas, or unregulated supplements.
- Testimonials are real but individual — not guaranteed for everyone.
When asked → 2–3 line caring answer + 🔗[PAGE:/disclaimer.html]

═══════════════════════════════════════
🛍️ PRODUCT CATALOG
═══════════════════════════════════════
NEVER use internal IDs. Use exact product titles and prices.
Each product has a Badge field — if a client asks about a product's status (ex: is it a best seller? is it new? is it on promotion?), use the Badge field to answer accurately.
${catalogText}

═══════════════════════════════════════
🏆 TOP STARTER PRODUCTS
═══════════════════════════════════════
Label: "${topStarterLabel}"
These are the products to show when a client asks which products to start with, what to buy to begin their weight loss journey, or what you recommend for a beginner.
Show ALL of these products — exactly these, in order:
${topStarterList || '(none configured)'}
Treat this request exactly like a product request: display all these product cards to the client.
DO NOT show other products in this case — only the ones listed above.

═══════════════════════════════════════
🥗 NUTRITION
═══════════════════════════════════════
Protein at every meal. Cut liquid sugars. 2L water/day. 300–500 calorie deficit. Sleep 7–8h.

═══════════════════════════════════════
🌐 SITE CONTENT
═══════════════════════════════════════
${searchContext || '(not available)'}

═══════════════════════════════════════
📝 BLOG
═══════════════════════════════════════
${blogContext || '(not available)'}

═══════════════════════════════════════
🚫 ABSOLUTE RULES — NEVER BREAK
═══════════════════════════════════════
- Never write raw URLs or phone numbers in text
- Never invent prices, emails, or data
- Never promise guaranteed results
- Never reply in wrong language
- Never show products for non-product requests
- Never add 👇 for greetings, policies, or general info
- Never show promo codes without [[CODE]] format
- Never apply promo codes to programs — Shop only
- Never answer policy questions without the relevant 🔗[PAGE:...] button
- Never give program prices when plans_available is No`;
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

    let searchData = null, blogData = null;
    try {
      [searchData, blogData] = await Promise.all([
        loadSearchData().catch(e   => { console.warn('search.data.json failed:', e.message);   return null; }),
        loadBlogArticles().catch(e => { console.warn('blog-articles.json failed:', e.message); return null; })
      ]);
    } catch (err) { console.warn('Could not load search/blog data:', err.message); }

    const contactSettings = settings.contact      || {};
    const socials         = settings.social_links || {};
    const contactInfo = {
      hasWhatsapp: !!(contactSettings.whatsapp_url || socials.whatsapp),
      hasTelegram: !!(contactSettings.telegram_url),
      whatsappUrl: contactSettings.whatsapp_url || socials.whatsapp || '',
      telegramUrl: contactSettings.telegram_url || '',
      contactPage: '/contact.html'
    };

    const intent = detectIntent(message);

    // ── MODIFICATION 3: détecter top starter request et récupérer ces produits ──
    const topStarterRequest = isTopStarterRequest(message);
    let relevantProducts = [], isVague = false;

    if (topStarterRequest) {
      // Afficher les top starter products depuis settings
      const topStarterIds = (settings.top_starter_products || {}).product_ids || [];
      relevantProducts = topStarterIds.map(id => products.find(p => p.id === id)).filter(Boolean);
      isVague = false;
    } else if (intent === 'product') {
      const searchResult = searchProducts(message, products);
      relevantProducts   = searchResult.results;
      isVague            = searchResult.isVague;
    }

    /* ── Contact intent — reliable regex ── */
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

    const isContactIntent = intent !== 'product' && EXPLICIT_CONTACT_PATTERNS.some(p => p.test(message));

    const systemPrompt = buildSystemPrompt(products, settings, contactInfo, searchData, blogData);

    /* Tell the AI explicitly when contact is detected — so it always adds 👇 */
    const contactInstruction = isContactIntent
      ? '\n[CONTACT REQUEST: User wants to reach the team. You MUST end your reply with 👇 on its own line — no exception.]'
      : '';

    const vagueInstruction = isVague
      ? '\n[VAGUE PRODUCT: Show up to 4 products and ask which one they mean.]'
      : '\n[SPECIFIC PRODUCT: Show ONLY the 1 most relevant product.]';

    // ── MODIFICATION 3: instruction spéciale pour top starter ──
    const topStarterInstruction = topStarterRequest
      ? '\n[TOP STARTER REQUEST: User wants to know the best products to start their journey. Show ALL the top starter products listed in the TOP STARTER PRODUCTS section. Introduce them warmly.]'
      : '';

    const langInstruction = userLang === 'fr'
      ? 'Reply 100% in FRENCH.'
      : userLang === 'es'
      ? 'Reply 100% in SPANISH.'
      : 'Reply 100% in ENGLISH.';

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: `${message}\n\n[${langInstruction}]${(intent === 'product' && !topStarterRequest) ? vagueInstruction : ''}${topStarterInstruction}${contactInstruction}` }
    ];

    /* ── Model rotation ── */
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let groqResponse = null, usedModel = null, modelSuccess = false;

    for (let attempt = 0; attempt < MODELS.length; attempt++) {
      const idx   = (currentModelIndex + attempt) % MODELS.length;
      const model = MODELS[idx];
      let modelOk = false;

      for (let retry = 1; retry <= 2; retry++) {
        try {
          groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
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
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ reply: getFallbackMessage(userLang), products: [], intent: 'general', isVague: false, showContact: false, contactInfo: null, pageButtons: [] })
      };
    }

    console.log(`[Chat] Model: ${usedModel} (index ${currentModelIndex})`);

    const data  = await groqResponse.json();
    const reply = data.choices?.[0]?.message?.content || getErrorMessage(userLang);

    /*
     * ── CONTACT BUTTONS ──
     * Use isContactIntent (reliable regex) OR presence of 👇 in reply.
     * This ensures buttons always appear even if AI model varies behavior.
     */
    const showContactButtons = intent !== 'product' && (isContactIntent || reply.includes('👇'));
    const cleanReply = reply.replace(/👇[\s]*/g, '').trim();

    /* ── PAGE BUTTONS ── */
    const pageMarkerRegex = /🔗\[PAGE:([^\]]+)\]/g;
    const pageMatches     = [...cleanReply.matchAll(pageMarkerRegex)];
    const pageButtons     = pageMatches.map(m => {
      const url = m[1].trim();
      if (PAGE_MAP[url]) return { url, label: PAGE_MAP[url].label, icon: PAGE_MAP[url].icon };
      const pm = url.match(/^\/products\/product(\d+)\.html$/);
      if (pm) {
        const prod = products[parseInt(pm[1], 10) - 1];
        return { url, label: prod ? prod.title : `Product ${pm[1]}`, icon: '🛍️' };
      }
      return { url, label: 'Visit Page', icon: '🔗' };
    });

    const finalReply = cleanReply.replace(pageMarkerRegex, '').trim();

    const productCards = relevantProducts.map(p => ({
      title: p.title, description: p.description, price: p.price, compare_price: p.compare_price,
      url: p.url, image: p.image,
      colors:   p.colors.map(c => ({ name: c.name, hex: c.hex, image: c.image })),
      variants: p.variants, sizes: p.sizes,
      delivery: formatDelivery(p.startDate, p.endDate),
      rating: p.rating, discounts: p.discounts
    }));

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        reply: finalReply, products: productCards, intent, isVague,
        showContact: showContactButtons,
        contactInfo: showContactButtons ? {
          whatsapp: contactInfo.hasWhatsapp ? contactInfo.whatsappUrl : null,
          telegram: contactInfo.hasTelegram ? contactInfo.telegramUrl : null,
          page:     contactInfo.contactPage
        } : null,
        pageButtons
      })
    };

  } catch (error) {
    console.error('Chat function error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error', message: error.message }) };
  }
};