// functions/send-email-auto.js (Cloudflare Pages Functions)
process.removeAllListeners('warning');

const { Resend } = require('resend');
const { google }  = require('googleapis');
const crypto = require('crypto');
const { notifyCustomerTelegram } = require('./_lib/telegram-broadcast');
const { getGoogleAuthClient } = require('./_lib/google-auth');

// ════════════════════════════════════════════════════════════════
//  ENVIRONMENT
//  ⚠️ NOTE MIGRATION CLOUDFLARE : BASE_URL/FROM_EMAIL étaient des constantes
//  module-level calculées une fois au chargement (process.env). Sur
//  Cloudflare Workers, `env` n'existe qu'à l'intérieur du handler — ces
//  valeurs sont donc recalculées à chaque requête via getBaseUrl(env) /
//  getFromEmail(env), et toutes les fonctions qui en avaient besoin
//  reçoivent désormais `env` en paramètre explicite.
// ════════════════════════════════════════════════════════════════
function getBaseUrl(env)   { return env.BASE_URL   || 'https://bbw4life.com'; }
function getFromEmail(env) { return env.FROM_EMAIL || 'Curvafit <bbw4life@bbw4life.com>'; }

// ════════════════════════════════════════════════════════════════
//  EMAIL TYPE CONSTANTS
// ════════════════════════════════════════════════════════════════
const T = {
  WELCOME:            'welcome',
  ORDER_CONFIRM:      'order_confirm',
  EBOOK_ORDER_CONFIRM:'ebook_order_confirm',
  ORDER_TRACKING:     'order_tracking',
  NEWSLETTER_1:       'newsletter_1',
  NEWSLETTER_2:       'newsletter_2',
  NEWSLETTER_3:       'newsletter_3',
  NEWSLETTER_4_BUYER: 'newsletter_4_buyer',
  NEWSLETTER_4_NEW:   'newsletter_4_new',
  CONTACT_REPLY:      'contact_reply',
  PLAN_REQUEST:       'plan_request',
  CUSTOM_PRODUCT:     'custom_product',
  CART_ABANDONED:     'cart_abandoned',
  CONFIRM_ACCOUNT:    'confirm_account',
  STORY_RECEIVED:     'story_received',
  REVIEW_RESPONSE:    'review_response',
  PASSWORD_RESET:     'password_reset',
};

// ════════════════════════════════════════════════════════════════
//  GROQ AI — MODELS & HELPERS
// ════════════════════════════════════════════════════════════════
// ⚠️ NOTE MIGRATION CLOUDFLARE : les anciens modèles (llama-3.3-70b-versatile,
// llama-3.1-70b-versatile, mixtral-8x7b-32768, gemma2-9b-it, llama3-70b-8192,
// llama3-8b-8192, llama-3.1-8b-instant) ont tous été décommissionnés par Groq
// (HTTP 400 "model_decommissioned" / 404 confirmés via /v1/models). Les
// modèles de remplacement "openai/gpt-oss-*" actuellement actifs sont des
// modèles de raisonnement : ils consomment max_tokens sur un raisonnement
// interne caché avant la réponse, ce qui tronque presque toujours le texte
// final (vérifié : réponse coupée à 1 mot avec max_tokens=100). Seul
// qwen/qwen3.8-27b répond directement sans ce problème (vérifié en direct).
const GROQ_MODELS = [
  'qwen/qwen3.8-27b',
];
let modelIdx = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const BBW_SYSTEM_PROMPT = `You are Curvafit's thoughtful email writer for a wellness and everyday movement brand.

BRAND CONTEXT:
Curvafit offers practical digital guides for gentle walking, flexible meal planning, at-home movement and restarting routines, alongside selected fitness essentials. The brand helps people find approachable ways to build routines at their own pace.

BRAND VOICE:
- Warm, clear, grounded and genuinely helpful
- Inclusive and encouraging without assuming someone's body, ability, goals or gender
- Calm and specific; never pushy, sentimental or robotic

WRITING RULES:
1. Follow the requested email type and write only the requested content.
2. Use only facts provided in the prompt. Never invent product features, delivery promises, discounts, health outcomes or customer details.
3. Do not promise weight loss, medical benefits or guaranteed results.
4. Keep paragraphs short, use natural contractions, and avoid filler.
5. No markdown, bullets, hashtags or subject lines unless explicitly requested.
6. Write in plain English, with a human, considerate tone.
7. Refer to the brand as Curvafit. Do not refer to any former brand identity.`

async function callGroq(userPrompt, env) {
  for (let attempt = 0; attempt < GROQ_MODELS.length; attempt++) {
    const idx   = (modelIdx + attempt) % GROQ_MODELS.length;
    const model = GROQ_MODELS[idx];
    for (let retry = 1; retry <= 2; retry++) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method:  'POST',
          headers: {
            'Authorization': `Bearer ${env.GROQ_API_KEY}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: BBW_SYSTEM_PROMPT },
              { role: 'user',   content: userPrompt },
            ],
            max_tokens:  500,
            temperature: 0.70,
            top_p:       0.92,
          }),
        });
        if (res.status === 429) {
          if (retry < 2) { await sleep(1800); continue; }
          modelIdx = (idx + 1) % GROQ_MODELS.length;
          break;
        }
        if (!res.ok) { console.warn(`[Groq] HTTP ${res.status} on ${model}`); break; }
        const data    = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim() || '';
        if (content.length < 20) break;
        modelIdx = idx;
        return content;
      } catch (e) {
        console.warn(`[Groq] Error on ${model} retry ${retry}:`, e.message);
        if (retry < 2) { await sleep(900); continue; }
        break;
      }
    }
  }
  return null;
}

// ════════════════════════════════════════════════════════════════
//  CASCADE IA — Anthropic (Claude) → Google (Gemini) → Groq
//  Même logique de secours que le chat live (functions/chat.js) : on
//  essaie le fournisseur principal, et on tombe sur le suivant à la
//  moindre erreur (crédit épuisé, HTTP en échec, réseau). Si les 3
//  échouent, callAI() retourne null — chaque gen*Copy() a déjà son
//  propre texte de secours codé en dur pour ce cas.
// ════════════════════════════════════════════════════════════════
const CLAUDE_MODEL_EMAIL = 'claude-haiku-4-5-20251001';
// gemini-3.5-flash-lite : 15 req/min en niveau gratuit (voir chat.js)
const GEMINI_MODEL_EMAIL = 'gemini-3.5-flash-lite';

async function callClaudeForEmail(userPrompt, env) {
  if (!env.ANTHROPIC_API_KEY) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL_EMAIL,
        max_tokens: 500,
        temperature: 0.70,
        system: BBW_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    if (!res.ok) {
      console.warn(`[Claude] HTTP ${res.status} for email copy`);
      return null;
    }
    const data    = await res.json();
    const content = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return content.length >= 20 ? content : null;
  } catch (e) {
    console.warn('[Claude] Error for email copy:', e.message);
    return null;
  }
}

async function callGeminiForEmail(userPrompt, env) {
  if (!env.GOOGLE_AI_API_KEY) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_EMAIL}:generateContent?key=${env.GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: BBW_SYSTEM_PROMPT }] },
          generationConfig: { maxOutputTokens: 500, temperature: 0.70 }
        })
      }
    );
    if (!res.ok) {
      console.warn(`[Gemini] HTTP ${res.status} for email copy`);
      return null;
    }
    const data    = await res.json();
    const content = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    return content.length >= 20 ? content : null;
  } catch (e) {
    console.warn('[Gemini] Error for email copy:', e.message);
    return null;
  }
}

async function callAI(userPrompt, env) {
  const claudeReply = await callClaudeForEmail(userPrompt, env);
  if (claudeReply) return claudeReply;

  const geminiReply = await callGeminiForEmail(userPrompt, env);
  if (geminiReply) return geminiReply;

  return callGroq(userPrompt, env);
}

// ════════════════════════════════════════════════════════════════
//  SETTINGS LOADER — from products.data.json
// ════════════════════════════════════════════════════════════════
// ⚠️ NOTE MIGRATION CLOUDFLARE : ce cache en variable globale ne persiste pas
// de façon fiable entre requêtes sur Cloudflare Workers (isolates recyclés
// fréquemment) — comportement dégradé (cache moins efficace, rechargera plus
// souvent depuis products.data.json) mais pas cassé.
let _cachedSettings = null;

async function loadSettings(env) {
  if (_cachedSettings) return _cachedSettings;
  try {
    const res  = await fetch(`${getBaseUrl(env)}/products.data.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const arr  = Array.isArray(data) ? data : [];
    _cachedSettings = arr.find(p => p.type === 'settings') || {};
    console.log('[Settings] Loaded from products.data.json');
    return _cachedSettings;
  } catch (e) {
    console.warn('[Settings] Failed to load:', e.message);
    return {};
  }
}

// ════════════════════════════════════════════════════════════════
//  GOOGLE SHEETS HELPERS
// ════════════════════════════════════════════════════════════════
async function getSheets(env) {
  const auth = await getGoogleAuthClient(env);
  return google.sheets({ version: 'v4', auth });
}

async function sheetRead(sheets, spreadsheetId, range) {
  if (!spreadsheetId) { console.warn(`[Sheets] Missing ID for: ${range}`); return []; }
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return res.data.values || [];
  } catch (e) {
    console.warn(`[Sheets] Read failed (${range}):`, e.message);
    return [];
  }
}

async function sheetAppend(sheets, spreadsheetId, range, values) {
  if (!spreadsheetId) { console.warn(`[Sheets] Missing ID for append: ${range}`); return; }
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId, range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [values] },
    });
  } catch (e) {
    console.warn(`[Sheets] Append failed (${range}):`, e.message);
  }
}

// ── Email Log — anti-duplicate ────────────────────────────────
const EMAIL_LOG_SHEET = 'curvafit-email-log';

async function loadEmailLog(sheets, env) {
  const rows = await sheetRead(sheets, env.SHEET_ID_CURVAFIT_ACCOUNTS, `${EMAIL_LOG_SHEET}!A:C`);
  const set  = new Set();
  rows.forEach(r => { if (r[0] && r[1]) set.add(`${r[0].toLowerCase()}||${r[1]}`); });
  console.log(`[EmailLog] ${set.size} sent records loaded`);
  return set;
}

async function markEmailSent(sheets, email, type, env) {
  await sheetAppend(
    sheets,
    env.SHEET_ID_CURVAFIT_ACCOUNTS,
    `${EMAIL_LOG_SHEET}!A:C`,
    [email.toLowerCase(), type, new Date().toISOString().slice(0, 10)]
  );
}

function wasEmailSent(log, email, type) {
  return log.has(`${email.toLowerCase()}||${type}`);
}

// ════════════════════════════════════════════════════════════════
//  RESEND DELIVERY
// ════════════════════════════════════════════════════════════════
async function deliver(to, subject, html, env) {
  if (!env.RESEND_API_KEY) {
    console.error('[Resend] Missing RESEND_API_KEY');
    return false;
  }
  const resend = new Resend(env.RESEND_API_KEY);
  try {
    const { data, error } = await resend.emails.send({
      from:    getFromEmail(env),
      to:      [to],
      subject,
      html,
    });
    if (error) { console.error(`[Resend] ✗ ${to}:`, JSON.stringify(error)); return false; }
    console.log(`[Resend] ✓ Sent to ${to} | ID: ${data?.id}`);
    return true;
  } catch (e) {
    console.error(`[Resend] ✗ ${to}:`, e.message);
    return false;
  }
}


// ════════════════════════════════════════════════════════════════
//  EPROLO — TRACKING CHECKER
// ════════════════════════════════════════════════════════════════

function buildEproloSign(env) {
  const apiKey    = env.EPROLO_API_KEY;
  const apiSecret = env.EPROLO_API_SECRET;
  const timestamp = Date.now();
  const sign      = crypto.createHash('md5').update(apiKey + timestamp + apiSecret).digest('hex');
  return { apiKey, timestamp, sign };
}

async function getEproloOrderTracking(internalOrderId, env) {
  try {
    const { apiKey, timestamp, sign } = buildEproloSign(env);

    const url = `https://openapi.eprolo.com/order_list.html?sign=${sign}&timestamp=${timestamp}&order_id=${encodeURIComponent(internalOrderId)}&status=0&page_size=1`;

    const res  = await fetch(url, {
      method:  'GET',
      headers: { 'apiKey': apiKey }
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { return null; }

    if (data.code !== '0' && data.code !== 0) {
      console.warn(`[EPROLO Tracking] API error: ${data.msg}`);
      return null;
    }

    const list  = (data.data && data.data.list) || [];
    const order = list[0];
    if (!order) return null;

    const logistics = (order.logistics || [])[0];
    if (!logistics || !logistics.tracking_number) return null;

    return {
      trackingNumber: logistics.tracking_number,
      carrier:        logistics.tracking_company || null,
      trackingUrl:    logistics.tracking_url     || null
    };

  } catch (e) {
    console.warn('[EPROLO Tracking] Error:', e.message);
    return null;
  }
}


// ════════════════════════════════════════════════════════════════
//  CJ — AUTH + TRACKING CHECKER
// ════════════════════════════════════════════════════════════════
async function getCJAccessToken(env) {
  const res = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: env.CJ_API_KEY })
  });
  const data = await res.json();
  if (!data.result || !data.data?.accessToken) {
    throw new Error('CJ auth failed: ' + (data.message || JSON.stringify(data)));
  }
  return data.data.accessToken;
}

async function getCJOrderTracking(cjOrderId, token) {
  try {
    const url = `https://developers.cjdropshipping.com/api2.0/v1/shopping/order/getOrderDetail?orderId=${encodeURIComponent(cjOrderId)}`;
    const res = await fetch(url, {
      method:  'GET',
      headers: { 'CJ-Access-Token': token }
    });
    const text = await res.text();

    let data;
    try { data = JSON.parse(text); } catch { return null; }

    if (data.result !== true || !data.data) {
      console.warn(`[CJ Tracking] API error: ${data.message}`);
      return null;
    }

    const trackNumber = data.data.trackNumber;
    if (!trackNumber) return null;

    return {
      trackingNumber: trackNumber,
      carrier:        data.data.logisticName || null,
      trackingUrl:    null
    };
  } catch (e) {
    console.warn('[CJ Tracking] Error:', e.message);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
//  TRACKING SCHEDULER — appelé par cron-job.org toutes les 12h
// ════════════════════════════════════════════════════════════════
async function runTrackingChecker(sheets, settings, env) {
  console.log('[Tracking] Starting tracking check...');

  const rows = await sheetRead(
    sheets,
    env.SHEET_ID_CURVAFIT_PENDING_ORDERS,
    'curvafit-pending-orders!A:X'
  );

  if (rows.length <= 1) {
    console.log('[Tracking] No orders found');
    return { checked: 0, found: 0 };
  }

  const now     = new Date();
  let checked   = 0;
  let found     = 0;
  let cjToken   = null; // ── récupéré à la volée, une seule fois, si besoin ──

  const processed = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const internalOrderId   = row[0]  || '';
    const paymentId         = row[2]  || '';
    const fullName          = row[3]  || '';
    const email              = row[4]  || '';
    const status             = (row[14] || '').toLowerCase();
    const orderDateStr       = row[16] || '';
    const trackingCol        = row[18] || '';
    const fulfillmentMethod  = (row[19] || 'eprolo').toLowerCase().trim();
    const cjOrderId          = row[21] || '';
    // Numéro de commande propre envoyé au CLIENT (colonne X) — repli sur
    // internalOrderId pour les commandes créées avant l'ajout de ce champ.
    const customerOrderId    = row[23] || internalOrderId;

    if (fulfillmentMethod === 'digital') continue;
    if (trackingCol)                   continue;
    if (status !== 'successful')       continue;
    if (!email || !email.includes('@')) continue;
    if (processed.has(paymentId))      continue;

    if (orderDateStr) {
      const orderDate = new Date(orderDateStr);
      const hoursElapsed = (now - orderDate) / (1000 * 60 * 60);
      if (hoursElapsed < 24) {
        console.log(`[Tracking] Order ${internalOrderId} — only ${hoursElapsed.toFixed(1)}h elapsed, skipping`);
        continue;
      }
    }

    checked++;
    processed.add(paymentId);

    let result = null;

    if (fulfillmentMethod === 'cj') {
      if (!cjOrderId) {
        console.log(`[Tracking] ⚠️ CJ order ${internalOrderId} — cj_order_id manquant en colonne V, skip`);
      } else {
        try {
          if (!cjToken) cjToken = await getCJAccessToken(env);
          result = await getCJOrderTracking(cjOrderId, cjToken);
        } catch (e) {
          console.warn('[Tracking] CJ auth/tracking error:', e.message);
        }
      }
    } else {
      result = await getEproloOrderTracking(internalOrderId, env);
    }

    if (result && result.trackingNumber) {
      found++;

      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: env.SHEET_ID_CURVAFIT_PENDING_ORDERS,
          range:         `curvafit-pending-orders!S${i + 1}`,
          valueInputOption: 'RAW',
          resource: { values: [[result.trackingNumber]] }
        });
        console.log(`[Tracking] ✅ Saved tracking ${result.trackingNumber} for order ${internalOrderId} (${fulfillmentMethod.toUpperCase()})`);
      } catch (e) {
        console.warn('[Tracking] Failed to save tracking:', e.message);
      }

      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName  = nameParts.slice(1).join(' ') || '';

      await trySendDirect(email, T.ORDER_TRACKING, async () => {
        return await composeOrderTracking({
          firstName,
          lastName,
          orderId:        customerOrderId,
          trackingNumber: result.trackingNumber,
          carrier:        result.carrier || ''
        }, settings, env);
      }, env);

      console.log(`[Tracking] ✅ Email sent to ${email}`);

      try {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            chat_id:    env.TELEGRAM_CHAT_ID,
            text:       `📦 <b>Tracking trouvé! (${fulfillmentMethod.toUpperCase()})</b>\n\n👤 <b>Client:</b> ${fullName}\n📧 <b>Email:</b> ${email}\n🔢 <b>Tracking:</b> ${result.trackingNumber}\n🚚 <b>Carrier:</b> ${result.carrier || 'N/A'}`,
            parse_mode: 'HTML'
          })
        });
      } catch (e) {
        console.warn('[Tracking] Telegram notify failed:', e.message);
      }

      // Client lié à Telegram (bouton "Add me on Telegram") — on lui envoie
      // aussi le numéro de suivi là-bas, en plus de l'email, pour les clients
      // qui ne consultent pas leur boîte mail de façon fiable. Prénom du
      // COMPTE (pas celui saisi au checkout, qui peut différer).
      try {
        await notifyCustomerTelegram(
          email,
          (accountFirstName) =>
            `${accountFirstName}, exciting news! 🚀\n\n📦 <b>Your Curvafit order has shipped!</b>\nOrder: <b>${customerOrderId}</b>\nTracking number: <b>${result.trackingNumber}</b>${result.carrier ? `\nCarrier: <b>${result.carrier}</b>` : ''}`,
          null,
          env
        );
      } catch (e) {
        console.warn('[Tracking] Client Telegram notify failed:', e.message);
      }

    } else {
      console.log(`[Tracking] ⏳ No tracking yet for ${internalOrderId} (${fulfillmentMethod.toUpperCase()})`);
    }

    await sleep(800);
  }

  console.log(`[Tracking] Done — checked: ${checked} | found: ${found}`);
  return { checked, found };
}


async function runEmailQueueProcessor(sheets, sentLog, settings, env) {
  console.log('[Queue] Checking scheduled emails...');
  const rows = await sheetRead(
    sheets,
    env.SHEET_ID_CURVAFIT_ACCOUNTS,
    'curvafit-accounts!A:AJ'
  );

  if (!rows.length) return { processed: 0 };

  const now = new Date();
  let processed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const firstName = row[1] || '';
    const email      = row[2] || '';

    const welcomeScheduledAt    = row[32] || '';
    const welcomeSent           = (row[33] || '').toLowerCase();
    const newsletterScheduledAt = row[34] || '';
    const newsletterSent        = (row[35] || '').toLowerCase();

    if (!email || !email.includes('@')) continue;

    if (welcomeScheduledAt && welcomeSent === 'no' && new Date(welcomeScheduledAt) <= now) {
      const single = { sent: [], skipped: [], errors: [] };
      const ok = await trySend(
        email, T.WELCOME,
        () => composeWelcome(firstName, settings, env),
        sheets, sentLog, single, env
      );
      await sheets.spreadsheets.values.update({
        spreadsheetId: env.SHEET_ID_CURVAFIT_ACCOUNTS,
        range: `curvafit-accounts!AH${i + 1}`,
        valueInputOption: 'RAW',
        resource: { values: [['yes']] }
      });
      if (ok) processed++;
      await sleep(400);
    }

    if (newsletterScheduledAt && newsletterSent === 'no' && new Date(newsletterScheduledAt) <= now) {
      const single = { sent: [], skipped: [], errors: [] };
      const ok = await trySend(
        email, T.NEWSLETTER_1,
        () => composeNewsletter1(firstName, settings, env),
        sheets, sentLog, single, env
      );
      await sheets.spreadsheets.values.update({
        spreadsheetId: env.SHEET_ID_CURVAFIT_ACCOUNTS,
        range: `curvafit-accounts!AJ${i + 1}`,
        valueInputOption: 'RAW',
        resource: { values: [['yes']] }
      });
      if (ok) processed++;
      await sleep(400);
    }
  }

  console.log(`[Queue] Done — processed: ${processed}`);
  return { processed };
}


async function trySendDirect(email, type, composeFn, env) {
  if (!email || !email.includes('@')) {
    console.warn(`[trySendDirect] Invalid email for ${type}: "${email}"`);
    return false;
  }
  try {
    console.log(`[trySendDirect] Composing ${type} for ${email}`);
    const { subject, html } = await composeFn();
    console.log(`[trySendDirect] Composed ${type} for ${email} — calling deliver()...`);
    const ok = await deliver(email, subject, html, env);
    console.log(`[trySendDirect] deliver() for ${type}/${email} returned: ${ok}`);
    return ok;
  } catch (e) {
    console.error(`[trySendDirect] Error ${email}/${type}:`, e.message);
    return false;
  }
}

// ════════════════════════════════════════════════════════════════
//  EMAIL DESIGN SYSTEM — Curvafit BRANDED
//  Redesign fidèle à l'image de référence :
//  • Header noir avec hero image (founder.hero_image) à droite
//  • Tagline "PRACTICAL GUIDANCE - EVERYDAY MOVEMENT"
//  • Logo Curvafit en grand avec "4" en rose
//  • Vague de transition noir→blanc
//  • Section corps sur fond blanc/rose très clair
//  • Bloc "YOU ARE enough JUST AS YOU ARE" sur fond rose pastel
//  • Grille de 4 icônes (valeurs de la marque)
//  • Footer sombre avec photo CEO + social icons colorés
// ════════════════════════════════════════════════════════════════

const BBW = {
  pink: '#e84387', pinkDark: '#bd3475', pinkLight: '#f6d9eb', pinkPale: '#fbf3fa',
  black: '#32165f', darkBg: '#28124d', white: '#ffffff', offWhite: '#f7f3fb',
  textDark: '#2d2140', textMid: '#5e526c', textLight: '#837991',
  gold: '#9a78c7', goldL: '#c6a8ed',
};

const BASE_CSS = `
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  body{margin:0!important;padding:0!important;background-color:#f5f1fa}
  a{color:inherit}
  @media only screen and (max-width:620px){
    .ew{width:100%!important;border-radius:0!important}
    .ep{padding:24px 16px!important}
    .eh1{font-size:26px!important}
    .elogo{font-size:38px!important}
    .egrid td{display:block!important;width:100%!important;padding:8px 0!important;text-align:center!important}
    .hide-mobile{display:none!important}
    .hero-img td{width:50%!important}
    .hero-img img{width:160px!important;max-width:160px!important}
    .hero-txt{padding:20px 16px 0!important}
  }
`;

// ── Social icons colorés (comme dans l'image) ─────────────────
function buildSocialIcons(settings) {
  const social = settings.social_links || {};
  const icons  = settings.social_icons  || {};

  const links = [
    { key: 'facebook',  label: 'Facebook'  },
    { key: 'instagram', label: 'Instagram' },
    { key: 'pinterest', label: 'Pinterest' },
    { key: 'youtube',   label: 'YouTube'   },
    { key: 'tiktok',    label: 'TikTok'    },
    { key: 'twitter',   label: 'X'         },
    { key: 'whatsapp',  label: 'WhatsApp'  },
  ].filter(l => social[l.key]);

  if (!links.length) return '';

  return `
<table cellpadding="0" cellspacing="0" role="presentation" style="margin:14px auto 6px;">
  <tr>
    ${links.map(l => `
    <td style="padding:0 4px;">
      <a href="${social[l.key]}" target="_blank" style="display:inline-block;text-decoration:none;">
        ${icons[l.key]
          ? `<img src="${icons[l.key]}" alt="${l.label}" width="38" height="38"
               style="width:38px;height:38px;display:block;border-radius:50%;object-fit:cover;">`
          : `<span style="display:inline-flex;align-items:center;justify-content:center;
               width:38px;height:38px;border-radius:50%;background:#5d3c90;
               font-family:Arial,sans-serif;font-size:11px;color:#fff;font-weight:700;">
               ${l.label.charAt(0)}
             </span>`
        }
      </a>
    </td>`).join('')}
  </tr>
</table>
<table cellpadding="0" cellspacing="0" role="presentation" style="margin:6px auto 0;">
  <tr>
    ${links.map(l => `
    <td style="padding:0 4px;text-align:center;min-width:46px;">
      <span style="font-family:Arial,sans-serif;font-size:9px;color:#706480;">${l.label}</span>
    </td>`).join('')}
  </tr>
</table>`;
}

// ── CEO Footer Block (fidèle à l'image : photo ronde + citation + logo + socials) ──
function buildCEOFooter(settings, env) {
  const BASE_URL = getBaseUrl(env);
  const support = (settings.contact_emails || {}).general || 'support@bbw4life.com';
  const whatsapp = (settings.contact || {}).whatsapp_url || 'https://wa.me/18292677434';
  return `
<tr><td style="padding:0;background:#f3eef9;border-top:1px solid #e7ddef;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td style="padding:28px 32px 10px;text-align:center;">
<p style="margin:0;font-family:Arial,sans-serif;font-size:23px;font-weight:800;letter-spacing:0.13em;color:${BBW.black};">CURVA<span style="color:${BBW.pink};">FIT</span></p>
<p style="margin:9px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:${BBW.textMid};">Practical guidance for movement and everyday wellbeing, at your pace.</p>
<p style="margin:10px 0 0;font-family:Arial,sans-serif;font-size:11px;color:${BBW.textLight};">Created with care by Pdg Francenel</p>
</td></tr>
<tr><td style="padding:8px 24px 18px;text-align:center;">${buildSocialIcons(settings)}
<p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.8;color:${BBW.textMid};"><a href="mailto:${support}" style="color:${BBW.black};text-decoration:underline;">${support}</a> &nbsp;|&nbsp; <a href="${whatsapp}" style="color:${BBW.black};text-decoration:underline;">WhatsApp support</a></p>
</td></tr>
<tr><td style="padding:15px 20px 22px;text-align:center;border-top:1px solid #e3d9ee;">
<p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:11px;line-height:1.65;color:${BBW.textLight};">You are receiving this email from Curvafit. You can <a href="${BASE_URL}/unsubscribe" style="color:${BBW.black};text-decoration:underline;">manage your email preferences</a>.</p>
<p style="margin:0;font-family:Arial,sans-serif;font-size:11px;line-height:2;color:${BBW.textMid};"><a href="${BASE_URL}/collections/curvafit-all-products.html" style="color:${BBW.textMid};text-decoration:none;">Explore Curvafit</a> &nbsp;|&nbsp; <a href="${BASE_URL}/policies/privacy.html" style="color:${BBW.textMid};text-decoration:none;">Privacy</a> &nbsp;|&nbsp; <a href="${BASE_URL}/page/contact.html" style="color:${BBW.textMid};text-decoration:none;">Contact</a> &nbsp;|&nbsp; <a href="${BASE_URL}/policies/refund.html" style="color:${BBW.textMid};text-decoration:none;">Returns</a></p>
<p style="margin:10px 0 0;font-family:Arial,sans-serif;font-size:10px;color:#9d92a9;">&copy; ${new Date().getFullYear()} Curvafit. All rights reserved.</p>
</td></tr></table></td></tr>`;
}

function buildValueGrid() {
  const values = [
    { icon: '01', title: 'GENTLE MOVEMENT', desc: 'Approachable ideas for everyday activity.' },
    { icon: '02', title: 'FLEXIBLE PLANNING', desc: 'Simple tools for routines that fit real life.' },
    { icon: '03', title: 'AT-HOME GUIDES', desc: 'Movement resources to use at your own pace.' },
    { icon: '04', title: 'PRACTICAL ESSENTIALS', desc: 'Selected items for everyday movement.' },
  ];
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0;border-top:1px solid rgba(93,60,144,0.12);">
  <tr>${values.map((v, i) => `
    <td class="egrid" width="25%" style="padding:24px 10px;text-align:center;${i < 3 ? 'border-right:1px solid rgba(93,60,144,0.12);' : ''}vertical-align:top;">
      <div style="font:700 12px Arial,sans-serif;margin-bottom:9px;color:${BBW.pink};">${v.icon}</div>
      <p style="margin:0 0 6px;font:700 10px Arial,sans-serif;color:${BBW.black};letter-spacing:.06em;">${v.title}</p>
      <p style="margin:0;font:11px/1.55 Arial,sans-serif;color:${BBW.textMid};">${v.desc}</p>
    </td>`).join('')}
  </tr>
</table>`;
}

function masterTemplate({ preheader, tagline, heroHeadline, heroSubline, topBadge, bodyHTML, settings, showValueGrid = false }, env) {
  const baseUrl = getBaseUrl(env);
  const heroImg = `${baseUrl}/img/curva-banner-2.png`;
  const headline = heroHeadline || 'FIND A RHYTHM THAT FEELS RIGHT.';
  const subline = heroSubline || 'Small steps. Practical support. Your pace.';
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Curvafit</title><style>${BASE_CSS}</style></head>
<body style="margin:0;padding:0;background:#f5f1fa;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f5f1fa;line-height:1px;">${preheader || 'A little support from Curvafit'}&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f5f1fa;padding:24px 12px;"><tr><td align="center">
<table class="ew" width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;border:1px solid #e7ddef;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 14px 38px rgba(59,27,125,0.10);">
<tr><td style="padding:20px 28px;background:#32165f;text-align:center;"><p style="margin:0;font-family:Arial,sans-serif;font-size:27px;line-height:1;font-weight:800;letter-spacing:0.15em;color:#fff;">CURVA<span style="color:#f08ac0;">FIT</span></p><p style="margin:9px 0 0;font-family:Arial,sans-serif;font-size:9px;line-height:1.5;letter-spacing:0.16em;text-transform:uppercase;color:#e8dff3;">${tagline || 'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT'}</p></td></tr>
<tr><td style="padding:0;line-height:0;font-size:0;"><img src="${heroImg}" alt="A Curvafit moment of everyday movement" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>
<tr><td style="padding:23px 28px 21px;text-align:center;background:#fbf8fd;border-bottom:1px solid #eee7f4;">${topBadge ? `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${BBW.pink};">${topBadge}</p>` : ''}<h1 class="eh1" style="margin:0;font-family:Arial,sans-serif;font-size:25px;line-height:1.25;font-weight:800;color:${BBW.black};">${headline}</h1><p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:${BBW.textMid};">${subline}</p></td></tr>
<tr><td class="ep" style="background:#fff;padding:32px 38px 28px;">${bodyHTML}</td></tr>
${showValueGrid ? `<tr><td style="background:#fbf8fd;padding:0 8px 8px;">${buildValueGrid()}</td></tr>` : ''}
${buildCEOFooter(settings, env)}</table></td></tr></table></body></html>`;
}

function cParagraphs(text) {
  if (!text) return '';
  return text.split('\n').filter(p => p.trim()).map(p =>
    `<p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;
        color:${BBW.textMid};line-height:1.75;">${p}</p>`
  ).join('');
}

function cCTA(label, url, color) {
  const bg = color || BBW.pink;
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0 8px;">
  <tr>
    <td align="center">
      <a href="${url}" target="_blank"
         style="display:inline-block;padding:15px 44px;border-radius:6px;
                background:${bg};font-family:Arial,sans-serif;font-size:14px;
                font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.06em;
                text-transform:uppercase;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

function cDivider() {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:22px 0;">
  <tr>
    <td style="height:1px;background:linear-gradient(90deg,transparent,rgba(93,60,144,0.25),transparent);"></td>
  </tr>
</table>`;
}

// Bloc "YOU ARE enough JUST AS YOU ARE" — signature visuelle de l'image
function cEnoughBox(message) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;">
  <tr><td style="background:${BBW.pinkLight};border-radius:12px;padding:30px 24px;text-align:center;">
    <p style="margin:0 0 10px;font:700 11px Arial,sans-serif;color:${BBW.pinkDark};letter-spacing:.12em;text-transform:uppercase;">CURVAFIT</p>
    <p style="margin:0 0 8px;font:700 25px/1.2 Georgia,serif;color:${BBW.black};">Move at</p>
    <p style="margin:0;font:italic 28px/1.2 Georgia,serif;color:${BBW.pink};">${message || 'your pace'}</p>
  </td></tr>
</table>`;
}

function cHighlightBox(icon, title, text, bgColor) {
  const bg = bgColor || BBW.pinkPale;
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin:0 0 12px;border-radius:10px;overflow:hidden;
              background:${bg};border-left:3px solid ${BBW.pink};">
  <tr>
    <td style="padding:16px 18px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td width="32" style="vertical-align:top;padding-top:1px;font-size:20px;">${icon}</td>
          <td style="padding-left:10px;">
            <p style="margin:0 0 3px;font-family:Arial,sans-serif;font-size:12px;
                font-weight:700;color:${BBW.pink};letter-spacing:0.06em;text-transform:uppercase;">${title}</p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
                color:${BBW.textMid};line-height:1.55;">${text}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function cOrderItem(item) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin-bottom:10px;border-radius:10px;overflow:hidden;
              background:${BBW.pinkPale};border:1px solid rgba(93,60,144,0.12);">
  <tr>
    ${item.image ? `
    <td width="70" style="padding:0;vertical-align:top;">
      <img src="${item.image}" width="70" height="70"
           style="display:block;width:70px;height:70px;object-fit:cover;border-radius:10px 0 0 10px;"
           alt="${item.title}">
    </td>` : ''}
    <td style="padding:14px 16px;vertical-align:middle;">
      <p style="margin:0 0 3px;font-family:Georgia,serif;font-size:13px;
          font-weight:700;color:${BBW.textDark};">${item.title}</p>
      ${item.size  ? `<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:${BBW.textLight};">Size: ${item.size}</p>`  : ''}
      ${item.color ? `<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:${BBW.textLight};">Color: ${item.color}</p>` : ''}
      <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${BBW.textLight};">
        Qty: ${item.quantity} &nbsp;·&nbsp;
        <span style="color:${BBW.pink};font-weight:700;">$${parseFloat(item.price * item.quantity).toFixed(2)}</span>
      </p>
    </td>
  </tr>
</table>`;
}

// Bloc promo code — style sombre (comme dans l'image)
function cPromoBlock(code, percent, items, label) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin:20px 0;border-radius:12px;overflow:hidden;
              background:${BBW.black};">
  <tr>
    <td style="padding:28px 24px;text-align:center;">
      <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;
          color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.15em;">
        🎁 ${label || 'Curvafit offer'}
      </p>
      <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:32px;font-weight:700;
          color:${BBW.goldL};letter-spacing:0.12em;">${code}</p>
      <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
          color:rgba(255,255,255,0.65);">
        ${percent}% off — ${items} items or more
      </p>
    </td>
  </tr>
</table>`;
}

// ════════════════════════════════════════════════════════════════
//  AI COPY GENERATORS — inchangés
// ════════════════════════════════════════════════════════════════

async function genWelcomeCopy(name, env) {
  const copy = await callAI(`EMAIL TYPE: Curvafit account welcome. RECIPIENT: ${name}\nWrite two brief paragraphs. Welcome them, explain their account keeps order details and saved items together, and invite them to explore practical movement guides and selected fitness essentials at their own pace. Do not assume gender or make body, health, or results claims. Plain text only.`, env);
  return copy || `Welcome to Curvafit, ${name}. Your account makes it easier to keep your order details and saved items together.\n\nWhen it suits you, explore practical guides for walking, meal planning and movement at home, along with selected fitness essentials. Take what is useful and move at your own pace.`;
}
async function genOrderConfirmCopy(name, env) {
  const copy = await callAI(`EMAIL TYPE: Physical order confirmation for Curvafit. RECIPIENT: ${name}\nWrite one concise paragraph thanking them and confirming their order is being prepared. Say tracking details will be shared when available. Do not invent a delivery date. Plain text only.`, env);
  return copy || `Thank you for your order, ${name}. It is confirmed and being prepared. We will share the tracking details as soon as they are available.`;
}
async function genTrackingCopy(name, env) {
  const copy = await callAI(`EMAIL TYPE: Curvafit shipping notification. RECIPIENT: ${name}\nWrite one concise paragraph saying the order has shipped and the tracking information is below. Do not promise an arrival date. Plain text only.`, env);
  return copy || `Your Curvafit order has shipped, ${name}. You can follow its progress using the tracking details below.`;
}
async function genNewsletter1Copy(name, env) {
  const copy = await callAI(`EMAIL TYPE: Curvafit newsletter welcome. RECIPIENT: ${name || 'there'}\nWrite two short paragraphs welcoming them and setting expectations: occasional practical ideas for everyday movement, flexible planning, useful guides and selected fitness essentials. No unsupported promises or pressure. Plain text only.`, env);
  return copy || `Welcome to Curvafit, ${name || 'there'}. We share practical ideas for everyday movement and routines that can fit real life.\n\nLook out for occasional notes about gentle walking, flexible meal planning, at-home movement and selected fitness essentials. We hope you find something useful whenever you are ready for it.`;
}
async function genNewsletter2Copy(name, env) {
  const copy = await callAI(`EMAIL TYPE: Curvafit subscriber check-in. RECIPIENT: ${name || 'there'}\nWrite two brief paragraphs. Check in without implying we tracked their browsing. Invite them to reply with a question or tell us what kind of practical resource would help. Plain text only.`, env);
  return copy || `A quick hello from Curvafit, ${name || 'there'}. We hope you have found something useful in the ideas and resources we share.\n\nIf you have a question or would like to see a particular kind of practical guide, just reply to this email. We read your messages and appreciate hearing what would help.`;
}
async function genNewsletter3Copy(name, env) {
  const copy = await callAI(`EMAIL TYPE: Curvafit practical resources newsletter. RECIPIENT: ${name || 'there'}\nWrite two short paragraphs introducing gentle walking, flexible meal planning and at-home movement guides, plus selected fitness essentials. Invite exploration without urgency or claims. Plain text only.`, env);
  return copy || `Small, practical resources can make it easier to decide where to begin. Curvafit brings together guides for gentle walking, flexible meal planning and at-home movement, each designed to be used at your own pace.\n\nYou will also find selected fitness essentials for everyday routines. Browse whenever it feels useful; there is no rush.`;
}
async function genNewsletter4BuyerCopy(name, env) {
  const copy = await callAI(`EMAIL TYPE: Curvafit post-purchase feedback request. RECIPIENT: ${name || 'there'}\nWrite two short paragraphs. Thank them for their order, ask for honest feedback without assuming it has arrived or that they are satisfied, and invite them to contact support if they need help. Plain text only.`, env);
  return copy || `Thank you again for choosing Curvafit, ${name || 'there'}. We appreciate your order and would value hearing about your experience when you have a chance.\n\nIf you have a question or need help with your order, reply to this email and our team will assist.`;
}
async function genNewsletter4NewCopy(name, env) {
  const copy = await callAI(`EMAIL TYPE: Curvafit newsletter note for a subscriber who has not ordered. RECIPIENT: ${name || 'there'}\nWrite two short paragraphs. Give a no-pressure invitation to explore the practical guides and selected fitness essentials. Mention a discount only as an offer shown separately in this email. Plain text only.`, env);
  return copy || `Thanks for staying in touch with Curvafit, ${name || 'there'}. If you are curious, you can explore our practical guides and selected fitness essentials whenever it suits you.\n\nThere is also a discount offer below, if it is useful to you. No rush; choose what fits your needs.`;
}
async function genContactReplyCopy(name, env) {
  const copy = await callAI(`EMAIL TYPE: Curvafit contact-form acknowledgement. RECIPIENT: ${name || 'there'}\nConfirm receipt and say the support team will respond within 24 to 48 hours. Be clear and calm. Plain text only.`, env);
  return copy || `Hi ${name || 'there'}, we have received your message. Our support team will review it and get back to you within 24 to 48 hours. Thank you for contacting Curvafit.`;
}
async function genPlanRequestCopy(name, program, env) {
  const copy = await callAI(`EMAIL TYPE: Curvafit request acknowledgement. RECIPIENT: ${name || 'there'} REQUEST: ${program}\nConfirm the request was received and will be reviewed. Do not promise approval or a timeline. Plain text only.`, env);
  return copy || `Hi ${name || 'there'}, we have received your request about ${program}. Our team will review the details and follow up if more information is needed. Thank you for reaching out to Curvafit.`;
}
async function genCustomProductCopy(name, productTitle, env) {
  const copy = await callAI(`EMAIL TYPE: Curvafit product suggestion acknowledgement. RECIPIENT: ${name || 'there'} SUGGESTION: ${productTitle}\nThank them and confirm the suggestion has been received for review. Do not imply that Curvafit will manufacture or launch it. Plain text only.`, env);
  return copy || `Thanks for sharing your idea for ${productTitle}, ${name || 'there'}. We have received your suggestion and will pass it along for review. We cannot promise that every suggestion will become a product, but your feedback is appreciated.`;
}
async function genCartAbandonedCopy(name, env) {
  const copy = await callAI(`EMAIL TYPE: Curvafit cart reminder. RECIPIENT: ${name || 'there'}\nWrite two short paragraphs. Gently mention that items are listed below and invite them back if they still want them. Mention an offer only if one is displayed separately. No false urgency and do not claim the cart is saved unless confirmed. Plain text only.`, env);
  return copy || `A quick note from Curvafit: the items you selected are listed below in case you would like to take another look.\n\nIf you have a question before deciding, reply to this email and we will be glad to help. Any offer shown below is there for you to review, with no pressure.`;
}
async function getProductName(productId, env) {
  try {
    const res  = await fetch(`${getBaseUrl(env)}/products.data.json`);
    if (!res.ok) return null;
    const data = await res.json();
    const arr  = Array.isArray(data) ? data : [];
    const prod = arr.find(p => p.id === productId && p.type !== 'settings');
    return prod ? (prod.name || prod.title || null) : null;
  } catch (e) {
    console.warn('[ProductName] Failed:', e.message);
    return null;
  }
}

function detectSentiment(title, text) {
  const combined = `${title} ${text}`.toLowerCase();
  const neg = [
    'never arrived','never received','not received','jamais reçu','jamais arrivé',
    'lost','perdu','broken','cassé','damaged','wrong','mauvais','disappointed',
    'déçu','terrible','horrible','bad','refund','remboursement','scam','arnaque',
    'too long','trop long','delay','retard','poor quality','mauvaise qualité',
    'problem','problème','worst','never again','ripped','doesn\'t fit'
  ];
  const pos = [
    'love','adore','amazing','beautiful','perfect','excellent','great','wonderful',
    'fantastic','gorgeous','magnifique','parfait','superbe','incroyable','très bien',
    'highly recommend','satisfied','happy','fast shipping','good quality',
    'fits perfectly','worth it','five stars','5 stars','best','comfortable'
  ];
  let negScore = 0; let posScore = 0;
  neg.forEach(k => { if (combined.includes(k)) negScore++; });
  pos.forEach(k => { if (combined.includes(k)) posScore++; });
  return negScore > posScore ? 'negative' : 'positive';
}

async function genReviewResponseCopy(firstName, title, text, productName, sentiment, promo, settings, env) {
  const whatsapp = (settings.contact || {}).whatsapp_url || 'https://wa.me/18298940709';
  const contactPage = `${getBaseUrl(env)}/page/contact.html`;
  const prompt = sentiment === 'positive'
    ? `A customer named ${firstName} left a positive review for ${productName}. Review title: ${title}. Review text: ${text}. Write a brief, specific thank-you. Mention a discount only if this code is present: ${promo ? promo.code : 'none'}. Do not claim an offer that is not provided. Plain text only.`
    : `A customer named ${firstName} left a negative review for ${productName}. Review title: ${title}. Review text: ${text}. Acknowledge the issue with care, apologize for their experience, and invite them to contact support at ${whatsapp} or ${contactPage}. Do not promise a refund, resolution, or outcome. Plain text only.`;
  const copy = await callAI(prompt, env);
  return copy || (sentiment === 'positive'
    ? `Thank you for sharing your thoughts about ${productName}. We appreciate you taking the time to leave a review.${promo ? ` As a thank-you, you can use ${promo.code} for ${promo.percent}% off ${promo.items} items or more.` : ''}`
    : `We are sorry to hear about your experience with ${productName}. Please contact our support team at ${whatsapp} or ${contactPage} so we can review the details with you.`);
}

async function genStoryReceivedCopy(name, env) {
  const copy = await callAI(`EMAIL TYPE: Curvafit story submission acknowledgement. RECIPIENT: ${name}\nThank them for sharing their experience. Say the submission has been received for review. Do not promise publication or invent a review timeline. Write two short paragraphs, plain text only.`, env);
  return copy || `Thank you for sharing your experience with Curvafit. We appreciate you taking the time to write to us.\n\nYour submission has been received for review. If we would like to publish it, our team will contact you first.`;
}

async function composeWelcome(firstName, settings, env) {
  const BASE_URL = getBaseUrl(env);
  const name = firstName || 'there';
  const copy = await genWelcomeCopy(name, env);
  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;font-weight:700;color:${BBW.textDark};">Hi ${name},</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;color:${BBW.pink};letter-spacing:.08em;text-transform:uppercase;font-weight:700;">Welcome to Curvafit</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    ${cHighlightBox('01', 'Gentle movement', 'Approachable ideas for everyday activity, at your pace.')}
    ${cHighlightBox('02', 'Flexible planning', 'Simple tools to make everyday planning more manageable.', BBW.offWhite)}
    ${cHighlightBox('03', 'Movement at home', 'Gentle routines with room to choose your own pace.', BBW.pinkPale)}
    ${cCTA('EXPLORE CURVAFIT', `${BASE_URL}/collections/curvafit-all-products.html`)}
    <div style="height:24px;"></div>`;
  return {
    subject: `Welcome to Curvafit, ${name}`,
    html: masterTemplate({
      preheader: 'Practical ideas and useful resources, at your pace.',
      tagline: 'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT',
      heroHeadline: `FIND A RHYTHM THAT <span style="color:${BBW.pink};">FITS.</span>`,
      heroSubline: 'PRACTICAL SUPPORT, AT YOUR PACE.',
      bodyHTML,
      settings,
      showValueGrid: true,
    }, env),
  };
}

async function composeConfirmAccount(data, settings, env) {
  const { firstName, confirmUrl } = data;
  const name = firstName || 'there';

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Confirm Your Email ✉️
    </p>
    <p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;
        color:${BBW.textMid};line-height:1.75;">
      Welcome to Curvafit! We're so glad you're here. Before you can log in and start shopping,
      please confirm your email address by clicking the button below.
    </p>
    ${cCTA('CONFIRM MY ACCOUNT &nbsp;›', confirmUrl)}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textLight};text-align:center;line-height:1.6;">
      If you didn't create this account, you can safely ignore this email.
    </p>
    <div style="height:32px;"></div>`;

  return {
    subject: `Please confirm your Curvafit account, ${name} ✉️`,
    html: masterTemplate({
      preheader:    `One quick step — confirm your email to activate your account.`,
      tagline:      'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT',
      heroHeadline: `ALMOST <span style="color:${BBW.pink};">THERE!</span>`,
      heroSubline:  'CONFIRM YOUR EMAIL TO GET STARTED.',
      bodyHTML,
      settings,
    }, env),
  };
}

// ── Réinitialisation de mot de passe ──
async function composePasswordReset(data, settings, env) {
  const { firstName, resetUrl } = data;
  const name = firstName || 'there';

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Reset Your Password 🔒
    </p>
    <p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;
        color:${BBW.textMid};line-height:1.75;">
      We received a request to reset your Curvafit password. Click the button below to choose a new one.
      This link will expire in 10 minutes for your security.
    </p>
    ${cCTA('RESET MY PASSWORD &nbsp;›', resetUrl)}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textLight};text-align:center;line-height:1.6;">
      If you didn't request this, you can safely ignore this email — your password will stay unchanged.
    </p>
    <div style="height:32px;"></div>`;

  return {
    subject: `Reset your Curvafit password, ${name}`,
    html: masterTemplate({
      preheader:    `Reset your password — this link expires in 10 minutes.`,
      tagline:      'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT',
      heroHeadline: `RESET YOUR <span style="color:${BBW.pink};">PASSWORD.</span>`,
      heroSubline:  'THIS LINK EXPIRES IN 10 MINUTES.',
      bodyHTML,
      settings,
    }, env),
  };
}

// ── 2. Order Confirmation ─────────────────────────────────────
async function composeOrderConfirm(data, settings, env) {
  const { firstName, lastName, orderId, items = [], total, shippingAddress } = data;
  const name = firstName || lastName || 'there';
  const copy = await genOrderConfirmCopy(name, env);

  const itemsHTML = items.map(item => cOrderItem(item)).join('');

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Order Confirmed ✅
    </p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:15px;font-weight:700;color:${BBW.textDark};">
      Your Order — <span style="color:${BBW.pink};">#${orderId || 'Curvafit'}</span>
    </p>
    ${itemsHTML}
    ${total ? `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin-top:14px;padding:14px;background:${BBW.pinkPale};
                  border-radius:8px;border:1px solid rgba(93,60,144,0.12);">
      <tr>
        <td style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:${BBW.textDark};">Total</td>
        <td style="text-align:right;font-family:Georgia,serif;font-size:17px;
            font-weight:700;color:${BBW.pink};">$${parseFloat(total).toFixed(2)}</td>
      </tr>
    </table>` : ''}
    ${shippingAddress ? `
    ${cDivider()}
    <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:13px;
        font-weight:700;color:${BBW.textDark};">Shipping to:</p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textMid};line-height:1.6;">${shippingAddress}</p>` : ''}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textLight};text-align:center;line-height:1.6;">
      You'll receive a tracking number by email as soon as your order ships.<br>
      Questions? Reply to this email — we're always here. ♡
    </p>
    <div style="height:32px;"></div>`;

  return {
    subject: `Order Confirmed! Your Curvafit order is being prepared 🛍️`,
    html: masterTemplate({
      preheader:    `Your order has been confirmed — we're already preparing it with care.`,
      tagline:      'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT',
      heroHeadline: `YOUR ORDER IS <span style="color:${BBW.pink};">CONFIRMED.</span>`,
      heroSubline:  'WE\'RE PREPARING IT WITH LOVE.',
      bodyHTML,
      settings,
    }, env),
  };
}

// Curvafit digital orders use a dedicated receipt and a secure return link.
// Physical-order confirmation remains on composeOrderConfirm unchanged.
function composeEbookOrderConfirm(data, settings, env) {
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const baseUrl = env.BASE_URL || 'https://curvafit.com';
  const firstName = escapeHtml(data.firstName || 'there');
  const orderId = escapeHtml(data.orderId || 'Curvafit');
  const downloadUrl = escapeHtml(data.downloadUrl || `${baseUrl}/thankyou.html`);
  const languageNames = { en: 'English', fr: 'French', es: 'Spanish' };
  const items = (Array.isArray(data.items) ? data.items : []).map(item => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #e7ddef;color:#2d2140;font:600 15px Arial,sans-serif;">
        ${escapeHtml(item.title)}<br>
        <span style="color:#837991;font:12px Arial,sans-serif;">${escapeHtml(languageNames[item.language] || item.language || '')} · Qty ${escapeHtml(item.quantity || 1)}</span>
      </td>
      <td align="right" style="padding:14px 0;border-bottom:1px solid #e7ddef;color:#2d2140;font:600 14px Arial,sans-serif;">
        $${(Number(item.lineTotal) || (Number(item.price) || 0) * (Number(item.quantity) || 1)).toFixed(2)}
      </td>
    </tr>`).join('');
  const total = (Number(data.total) || 0).toFixed(2);

  return {
    subject: `Your Curvafit digital order is confirmed · #${orderId}`,
    html: `<!doctype html><html><body style="margin:0;background:#f5f1fa;padding:28px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e7ddef;border-radius:18px;overflow:hidden;font-family:Arial,sans-serif;">
          <tr><td style="padding:28px;text-align:center;background:#32165f;color:#fff;">
            <div style="font-size:23px;font-weight:700;letter-spacing:.12em;">CURVAFIT</div>
            <div style="margin-top:8px;font-size:12px;letter-spacing:.1em;">PRACTICAL GUIDANCE. EVERYDAY MOVEMENT. YOUR PACE.</div>
          </td></tr>
          <tr><td style="padding:30px;color:#2d2140;">
            <h1 style="margin:0 0 12px;font-size:25px;">Your digital order is confirmed</h1>
            <p style="margin:0 0 22px;color:#5e526c;line-height:1.65;">Hi ${firstName}, thank you for choosing Curvafit. Your payment is confirmed and your guides are ready to access.</p>
            <p style="margin:0 0 8px;font-size:13px;color:#5e526c;">ORDER <strong style="color:#2d2140;">#${orderId}</strong></p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${items}
              <tr><td style="padding:18px 0;font-weight:700;">Total</td><td align="right" style="padding:18px 0;color:#5d3c90;font-size:18px;font-weight:700;">$${total}</td></tr>
            </table>
            <div style="padding:12px 0 20px;text-align:center;">
              <a href="${downloadUrl}" style="display:inline-block;padding:15px 24px;border-radius:999px;background:#bd3475;color:#fff;text-decoration:none;font-weight:700;">Access my digital guides</a>
            </div>
            <p style="margin:0;color:#5e526c;font-size:13px;line-height:1.65;">This secure link opens your Curvafit confirmation page and prepares your downloads. If you need help, visit <a href="${escapeHtml(baseUrl)}/page/contact.html" style="color:#5d3c90;">Curvafit support</a>.</p>
          </td></tr>
          <tr><td style="padding:18px;text-align:center;background:#f3eef9;color:#837991;font-size:11px;">Curvafit · Gentle guidance, at your pace.</td></tr>
        </table>
      </td></tr></table>
    </body></html>`
  };
}

// ── 3. Order Tracking ─────────────────────────────────────────
async function composeOrderTracking(data, settings, env) {
  const BASE_URL = getBaseUrl(env);
  const { firstName, lastName, orderId, trackingNumber, carrier } = data;
  const name = firstName || lastName || 'there';
  const copy = await genTrackingCopy(name, env);

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Your Order Is On Its Way 🚚
    </p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin:0 0 20px;border-radius:12px;overflow:hidden;background:${BBW.black};">
      <tr>
        <td style="padding:28px;text-align:center;">
          <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:10px;
              color:rgba(255,255,255,0.50);text-transform:uppercase;letter-spacing:0.15em;">
            Tracking Number
          </p>
          <p style="margin:0 0 10px;font-family:Georgia,serif;font-size:26px;font-weight:700;
              color:${BBW.goldL};letter-spacing:0.10em;">${trackingNumber}</p>
          ${carrier ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:12px;
              color:rgba(255,255,255,0.55);">Carrier: ${carrier}</p>` : ''}
        </td>
      </tr>
    </table>
    ${cCTA('TRACK MY ORDER &nbsp;›', data.trackingUrl || `${BASE_URL}/page/order-tracking.html`)}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textLight};text-align:center;">
      Order: <strong style="color:${BBW.textDark};">#${orderId || 'Curvafit'}</strong>
    </p>
    <div style="height:32px;"></div>`;

  return {
    subject: `Your Curvafit order is on its way! 🚚 Tracking: ${trackingNumber}`,
    html: masterTemplate({
      preheader:    `Your order has shipped — tracking: ${trackingNumber}`,
      tagline:      'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT',
      heroHeadline: `IT'S ON ITS <span style="color:${BBW.pink};">WAY!</span>`,
      heroSubline:  'YOUR PACKAGE IS HEADING TO YOU.',
      bodyHTML,
      settings,
    }, env),
  };
}

// ── 4. Newsletter #1 — Immédiat ───────────────────────────────
async function composeNewsletter1(firstName, settings, env) {
  const BASE_URL = getBaseUrl(env);
  const name = firstName || 'there';
  const copy = await genNewsletter1Copy(name, env);
  const promos = settings.promos || [];
  const promo = promos[0];
  const bodyHTML = `
    <p style="margin:0 0 4px;font:700 26px Georgia,serif;color:${BBW.textDark};">Hi ${name},</p>
    <p style="margin:0 0 22px;font:700 12px Arial,sans-serif;color:${BBW.pink};letter-spacing:.08em;text-transform:uppercase;">You are subscribed</p>
    ${cParagraphs(copy)}
    ${cCTA('EXPLORE CURVAFIT', `${BASE_URL}/collections/curvafit-all-products.html`)}
    ${promo ? cPromoBlock(promo.code, promo.percent, promo.items, 'Subscriber offer') : ''}
    <div style="height:24px;"></div>`;
  return {
    subject: 'Welcome to Curvafit',
    html: masterTemplate({ preheader: 'Practical ideas for everyday movement, at your pace.', tagline: 'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT', heroHeadline: `WELCOME TO <span style="color:${BBW.pink};">CURVAFIT.</span>`, heroSubline: 'USEFUL IDEAS FOR REAL-LIFE ROUTINES.', bodyHTML, settings, showValueGrid: true }, env),
  };
}

async function composeNewsletter2(firstName, settings, env) {
  const BASE_URL = getBaseUrl(env);
  const name = firstName || 'there';
  const copy = await genNewsletter2Copy(name, env);
  const support = (settings.contact_emails || {}).general || 'support@bbw4life.com';
  const bodyHTML = `
    <p style="margin:0 0 4px;font:700 26px Georgia,serif;color:${BBW.textDark};">Hi ${name},</p>
    <p style="margin:0 0 22px;font:700 12px Arial,sans-serif;color:${BBW.pink};letter-spacing:.08em;text-transform:uppercase;">A quick check-in</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    ${cHighlightBox('?', 'Need a hand?', 'Reply to this email or contact the Curvafit support team.', BBW.pinkPale)}
    ${cCTA('CONTACT SUPPORT', `mailto:${support}`)}
    ${cCTA('EXPLORE CURVAFIT', `${BASE_URL}/collections/curvafit-all-products.html`, BBW.pinkDark)}
    <div style="height:24px;"></div>`;
  return {
    subject: 'A quick check-in from Curvafit',
    html: masterTemplate({ preheader: 'Have a question or an idea for a useful guide? Reply and let us know.', tagline: 'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT', heroHeadline: `HERE TO <span style="color:${BBW.pink};">HELP.</span>`, heroSubline: 'CLEAR ANSWERS AND PRACTICAL SUPPORT.', bodyHTML, settings }, env),
  };
}

async function composeNewsletter3(firstName, settings, env) {
  const BASE_URL = getBaseUrl(env);
  const name = firstName || 'there';
  const copy = await genNewsletter3Copy(name, env);
  const promos = settings.promos || [];
  const promo = promos[1] || promos[0];
  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;font-weight:700;color:${BBW.textDark};">Hi ${name},</p>
    <p style="margin:0 0 22px;font:700 12px Arial,sans-serif;color:${BBW.pink};letter-spacing:.08em;text-transform:uppercase;">A few practical ideas</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    ${cHighlightBox('01', 'Practical guides', 'Explore walking, meal planning and at-home movement resources.')}
    ${cHighlightBox('02', 'Everyday essentials', 'Selected fitness items for home and daily routines.', BBW.offWhite)}
    ${cHighlightBox('03', 'At your pace', 'Choose the ideas and tools that feel useful to you.', BBW.pinkPale)}
    ${promo ? cPromoBlock(promo.code, promo.percent, promo.items, 'Subscriber offer') : ''}
    ${cCTA('EXPLORE CURVAFIT', `${BASE_URL}/collections/most-popular.html`)}
    <div style="height:24px;"></div>`;
  return {
    subject: 'Practical resources from Curvafit',
    html: masterTemplate({ preheader: 'Practical guides and selected fitness essentials, at your pace.', tagline: 'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT', heroHeadline: `RESOURCES FOR <span style="color:${BBW.pink};">REAL ROUTINES.</span>`, heroSubline: 'PRACTICAL GUIDES AND EVERYDAY ESSENTIALS.', bodyHTML, settings }, env),
  };
}

async function composeNewsletter4Buyer(firstName, settings, env) {
  const BASE_URL = getBaseUrl(env);
  const name = firstName || 'there';
  const copy = await genNewsletter4BuyerCopy(name, env);
  const bodyHTML = `
    <p style="margin:0 0 4px;font:700 26px Georgia,serif;color:${BBW.textDark};">Hi ${name},</p>
    <p style="margin:0 0 22px;font:700 12px Arial,sans-serif;color:${BBW.pink};letter-spacing:.08em;text-transform:uppercase;">Thank you for your order</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    ${cHighlightBox('01', 'Share your experience', 'Your feedback helps us improve the information and support we provide.')}
    ${cCTA('EXPLORE CURVAFIT', `${BASE_URL}/collections/curvafit-all-products.html`, BBW.pinkDark)}
    <div style="height:24px;"></div>`;
  return {
    subject: `Thank you for choosing Curvafit`,
    html: masterTemplate({ preheader: 'We appreciate your order and welcome your feedback.', tagline: 'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT', heroHeadline: `THANK YOU FOR <span style="color:${BBW.pink};">YOUR ORDER.</span>`, heroSubline: 'WE ARE HERE IF YOU NEED SUPPORT.', bodyHTML, settings }, env),
  };
}

async function composeNewsletter4New(firstName, settings, env) {
  const BASE_URL = getBaseUrl(env);
  const name = firstName || 'there';
  const copy = await genNewsletter4NewCopy(name, env);
  const promos = settings.promos || [];
  const promo = promos[0];
  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;font-weight:700;color:${BBW.textDark};">Hi ${name},</p>
    <p style="margin:0 0 22px;font:700 12px Arial,sans-serif;color:${BBW.pink};letter-spacing:.08em;text-transform:uppercase;">A Curvafit note</p>
    ${cParagraphs(copy)}
    ${promo ? cPromoBlock(promo.code, promo.percent, promo.items, 'Subscriber offer') : ''}
    ${cCTA('EXPLORE CURVAFIT', `${BASE_URL}/collections/curvafit-all-products.html`)}
    ${cDivider()}
    <p style="margin:0;font:13px/1.6 Arial,sans-serif;color:${BBW.textLight};text-align:center;">Browse whenever it suits you. No rush.</p>
    <div style="height:24px;"></div>`;
  return {
    subject: 'A practical note from Curvafit',
    html: masterTemplate({ preheader: 'Explore practical resources and selected fitness essentials.', tagline: 'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT', heroHeadline: `A LITTLE SUPPORT, <span style="color:${BBW.pink};">AT YOUR PACE.</span>`, heroSubline: 'USEFUL IDEAS FOR EVERYDAY ROUTINES.', bodyHTML, settings, showValueGrid: true }, env),
  };
}

async function composeContactReply(data, settings, env) {
  const { firstName, lastName, subject: msgSubject, category } = data;
  const name    = firstName || lastName || 'there';
  const copy    = await genContactReplyCopy(name, env);
  const support = (settings.contact_emails || {}).general || 'support@bbw4life.com';
  const whatsapp = (settings.contact || {}).whatsapp_url || 'https://wa.me/18292677434';

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Message Received ✅
    </p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:10px;background:${BBW.pinkPale};
                  border:1px solid rgba(93,60,144,0.12);">
      <tr>
        <td style="padding:20px;">
          <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:13px;
              font-weight:700;color:${BBW.textDark};">Your message details:</p>
          ${msgSubject ? `<p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textMid};"><strong>Subject:</strong> ${msgSubject}</p>` : ''}
          ${category   ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textMid};"><strong>Category:</strong> ${category}</p>` : ''}
        </td>
      </tr>
    </table>
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textLight};text-align:center;line-height:1.7;">
      Need urgent help?<br>
      <a href="mailto:${support}" style="color:${BBW.pink};font-weight:700;text-decoration:none;">${support}</a>
      &nbsp;·&nbsp;
      <a href="${whatsapp}" target="_blank" style="color:${BBW.pink};font-weight:700;text-decoration:none;">WhatsApp Us</a>
    </p>
    <div style="height:32px;"></div>`;

  return {
    subject: `We received your message — Curvafit Support ✅`,
    html: masterTemplate({
      preheader:    `Your message has been received — our team will respond within 24-48 hours.`,
      tagline:      'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT',
      heroHeadline: `MESSAGE <span style="color:${BBW.pink};">RECEIVED!</span>`,
      heroSubline:  'OUR TEAM WILL RESPOND WITHIN 24-48H.',
      bodyHTML,
      settings,
    }, env),
  };
}

// ── 10. Plan/Product Request ──────────────────────────────────
async function composePlanRequest(data, settings, env) {
  const BASE_URL = getBaseUrl(env);
  const { firstName, lastName, program, size, color } = data;
  const name = firstName || lastName || 'there';
  const copy = await genPlanRequestCopy(name, program, env);

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Request Received ✅
    </p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:12px;overflow:hidden;background:${BBW.black};">
      <tr>
        <td style="padding:24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:32px;">⏳</p>
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:15px;
              font-weight:700;color:#fff;">${program}</p>
          ${size  ? `<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.55);">Size: ${size}</p>` : ''}
          ${color ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.55);">Color: ${color}</p>` : ''}
          <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${BBW.goldL};">
            Our team will be in touch soon.
          </p>
        </td>
      </tr>
    </table>
    ${cCTA('BROWSE THE SHOP &nbsp;›', `${BASE_URL}/collections/curvafit-all-products.html`)}
    <div style="height:32px;"></div>`;

  return {
    subject: `Your Curvafit product request has been received! ⏳`,
    html: masterTemplate({
      preheader:    `We've received your request for ${program} — our team will review it soon.`,
      tagline:      'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT',
      heroHeadline: `WE'VE GOT YOUR <span style="color:${BBW.pink};">REQUEST!</span>`,
      heroSubline:  'OUR TEAM IS ON IT.',
      bodyHTML,
      settings,
    }, env),
  };
}

// ── 11. Custom Product Request ────────────────────────────────
async function composeCustomProduct(data, settings, env) {
  const BASE_URL = getBaseUrl(env);
  const { firstname, lastname, product_title, product_desc } = data;
  const name = firstname || lastname || 'there';
  const copy = await genCustomProductCopy(name, product_title, env);

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Design Request Received 🎨
    </p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:12px;overflow:hidden;background:${BBW.black};">
      <tr>
        <td style="padding:24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:32px;">🎨</p>
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:15px;
              font-weight:700;color:#fff;">${product_title || 'Your Custom Product'}</p>
          ${product_desc ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:12px;
              color:rgba(255,255,255,0.55);line-height:1.5;">${product_desc.substring(0, 100)}${product_desc.length > 100 ? '...' : ''}</p>` : ''}
          <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${BBW.goldL};">
            Our design team will review your idea.
          </p>
        </td>
      </tr>
    </table>
    ${cDivider()}
    <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textLight};text-align:center;line-height:1.7;">
      We evaluate every personalized product request carefully.<br>
      If your idea becomes a product, you'll be the first to know. 👑
    </p>
    ${cCTA('EXPLORE EXISTING PRODUCTS &nbsp;›', `${BASE_URL}/collections/curvafit-all-products.html`)}
    <div style="height:32px;"></div>`;

  return {
    subject: `Your personalized product request is with our design team! 🎨`,
    html: masterTemplate({
      preheader:    `Your custom product idea has been received — our design team is reviewing it.`,
      tagline:      'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT',
      heroHeadline: `THANK YOU FOR <span style="color:${BBW.pink};">YOUR IDEA.</span>`,
      heroSubline:  'OUR DESIGN TEAM IS REVIEWING IT.',
      bodyHTML,
      settings,
      showValueGrid: true,
    }, env),
  };
}

// ── 12. Abandoned Cart Recovery ───────────────────────────────
async function composeCartAbandoned(data, settings, env) {
  const baseUrl = getBaseUrl(env);
  const { firstName, lastName, items = [], promoCode, promoPercent, restartLink } = data;
  const name = firstName || lastName || 'there';
  const copy = await genCartAbandonedCopy(name, env);
  const itemsHTML = items.map(item => cOrderItem(item)).join('');
  const finalRestartLink = restartLink || `${baseUrl}/checkout/checkout.html`;
  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;font-weight:700;color:${BBW.textDark};">Hi ${name},</p>
    <p style="margin:0 0 22px;font:700 12px Arial,sans-serif;color:${BBW.pink};letter-spacing:.08em;text-transform:uppercase;">Your selected items</p>
    ${cParagraphs(copy)}
    ${itemsHTML ? `${cDivider()}<p style="margin:0 0 14px;font:700 15px Georgia,serif;color:${BBW.textDark};">Items you selected:</p>${itemsHTML}` : ''}
    ${promoCode ? cPromoBlock(promoCode, promoPercent || '', '', 'Discount offer') : ''}
    ${cCTA('REVIEW YOUR SELECTION', finalRestartLink)}
    <div style="height:24px;"></div>`;
  return {
    subject: 'Your Curvafit selection',
    html: masterTemplate({ preheader: 'Your selected items are listed below if you would like another look.', tagline: 'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT', heroHeadline: `TAKE ANOTHER LOOK <span style="color:${BBW.pink};">WHEN READY.</span>`, heroSubline: 'YOUR SELECTED ITEMS ARE LISTED BELOW.', bodyHTML, settings }, env),
  };
}

async function composeReviewResponse(data, settings, env) {
  const BASE_URL = getBaseUrl(env);
  const { firstName, title, text, productId } = data;
  const name        = firstName || 'there';
  const productName = await getProductName(productId, env) || productId;
  const sentiment   = detectSentiment(title, text);
  const promos      = settings.promos || [];
  const promo       = sentiment === 'positive' && promos.length
    ? promos[Math.floor(Math.random() * promos.length)]
    : null;

  const copy = await genReviewResponseCopy(name, title, text, productName, sentiment, promo, settings, env);

  const promoBlock = (sentiment === 'positive' && promo)
    ? cPromoBlock(promo.code, promo.percent, promo.items, 'Your Thank-You Gift')
    : '';

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      ${sentiment === 'positive' ? 'Thank You 💕' : "We're Sorry 💙"}
    </p>
    ${cParagraphs(copy)}
    ${promoBlock}
    ${sentiment === 'positive' ? cCTA('SHOP NOW &nbsp;›', `${BASE_URL}/collections/curvafit-all-products.html`) : ''}
    <div style="height:32px;"></div>`;

  const isPositive = sentiment === 'positive';
  return {
    subject: isPositive
      ? `Thank you for your review, ${name}! 💕 Here's a gift for you`
      : `We're truly sorry, ${name} — let's make this right 💙`,
    html: masterTemplate({
      preheader:   isPositive
        ? `Your review made our day — here's a little thank-you gift just for you.`
        : `We read your review and we want to make this right for you.`,
      tagline:      'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT',
      heroHeadline: isPositive
        ? `THANK YOU FOR <span style="color:${BBW.pink};">YOUR FEEDBACK.</span>`
        : `WE'RE TRULY <span style="color:${BBW.pink};">SORRY.</span>`,
      heroSubline:  isPositive
        ? 'THANK YOU FOR YOUR REVIEW.'
        : "YOUR EXPERIENCE MATTERS — LET'S FIX THIS.",
      bodyHTML,
      settings,
      showValueGrid: true,
    }, env),
  };
}

// ── 14. Story Submission Confirmation ─────────────────────────
async function composeStoryReceived(data, settings, env) {
  const BASE_URL = getBaseUrl(env);
  const { firstName, lastName } = data;
  const name = firstName || lastName || 'there';
  const copy = await genStoryReceivedCopy(name, env);
  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;font-weight:700;color:${BBW.textDark};">Hi ${name},</p>
    <p style="margin:0 0 22px;font:700 12px Arial,sans-serif;color:${BBW.pink};letter-spacing:.08em;text-transform:uppercase;">Submission received</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    ${cHighlightBox('01', 'Review process', 'Our team will review your submission. We will contact you before any publication.')}
    ${cCTA('CONTACT CURVAFIT', `${BASE_URL}/page/contact.html`)}
    <div style="height:24px;"></div>`;
  return {
    subject: 'We received your Curvafit submission',
    html: masterTemplate({ preheader: 'Your submission has been received for review.', tagline: 'PRACTICAL GUIDANCE - EVERYDAY MOVEMENT', heroHeadline: `THANK YOU FOR <span style="color:${BBW.pink};">SHARING.</span>`, heroSubline: 'WE HAVE RECEIVED YOUR MESSAGE.', bodyHTML, settings }, env),
  };
}

async function trySend(email, type, composeFn, sheets, sentLog, results, env, ...args) {
  if (!email || !email.includes('@')) {
    console.warn(`[trySend] Invalid email: "${email}"`);
    return false;
  }
  if (wasEmailSent(sentLog, email, type)) {
    results.skipped.push({ email, type, reason: 'already sent' });
    return false;
  }
  try {
    console.log(`[trySend] Composing ${type} for ${email}`);
    const { subject, html } = await composeFn(...args);
    const ok = await deliver(email, subject, html, env);
    if (ok) {
      await markEmailSent(sheets, email, type, env);
      sentLog.add(`${email.toLowerCase()}||${type}`);
      results.sent.push({ email, type });
    } else {
      results.errors.push({ email, type, reason: 'Resend delivery failed' });
    }
    return ok;
  } catch (e) {
    console.error(`[trySend] Error ${email}/${type}:`, e.message);
    results.errors.push({ email, type, reason: e.message });
    return false;
  }
}

// ════════════════════════════════════════════════════════════════
//  MAIN HANDLER
//  ⚠️ NOTE MIGRATION CLOUDFLARE : le handler unique Netlify (exports.handler)
//  dispatchait lui-même sur event.httpMethod (OPTIONS / POST trigger mode /
//  GET batch-scheduler mode). Sur Cloudflare Pages Functions, ce dispatch
//  est réparti dans onRequestOptions / onRequestPost / onRequestGet — la
//  logique interne de chaque branche reste strictement identique.
// ════════════════════════════════════════════════════════════════
const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
};

function res(statusCode, body) {
  return new Response(body === '' ? '' : JSON.stringify(body), { status: statusCode, headers: HEADERS });
}

export async function onRequestOptions() {
  return res(200, '');
}

// ── TRIGGER MODE (POST) ──────────────────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context;
  const results = { sent: [], skipped: [], errors: [] };

  try {
    const settings = await loadSettings(env);
    const sheets   = await getSheets(env);
    const sentLog  = await loadEmailLog(sheets, env);

    const bodyText = await request.text();
    if (!bodyText) {
      return res(405, { error: 'Method not allowed' });
    }
    const body    = JSON.parse(bodyText);
    const trigger = body.trigger;

    if (!trigger) {
      return res(400, { error: 'trigger required' });
    }

    console.log(`[Handler] Trigger: ${trigger}`);

    const email = body.email;
    if (!email || !email.includes('@')) {
      return res(400, { error: 'Valid email required' });
    }

    if (trigger === T.WELCOME) {
      await trySend(email, T.WELCOME, () => composeWelcome(body.firstName, settings, env), sheets, sentLog, results, env);
    }

    if (trigger === T.CONFIRM_ACCOUNT) {
      await trySend(email, T.CONFIRM_ACCOUNT,
        () => composeConfirmAccount(body, settings, env),
        sheets, sentLog, results, env);
    }

    if (trigger === T.ORDER_CONFIRM) {
      const dedupeType = `${T.ORDER_CONFIRM}_${body.orderId || Date.now()}`;
      await trySend(email, dedupeType,
        () => composeOrderConfirm(body, settings, env),
        sheets, sentLog, results, env);
    }

    if (trigger === T.EBOOK_ORDER_CONFIRM) {
      const dedupeType = `${T.EBOOK_ORDER_CONFIRM}_${body.orderId || Date.now()}`;
      await trySend(email, dedupeType,
        () => composeEbookOrderConfirm(body, settings, env),
        sheets, sentLog, results, env);
    }

    if (trigger === T.ORDER_TRACKING) {
      await trySend(email, T.ORDER_TRACKING,
        () => composeOrderTracking(body, settings, env),
        sheets, sentLog, results, env);
    }

    if (trigger === T.NEWSLETTER_1) {
      await trySend(email, T.NEWSLETTER_1,
        () => composeNewsletter1(body.firstName, settings, env),
        sheets, sentLog, results, env);
    }

    if (trigger === T.NEWSLETTER_2) {
      await trySend(email, T.NEWSLETTER_2,
        () => composeNewsletter2(body.firstName, settings, env),
        sheets, sentLog, results, env);
    }

    if (trigger === T.NEWSLETTER_3) {
      await trySend(email, T.NEWSLETTER_3,
        () => composeNewsletter3(body.firstName, settings, env),
        sheets, sentLog, results, env);
    }

    if (trigger === T.NEWSLETTER_4_BUYER) {
      await trySend(email, T.NEWSLETTER_4_BUYER,
        () => composeNewsletter4Buyer(body.firstName, settings, env),
        sheets, sentLog, results, env);
    }

    if (trigger === T.NEWSLETTER_4_NEW) {
      await trySend(email, T.NEWSLETTER_4_NEW,
        () => composeNewsletter4New(body.firstName, settings, env),
        sheets, sentLog, results, env);
    }

    if (trigger === T.CONTACT_REPLY) {
      await trySend(email, T.CONTACT_REPLY,
        () => composeContactReply(body, settings, env),
        sheets, sentLog, results, env);
    }

    if (trigger === T.PLAN_REQUEST) {
      await trySend(email, T.PLAN_REQUEST,
        () => composePlanRequest(body, settings, env),
        sheets, sentLog, results, env);
    }

    if (trigger === T.CUSTOM_PRODUCT) {
      await trySend(email, T.CUSTOM_PRODUCT,
        () => composeCustomProduct(body, settings, env),
        sheets, sentLog, results, env);
    }

    if (trigger === T.CART_ABANDONED) {
      const dedupeType = `${T.CART_ABANDONED}_${body.orderId || Date.now()}`;
      await trySend(email, dedupeType,
        () => composeCartAbandoned(body, settings, env),
        sheets, sentLog, results, env);
    }

    if (trigger === T.STORY_RECEIVED) {
      await trySend(email, T.STORY_RECEIVED,
        () => composeStoryReceived(body, settings, env),
        sheets, sentLog, results, env);
    }

    if (trigger === T.REVIEW_RESPONSE) {
      await trySend(email, T.REVIEW_RESPONSE,
        () => composeReviewResponse(body, settings, env),
        sheets, sentLog, results, env);
    }

    // ── Password reset : même chemin que CART_ABANDONED (trySend avec un
    // type unique par requête via timestamp) pour ne jamais être bloqué
    // par le dédoublonnage tout en réutilisant le chemin d'envoi éprouvé
    // utilisé par tous les autres triggers. ──
    if (trigger === T.PASSWORD_RESET) {
      const dedupeType = `${T.PASSWORD_RESET}_${Date.now()}`;
      await trySend(email, dedupeType,
        () => composePasswordReset(body, settings, env),
        sheets, sentLog, results, env);
    }

    return res(200, { success: true, trigger, results });

  } catch (fatal) {
    console.error('[Handler] Fatal error:', fatal.message, fatal.stack);
    return res(500, { success: false, error: fatal.message });
  }
}

// ── BATCH / SCHEDULER MODE (GET) ─────────────────────────────
export async function onRequestGet(context) {
  const { request, env } = context;
  const results = { sent: [], skipped: [], errors: [] };

  try {
    const settings = await loadSettings(env);
    const sheets   = await getSheets(env);
    const sentLog  = await loadEmailLog(sheets, env);

    const params = new URL(request.url).searchParams;

    if (params.get('action') === 'tracking') {
      const secret = params.get('secret');
      if (secret !== env.REPORT_SECRET) {
        return res(401, { error: 'Unauthorized' });
      }
      const trackResult = await runTrackingChecker(sheets, settings, env);
      return res(200, { success: true, ...trackResult });
    }

    if (params.get('action') === 'process-queue') {
      const secret = params.get('secret');
      if (secret !== env.REPORT_SECRET) {
        return res(401, { error: 'Unauthorized' });
      }
      const queueResult = await runEmailQueueProcessor(sheets, sentLog, settings, env);
      return res(200, { success: true, ...queueResult });
    }

    // ── Newsletter batch (existant) ──
    console.log('[Handler] Batch newsletter sequence mode');

    const accountRows = await sheetRead(
      sheets,
      env.SHEET_ID_CURVAFIT_ACCOUNTS,
      'curvafit-accounts!A:I'
    );

    console.log(`[Batch] ${accountRows.length} account rows`);

    for (const row of accountRows) {
      const lastName   = (row[0] || '').trim();
      const firstName  = (row[1] || '').trim();
      const email      = (row[2] || '').trim();
      const newsletter = (row[5] || '').trim().toLowerCase();
      const orders     = parseInt(row[6] || 0, 10);

      if (!email || !email.includes('@')) continue;

      const name = firstName || lastName || 'there';

      if (newsletter === 'yes') {
        if (!wasEmailSent(sentLog, email, T.NEWSLETTER_1)) {
          await trySend(email, T.NEWSLETTER_1,
            () => composeNewsletter1(name, settings, env),
            sheets, sentLog, results, env);
          await sleep(500); continue;
        }
        if (!wasEmailSent(sentLog, email, T.NEWSLETTER_2)) {
          await trySend(email, T.NEWSLETTER_2,
            () => composeNewsletter2(name, settings, env),
            sheets, sentLog, results, env);
          await sleep(500); continue;
        }
        if (!wasEmailSent(sentLog, email, T.NEWSLETTER_3)) {
          await trySend(email, T.NEWSLETTER_3,
            () => composeNewsletter3(name, settings, env),
            sheets, sentLog, results, env);
          await sleep(500); continue;
        }

        if (!wasEmailSent(sentLog, email, T.NEWSLETTER_4_BUYER) &&
            !wasEmailSent(sentLog, email, T.NEWSLETTER_4_NEW)) {
          if (orders > 0) {
            await trySend(email, T.NEWSLETTER_4_BUYER,
              () => composeNewsletter4Buyer(name, settings, env),
              sheets, sentLog, results, env);
          } else {
            await trySend(email, T.NEWSLETTER_4_NEW,
              () => composeNewsletter4New(name, settings, env),
              sheets, sentLog, results, env);
          }
          await sleep(500);
        }
      }
    }

    const summary = {
      sent:    results.sent.length,
      skipped: results.skipped.length,
      errors:  results.errors.length,
    };
    console.log(`[Batch] Done — sent:${summary.sent} skipped:${summary.skipped} errors:${summary.errors}`);

    return res(200, { success: true, summary, results });

  } catch (fatal) {
    console.error('[Handler] Fatal error:', fatal.message, fatal.stack);
    return res(500, { success: false, error: fatal.message });
  }
}
