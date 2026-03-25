// ═══════════════════════════════════════════════════════════════
//  CURVAFIT — Netlify Function: chat.js
//  Lit toutes les données depuis data.json (produits, programmes,
//  promos, settings) et les transmet dynamiquement à l'API Groq.
// ═══════════════════════════════════════════════════════════════

const fetch = require('node-fetch');
const path  = require('path');
const fs    = require('fs');

// ── Chargement dynamique de data.json ──────────────────────────
// Le fichier est lu à chaque appel pour garantir les dernières
// données après chaque redéploiement.
function loadData() {
  const dataPath = path.join(__dirname, '..', 'data.json');
  const raw = fs.readFileSync(dataPath, 'utf-8');
  return JSON.parse(raw);
}

// ── Extraction des entités depuis data.json ────────────────────
function parseData(allData) {
  const settings = allData.find(item => item.type === 'settings') || {};
  const products  = allData.filter(item => item.type !== 'settings' && item.active !== false);
  return { settings, products };
}

// ── Construction de l'URL produit ─────────────────────────────
function buildProductUrl(productId) {
  return `/products/${productId}.html`;
}

// ── Recherche de produits pertinents ──────────────────────────
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

    // Correspondances thématiques multilingues
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

    // Prix budget / premium
    if (['cheap','budget','pas cher','moins cher','economique'].some(k => q.includes(k)) && p.price < 20) score += 5;
    if (['premium','best','top','meilleur','qualite'].some(k => q.includes(k)) && p.price > 30)           score += 3;

    // Taille plus-size
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

// ── Formatage d'un produit pour le contexte AI ────────────────
function formatProductForContext(p, index) {
  const url    = buildProductUrl(p.id);
  const colors = (p.colors || []).map(c => {
    const imgPart = c.image ? ` [image: ${c.image}]` : '';
    return `${c.name}${imgPart}`;
  }).join(' | ');

  const sizes   = (p.sizes || []).length > 0 ? p.sizes.join(', ') : 'Taille unique';
  const savings = p.compare_price ? (p.compare_price - p.price).toFixed(2) : null;
  const savePct = p.compare_price ? Math.round((1 - p.price / p.compare_price) * 100) : null;

  let promoInfo = '';
  if (p.single_discount > 0 || p.duo_discount > 0 || p.trio_discount > 0) {
    promoInfo = `\n   - Promotions: 1 article -${p.single_discount}% | 2 articles -${p.duo_discount}% | 3 articles -${p.trio_discount}%`;
  }

  let ratingInfo = '';
  if (p.rating) {
    ratingInfo = `\n   - Note: ${p.rating}/5 (${p.reviews_count || 0} avis)`;
  }

  return `
${index + 1}. **${p.title}**
   - ID interne: ${p.id} (NE PAS mentionner à l'utilisateur)
   - URL page produit: ${url}
   - Prix actuel: $${p.price}
   - Prix barré: $${p.compare_price}${savings ? ` (économie: $${savings} — ${savePct}% de réduction)` : ''}
   - Description: ${p.description}
   - Couleurs disponibles (avec image): ${colors}
   - Tailles disponibles: ${sizes}
   - Délai de livraison: 7 à 15 jours ouvrables${promoInfo}${ratingInfo}`;
}

// ── Formatage des programmes depuis settings ───────────────────
function formatPrograms(settings) {
  if (!settings.programs) return '';
  const { beginner, intermediate, maintenance } = settings.programs;
  return `
PROGRAMMES CURVAFIT:
- Soft Start (Débutant): $${beginner?.price || 'N/A'} — "${beginner?.label || ''}"
- Deeper Refiner (Intermédiaire): $${intermediate?.price || 'N/A'} — "${intermediate?.label || ''}"
- Forever Fit (Maintenance): $${maintenance?.price || 'N/A'} — "${maintenance?.label || ''}"
→ Après achat: email + mot de passe envoyé, accès à la plateforme partenaire.`;
}

// ── Formatage des codes promo depuis settings ──────────────────
function formatPromos(settings) {
  if (!settings.promos || settings.promos.length === 0) return '';
  const promoLines = settings.promos.map(p =>
    `Code "${p.code}": -${p.percent}% dès ${p.items} articles`
  ).join('\n   ');
  return `\nCODES PROMO ACTIFS:\n   ${promoLines}`;
}

// ── Formatage du cart drawer / shipping ───────────────────────
function formatShipping(settings) {
  const freeThreshold = settings.cart_drawer?.free_shipping_threshold;
  const shippingCost  = settings.shipping_cost;
  let info = `\nLIVRAISON:\n   - Délai: 7 à 15 jours ouvrables pour tous les pays`;
  if (shippingCost)  info += `\n   - Frais de port: $${shippingCost}`;
  if (freeThreshold) info += `\n   - Livraison GRATUITE dès $${freeThreshold} d'achat`;
  return info;
}

// ── Liens sociaux / contact ────────────────────────────────────
function formatContactLinks(settings) {
  const s = settings.social_links || {};
  return `
CONTACT & RÉSEAUX:
   - WhatsApp: ${s.whatsapp || '[non configuré]'}
   - Instagram: ${s.instagram || '[non configuré]'}
   - TikTok: ${s.tiktok || '[non configuré]'}
   - Facebook: ${s.facebook || '[non configuré]'}
   - YouTube: ${s.youtube || '[non configuré]'}`;
}

// ── System prompt complet ──────────────────────────────────────
function buildSystemPrompt(settings, productContext) {
  return `Tu es **Curva Support**, l'assistante officielle de CurvaFit — une marque fitness premium dédiée aux femmes plus-size.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TON IDENTITÉ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tu t'appelles **Curva Support** (jamais "Cora", jamais "AI").
Tu es :
- Un coach motivant et bienveillant
- Un conseiller stratégique fitness
- Un guide doux, jamais condescendant
- Un vendeur intelligent (pertinent, jamais agressif)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 MISSION CURVAFIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CurvaFit aide les femmes plus-size à :
- Perdre du poids sainement et progressivement (pas extrême)
- Rester actives à domicile, sans salle de sport
- Adopter un mode de vie durable et motivant
- Retrouver confiance en elles

Approche : science + expérience réelle + bienveillance.
Résultats visibles : en moyenne 4 à 6 semaines avec constance.
Probabilité de succès : ~70% si les conseils sont bien suivis.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏋️ PROGRAMMES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatPrograms(settings)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 PRODUITS — CATALOGUE COMPLET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${productContext}
${formatShipping(settings)}
${formatPromos(settings)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 SUPPORT HUMAIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Si l'utilisateur insiste, n'est pas satisfait, ou demande un humain :
"Je comprends 👍 Tu peux contacter notre équipe directement :
${formatContactLinks(settings)}
Nous serons ravis de t'aider personnellement 😊"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 À PROPOS DU FONDATEUR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Paul Francenel, 25 ans, entrepreneur.
Pas médecin — travaille avec des professionnels certifiés.
Objectif : transformer la vie des femmes plus-size sainement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 RÈGLES ABSOLUES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. TOUJOURS répondre dans la même langue que l'utilisateur (FR ou EN).
2. Ne JAMAIS mentionner les IDs internes (resistance-bands, yoga-mat, etc.).
3. Ne JAMAIS inventer des prix, couleurs ou données non présentes dans le catalogue.
4. Ne JAMAIS promettre des résultats garantis.
5. Ne JAMAIS donner de conseils médicaux avancés — rediriger vers un médecin.
6. Quand tu mentionnes un produit, TOUJOURS inclure : titre, prix, couleurs disponibles.
7. Quand une couleur est mentionnée, préciser son image si disponible.
8. Les liens produits suivent ce format : /products/[id-produit].html
   Ex: /products/resistance-bands.html — NE JAMAIS générer d'autres formats d'URL.
9. Ne jamais forcer la vente — proposer intelligemment.
10. Réponses concises (3-5 phrases max par point), naturelles, avec émojis.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🥗 NUTRITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Conseils simples et pratiques : déficit calorique modéré (300-500 cal), 
protéines à chaque repas, 2L d'eau/jour, 3 repas structurés, 
pas de pilules ni suppléments — approche naturelle uniquement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 COMPORTEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Ton chaud, humain, motivant — jamais robotique
- Adapter le niveau de détail à la question
- Terminer par une invitation douce à l'action si pertinent
- Si hors sujet fitness/produits : rediriger poliment`;
}

// ── Handler principal ──────────────────────────────────────────
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
    // ── Chargement des données ──
    const allData = loadData();
    const { settings, products } = parseData(allData);

    // ── Parsing de la requête ──
    const { message, history = [] } = JSON.parse(event.body);

    if (!message || message.trim().length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message requis' }) };
    }

    // ── Recherche produits pertinents ──
    const relevantProducts = searchProducts(message, products);

    // ── Contexte produits pour le prompt ──
    let productContext = '';
    if (relevantProducts.length > 0) {
      productContext = '📦 PRODUITS PERTINENTS POUR CETTE REQUÊTE:\n';
      productContext += relevantProducts.map((p, i) => formatProductForContext(p, i)).join('\n');
    } else {
      // Donner le catalogue complet condensé si aucun produit spécifique
      productContext = '📦 CATALOGUE COMPLET (condensé):\n';
      productContext += products.map((p, i) => {
        const url = buildProductUrl(p.id);
        return `${i + 1}. ${p.title} — $${p.price} — ${url}`;
      }).join('\n');
    }

    // ── Construction du prompt système ──
    const systemPrompt = buildSystemPrompt(settings, productContext);

    // ── Messages pour Groq ──
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    // ── Appel API Groq ──
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
    const reply = data.choices[0]?.message?.content || "Je suis désolée, je n'ai pas pu générer une réponse. Réessaie !";

    // ── Préparation des cartes produits pour le frontend ──
    const productCards = relevantProducts.slice(0, 2).map(p => {
      // Trouver la première couleur avec image
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
        delivery:      '7 à 15 jours ouvrables',
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
      body: JSON.stringify({ error: 'Erreur interne', message: error.message })
    };
  }
};