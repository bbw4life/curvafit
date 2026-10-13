// functions/reply-contact-message.js
// ⚠️ SCHEDULED FUNCTION — Netlify : [functions.reply-contact-message]
// schedule = "*/5 * * * *". Cron Trigger Cloudflare câblé séparément.
const { Resend } = require('resend');
const { google } = require('googleapis');
const { notifyCustomerTelegram } = require('./_lib/telegram-broadcast');
const { getGoogleAuthClient } = require('./_lib/google-auth');

function getBaseUrl(env)   { return env.BASE_URL   || 'https://bbw4life.com'; }
function getFromEmail(env) { return env.FROM_EMAIL || 'Curvafit <hello@bbw4life.com>'; }

// ⚠️ Anciens modèles tous décommissionnés par Groq (confirmé via /v1/models
// — même problème que send-email-auto.js). qwen/qwen3.8-27b est le seul
// modèle texte actuel fiable (ne tronque pas sa réponse comme les gpt-oss-*,
// qui sont des modèles "reasoning" consommant max_tokens sur un raisonnement
// caché avant le texte final).
const GROQ_MODELS = [
  'qwen/qwen3.8-27b',
];
let modelIdx = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Brand colors ───────────────────────────────────────────────
const BBW = {
  pink: '#e84387', pinkDark: '#bd3475', pinkLight: '#f6d9eb', pinkPale: '#fbf3fa',
  black: '#32165f', darkBg: '#28124d', white: '#ffffff', offWhite: '#f7f3fb',
  textDark: '#2d2140', textMid: '#5e526c', textLight: '#837991',
  gold: '#9a78c7', goldL: '#c6a8ed',
};

// ── Base CSS ───────────────────────────────────────────────────
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

const SUPPORT_SYSTEM_PROMPT = `You write clear, considerate customer-support emails for Curvafit, a brand offering practical movement guides and selected fitness essentials.

RULES:
1. Write only the email body, with no subject line or commentary.
2. Use support notes as the sole source of case-specific facts. Never invent an outcome, refund, delivery date, policy, or promise.
3. Keep the response focused, warm, professional, and human.
4. Use short paragraphs and natural contractions. No markdown or bullet points.
5. Address the customer by first name when provided and sign off as the Curvafit Support Team.
6. Keep the message specific to Curvafit resources and customer support.`;

// ── Groq ───────────────────────────────────────────────────────
async function callGroq(userPrompt, env) {
  for (let attempt = 0; attempt < GROQ_MODELS.length; attempt++) {
    const idx   = (modelIdx + attempt) % GROQ_MODELS.length;
    const model = GROQ_MODELS[idx];
    for (let retry = 1; retry <= 2; retry++) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GROQ_API_KEY}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: SUPPORT_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt }
            ],
            max_tokens:  500,
            temperature: 0.60,
            top_p:       0.88,
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

// ── Cascade IA — Anthropic (Claude) → Google (Gemini) → Groq ──
// Même stratégie que send-email-auto.js et chat.js : on essaie le
// fournisseur principal, et on tombe sur le suivant à la moindre erreur.
const CLAUDE_MODEL_SUPPORT = 'claude-haiku-4-5-20251001';
const GEMINI_MODEL_SUPPORT = 'gemini-3.5-flash-lite';

async function callClaudeForSupport(userPrompt, env) {
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
        model: CLAUDE_MODEL_SUPPORT,
        max_tokens: 500,
        temperature: 0.60,
        system: SUPPORT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    if (!res.ok) {
      console.warn(`[Claude] HTTP ${res.status} for support reply`);
      return null;
    }
    const data    = await res.json();
    const content = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return content.length >= 20 ? content : null;
  } catch (e) {
    console.warn('[Claude] Error for support reply:', e.message);
    return null;
  }
}

async function callGeminiForSupport(userPrompt, env) {
  if (!env.GOOGLE_AI_API_KEY) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_SUPPORT}:generateContent?key=${env.GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: SUPPORT_SYSTEM_PROMPT }] },
          generationConfig: { maxOutputTokens: 500, temperature: 0.60 }
        })
      }
    );
    if (!res.ok) {
      console.warn(`[Gemini] HTTP ${res.status} for support reply`);
      return null;
    }
    const data    = await res.json();
    const content = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    return content.length >= 20 ? content : null;
  } catch (e) {
    console.warn('[Gemini] Error for support reply:', e.message);
    return null;
  }
}

async function callAI(userPrompt, env) {
  const claudeReply = await callClaudeForSupport(userPrompt, env);
  if (claudeReply) return claudeReply;

  const geminiReply = await callGeminiForSupport(userPrompt, env);
  if (geminiReply) return geminiReply;

  return callGroq(userPrompt, env);
}

// ── Sheets ─────────────────────────────────────────────────────
async function getSheets(env) {
  const auth = await getGoogleAuthClient(env);
  return google.sheets({ version: 'v4', auth });
}

// ── Settings ───────────────────────────────────────────────────
async function loadSettings(env) {
  try {
    const res  = await fetch(`${getBaseUrl(env)}/products.data.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const arr  = Array.isArray(data) ? data : [];
    return arr.find(p => p.type === 'settings') || {};
  } catch (e) {
    console.warn('[Settings] Failed to load:', e.message);
    return {};
  }
}

// ── Social icons ───────────────────────────────────────────────
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

// ── CEO Footer ─────────────────────────────────────────────────
function buildCEOFooter(settings, env) {
  const baseUrl = getBaseUrl(env);
  const support = (settings.contact_emails || {}).general || 'support@bbw4life.com';
  const whatsapp = (settings.contact || {}).whatsapp_url || 'https://wa.me/18292677434';
  return `
<tr><td style="padding:0;background:#f3eef9;border-top:1px solid #e7ddef;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td style="padding:28px 28px 8px;text-align:center;">
      <p style="margin:0;font-family:Arial,sans-serif;font-size:23px;font-weight:800;letter-spacing:.13em;color:${BBW.black};">CURVA<span style="color:${BBW.pink};">FIT</span></p>
      <p style="margin:9px 0 0;font:13px/1.6 Arial,sans-serif;color:${BBW.textMid};">Practical guidance for movement and everyday wellbeing, at your pace.</p>
      <p style="margin:7px 0 0;font:11px/1.5 Arial,sans-serif;color:${BBW.textLight};">Support from the team of Pdg Francenel</p>
    </td></tr>
    <tr><td style="padding:8px 20px 16px;text-align:center;">${buildSocialIcons(settings)}
      <p style="margin:12px 0 0;font:12px/1.8 Arial,sans-serif;color:${BBW.textMid};"><a href="mailto:${support}" style="color:${BBW.black};">${support}</a> &nbsp;|&nbsp; <a href="${whatsapp}" style="color:${BBW.black};">WhatsApp support</a></p>
    </td></tr>
    <tr><td style="padding:14px 20px 20px;text-align:center;border-top:1px solid #e3d9ee;">
      <p style="margin:0;font:11px/1.7 Arial,sans-serif;color:${BBW.textLight};">You are receiving this message because you contacted Curvafit support.</p>
      <p style="margin:8px 0 0;font:11px/2 Arial,sans-serif;color:${BBW.textMid};"><a href="${baseUrl}/collections/curvafit-all-products.html" style="color:${BBW.textMid};text-decoration:none;">Explore Curvafit</a> &nbsp;|&nbsp; <a href="${baseUrl}/policies/privacy.html" style="color:${BBW.textMid};text-decoration:none;">Privacy</a> &nbsp;|&nbsp; <a href="${baseUrl}/page/contact.html" style="color:${BBW.textMid};text-decoration:none;">Contact</a> &nbsp;|&nbsp; <a href="${baseUrl}/policies/refund.html" style="color:${BBW.textMid};text-decoration:none;">Returns</a></p>
      <p style="margin:8px 0 0;font:10px Arial,sans-serif;color:#9d92a9;">&copy; ${new Date().getFullYear()} Curvafit. All rights reserved.</p>
    </td></tr>
  </table>
</td></tr>`;
}

function buildEmailHTML(subjectResp, aiBody, settings, env) {
  const heroImg = `${getBaseUrl(env)}/img/curva-banner-2.png`;

  const logoHTML = `
<p style="margin:0;font-family:Georgia,serif;font-size:48px;font-weight:700;
    color:${BBW.white};letter-spacing:0.02em;line-height:1;">
  CURVA<span style="color:${BBW.pink};">FIT</span>
</p>
<div style="width:60px;height:2px;background:${BBW.pink};margin:10px 0 16px;"></div>`;

  const bodyParagraphs = aiBody.split('\n').filter(p => p.trim()).map(p =>
    `<p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;color:${BBW.textMid};line-height:1.75;">${p}</p>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Curvafit Support</title>
  <style>${BASE_CSS}</style>
</head>
<body style="margin:0;padding:0;background-color:#f5f1fa;">

<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f5f1fa;line-height:1px;">
  ${subjectResp} — Curvafit Support&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;
</div>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background:#f5f1fa;padding:24px 16px;">
  <tr><td align="center">
    <table class="ew" width="600" cellpadding="0" cellspacing="0" role="presentation"
           style="max-width:600px;width:100%;border:1px solid #e7ddef;border-radius:18px;overflow:hidden;background:#ffffff;
                  box-shadow:0 16px 48px rgba(93,60,144,0.12);">

      <!-- HEADER -->
      <tr>
        <td style="background:${BBW.black};padding:0;position:relative;">

          <!-- Tagline strip -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="padding:12px 32px 0;text-align:center;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;
                    color:rgba(255,255,255,0.55);letter-spacing:0.20em;text-transform:uppercase;">
                  PRACTICAL GUIDANCE - EVERYDAY MOVEMENT &nbsp;♥
                </p>
              </td>
            </tr>
          </table>

          <!-- Hero: Logo left + Image right -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <!-- Left: Logo + Headline -->
              <td class="hero-txt" width="55%" style="padding:20px 24px 0 32px;vertical-align:bottom;">
                ${logoHTML}
                <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;
                    font-weight:700;color:${BBW.white};letter-spacing:0.04em;text-transform:uppercase;">
                  SUPPORT <span style="color:${BBW.pink};">RESPONSE.</span>
                </p>
                <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:13px;
                    font-weight:700;color:rgba(255,255,255,0.75);letter-spacing:0.04em;text-transform:uppercase;">
                  WE'RE HERE FOR YOU.
                </p>
              </td>
              <!-- Right: Hero image -->
              ${heroImg ? `
              <td class="hero-img" width="45%" style="padding:0;vertical-align:bottom;text-align:right;">
                <img src="${heroImg}" alt="Curvafit everyday movement" width="260"
                     style="width:260px;max-width:260px;height:auto;display:block;
                            border-radius:0;object-fit:cover;object-position:top center;">
              </td>` : `<td width="45%"></td>`}
            </tr>
          </table>

          <!-- Wave SVG transition noir → blanc -->
          <div style="line-height:0;font-size:0;display:block;overflow:hidden;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 48" width="600" height="48"
                 style="display:block;width:100%;height:auto;" preserveAspectRatio="none">
              <path d="M0,0 C150,48 450,0 600,32 L600,48 L0,48 Z" fill="${BBW.pink}" opacity="0.9"/>
              <path d="M0,16 C200,48 400,8 600,40 L600,48 L0,48 Z" fill="${BBW.white}"/>
            </svg>
          </div>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td class="ep" style="background:${BBW.white};padding:36px 40px 36px;">
          ${bodyParagraphs}
          <div style="height:8px;"></div>
        </td>
      </tr>

      <!-- CEO FOOTER -->
      ${buildCEOFooter(settings, env)}

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Resend ─────────────────────────────────────────────────────
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
//  HANDLER
//  ⚠️ SCHEDULED FUNCTION — Cron Trigger Cloudflare câblé séparément.
// ════════════════════════════════════════════════════════════════
export async function onRequestGet(context) {
  const { env } = context;
  console.log('[reply-contact-message] Starting — ' + new Date().toISOString());

  try {
    const sheets        = await getSheets(env);
    const spreadsheetId = env.SHEET_ID_CURVAFIT_ACCOUNTS;
    const SHEET         = 'curvafit-contact-messages';
    const settings      = await loadSettings(env);

    const res  = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET}!A:J`
    });
    const rows = res.data.values || [];

    if (rows.length <= 1) {
      console.log('[reply-contact-message] No rows found');
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    let processed = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      const firstName       = row[0] || '';
      const lastName        = row[1] || '';
      const email           = row[2] || '';
      const originalSubject = row[3] || '';
      const category        = row[4] || '';
      const message         = row[5] || '';
      const subjectResp     = (row[7] !== undefined ? row[7] : '').trim();
      const response        = (row[8] !== undefined ? row[8] : '').trim();
      const repliedAt       = (row[9] !== undefined ? row[9] : '').trim();

      if (!subjectResp || !response) continue;
      if (repliedAt && !repliedAt.startsWith('pending:')) continue;
      if (!email || !email.includes('@')) continue;

      console.log(`[reply-contact-message] Processing row ${i + 1} — ${email} — repliedAt: "${repliedAt}"`);

      if (!repliedAt) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range:            `${SHEET}!J${i + 1}`,
          valueInputOption: 'RAW',
          resource:         { values: [[`pending:${new Date().toISOString()}`]] }
        });
        console.log(`[reply-contact-message] Row ${i + 1} — marked as pending, will send in 2min`);
        await sleep(500);
        continue;
      }

      if (repliedAt.startsWith('pending:')) {
        const pendingTime         = new Date(repliedAt.replace('pending:', ''));
        const minutesSincePending = (Date.now() - pendingTime.getTime()) / (1000 * 60);

        if (minutesSincePending < 30) {
          console.log(`[reply-contact-message] Row ${i + 1} — pending since ${minutesSincePending.toFixed(1)} min, waiting`);
          await sleep(500);
          continue;
        }

        console.log(`[reply-contact-message] Row ${i + 1} — ${minutesSincePending.toFixed(1)} min elapsed, sending to ${email}`);

        const aiPrompt = `You are replying to a customer support message for Curvafit. Use only the supplied support notes; do not invent policy, outcomes, delivery dates, or promises. Keep the answer clear, calm, and focused.

CUSTOMER: ${firstName} ${lastName}
ORIGINAL SUBJECT: ${originalSubject}
CATEGORY: ${category}
CUSTOMER MESSAGE: ${message}

RESPONSE SUBJECT: ${subjectResp}
SUPPORT TEAM NOTES: ${response}

Write a warm, professional email body. Use ONLY the support notes as your basis. Do not add anything not mentioned in the notes. Address the customer by first name. Keep it focused and on-topic.`;

        const aiBody = await callAI(aiPrompt, env) || response;
        const html   = buildEmailHTML(subjectResp, aiBody, settings, env);
        const ok     = await deliver(email, subjectResp, html, env);

        if (ok) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range:            `${SHEET}!J${i + 1}`,
            valueInputOption: 'RAW',
            resource:         { values: [[`sent:${new Date().toISOString()}`]] }
          });
          console.log(`[reply-contact-message] ✅ Reply sent to ${email}`);
          processed++;

          // ── Telegram : avertir le client qu'on lui a répondu (best effort) ──
          notifyCustomerTelegram(
            email,
            (accountFirstName) =>
              `${accountFirstName}, we heard you! 💬\n\n` +
              `<b>You got a reply from Curvafit!</b>\n` +
              `Re: <b>${subjectResp}</b>\n\n` +
              `Check your email for our full reply — we've sent it to ${email}.`,
            undefined,
            env
          ).catch(e => console.warn('[reply-contact-message] Telegram notify failed:', e.message));
        }

        await sleep(500);
      }
    }

    console.log(`[reply-contact-message] Done — processed: ${processed}`);
    return new Response(JSON.stringify({ success: true, processed }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[reply-contact-message] ERROR:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
