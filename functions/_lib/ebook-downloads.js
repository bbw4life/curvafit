// Private R2 object keys for Curvafit ebooks.
// This module is used server-side and is never loaded by public pages.
const crypto = require('crypto');
const DOWNLOAD_TOKEN_TTL_MS = 5 * 60 * 1000;

const EBOOK_DOWNLOADS = Object.freeze({
  'Pdg-Francenel-product1': Object.freeze({
    en: 'gentle-walking/en.pdf',
    fr: 'gentle-walking/fr.pdf',
    es: 'gentle-walking/es.pdf'
  }),
  'Pdg-Francenel-product2': Object.freeze({
    en: 'simple-meal-planner/en.pdf',
    fr: 'simple-meal-planner/fr.pdf',
    es: 'simple-meal-planner/es.pdf'
  }),
  'Pdg-Francenel-product3': Object.freeze({
    en: 'move-at-home/en.pdf',
    fr: 'move-at-home/fr.pdf',
    es: 'move-at-home/es.pdf'
  }),
  'Pdg-Francenel-product15': Object.freeze({
    en: 'back-on-track/en.pdf',
    fr: 'back-on-track/fr.pdf',
    es: 'back-on-track/es.pdf'
  })
});

const EBOOK_TITLES = Object.freeze({
  'Pdg-Francenel-product1': 'Gentle Walking',
  'Pdg-Francenel-product2': 'Simple Meal Planner',
  'Pdg-Francenel-product3': 'Move at Home',
  'Pdg-Francenel-product15': 'Back on Track'
});

const LANGUAGE_ALIASES = Object.freeze({
  en: 'en', english: 'en', anglais: 'en',
  fr: 'fr', french: 'fr', francais: 'fr', français: 'fr',
  es: 'es', spanish: 'es', espanol: 'es', español: 'es'
});

const EBOOK_VARIANTS = Object.freeze({
  '348860196': Object.freeze({ productId: 'Pdg-Francenel-product1', language: 'en' }),
  '730214313': Object.freeze({ productId: 'Pdg-Francenel-product1', language: 'fr' }),
  '954315224': Object.freeze({ productId: 'Pdg-Francenel-product1', language: 'es' }),
  '346688130': Object.freeze({ productId: 'Pdg-Francenel-product2', language: 'en' }),
  '563515566': Object.freeze({ productId: 'Pdg-Francenel-product2', language: 'fr' }),
  '134170355': Object.freeze({ productId: 'Pdg-Francenel-product2', language: 'es' }),
  '725838780': Object.freeze({ productId: 'Pdg-Francenel-product3', language: 'en' }),
  '227122504': Object.freeze({ productId: 'Pdg-Francenel-product3', language: 'fr' }),
  '163875360': Object.freeze({ productId: 'Pdg-Francenel-product3', language: 'es' }),
  '149626760': Object.freeze({ productId: 'Pdg-Francenel-product15', language: 'en' }),
  '584375070': Object.freeze({ productId: 'Pdg-Francenel-product15', language: 'fr' }),
  '748374596': Object.freeze({ productId: 'Pdg-Francenel-product15', language: 'es' })
});

function normalizeLanguage(language) {
  const value = String(language || 'en').trim().toLowerCase();
  return LANGUAGE_ALIASES[value] || null;
}

function getEbookDownload(productId, language = 'en') {
  const productFiles = EBOOK_DOWNLOADS[String(productId || '').trim()];
  const lang = normalizeLanguage(language);

  if (!productFiles || !lang || !productFiles[lang]) return null;

  return {
    productId: String(productId).trim(),
    language: lang,
    key: productFiles[lang]
  };
}

function getEbookSelection(item = {}) {
  const variantId = String(item.variantsid || item.variant_id || item.cj_variant_id || item.vid || '').trim();
  const variant = EBOOK_VARIANTS[variantId];
  const productId = String(item.productId || item.product_id || item.id || variant?.productId || '').trim();
  const language = normalizeLanguage(item.language || item.lang || item.color || variant?.language || 'en');

  if (!productId || !EBOOK_DOWNLOADS[productId] || !language) return null;

  return {
    productId,
    language,
    variantId,
    key: EBOOK_DOWNLOADS[productId][language]
  };
}

// Chaque combinaison produit/langue donne un seul téléchargement : la
// quantité commandée ne crée pas de boutons supplémentaires.
function getEbookDownloadsForOrder(items = []) {
  const downloads = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const download = getEbookSelection(item);
    if (!download || !download.key) continue;

    const key = `${download.productId}:${download.language}`;
    if (!downloads.has(key)) downloads.set(key, download);
  }

  return Array.from(downloads.values());
}

function getDownloadTokenSecret(env = {}) {
  return env.CHECKOUT_SECRET || env.ACCOUNT_TOKEN_SECRET || env.STRIPE_SECRET_KEY || '';
}

function createEbookAccessToken(paymentId, ebooks, env = {}, now = Date.now(), expiresAt = now + DOWNLOAD_TOKEN_TTL_MS) {
  const secret = getDownloadTokenSecret(env);
  if (!secret || !paymentId || !Array.isArray(ebooks) || ebooks.length === 0) return null;

  const payload = Buffer.from(JSON.stringify({
    paymentId: String(paymentId),
    expiresAt,
    ebooks: ebooks.map(item => ({
      productId: item.productId,
      language: item.language,
      variantId: String(item.variantId || ''),
      title: item.title || ''
    }))
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

  return { token: `${payload}.${signature}`, expiresAt };
}

function verifyEbookAccessToken(token, env = {}, now = Date.now()) {
  const secret = getDownloadTokenSecret(env);
  if (!secret || typeof token !== 'string') return null;

  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra) return null;

  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const expected = Buffer.from(expectedSignature);
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.paymentId || !Array.isArray(data.ebooks) || !Number.isFinite(data.expiresAt) || now >= data.expiresAt) return null;
    return data;
  } catch (_) {
    return null;
  }
}

module.exports = {
  EBOOK_DOWNLOADS,
  EBOOK_TITLES,
  EBOOK_VARIANTS,
  DOWNLOAD_TOKEN_TTL_MS,
  getEbookDownload,
  getEbookSelection,
  getEbookDownloadsForOrder,
  createEbookAccessToken,
  verifyEbookAccessToken,
  normalizeLanguage
};
