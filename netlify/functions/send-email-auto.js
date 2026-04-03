// netlify/functions/send-email-auto.js
// ══════════════════════════════════════════════════════════════════
//  CurvaFit — Automated Smart Email Marketing System
//  • Reads data from Google Sheets (accounts, orders, reviews, plans)
//  • Generates email content via Groq AI
//  • Sends emails via Resend
//  • Intelligent deduplication & context-aware logic
// ══════════════════════════════════════════════════════════════════

const { google } = require('googleapis');
const { Resend }  = require('resend');

// ── CONFIG ──────────────────────────────────────────────────────────────────
const SITE_URL    = process.env.SITE_URL    || 'https://curvafit.com';
const LOGO_URL    = 'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/curvafit_logo.png';
const FROM_EMAIL  = 'CurvaFit <hello@paulcurvafit.com>';
const GROQ_KEY    = process.env.GROQ_API_KEY;
const RESEND_KEY  = process.env.RESEND_API_KEY;

// ── GROQ MODELS (different from chat.js) ─────────────────────────────────
// chat.js uses: llama-3.3-70b-versatile, moonshotai/kimi-k2-instruct,
// meta-llama/llama-4-scout-17b-16e-instruct, qwen/qwen3-32b,
// openai/gpt-oss-120b, openai/gpt-oss-20b, moonshotai/kimi-k2-instruct-0905,
// openai/gpt-oss-safeguard-20b, llama-3.1-8b-instant,
// meta-llama/llama-prompt-guard-2-22m
// We use a separate pool here:
const EMAIL_MODELS = [
  'llama-3.3-70b-versatile',           // high quality, fast
  'moonshotai/kimi-k2-instruct',        // strong creative writer
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'qwen/qwen3-32b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'llama-3.1-8b-instant',
  'moonshotai/kimi-k2-instruct-0905',
  'openai/gpt-oss-safeguard-20b',
  'meta-llama/llama-prompt-guard-2-22m',
];
let emailModelIndex = 0;

// ── EMAIL TYPES ──────────────────────────────────────────────────────────
const EMAIL_TYPE = {
  WELCOME:          'welcome',
  NEWSLETTER:       'newsletter',
  REVIEW_THANKS:    'review_thanks',
  ABANDONED_CART:   'abandoned_cart',
};

// ── SENT LOG SHEET ───────────────────────────────────────────────────────
// We store sent emails in a "EmailLog" sheet tab inside the accounts spreadsheet
// to avoid duplicates. Format: email | type | date
const EMAIL_LOG_RANGE = 'EmailLog!A:C';

// ── PRODUCTS — minimal list for promo emails ──────────────────────────────
const FEATURED_PRODUCTS = [
  {
    id:    'resistance-bands',
    title: 'Smart Hula Hoop — Waist Burner',
    price: '$63.46',
    url:   `${SITE_URL}/products/product1.html`,
    image: 'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/image_produit_first.webp?v=1774271069',
  },
  {
    id:    'yoga-mat',
    title: 'Plus Size Waist Trainer — S to 6XL',
    price: '$34.99',
    url:   `${SITE_URL}/products/product2.html`,
    image: 'https://cdn.shopify.com/s/files/1/0643/8263/2041/files/big_style_3.webp?v=1771457384',
  },
  {
    id:    'fitness-tracker',
    title: 'Shock-Absorbing Sports Bra — S to 5XL',
    price: '$24.99',
    url:   `${SITE_URL}/products/product7.html`,
    image: 'https://cdn.shopify.com/s/files/1/0643/8263/2041/files/big_style.webp?v=1771457385',
  },
  {
    id:    'leggings',
    title: 'Smart Jump Rope — LCD Counter',
    price: '$17.99',
    url:   `${SITE_URL}/products/product3.html`,
    image: 'https://cdn.shopify.com/s/files/1/0643/8263/2041/files/big_style_2.webp?v=1771457384',
  },
];

const PROMO_CODES = [
  { code: 'CURVA15',    discount: '20% off on 4+ items' },
  { code: 'FITNESS25',  discount: '25% off on 5+ items' },
  { code: 'PAUL81',     discount: '40% off on 10+ items' },
];

// ════════════════════════════════════════════════════════════════════════════
//  GOOGLE SHEETS AUTH
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

const SHEET_ACCOUNTS = process.env.GOOGLE_SHEET_ID_ACCOUNTS;
const SHEET_REVIEWS  = process.env.GOOGLE_SHEET_ID_REVIEWS;
const SHEET_ORDERS   = process.env.GOOGLE_SHEET_ID_ACCOUNTS; // same sheet, different tab
const SHEET_PLANS    = process.env.GOOGLE_SHEET_ID_ACCOUNTS; // same sheet if plans tab exists

// ── Read a sheet range ──────────────────────────────────────────────────
async function readRange(sheets, spreadsheetId, range) {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return res.data.values || [];
  } catch (e) {
    console.warn(`[readRange] ${range} failed:`, e.message);
    return [];
  }
}

// ── Append a row ────────────────────────────────────────────────────────
async function appendRow(sheets, spreadsheetId, range, values) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption:  'RAW',
      insertDataOption:  'INSERT_ROWS',
      resource: { values: [values] },
    });
  } catch (e) {
    console.warn(`[appendRow] ${range} failed:`, e.message);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  SENT LOG — prevent duplicate sends
// ════════════════════════════════════════════════════════════════════════════
async function loadSentLog(sheets) {
  const rows = await readRange(sheets, SHEET_ACCOUNTS, EMAIL_LOG_RANGE);
  // rows: [[email, type, date], ...]
  const sent = new Set();
  rows.forEach(r => {
    if (r[0] && r[1]) sent.add(`${r[0].toLowerCase()}::${r[1]}`);
  });
  return sent;
}

async function markSent(sheets, email, type) {
  const date = new Date().toISOString().slice(0, 10);
  await appendRow(sheets, SHEET_ACCOUNTS, EMAIL_LOG_RANGE, [email.toLowerCase(), type, date]);
}

function alreadySent(sentLog, email, type) {
  return sentLog.has(`${email.toLowerCase()}::${type}`);
}

// ════════════════════════════════════════════════════════════════════════════
//  GROQ — generate email body (text only, HTML built separately)
// ════════════════════════════════════════════════════════════════════════════
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function generateWithGroq(prompt) {
  for (let attempt = 0; attempt < EMAIL_MODELS.length; attempt++) {
    const idx   = (emailModelIndex + attempt) % EMAIL_MODELS.length;
    const model = EMAIL_MODELS[idx];

    for (let retry = 1; retry <= 2; retry++) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method:  'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_KEY}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            model,
            messages:   [{ role: 'user', content: prompt }],
            max_tokens: 600,
            temperature: 0.72,
          }),
        });

        if (res.status === 429) {
          if (retry < 2) { await sleep(1500); continue; }
          emailModelIndex = (idx + 1) % EMAIL_MODELS.length;
          break;
        }

        if (!res.ok) break;

        const data    = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        emailModelIndex = idx;
        return content.trim();
      } catch (e) {
        if (retry < 2) { await sleep(800); continue; }
        break;
      }
    }
  }
  return null; // all models failed → use fallback text
}

// ════════════════════════════════════════════════════════════════════════════
//  EMAIL DESIGN HELPERS
// ════════════════════════════════════════════════════════════════════════════

function productCard(p, promoCode) {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border-radius:12px;overflow:hidden;border:1px solid #f0e6f6;">
    <tr>
      <td width="100" style="padding:0;vertical-align:top;">
        <a href="${p.url}" style="display:block;">
          <img src="${p.image}" width="100" height="100"
               style="display:block;object-fit:cover;border-radius:12px 0 0 12px;"
               alt="${p.title}">
        </a>
      </td>
      <td style="padding:12px 16px;vertical-align:middle;">
        <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#2d1a4e;">${p.title}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#b845a0;font-weight:600;">${p.price}</p>
        ${promoCode ? `<p style="margin:0 0 8px;font-size:11px;background:#fdf4ff;border:1px dashed #d47ef5;border-radius:6px;padding:4px 8px;display:inline-block;color:#7c3aed;">Use code <strong>${promoCode}</strong></p>` : ''}
        <a href="${p.url}"
           style="display:inline-block;margin-top:6px;padding:7px 18px;background:linear-gradient(135deg,#c026d3,#7c3aed);color:#fff;font-size:12px;font-weight:700;border-radius:20px;text-decoration:none;">
          Shop Now →
        </a>
      </td>
    </tr>
  </table>`;
}

function emailWrapper({ preheader, headline, bodyHTML, ctaLabel, ctaUrl, footerNote }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>CurvaFit</title>
<!--[if mso]><style>table{border-collapse:collapse!important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f5f0fa;font-family:'Helvetica Neue',Arial,sans-serif;">

<!-- PREHEADER (hidden) -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f5f0fa;">
  ${preheader}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0fa;padding:32px 0;">
  <tr>
    <td align="center">

      <!-- WRAPPER -->
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(120,0,180,0.10);">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#c026d3 0%,#7c3aed 100%);padding:32px 40px;text-align:center;">
            <a href="${SITE_URL}" style="text-decoration:none;">
              <img src="${LOGO_URL}" alt="CurvaFit" height="48"
                   style="display:inline-block;max-height:48px;filter:brightness(0) invert(1);"
                   onerror="this.style.display='none'">
              <span style="display:block;color:#fff;font-size:22px;font-weight:800;letter-spacing:1px;margin-top:6px;">CurvaFit</span>
            </a>
          </td>
        </tr>

        <!-- HEADLINE BANNER -->
        <tr>
          <td style="background:#fdf4ff;padding:28px 40px 20px;text-align:center;border-bottom:1px solid #f0e6f6;">
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#2d1a4e;line-height:1.25;">${headline}</h1>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:32px 40px;">
            ${bodyHTML}

            ${ctaLabel && ctaUrl ? `
            <!-- MAIN CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
              <tr>
                <td align="center">
                  <a href="${ctaUrl}"
                     style="display:inline-block;padding:16px 44px;background:linear-gradient(135deg,#c026d3,#7c3aed);color:#fff;font-size:16px;font-weight:800;border-radius:30px;text-decoration:none;letter-spacing:0.5px;box-shadow:0 4px 18px rgba(124,58,237,0.30);">
                    ${ctaLabel}
                  </a>
                </td>
              </tr>
            </table>` : ''}
          </td>
        </tr>

        <!-- DIVIDER -->
        <tr><td style="height:1px;background:#f0e6f6;"></td></tr>

        <!-- SOCIAL -->
        <tr>
          <td style="padding:24px 40px;text-align:center;">
            <p style="margin:0 0 14px;font-size:13px;color:#9ca3af;">Follow us</p>
            <a href="https://instagram.com/curvafit" style="margin:0 6px;text-decoration:none;">
              <img src="https://cdn-icons-png.flaticon.com/32/2111/2111463.png" width="24" alt="Instagram">
            </a>
            <a href="https://facebook.com/curvafit" style="margin:0 6px;text-decoration:none;">
              <img src="https://cdn-icons-png.flaticon.com/32/733/733547.png" width="24" alt="Facebook">
            </a>
            <a href="https://tiktok.com/@curvafit" style="margin:0 6px;text-decoration:none;">
              <img src="https://cdn-icons-png.flaticon.com/32/3046/3046121.png" width="24" alt="TikTok">
            </a>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#f5f0fa;padding:20px 40px;text-align:center;border-top:1px solid #e9d5f5;">
            <p style="margin:0 0 6px;font-size:11px;color:#9ca3af;">
              © ${new Date().getFullYear()} CurvaFit — Designed for real women.
            </p>
            ${footerNote ? `<p style="margin:0;font-size:11px;color:#c4b5d4;">${footerNote}</p>` : ''}
            <p style="margin:8px 0 0;font-size:11px;color:#c4b5d4;">
              <a href="${SITE_URL}/policies/privacy.html" style="color:#b845a0;text-decoration:none;">Privacy</a>
              &nbsp;·&nbsp;
              <a href="${SITE_URL}/contact.html" style="color:#b845a0;text-decoration:none;">Contact</a>
              &nbsp;·&nbsp;
              <a href="${SITE_URL}" style="color:#b845a0;text-decoration:none;">Shop</a>
            </p>
          </td>
        </tr>

      </table>
      <!-- /WRAPPER -->

    </td>
  </tr>
</table>

</body>
</html>`;
}

// ════════════════════════════════════════════════════════════════════════════
//  EMAIL BUILDERS
// ════════════════════════════════════════════════════════════════════════════

// A. WELCOME EMAIL ──────────────────────────────────────────────────────────
async function buildWelcomeEmail(firstName) {
  const prompt = `You are a warm, motivating email copywriter for CurvaFit, a fitness brand for curvy women.
Write a short welcome email body (3-4 sentences, NO subject line, NO greeting, NO sign-off).
The recipient's first name is ${firstName}.
Tone: warm, empowering, human, feminine. NO bullet points. NO markdown.
Mention: she's joining a community of real women on a transformation journey, and CurvaFit is here to support her.`;

  const aiText = await generateWithGroq(prompt) || `You're officially part of the CurvaFit family — and we couldn't be more excited to have you here. This is a space built for real women, by someone who truly believes in you. Explore our shop, find what speaks to your body, and remember: your journey starts exactly where you are right now. We're with you every step of the way! 💜`;

  const bodyHTML = `
    <p style="margin:0 0 20px;font-size:16px;color:#4b5563;line-height:1.7;">Hi <strong style="color:#7c3aed;">${firstName}</strong> 👋</p>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.8;">${aiText}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#fdf4ff;border-radius:14px;padding:20px;border:1px solid #e9d5f5;">
      <tr>
        <td style="text-align:center;">
          <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;letter-spacing:0.05em;text-transform:uppercase;">Your welcome gift</p>
          <p style="margin:0;font-size:28px;font-weight:800;color:#7c3aed;letter-spacing:2px;">CURVA15</p>
          <p style="margin:4px 0 0;font-size:12px;color:#b845a0;">20% off on your first order (4+ items)</p>
        </td>
      </tr>
    </table>`;

  return {
    subject: `Welcome to CurvaFit, ${firstName}! 💜 Your journey starts now`,
    html: emailWrapper({
      preheader:  `Welcome, ${firstName}! Your transformation starts here.`,
      headline:   `Welcome to CurvaFit! 🎉`,
      bodyHTML,
      ctaLabel:   'Discover the Shop →',
      ctaUrl:     `${SITE_URL}/shop.html`,
      footerNote: 'You received this because you created a CurvaFit account.',
    }),
  };
}

// B. NEWSLETTER CONFIRMATION EMAIL ─────────────────────────────────────────
async function buildNewsletterEmail(firstName) {
  const name    = firstName || 'Beautiful';
  const prompt  = `You are an email copywriter for CurvaFit, a fitness brand for curvy women.
Write a short newsletter confirmation email body (2-3 sentences, NO subject line, NO greeting, NO sign-off).
Recipient first name: ${name}.
Tone: friendly, warm, empowering. Mention: she'll get exclusive tips, deals, and inspiration.`;

  const aiText = await generateWithGroq(prompt) || `You're now subscribed to the CurvaFit newsletter — get ready for exclusive tips, early deals, and real inspiration delivered to your inbox. We promise to only send you things that matter to your journey. So happy to have you here! 💜`;

  const bodyHTML = `
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.8;">${aiText}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">What you'll receive:</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${['💡 Weekly wellness & weight loss tips',
         '🎁 Exclusive subscriber-only discounts',
         '✨ New product launches first',
         '💪 Success stories from real CurvaFit women'].map(item => `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#4b5563;">
          <span style="margin-right:8px;">${item}</span>
        </td>
      </tr>`).join('')}
    </table>`;

  return {
    subject: `You're in! 💌 Welcome to the CurvaFit newsletter`,
    html: emailWrapper({
      preheader:  'Your subscription is confirmed — exclusive tips & deals incoming!',
      headline:   `You're officially subscribed! 💌`,
      bodyHTML,
      ctaLabel:   'Explore the Shop →',
      ctaUrl:     `${SITE_URL}/shop.html`,
      footerNote: 'You subscribed to our newsletter. <a href="' + SITE_URL + '/contact.html" style="color:#b845a0;">Unsubscribe</a>',
    }),
  };
}

// C. REVIEW THANK-YOU EMAIL ────────────────────────────────────────────────
async function buildReviewThanksEmail(firstName, products, promo) {
  const name   = firstName || 'Beautiful';
  const prompt = `You are an email copywriter for CurvaFit fitness brand.
Write a short thank-you email body for a customer who left a product review (2-3 sentences, NO subject, NO greeting, NO sign-off).
Recipient: ${name}. Tone: grateful, warm, genuine. Mention: her review helps other women decide, and as a thank-you here are some special offers.`;

  const aiText = await generateWithGroq(prompt) || `Your review means the world to us — and to the thousands of women who read it before deciding to start their journey. Thank you for taking the time to share your experience, ${name}. As a little thank-you, here are some exclusive deals just for you! 💜`;

  const productsHTML = products.slice(0, 4).map(p => productCard(p, promo.code)).join('');

  const bodyHTML = `
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.8;">${aiText}</p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="margin:16px 0;background:#fdf4ff;border-radius:14px;padding:16px 20px;border:1px solid #e9d5f5;">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;">Your exclusive code</p>
          <p style="margin:0;font-size:26px;font-weight:800;color:#7c3aed;letter-spacing:2px;">${promo.code}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#b845a0;">${promo.discount}</p>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 12px;font-size:15px;font-weight:700;color:#2d1a4e;">Handpicked for you:</p>
    ${productsHTML}`;

  return {
    subject: `Thank you for your review, ${name}! 🌟 Here's a special gift`,
    html: emailWrapper({
      preheader:  `Your review helps thousands of women — thank you! Here's something special.`,
      headline:   `Thank you, ${name}! 🌟`,
      bodyHTML,
      ctaLabel:   'Shop with your discount →',
      ctaUrl:     `${SITE_URL}/shop.html`,
      footerNote: 'You received this because you left a product review on CurvaFit.',
    }),
  };
}

// D. ABANDONED CART EMAIL ──────────────────────────────────────────────────
async function buildAbandonedCartEmail(firstName, cartQty) {
  const name   = firstName || 'Beautiful';
  const prompt = `You are an email copywriter for CurvaFit, a fitness brand for curvy women.
Write a short abandoned cart email body (2-3 sentences, NO subject, NO greeting, NO sign-off).
Recipient: ${name}. She has ${cartQty} item(s) waiting in her cart.
Tone: warm, a little playful, encouraging. Mention: her items are waiting and she deserves to treat herself.`;

  const aiText = await generateWithGroq(prompt) || `Hey ${name} — you left something behind! You've got ${cartQty} item${cartQty > 1 ? 's' : ''} waiting in your cart, and they're ready to join your journey. Don't let them wait too long — your transformation is worth it! 💜`;

  const promo   = PROMO_CODES[Math.floor(Math.random() * PROMO_CODES.length)];
  const featuredProduct = FEATURED_PRODUCTS[0];

  const bodyHTML = `
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.8;">${aiText}</p>

    <!-- Cart reminder visual -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="margin:16px 0;background:#fdf4ff;border-radius:14px;padding:20px;border:1px solid #e9d5f5;text-align:center;">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:36px;">🛒</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:#7c3aed;">
            ${cartQty} item${cartQty > 1 ? 's' : ''} in your cart
          </p>
          <p style="margin:6px 0 0;font-size:13px;color:#9ca3af;">Reserved just for you</p>
        </td>
      </tr>
    </table>

    <!-- Bonus promo -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="margin:16px 0;background:#7c3aed;border-radius:14px;padding:18px 20px;text-align:center;">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.1em;">Bonus offer — complete your order now</p>
          <p style="margin:0;font-size:28px;font-weight:800;color:#fff;letter-spacing:2px;">${promo.code}</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">${promo.discount}</p>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 12px;font-size:15px;font-weight:700;color:#2d1a4e;">You might also love:</p>
    ${productCard(featuredProduct, promo.code)}`;

  return {
    subject: `${name}, your cart is waiting for you 🛒 + a special offer inside`,
    html: emailWrapper({
      preheader:  `You left ${cartQty} item${cartQty > 1 ? 's' : ''} behind — complete your order with a special discount!`,
      headline:   `Don't forget your cart! 🛒`,
      bodyHTML,
      ctaLabel:   'Complete My Order →',
      ctaUrl:     `${SITE_URL}/checkout.html`,
      footerNote: 'You received this because you had items in your CurvaFit cart.',
    }),
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  SEND VIA RESEND
// ════════════════════════════════════════════════════════════════════════════
async function sendEmail(to, subject, html) {
  const resend = new Resend(RESEND_KEY);
  try {
    const { data, error } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      [to],
      subject,
      html,
    });
    if (error) {
      console.error('[Resend] Error:', error);
      return false;
    }
    console.log(`[Resend] Sent to ${to} | ID: ${data?.id}`);
    return true;
  } catch (e) {
    console.error('[Resend] Exception:', e.message);
    return false;
  }
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

  // Optional: accept a specific trigger via POST body
  // e.g. { trigger: 'welcome', email: '...', firstName: '...', lastName: '...' }
  // If called with no body → run full batch scan
  let trigger = null;
  let triggerData = {};

  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      trigger     = body.trigger || null;
      triggerData = body;
    } catch (_) {}
  }

  const results = {
    sent:    [],
    skipped: [],
    errors:  [],
  };

  try {
    const sheets  = getSheets();
    const sentLog = await loadSentLog(sheets);

    // ── SINGLE TRIGGER MODE ──────────────────────────────────────────────
    // Called right after a specific user action (faster, targeted)
    if (trigger) {
      const { email, firstName = '', lastName = '', cartQty = 0, newsletter = 'no' } = triggerData;

      if (!email) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'email required' }) };
      }

      let emailSent = false;

      // Welcome
      if (trigger === EMAIL_TYPE.WELCOME && !alreadySent(sentLog, email, EMAIL_TYPE.WELCOME)) {
        const { subject, html } = await buildWelcomeEmail(firstName || 'Beautiful');
        emailSent = await sendEmail(email, subject, html);
        if (emailSent) {
          await markSent(sheets, email, EMAIL_TYPE.WELCOME);
          results.sent.push({ email, type: EMAIL_TYPE.WELCOME });
        }
      }

      // Newsletter (only if not welcome already sent in same request)
      if (trigger === EMAIL_TYPE.NEWSLETTER
          && String(newsletter).toLowerCase() === 'yes'
          && !alreadySent(sentLog, email, EMAIL_TYPE.NEWSLETTER)
          && !alreadySent(sentLog, email, EMAIL_TYPE.WELCOME)) {
        const { subject, html } = await buildNewsletterEmail(firstName || '');
        emailSent = await sendEmail(email, subject, html);
        if (emailSent) {
          await markSent(sheets, email, EMAIL_TYPE.NEWSLETTER);
          results.sent.push({ email, type: EMAIL_TYPE.NEWSLETTER });
        }
      }

      // Abandoned Cart
      if (trigger === EMAIL_TYPE.ABANDONED_CART
          && cartQty > 0
          && !alreadySent(sentLog, email, EMAIL_TYPE.ABANDONED_CART)) {
        const { subject, html } = await buildAbandonedCartEmail(firstName || 'Beautiful', cartQty);
        emailSent = await sendEmail(email, subject, html);
        if (emailSent) {
          await markSent(sheets, email, EMAIL_TYPE.ABANDONED_CART);
          results.sent.push({ email, type: EMAIL_TYPE.ABANDONED_CART });
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, results }),
      };
    }

    // ── BATCH SCAN MODE ──────────────────────────────────────────────────
    // Called by a scheduled job (Netlify scheduled function or cron)
    // Scans ALL users and sends emails based on their state

    // 1. Read accounts sheet
    //    Columns: A=lastName B=firstName C=email D=phone E=password F=newsletter
    //             G=orders H=totalSpent I=reviewsWritten J-N=address O=cartQty P=memberSince Q=history
    const accountRows = await readRange(sheets, SHEET_ACCOUNTS, 'Feuille 1!A:Q');

    for (const row of accountRows) {
      const lastName      = row[0]  || '';
      const firstName     = row[1]  || '';
      const email         = row[2]  || '';
      const newsletter    = (row[5] || '').toLowerCase();
      const ordersCount   = parseInt(row[6]  || 0);
      const reviewsCount  = parseInt(row[8]  || 0);
      const cartQty       = parseInt(row[14] || 0);

      if (!email || !email.includes('@')) continue;

      const name = firstName || lastName || 'Beautiful';

      // A. WELCOME — send if account exists & welcome not sent
      if (!alreadySent(sentLog, email, EMAIL_TYPE.WELCOME)) {
        try {
          const { subject, html } = await buildWelcomeEmail(name);
          const ok = await sendEmail(email, subject, html);
          if (ok) {
            await markSent(sheets, email, EMAIL_TYPE.WELCOME);
            sentLog.add(`${email.toLowerCase()}::${EMAIL_TYPE.WELCOME}`);
            results.sent.push({ email, type: EMAIL_TYPE.WELCOME });
          } else {
            results.errors.push({ email, type: EMAIL_TYPE.WELCOME, reason: 'Resend failed' });
          }
          await sleep(400); // rate limit courtesy
        } catch (e) {
          results.errors.push({ email, type: EMAIL_TYPE.WELCOME, reason: e.message });
        }
        continue; // only 1 email per user per run to avoid spam
      }

      // B. NEWSLETTER — only if subscribed and welcome already sent and no newsletter yet
      if (newsletter === 'yes'
          && alreadySent(sentLog, email, EMAIL_TYPE.WELCOME)
          && !alreadySent(sentLog, email, EMAIL_TYPE.NEWSLETTER)) {
        try {
          const { subject, html } = await buildNewsletterEmail(name);
          const ok = await sendEmail(email, subject, html);
          if (ok) {
            await markSent(sheets, email, EMAIL_TYPE.NEWSLETTER);
            sentLog.add(`${email.toLowerCase()}::${EMAIL_TYPE.NEWSLETTER}`);
            results.sent.push({ email, type: EMAIL_TYPE.NEWSLETTER });
          }
          await sleep(400);
        } catch (e) {
          results.errors.push({ email, type: EMAIL_TYPE.NEWSLETTER, reason: e.message });
        }
        continue;
      }

      // C. REVIEW THANKS — if reviewsCount > 0 and not sent yet
      if (reviewsCount > 0 && !alreadySent(sentLog, email, EMAIL_TYPE.REVIEW_THANKS)) {
        try {
          const promo = PROMO_CODES[ordersCount % PROMO_CODES.length];
          const { subject, html } = await buildReviewThanksEmail(name, FEATURED_PRODUCTS, promo);
          const ok = await sendEmail(email, subject, html);
          if (ok) {
            await markSent(sheets, email, EMAIL_TYPE.REVIEW_THANKS);
            sentLog.add(`${email.toLowerCase()}::${EMAIL_TYPE.REVIEW_THANKS}`);
            results.sent.push({ email, type: EMAIL_TYPE.REVIEW_THANKS });
          }
          await sleep(400);
        } catch (e) {
          results.errors.push({ email, type: EMAIL_TYPE.REVIEW_THANKS, reason: e.message });
        }
        continue;
      }

      // D. ABANDONED CART — cartQty > 0 and no abandoned cart email sent yet
      if (cartQty > 0 && !alreadySent(sentLog, email, EMAIL_TYPE.ABANDONED_CART)) {
        try {
          const { subject, html } = await buildAbandonedCartEmail(name, cartQty);
          const ok = await sendEmail(email, subject, html);
          if (ok) {
            await markSent(sheets, email, EMAIL_TYPE.ABANDONED_CART);
            sentLog.add(`${email.toLowerCase()}::${EMAIL_TYPE.ABANDONED_CART}`);
            results.sent.push({ email, type: EMAIL_TYPE.ABANDONED_CART });
          }
          await sleep(400);
        } catch (e) {
          results.errors.push({ email, type: EMAIL_TYPE.ABANDONED_CART, reason: e.message });
        }
        continue;
      }

      // Nothing to send for this user
      results.skipped.push({ email, reason: 'no action needed' });
    }

    // 2. Read newsletter-only subscribers (email only, no account)
    //    These are rows where firstName & lastName are empty but email + newsletter=yes
    for (const row of accountRows) {
      const lastName   = (row[0] || '').trim();
      const firstName  = (row[1] || '').trim();
      const email      = (row[2] || '').trim();
      const newsletter = (row[5] || '').toLowerCase();

      // Newsletter-only subscriber (no name, subscribed via footer)
      if (!firstName && !lastName && email && email.includes('@')
          && newsletter === 'yes'
          && !alreadySent(sentLog, email, EMAIL_TYPE.NEWSLETTER)) {
        try {
          const { subject, html } = await buildNewsletterEmail('');
          const ok = await sendEmail(email, subject, html);
          if (ok) {
            await markSent(sheets, email, EMAIL_TYPE.NEWSLETTER);
            results.sent.push({ email, type: EMAIL_TYPE.NEWSLETTER });
          }
          await sleep(400);
        } catch (e) {
          results.errors.push({ email, type: EMAIL_TYPE.NEWSLETTER, reason: e.message });
        }
      }
    }

    // ── SUMMARY ──────────────────────────────────────────────────────────
    console.log(`[send-email-auto] Done — sent: ${results.sent.length} | skipped: ${results.skipped.length} | errors: ${results.errors.length}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        summary: {
          sent:    results.sent.length,
          skipped: results.skipped.length,
          errors:  results.errors.length,
        },
        results,
      }),
    };

  } catch (error) {
    console.error('[send-email-auto] Fatal error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};