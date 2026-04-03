// netlify/functions/send-email-auto.js
// ══════════════════════════════════════════════════════════════════════════════
//  CurvaFit — Professional Automated Email Marketing System
//  ─────────────────────────────────────────────────────────
//  • Google Sheets → reads accounts, reviews, orders, plans
//  • Groq AI       → generates professional, on-brand email copy
//  • Resend        → delivers beautiful HTML emails
//  • Smart logic   → deduplication, context-aware, no spam
// ══════════════════════════════════════════════════════════════════════════════

const { google } = require('googleapis');
const { Resend }  = require('resend');

// ── ENVIRONMENT ──────────────────────────────────────────────────────────────
const SITE_URL   = process.env.SITE_URL || 'https://curvafit.com';
const FROM_EMAIL = 'CurvaFit <hello@paulcurvafit.com>';

// ── GROQ MODELS — SEPARATE POOL FROM chat.js ─────────────────────────────────
const EMAIL_MODELS = [
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
let modelIdx = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── EMAIL TYPES ───────────────────────────────────────────────────────────────
const T = {
  WELCOME:       'welcome',
  NEWSLETTER:    'newsletter',
  REVIEW_THANKS: 'review_thanks',
  CART_ABANDON:  'abandoned_cart',
};

// ── FEATURED PRODUCTS for promo emails ───────────────────────────────────────
const PRODUCTS = [
  {
    title:    'Smart Hula Hoop — Waist Burner',
    price:    '$63.46',
    oldPrice: '$148.99',
    badge:    'Best Seller',
    url:      `${SITE_URL}/products/product1.html`,
    image:    'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/image_produit_first.webp?v=1774271069',
  },
  {
    title:    'Plus Size Waist Trainer — S to 6XL',
    price:    '$34.99',
    oldPrice: '$54.99',
    badge:    'In Promotion',
    url:      `${SITE_URL}/products/product2.html`,
    image:    'https://cdn.shopify.com/s/files/1/0643/8263/2041/files/big_style_3.webp?v=1771457384',
  },
  {
    title:    'Shock-Absorbing Sports Bra — S to 5XL',
    price:    '$24.99',
    oldPrice: '$44.99',
    badge:    'Top Rated',
    url:      `${SITE_URL}/products/product7.html`,
    image:    'https://cdn.shopify.com/s/files/1/0643/8263/2041/files/big_style.webp?v=1771457385',
  },
  {
    title:    'High Waist Yoga Pants — Peach Lift',
    price:    '$16.99',
    oldPrice: '$28.99',
    badge:    'Top Sale',
    url:      `${SITE_URL}/products/product4.html`,
    image:    'https://cdn.shopify.com/s/files/1/0643/8263/2041/files/band_1.webp?v=1771462321',
  },
];

const PROMOS = [
  { code: 'CURVA15',    label: '20% off — 4 items or more' },
  { code: 'FITNESS25',  label: '25% off — 5 items or more' },
  { code: 'PAUL81',     label: '40% off — 10 items or more' },
  { code: 'BUNDLEFREE', label: '30% off — 6 items or more' },
];

// ════════════════════════════════════════════════════════════════════════════
//  GROQ — PROFESSIONAL AI COPY GENERATION
//  Strict system prompt + detailed per-type prompts
// ════════════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are the senior email copywriter for CurvaFit — a premium fitness and wellness brand built exclusively for curvy, plus-size women who are serious about their transformation journey.

BRAND VOICE:
- Warm, empowering, and deeply human — like a best friend who genuinely believes in you
- Never condescending, never clinical, never robotic
- Celebrates real bodies, real progress, real women
- Confident and aspirational without being pushy
- Uses natural feminine energy — not toxic positivity

WRITING RULES — NON-NEGOTIABLE:
1. Write ONLY the requested content — no subject lines, no greetings, no sign-offs unless asked
2. NO bullet points, NO markdown, NO asterisks, NO hashtags
3. Maximum 3 sentences per paragraph
4. Every sentence must feel intentional and earned — no filler phrases
5. NEVER use: "embark on", "unleash", "game-changer", "journey to success", "transform your life overnight"
6. ALWAYS use: conversational contractions (you're, we're, it's), sensory language, emotional truth
7. Match the specific email type exactly — do not mix tones or add unsolicited content

OUTPUT: Plain text only. No formatting. No line breaks unless specifically instructed to separate paragraphs with a blank line.`;

async function callGroq(userPrompt) {
  for (let attempt = 0; attempt < EMAIL_MODELS.length; attempt++) {
    const idx   = (modelIdx + attempt) % EMAIL_MODELS.length;
    const model = EMAIL_MODELS[idx];

    for (let retry = 1; retry <= 2; retry++) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method:  'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user',   content: userPrompt },
            ],
            max_tokens:  500,
            temperature: 0.68,
            top_p:       0.92,
          }),
        });

        if (res.status === 429) {
          if (retry < 2) { await sleep(1800); continue; }
          modelIdx = (idx + 1) % EMAIL_MODELS.length;
          break;
        }

        if (!res.ok) { console.warn(`[Groq] HTTP ${res.status} on ${model}`); break; }

        const data    = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim() || '';
        if (content.length < 30) break;

        modelIdx = idx;
        return content;

      } catch (e) {
        console.warn(`[Groq] Fetch error on ${model} retry ${retry}:`, e.message);
        if (retry < 2) { await sleep(900); continue; }
        break;
      }
    }
  }
  return null;
}

async function generateWelcomeCopy(firstName) {
  const prompt = `EMAIL TYPE: Welcome email — new CurvaFit customer just created their account.
RECIPIENT FIRST NAME: ${firstName}

Write exactly 2 short paragraphs separated by a blank line:
- Paragraph 1 (2 sentences): Make her feel genuinely seen and celebrated for taking this step. Reference that CurvaFit was built for her body right now, not a body she's trying to reach.
- Paragraph 2 (2 sentences): Tell her what's waiting (the shop, the programs, the community). End with one warm encouraging line that feels personal and real.

Output: 2 paragraphs, plain text only, no greetings, no sign-off.`;

  return await callGroq(prompt)
    || `You just made a decision that thousands of women told themselves they'd make "someday" — and you made it today. CurvaFit was built for women exactly like you: real bodies, real goals, and no time for programs that weren't designed with you in mind.\n\nEverything you need is already here — products that work, programs that fit, and a community of women who genuinely get it. We're so glad you're here.`;
}

async function generateNewsletterCopy(firstName) {
  const name  = firstName || 'Beautiful';
  const prompt = `EMAIL TYPE: Newsletter subscription confirmation.
RECIPIENT: ${name}

Write exactly 1 paragraph (2-3 sentences):
- Confirm their subscription warmly without being dramatic
- Mention they'll receive: exclusive deals, wellness tips, new arrivals, and real success stories from curvy women
- End with one line of genuine excitement about what's coming

Output: 1 paragraph, plain text only, no greeting, no sign-off.`;

  return await callGroq(prompt)
    || `You're officially on the inside now — and that means something real. Every week you'll get exclusive deals before anyone else, practical wellness tips built for curvy women, and honest stories from women in our community who show up for themselves every day. Good things are heading your way.`;
}

async function generateReviewThanksCopy(firstName) {
  const name  = firstName || 'Beautiful';
  const prompt = `EMAIL TYPE: Thank-you email after a customer submitted a product review.
RECIPIENT: ${name}

Write exactly 2 short paragraphs separated by a blank line:
- Paragraph 1 (2 sentences): Thank her sincerely. Explain specifically why her review matters — not to the brand, but to the next woman reading it before deciding.
- Paragraph 2 (1-2 sentences): Tell her that as a thank-you, she has an exclusive offer waiting below. Keep it warm, not salesy.

Output: 2 paragraphs, plain text only, no greeting, no sign-off, no mention of specific codes.`;

  return await callGroq(prompt)
    || `Your review matters more than you might realize — every honest word you wrote will help another woman decide whether CurvaFit is the right fit for her, and that kind of impact is something we never take lightly. Thank you for taking the time to share your real experience with our community.\n\nAs a small thank-you from us, we've put together something exclusive just for you — because women who give deserve to receive too.`;
}

async function generateCartCopy(firstName, cartQty) {
  const name  = firstName || 'Beautiful';
  const prompt = `EMAIL TYPE: Abandoned cart recovery email.
RECIPIENT: ${name}
ITEMS LEFT IN CART: ${cartQty}

Write exactly 2 short paragraphs separated by a blank line:
- Paragraph 1 (2 sentences): Remind her warmly that she left ${cartQty} item${cartQty > 1 ? 's' : ''} in her cart. Sound like a caring friend giving a gentle nudge — NOT desperate or salesy.
- Paragraph 2 (1-2 sentences): Create light urgency — hint that stock moves fast and her cart won't last forever. Mention there's a special offer below to make finishing easy.

Output: 2 paragraphs, plain text only, no greeting, no sign-off.`;

  return await callGroq(prompt)
    || `You left ${cartQty} item${cartQty > 1 ? 's' : ''} behind — and we completely understand, life gets busy sometimes. But we didn't want you to miss out on something you clearly already loved enough to add to your cart.\n\nStock on some of these moves fast, and your saved cart won't last forever. We've added something special below to make it easier to finish what you started.`;
}

// ════════════════════════════════════════════════════════════════════════════
//  PREMIUM EMAIL DESIGN SYSTEM
//  – Cinzel + DM Sans typography (Google Fonts)
//  – Dark gradient header (3 variants)
//  – Glassmorphism promo block
//  – Product cards with badge, price, discount %, CTA
//  – 4-card feature grid (newsletter)
//  – Responsive 600px container
// ════════════════════════════════════════════════════════════════════════════

const BASE_CSS = `
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  body{margin:0!important;padding:0!important;background-color:#f4f0f8}
  a{color:inherit}
  @media only screen and (max-width:620px){
    .ew{width:100%!important;border-radius:0!important}
    .ep{padding:28px 20px!important}
    .eh1{font-size:26px!important;line-height:1.2!important}
    .ehide{display:none!important;max-height:0!important;overflow:hidden!important}
    .egrid td{display:block!important;width:100%!important;padding:0 0 12px!important}
  }
`;

const GRAD = {
  purple: 'background:linear-gradient(145deg,#1a0533 0%,#6b21a8 45%,#a855f7 75%,#ec4899 100%)',
  rose:   'background:linear-gradient(145deg,#1a0020 0%,#86198f 40%,#db2777 70%,#f97316 100%)',
  dark:   'background:linear-gradient(145deg,#0f0f23 0%,#1e1b4b 40%,#4c1d95 70%,#7c3aed 100%)',
};

function cProductCard(p, code) {
  const disc = Math.round((1 - parseFloat(p.price.replace('$','')) / parseFloat(p.oldPrice.replace('$',''))) * 100);
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
  style="margin-bottom:12px;border-radius:16px;overflow:hidden;background:#fff;border:1px solid #ede9fe;box-shadow:0 2px 12px rgba(109,40,217,0.07);">
  <tr>
    <td width="110" style="padding:0;vertical-align:top;">
      <a href="${p.url}" target="_blank">
        <img src="${p.image}" width="110" height="110"
             style="display:block;width:110px;height:110px;object-fit:cover;border-radius:16px 0 0 16px;"
             alt="${p.title}">
      </a>
    </td>
    <td style="padding:14px 16px;vertical-align:middle;">
      <span style="display:inline-block;padding:2px 10px;border-radius:20px;background:linear-gradient(90deg,#7c3aed,#db2777);font-family:'DM Sans',Arial,sans-serif;font-size:10px;font-weight:700;color:#fff;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">${p.badge}</span>
      <p style="margin:0 0 5px;font-family:'Cinzel',Georgia,serif;font-size:13px;font-weight:700;color:#1e1b4b;line-height:1.3;">${p.title}</p>
      <p style="margin:0 0 10px;">
        <span style="font-family:'DM Sans',Arial,sans-serif;font-size:16px;font-weight:800;color:#7c3aed;">${p.price}</span>
        <span style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#9ca3af;text-decoration:line-through;margin-left:6px;">${p.oldPrice}</span>
        <span style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:700;color:#db2777;margin-left:6px;">&#8722;${disc}%</span>
      </p>
      ${code ? `<p style="margin:0 0 10px;display:inline-block;padding:4px 10px;border-radius:8px;background:#fdf4ff;border:1.5px dashed #a855f7;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#6b21a8;">Code: <strong>${code}</strong></p>` : ''}
      <a href="${p.url}" target="_blank"
         style="display:inline-block;padding:8px 20px;border-radius:20px;background:linear-gradient(135deg,#7c3aed,#db2777);font-family:'DM Sans',Arial,sans-serif;font-size:12px;font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.02em;">
        Shop Now &rarr;
      </a>
    </td>
  </tr>
</table>`;
}

function cPromoBlock(code, label, tagline) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
  style="margin:28px 0;border-radius:20px;overflow:hidden;background:linear-gradient(135deg,#1e1b4b 0%,#4c1d95 50%,#6b21a8 100%);">
  <tr>
    <td style="padding:28px 32px;text-align:center;">
      <p style="margin:0 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.15em;">${tagline}</p>
      <p style="margin:0 0 4px;font-family:'Cinzel',Georgia,serif;font-size:36px;font-weight:700;color:#fff;letter-spacing:0.12em;">${code}</p>
      <p style="margin:0 0 16px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.75);">${label}</p>
      <div style="width:48px;height:2px;background:linear-gradient(90deg,#a855f7,#ec4899);margin:0 auto;border-radius:2px;"></div>
    </td>
  </tr>
</table>`;
}

function cDivider() {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0;">
  <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#ede9fe,transparent);"></td></tr>
</table>`;
}

function cCTA(label, url) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:32px 0 8px;">
  <tr>
    <td align="center">
      <a href="${url}" target="_blank"
         style="display:inline-block;padding:17px 52px;border-radius:50px;background:linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#db2777 100%);font-family:'DM Sans',Arial,sans-serif;font-size:15px;font-weight:800;color:#fff;text-decoration:none;letter-spacing:0.04em;box-shadow:0 6px 24px rgba(124,58,237,0.40);">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

function cCheckList(items) {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px;">
  ${items.map(item => `
  <tr>
    <td width="28" style="vertical-align:top;padding-top:3px;">
      <div style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#db2777);text-align:center;line-height:20px;font-size:11px;color:#fff;">&#10003;</div>
    </td>
    <td style="padding-left:6px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:#374151;line-height:1.65;padding-bottom:10px;">${item}</td>
  </tr>`).join('')}
</table>`;
}

function cParagraphs(text) {
  return text.split('\n').filter(p => p.trim().length > 0).map(p =>
    `<p style="margin:0 0 18px;font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:#374151;line-height:1.75;">${p}</p>`
  ).join('');
}

// ── Master email shell ────────────────────────────────────────────────────────
function buildEmail({ preheader, gradStyle, topTag, headline, subHeadline, bodyHTML, footerNote }) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>CurvaFit</title>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=DM+Sans:ital,wght@0,400;0,500;0,700;0,800;1,400&display=swap" rel="stylesheet">
  <style>${BASE_CSS}</style>
</head>
<body style="margin:0;padding:0;background-color:#f4f0f8;">

<!-- INBOX PREVIEW TEXT -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f4f0f8;line-height:1px;">
${preheader}&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;
</div>

<!-- OUTER TABLE -->
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f0f8;padding:40px 16px;">
  <tr>
    <td align="center">

      <!-- CONTAINER -->
      <table class="ew" width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;width:100%;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(109,40,217,0.15);">

        <!-- HEADER -->
        <tr>
          <td style="${gradStyle};">
            <!-- Shimmer top bar -->
            <div style="height:3px;background:linear-gradient(90deg,#f9a8d4,#c084fc,#818cf8,#f9a8d4,#c084fc);"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:40px 44px 36px;text-align:center;">

                  <!-- Logo pill -->
                  <a href="${SITE_URL}" target="_blank" style="text-decoration:none;display:inline-block;margin-bottom:22px;">
                    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
                      <tr>
                        <td style="border:1.5px solid rgba(255,255,255,0.30);border-radius:12px;padding:10px 26px;background:rgba(255,255,255,0.10);">
                          <span style="font-family:'Cinzel',Georgia,serif;font-size:19px;font-weight:700;color:#fff;letter-spacing:0.18em;">CURVA<span style="color:#f9a8d4;">FIT</span></span>
                        </td>
                      </tr>
                    </table>
                  </a>

                  ${topTag ? `
                  <!-- Tag pill -->
                  <br>
                  <span style="display:inline-block;padding:5px 18px;border-radius:20px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:700;color:rgba(255,255,255,0.90);letter-spacing:0.10em;text-transform:uppercase;">${topTag}</span>
                  <br>` : ''}

                  <!-- Headline -->
                  <h1 class="eh1" style="margin:${topTag ? '16px' : '0'} 0 0;font-family:'Cinzel',Georgia,serif;font-size:32px;font-weight:700;color:#fff;line-height:1.2;letter-spacing:0.02em;">${headline}</h1>

                  ${subHeadline ? `<p style="margin:10px 0 0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.5;">${subHeadline}</p>` : ''}

                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td class="ep" style="background:#fff;padding:40px 44px;">
            ${bodyHTML}
          </td>
        </tr>

        <!-- SOCIAL STRIP -->
        <tr>
          <td style="background:#faf5ff;padding:24px 44px;text-align:center;border-top:1px solid #ede9fe;">
            <p style="margin:0 0 14px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#9ca3af;letter-spacing:0.08em;text-transform:uppercase;">Follow our community</p>
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
              <tr>
                <td style="padding:0 5px;">
                  <a href="https://instagram.com/curvafit" target="_blank"
                     style="display:inline-block;width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045);text-align:center;line-height:38px;font-size:18px;text-decoration:none;">&#x1F4F7;</a>
                </td>
                <td style="padding:0 5px;">
                  <a href="https://facebook.com/curvafit" target="_blank"
                     style="display:inline-block;width:38px;height:38px;border-radius:10px;background:#1877f2;text-align:center;line-height:38px;font-size:18px;text-decoration:none;">&#x1F44D;</a>
                </td>
                <td style="padding:0 5px;">
                  <a href="https://tiktok.com/@curvafit" target="_blank"
                     style="display:inline-block;width:38px;height:38px;border-radius:10px;background:#010101;text-align:center;line-height:38px;font-size:18px;text-decoration:none;">&#x1F3B5;</a>
                </td>
                <td style="padding:0 5px;">
                  <a href="https://wa.me/18292677434" target="_blank"
                     style="display:inline-block;width:38px;height:38px;border-radius:10px;background:#25d366;text-align:center;line-height:38px;font-size:18px;text-decoration:none;">&#x1F4AC;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#1e1b4b;padding:24px 44px;text-align:center;">
            <p style="margin:0 0 10px;font-family:'Cinzel',Georgia,serif;font-size:12px;color:rgba(255,255,255,0.45);letter-spacing:0.12em;">CURVAFIT</p>
            <p style="margin:0 0 12px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.35);line-height:1.6;">
              ${footerNote || 'You received this email from CurvaFit.'}
            </p>
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
              <tr>
                <td style="padding:0 10px;">
                  <a href="${SITE_URL}/shop.html" target="_blank" style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#a78bfa;text-decoration:none;">Shop</a>
                </td>
                <td style="padding:0 10px;border-left:1px solid rgba(255,255,255,0.12);">
                  <a href="${SITE_URL}/policies/privacy.html" target="_blank" style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#a78bfa;text-decoration:none;">Privacy</a>
                </td>
                <td style="padding:0 10px;border-left:1px solid rgba(255,255,255,0.12);">
                  <a href="${SITE_URL}/contact.html" target="_blank" style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#a78bfa;text-decoration:none;">Contact</a>
                </td>
                <td style="padding:0 10px;border-left:1px solid rgba(255,255,255,0.12);">
                  <a href="${SITE_URL}/policies/refund.html" target="_blank" style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#a78bfa;text-decoration:none;">Refunds</a>
                </td>
              </tr>
            </table>
            <p style="margin:14px 0 0;font-family:'DM Sans',Arial,sans-serif;font-size:10px;color:rgba(255,255,255,0.20);">
              &copy; ${new Date().getFullYear()} CurvaFit &mdash; Built for real women.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}

// ════════════════════════════════════════════════════════════════════════════
//  EMAIL COMPOSERS
// ════════════════════════════════════════════════════════════════════════════

async function composeWelcome(firstName) {
  const name = firstName || 'Beautiful';
  const copy = await generateWelcomeCopy(name);
  const promo = PROMOS[0];

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;font-weight:700;color:#a855f7;letter-spacing:0.06em;text-transform:uppercase;">Hey ${name} &#x1F44B;</p>

    ${cParagraphs(copy)}

    ${cDivider()}

    ${cPromoBlock(promo.code, promo.label, '&#x1F381; Your welcome gift — use it on your first order')}

    <p style="margin:0 0 16px;font-family:'Cinzel',Georgia,serif;font-size:15px;font-weight:700;color:#1e1b4b;">What's waiting for you:</p>
    ${cCheckList([
      '16 premium fitness products designed for curvy women',
      'Coaching programs from beginner to advanced',
      'A community of real women on their transformation journey',
      'Expert nutrition guidance built around your body',
    ])}

    ${cCTA('Explore the Shop &rarr;', `${SITE_URL}/shop.html`)}

    ${cDivider()}

    <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#9ca3af;text-align:center;line-height:1.6;">
      Questions? We're always here.<br>
      <a href="mailto:support@paulcurvafit.com" style="color:#7c3aed;text-decoration:none;font-weight:700;">support@paulcurvafit.com</a>
      &nbsp;&middot;&nbsp;
      <a href="${SITE_URL}/contact.html" style="color:#7c3aed;text-decoration:none;">Live support</a>
    </p>`;

  return {
    subject: `Welcome to CurvaFit, ${name}! Your gift is inside &#x1F49C;`,
    html: buildEmail({
      preheader:   `You're officially part of CurvaFit — and we built this for exactly you.`,
      gradStyle:   GRAD.purple,
      topTag:      'Welcome to the family',
      headline:    'You made it. &#x1F49C;',
      subHeadline: 'CurvaFit was built for women exactly like you.',
      bodyHTML,
      footerNote:  `You received this because you created a CurvaFit account. <a href="${SITE_URL}/contact.html" style="color:#a78bfa;">Manage preferences</a>`,
    }),
  };
}

async function composeNewsletter(firstName) {
  const name = firstName || 'Beautiful';
  const copy = await generateNewsletterCopy(name);

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;font-weight:700;color:#a855f7;letter-spacing:0.06em;text-transform:uppercase;">Subscription confirmed &#x2713;</p>

    <p style="margin:0 0 28px;font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:#374151;line-height:1.75;">${copy}</p>

    ${cDivider()}

    <p style="margin:0 0 16px;font-family:'Cinzel',Georgia,serif;font-size:15px;font-weight:700;color:#1e1b4b;">Here's what's coming your way:</p>

    <!-- 2x2 Feature grid -->
    <table class="egrid" width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td width="50%" style="padding:0 6px 12px 0;vertical-align:top;">
          <div style="background:#faf5ff;border-radius:16px;padding:20px;border:1px solid #ede9fe;height:100%;">
            <p style="margin:0 0 6px;font-size:22px;">&#x1F4A1;</p>
            <p style="margin:0 0 6px;font-family:'Cinzel',Georgia,serif;font-size:13px;font-weight:700;color:#1e1b4b;">Weekly Tips</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#6b7280;line-height:1.55;">Practical wellness &amp; weight loss tips that actually work for curvy bodies.</p>
          </div>
        </td>
        <td width="50%" style="padding:0 0 12px 6px;vertical-align:top;">
          <div style="background:#fdf2f8;border-radius:16px;padding:20px;border:1px solid #fce7f3;height:100%;">
            <p style="margin:0 0 6px;font-size:22px;">&#x1F381;</p>
            <p style="margin:0 0 6px;font-family:'Cinzel',Georgia,serif;font-size:13px;font-weight:700;color:#1e1b4b;">Exclusive Deals</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#6b7280;line-height:1.55;">Subscriber-only discount codes before they go public.</p>
          </div>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
          <div style="background:#f0fdf4;border-radius:16px;padding:20px;border:1px solid #dcfce7;height:100%;">
            <p style="margin:0 0 6px;font-size:22px;">&#x2728;</p>
            <p style="margin:0 0 6px;font-family:'Cinzel',Georgia,serif;font-size:13px;font-weight:700;color:#1e1b4b;">New Arrivals</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#6b7280;line-height:1.55;">You'll be first to know when new products launch.</p>
          </div>
        </td>
        <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
          <div style="background:#eff6ff;border-radius:16px;padding:20px;border:1px solid #dbeafe;height:100%;">
            <p style="margin:0 0 6px;font-size:22px;">&#x1F4AA;</p>
            <p style="margin:0 0 6px;font-family:'Cinzel',Georgia,serif;font-size:13px;font-weight:700;color:#1e1b4b;">Real Stories</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#6b7280;line-height:1.55;">Success stories from real women in our community.</p>
          </div>
        </td>
      </tr>
    </table>

    ${cCTA('Discover the Shop &rarr;', `${SITE_URL}/shop.html`)}`;

  return {
    subject: `You're in! &#x1F48C; The CurvaFit insider list just got better`,
    html: buildEmail({
      preheader:   `Your subscription is confirmed — exclusive tips, deals, and real stories incoming.`,
      gradStyle:   GRAD.rose,
      topTag:      'Newsletter confirmed',
      headline:    "You're officially inside. &#x1F48C;",
      subHeadline: 'The best of CurvaFit, delivered to your inbox.',
      bodyHTML,
      footerNote:  `You subscribed to the CurvaFit newsletter. <a href="${SITE_URL}/contact.html" style="color:#a78bfa;">Unsubscribe</a>`,
    }),
  };
}

async function composeReviewThanks(firstName) {
  const name  = firstName || 'Beautiful';
  const copy  = await generateReviewThanksCopy(name);
  const promo = PROMOS[Math.floor(Math.random() * PROMOS.length)];

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;font-weight:700;color:#a855f7;letter-spacing:0.06em;text-transform:uppercase;">Thank you, ${name} &#x1F31F;</p>

    ${cParagraphs(copy)}

    ${cDivider()}

    ${cPromoBlock(promo.code, promo.label, '&#x2728; Your exclusive thank-you offer')}

    <p style="margin:0 0 16px;font-family:'Cinzel',Georgia,serif;font-size:15px;font-weight:700;color:#1e1b4b;">Handpicked for you:</p>

    ${PRODUCTS.map(p => cProductCard(p, promo.code)).join('')}

    ${cCTA(`Shop with ${promo.code} &rarr;`, `${SITE_URL}/shop.html`)}

    ${cDivider()}

    <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#9ca3af;text-align:center;">
      Your review is now helping other women make the right choice. &#x1F49C;
    </p>`;

  return {
    subject: `Thank you for your review, ${name}! Here's something special &#x1F31F;`,
    html: buildEmail({
      preheader:   `Your honest words are helping thousands of women — here's our thank-you.`,
      gradStyle:   GRAD.rose,
      topTag:      'Your review matters',
      headline:    'Thank you. Truly. &#x1F31F;',
      subHeadline: 'Your words are helping real women every day.',
      bodyHTML,
      footerNote:  `You received this because you submitted a product review on CurvaFit.`,
    }),
  };
}

async function composeAbandonedCart(firstName, cartQty) {
  const name  = firstName || 'Beautiful';
  const copy  = await generateCartCopy(name, cartQty);
  const promo = PROMOS[1]; // FITNESS25

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;font-weight:700;color:#a855f7;letter-spacing:0.06em;text-transform:uppercase;">Hey ${name} &#x1F6D2;</p>

    ${cParagraphs(copy)}

    ${cDivider()}

    <!-- Cart visual box -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin:0 0 24px;background:#faf5ff;border-radius:20px;border:2px dashed #c084fc;">
      <tr>
        <td style="padding:28px;text-align:center;">
          <p style="margin:0 0 6px;font-size:40px;">&#x1F6D2;</p>
          <p style="margin:0 0 4px;font-family:'Cinzel',Georgia,serif;font-size:18px;font-weight:700;color:#4c1d95;">
            ${cartQty} item${cartQty > 1 ? 's' : ''} waiting for you
          </p>
          <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#7c3aed;">Your cart is saved — but not forever.</p>
        </td>
      </tr>
    </table>

    ${cPromoBlock(promo.code, promo.label, '&#x26A1; Complete your order with this offer')}

    <p style="margin:0 0 16px;font-family:'Cinzel',Georgia,serif;font-size:15px;font-weight:700;color:#1e1b4b;">You might also love:</p>
    ${cProductCard(PRODUCTS[0], promo.code)}
    ${cProductCard(PRODUCTS[1], promo.code)}

    ${cCTA('Complete My Order &rarr;', `${SITE_URL}/checkout.html`)}

    ${cDivider()}

    <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#9ca3af;text-align:center;line-height:1.6;">
      Need help with your order?<br>
      <a href="${SITE_URL}/contact.html" style="color:#7c3aed;text-decoration:none;font-weight:700;">Chat with us &rarr;</a>
    </p>`;

  return {
    subject: `${name}, your cart is waiting &#x1F6D2; — ${promo.code} inside`,
    html: buildEmail({
      preheader:   `${cartQty} item${cartQty > 1 ? 's' : ''} still in your cart — complete your order with an exclusive offer.`,
      gradStyle:   GRAD.dark,
      topTag:      `${cartQty} item${cartQty > 1 ? 's' : ''} in your cart`,
      headline:    "Don't leave empty-handed. &#x1F6D2;",
      subHeadline: 'Your items are waiting — and so is your offer.',
      bodyHTML,
      footerNote:  `You received this because you had items in your CurvaFit cart.`,
    }),
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  GOOGLE SHEETS HELPERS
// ════════════════════════════════════════════════════════════════════════════
function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function readRange(sheets, spreadsheetId, range) {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return res.data.values || [];
  } catch (e) { console.warn(`[Sheets] ${range}:`, e.message); return []; }
}

async function appendRow(sheets, spreadsheetId, range, values) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId, range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [values] },
    });
  } catch (e) { console.warn(`[Sheets] append ${range}:`, e.message); }
}

const LOG_RANGE = 'EmailLog!A:C';
const SHEET_ID  = () => process.env.GOOGLE_SHEET_ID_ACCOUNTS;

async function loadSentLog(sheets) {
  const rows = await readRange(sheets, SHEET_ID(), LOG_RANGE);
  const set  = new Set();
  rows.forEach(r => { if (r[0] && r[1]) set.add(`${r[0].toLowerCase()}||${r[1]}`); });
  return set;
}

async function markSent(sheets, email, type) {
  await appendRow(sheets, SHEET_ID(), LOG_RANGE, [email.toLowerCase(), type, new Date().toISOString().slice(0,10)]);
}

function wasSent(log, email, type) {
  return log.has(`${email.toLowerCase()}||${type}`);
}

// ── Resend delivery ───────────────────────────────────────────────────────────
async function deliver(to, subject, html) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to: [to], subject, html });
    if (error) { console.error(`[Resend] ✗ ${to}:`, error); return false; }
    console.log(`[Resend] ✓ ${to} | ${subject.slice(0,55)}`);
    return true;
  } catch (e) { console.error(`[Resend] ✗ ${to}:`, e.message); return false; }
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ════════════════════════════════════════════════════════════════════════════
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const results = { sent: [], skipped: [], errors: [] };
  let trigger = null, triggerData = {};

  if (event.body) {
    try { const b = JSON.parse(event.body); trigger = b.trigger || null; triggerData = b; }
    catch (_) {}
  }

  try {
    const sheets  = getSheets();
    const sentLog = await loadSentLog(sheets);

    const trySend = async (email, type, composeFn, ...args) => {
      if (wasSent(sentLog, email, type)) {
        results.skipped.push({ email, type, reason: 'already sent' });
        return false;
      }
      try {
        const { subject, html } = await composeFn(...args);
        const ok = await deliver(email, subject, html);
        if (ok) {
          await markSent(sheets, email, type);
          sentLog.add(`${email.toLowerCase()}||${type}`);
          results.sent.push({ email, type });
        } else {
          results.errors.push({ email, type, reason: 'Resend delivery failed' });
        }
        return ok;
      } catch (e) {
        results.errors.push({ email, type, reason: e.message });
        return false;
      }
    };

    // ══ SINGLE-TRIGGER MODE ═══════════════════════════════════════════════
    if (trigger) {
      const { email, firstName = '', lastName = '', newsletter = 'no', cartQty = 0 } = triggerData;
      if (!email || !email.includes('@')) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };
      }

      if (trigger === T.WELCOME) {
        await trySend(email, T.WELCOME, composeWelcome, firstName || lastName || 'Beautiful');
        // Newsletter will fire on next batch run if subscribed — prevents double email in 1 session
      }

      if (trigger === T.NEWSLETTER && String(newsletter).toLowerCase() === 'yes') {
        if (!wasSent(sentLog, email, T.WELCOME)) {
          await trySend(email, T.NEWSLETTER, composeNewsletter, firstName);
        } else {
          results.skipped.push({ email, type: T.NEWSLETTER, reason: 'Welcome sent this session — queued for next batch' });
        }
      }

      if (trigger === T.REVIEW_THANKS) {
        await trySend(email, T.REVIEW_THANKS, composeReviewThanks, firstName || 'Beautiful');
      }

      if (trigger === T.CART_ABANDON && cartQty > 0) {
        await trySend(email, T.CART_ABANDON, composeAbandonedCart, firstName || 'Beautiful', cartQty);
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, results }) };
    }

    // ══ BATCH SCAN MODE ═══════════════════════════════════════════════════
    const rows = await readRange(sheets, SHEET_ID(), 'Feuille 1!A:Q');

    for (const row of rows) {
      const lastName   = (row[0]  || '').trim();
      const firstName  = (row[1]  || '').trim();
      const email      = (row[2]  || '').trim();
      const newsletter = (row[5]  || '').toLowerCase();
      const reviews    = parseInt(row[8]  || 0);
      const cartQty    = parseInt(row[14] || 0);

      if (!email || !email.includes('@')) continue;
      const name = firstName || lastName || 'Beautiful';

      // Priority order: 1 email per user per batch run
      if (!wasSent(sentLog, email, T.WELCOME)) {
        await trySend(email, T.WELCOME, composeWelcome, name);
        await sleep(500); continue;
      }
      if (newsletter === 'yes' && !wasSent(sentLog, email, T.NEWSLETTER)) {
        await trySend(email, T.NEWSLETTER, composeNewsletter, name);
        await sleep(500); continue;
      }
      if (reviews > 0 && !wasSent(sentLog, email, T.REVIEW_THANKS)) {
        await trySend(email, T.REVIEW_THANKS, composeReviewThanks, name);
        await sleep(500); continue;
      }
      if (cartQty > 0 && !wasSent(sentLog, email, T.CART_ABANDON)) {
        await trySend(email, T.CART_ABANDON, composeAbandonedCart, name, cartQty);
        await sleep(500); continue;
      }

      results.skipped.push({ email, reason: 'no action needed' });
    }

    // Newsletter-only footer subscribers (no name, email only)
    for (const row of rows) {
      const lastName  = (row[0] || '').trim();
      const firstName = (row[1] || '').trim();
      const email     = (row[2] || '').trim();
      const newsletter = (row[5] || '').toLowerCase();

      if (!firstName && !lastName && email && email.includes('@')
          && newsletter === 'yes'
          && !wasSent(sentLog, email, T.NEWSLETTER)) {
        await trySend(email, T.NEWSLETTER, composeNewsletter, '');
        await sleep(500);
      }
    }

    console.log(`[send-email-auto] Batch done — sent:${results.sent.length} skipped:${results.skipped.length} errors:${results.errors.length}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        summary: { sent: results.sent.length, skipped: results.skipped.length, errors: results.errors.length },
        results,
      }),
    };

  } catch (fatal) {
    console.error('[send-email-auto] Fatal:', fatal);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: fatal.message }) };
  }
};