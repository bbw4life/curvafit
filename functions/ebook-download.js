const { google } = require('googleapis');
const { getGoogleAuthClient } = require('./_lib/google-auth');
const {
  EBOOK_TITLES,
  getEbookDownload,
  getEbookSelection,
  createEbookAccessToken,
  verifyEbookAccessToken
} = require('./_lib/ebook-downloads');

const SHEET_TAB = 'curvafit-pending-orders';
const DOWNLOAD_STATUS_COLUMN = 'Y';

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function safeFileName(title, language) {
  const base = String(title || 'Curvafit guide')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'Curvafit-guide';
  return `${base}-${language}.pdf`;
}

function findAuthorizedEbook(tokenData, variantId) {
  return tokenData.ebooks.find(item => String(item.variantId) === String(variantId));
}

async function getOrderRows(env, paymentId) {
  if (!env.SHEET_ID_CURVAFIT_PENDING_ORDERS) throw new Error('Order sheet is not configured');
  const auth = await getGoogleAuthClient(env);
  const sheets = google.sheets({ version: 'v4', auth });
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: env.SHEET_ID_CURVAFIT_PENDING_ORDERS,
    range: `'${SHEET_TAB}'!A:Y`
  });
  const rows = result.data.values || [];
  const firstRow = rows[0] || [];
  const firstCell = String(firstRow[0] || '');
  const hasHeaderRow = Boolean(firstCell && !firstCell.startsWith('PENDING_'));
  if (hasHeaderRow && !firstRow[24]) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.SHEET_ID_CURVAFIT_PENDING_ORDERS,
      range: `'${SHEET_TAB}'!${DOWNLOAD_STATUS_COLUMN}1`,
      valueInputOption: 'RAW',
      resource: { values: [['ebook_download_status']] }
    });
  }
  const matches = rows
    .map((row, index) => ({ row, rowNumber: index + 1 }))
    .filter(({ row }) => String(row[2] || '') === String(paymentId));
  return { sheets, matches, spreadsheetId: env.SHEET_ID_CURVAFIT_PENDING_ORDERS };
}

function rowsForVariant(matches, variantId) {
  return matches.filter(({ row }) => String(row[12] || '') === String(variantId));
}

async function handlePost({ request, env }) {
  try {
    const body = await request.json();
    const { action, variantId } = body;
    if (action === 'prepare-order') {
        const orderId = String(body.paymentId || body.orderId || '').trim();
        if (!orderId) return json(400, { success: false, error: 'Missing payment ID.' });

        const sheetsForOrder = await getOrderRows(env, orderId);
        const { matches } = sheetsForOrder;
        if (!matches.length) return json(202, { success: false, pending: true, error: 'Order is still being recorded.' });

        const ebookRows = matches
          .map(match => ({ match, item: getEbookSelection({ variantsid: match.row[12] }) }))
          .filter(entry => entry.item)
          .filter((entry, index, list) =>
            list.findIndex(other => other.item.productId === entry.item.productId && other.item.language === entry.item.language) === index
          );
        const ebooks = ebookRows
          .map(({ item }) => item)
          .filter((item, index, list) =>
            list.findIndex(other => other.productId === item.productId && other.language === item.language) === index
          )
          .map(item => ({ ...item, title: EBOOK_TITLES[item.productId] || 'Curvafit guide' }));

        let access = null;
        if (ebooks.length) {
          const now = Date.now();
          const variantIds = new Set(ebooks.map(item => String(item.variantId)));
          const recordedExpiries = matches
            .filter(({ row }) => variantIds.has(String(row[12] || '')))
            .map(({ row }) => String(row[24] || '').trim())
            .map(value => value.match(/^open:(\d+)$/)?.[1])
            .filter(Boolean)
            .map(Number);
          const expiresAt = recordedExpiries.length
            ? Math.min(...recordedExpiries)
            : now + 5 * 60 * 1000;

          if (now >= expiresAt) {
            return json(410, { success: false, expired: true, error: 'The ebook download window has closed.' });
          }

          access = createEbookAccessToken(orderId, ebooks, env, now, expiresAt);
          if (!access) return json(503, { success: false, error: 'Ebook download access is not configured.' });

          for (const { rowNumber, row } of matches) {
            if (!variantIds.has(String(row[12] || ''))) continue;
            const status = String(row[24] || '').trim().toLowerCase();
            if (status === 'success' || status.startsWith('open:')) continue;
            await sheetsForOrder.sheets.spreadsheets.values.update({
              spreadsheetId: sheetsForOrder.spreadsheetId,
              range: `'${SHEET_TAB}'!${DOWNLOAD_STATUS_COLUMN}${rowNumber}`,
              valueInputOption: 'RAW',
              resource: { values: [[`open:${expiresAt}`]] }
            });
          }

        }

        return json(200, {
          success: true,
          ebooks: ebooks.map(({ productId, language, variantId, title }) => ({ productId, language, variantId, title })),
          ebookAccessToken: access?.token || '',
          ebookAccessExpiresAt: access?.expiresAt || 0
        });
    }
    if (!['availability', 'download', 'complete'].includes(action)) {
      return json(400, { success: false, error: 'Unknown action.' });
    }

    const tokenData = verifyEbookAccessToken(body.token, env);
    if (!tokenData) return json(401, { success: false, error: 'Invalid or expired ebook download access.' });

    if (action === 'availability') {
      const { matches } = await getOrderRows(env, tokenData.paymentId);
      const ebooks = await Promise.all(tokenData.ebooks.map(async item => {
        const download = getEbookDownload(item.productId, item.language);
        const orderRows = rowsForVariant(matches, item.variantId);
        const alreadyDownloaded = orderRows.some(({ row }) => String(row[24] || '').trim().toLowerCase() === 'success');
        const objectExists = Boolean(download?.key && env.EBOOKS_BUCKET && await env.EBOOKS_BUCKET.head(download.key));
        return {
          productId: item.productId,
          variantId: item.variantId,
          language: item.language,
          title: item.title,
          available: Boolean(download && objectExists && orderRows.length && !alreadyDownloaded),
          configured: Boolean(download && env.EBOOKS_BUCKET)
        };
      }));
      return json(200, { success: true, expiresAt: tokenData.expiresAt, ebooks });
    }

    const item = findAuthorizedEbook(tokenData, variantId);
    if (!item) return json(403, { success: false, error: 'This ebook is not part of the verified order.' });

    const { sheets, matches, spreadsheetId } = await getOrderRows(env, tokenData.paymentId);
    const orderRows = rowsForVariant(matches, item.variantId);
    if (!orderRows.length) return json(403, { success: false, error: 'No matching paid order item was found.' });
    if (orderRows.some(({ row }) => String(row[24] || '').trim().toLowerCase() === 'success')) {
      return json(409, { success: false, error: 'This ebook has already been downloaded.' });
    }

    if (action === 'complete') {
      for (const { rowNumber } of orderRows) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${SHEET_TAB}'!${DOWNLOAD_STATUS_COLUMN}${rowNumber}`,
          valueInputOption: 'RAW',
          resource: { values: [['success']] }
        });
      }
      return json(200, { success: true, status: 'success' });
    }

    const download = getEbookDownload(item.productId, item.language);
    if (!download || !env.EBOOKS_BUCKET) {
      return json(503, { success: false, error: 'Ebook storage is not configured yet.' });
    }

    const ebookFile = await env.EBOOKS_BUCKET.get(download.key);
    if (!ebookFile || !ebookFile.body) {
      return json(404, { success: false, error: 'The ebook file is not available yet. Please try again later.' });
    }

    return new Response(ebookFile.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFileName(item.title, item.language)}"`,
        'Content-Length': String(ebookFile.size),
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.error('[EBOOK DOWNLOAD]', error.message);
    return json(500, { success: false, error: 'Unable to process this ebook download.' });
  }
}

export async function onRequestPost(context) {
  return handlePost(context);
}
