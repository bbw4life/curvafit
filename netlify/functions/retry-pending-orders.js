// retry-pending-order.js
const { google } = require("googleapis");
const fetch = require("node-fetch");

async function getAccessToken() {
  if (!process.env.CJ_API_KEY) throw new Error("Missing CJ_API_KEY");
  const tokenRes = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: process.env.CJ_API_KEY })
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || tokenData.code !== 200) throw new Error(tokenData.message || 'Token failed');
  return tokenData.data.accessToken;
}

exports.handler = async () => {
  console.log('[RETRY PENDING] 🚀 Démarrage - ' + new Date().toISOString());

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const range = "PendingOrders!A:Q";  // Standardisé
    const getRes = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = getRes.data.values || [];

    if (rows.length <= 1) {
      console.log('[RETRY PENDING] Aucune commande en attente');
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0 }) };
    }

    const dataRows = rows.slice(1);
    let processed = 0;
    let fulfilled = 0;
    let errors = [];

    // Grouper par payment_id pour batcher par commande originale
    const groupedByPayment = dataRows.reduce((acc, row, index) => {
      const paymentId = row[2];
      if (!acc[paymentId]) acc[paymentId] = [];
      acc[paymentId].push({ row, lineNumber: index + 2 });
      return acc;
    }, {});

    let groupIndex = 0;
    for (const [paymentId, group] of Object.entries(groupedByPayment)) {
      if (groupIndex > 0) await delay(310000); // Délai entre groupes

      const pendingItems = group.filter(g => ["pending_stock", "pending_rate_limit"].includes(g.row[14] || ""));
      if (pendingItems.length === 0) continue;

      processed += pendingItems.length;
      console.log(`[RETRY PENDING] 🔄 Groupe ${paymentId} (${pendingItems.length} items)`);

      const firstRow = pendingItems[0].row;
      const shipping = {
        fullName: firstRow[3] || "", email: firstRow[4] || "", phone: firstRow[5] || "",
        country: firstRow[6] || "US", state: firstRow[7] || "", city: firstRow[8] || "",
        postalCode: firstRow[9] || "", address: firstRow[10] || ""
      };

      const inStockItems = [];
      let rateLimitHit = false;

      for (let i = 0; i < pendingItems.length; i++) {
        const { row, lineNumber } = pendingItems[i];
        const item = {
          cj_product_id: row[11] || "",
          cj_variant_id: row[12] || "",
          quantity: parseInt(row[13]) || 1
        };

        if (i > 0) await delay(310000); // Délai par stock check

        // Check stock
        const stockRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/check-cj-stock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cj_variant_id: item.cj_variant_id })
        });
        const stockData = await stockRes.json();

        if (!stockData.success) {
          rateLimitHit = stockData.isRateLimit;
          errors.push(`Ligne ${lineNumber}: Erreur stock${rateLimitHit ? ' (rate limit)' : ''}`);
          continue;
        }

        if (stockData.inStock) {
          inStockItems.push(item);
        } else {
          errors.push(`Ligne ${lineNumber}: Stock insuffisant`);
        }
      }

      // Create batch CJ order
      if (inStockItems.length > 0 && !rateLimitHit) {
        await delay(310000); // Délai avant create

        const createRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/create-cj-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart: inStockItems, shipping })
        });
        const createData = await createRes.json();

        if (createData.success) {
          for (const { lineNumber } of pendingItems) {
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `${range.split('!')[0]}!O${lineNumber}`,
              valueInputOption: "RAW",
              resource: { values: [["completed"]] }
            });
          }
          console.log(`   🎉 SUCCÈS CJ pour groupe ${paymentId} !`);
          fulfilled += pendingItems.length;
        } else {
          errors.push(`Groupe ${paymentId}: ${createData.error || "Échec création CJ"}`);
        }
      }

      groupIndex++;
    }

    console.log(`[RETRY PENDING] ✅ FIN - Traités: ${processed} | Réussis: ${fulfilled}`);
    return { statusCode: 200, body: JSON.stringify({ success: true, processed, fulfilled, errors }) };

  } catch (error) {
    console.error("RETRY ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }