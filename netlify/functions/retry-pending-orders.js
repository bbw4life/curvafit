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
    const rangesToTry = ["Feuille 1!A:Q", "PendingOrders!A:Q", "Sheet1!A:Q"];
    let rows = [];
    let activeTab = "";
    for (const range of rangesToTry) {
      try {
        const getRes = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        rows = getRes.data.values || [];
        if (rows.length > 1) {
          activeTab = range.split('!')[0];
          console.log(`[RETRY PENDING] ✅ Onglet détecté : ${activeTab} (${rows.length - 1} commandes potentielles)`);
          break;
        } else {
          console.log(`[RETRY PENDING] Onglet ${range.split('!')[0]} vide ou sans données`);
        }
      } catch (e) {
        console.error(`[RETRY PENDING] Erreur accès onglet ${range.split('!')[0]}: ${e.message}`);
      }
    }
    if (rows.length <= 1) {
      console.log('[RETRY PENDING] Aucune commande en attente trouvée dans aucun onglet');
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0, message: "Aucune pending" }) };
    }
    const dataRows = rows.slice(1).filter(row => row.length >= 15); // Filtrer lignes incomplètes
    let processed = 0;
    let fulfilled = 0;
    let errors = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const status = row[14] || "";
      if (!["pending_stock", "pending_rate_limit"].includes(status)) {
        console.log(`[RETRY PENDING] Ligne ${i+2} sautée (status: ${status})`);
        continue;
      }
      processed++;
      const lineNumber = i + 2;
      const internalId = row[0] || "UNKNOWN";
      const cj_variant_id = row[12] || "";
      if (!cj_variant_id) {
        console.log(`[RETRY PENDING] Ligne ${lineNumber} sautée: Pas de cj_variant_id`);
        errors.push(`Ligne ${lineNumber}: Pas de variant_id`);
        continue;
      }
      const shipping = {
        fullName: row[3] || "", email: row[4] || "", phone: row[5] || "",
        country: row[6] || "US", state: row[7] || "", city: row[8] || "",
        postalCode: row[9] || "", address: row[10] || ""
      };
      const cart = [{
        cj_product_id: row[11] || "",
        cj_variant_id: cj_variant_id,
        quantity: parseInt(row[13]) || 1
      }];
      console.log(`[RETRY PENDING] 🔄 Traitement ligne ${lineNumber} (${status}) → ${internalId} (variant: ${cj_variant_id})`);
      let stockRetryAttempts = 0;
      let stockData;
      while (stockRetryAttempts < 3) {
        try {
          if (processed > 1 || stockRetryAttempts > 0) {
            console.log(`[RETRY PENDING] ⏳ Attente 310s pour rate limit CJ... (tentative stock ${stockRetryAttempts + 1})`);
            await delay(310000);
          }
          const accessToken = await getAccessToken();
          // Check stock
          const stockRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/check-cj-stock`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cj_variant_id: cart[0].cj_variant_id })
          });
          stockData = await stockRes.json();
          console.log(`[RETRY PENDING] Stock check: success=${stockData.success}, inStock=${stockData.inStock}, isRateLimit=${stockData.isRateLimit || false}`);
          if (stockData.success) break; // Succès, on sort
          if (stockData.isRateLimit) {
            stockRetryAttempts++;
            continue; // Réessaie après délai
          } else {
            throw new Error(stockData.error || "Stock check échoué");
          }
        } catch (err) {
          console.error(`[RETRY PENDING] ❌ Erreur ligne ${lineNumber} pendant stock: ${err.message}`);
          if (err.message.includes("Too Many Requests")) {
            stockRetryAttempts++;
            continue;
          } else {
            errors.push(`Ligne ${lineNumber}: ${err.message}`);
            break; // Erreur non-rate limit, on skip
          }
        }
      }
      if (!stockData || !stockData.success || !stockData.inStock) {
        errors.push(`Ligne ${lineNumber}: Stock check final échoué ou insuffisant`);
        continue;
      }
      // Create CJ Order (avec retry similaire si rate limit)
      let createRetryAttempts = 0;
      while (createRetryAttempts < 3) {
        try {
          const createRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/create-cj-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cart, shipping })
          });
          const createData = await createRes.json();
          console.log(`[RETRY PENDING] CJ create: success=${createData.success}`);
          if (createData.success) {
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `${activeTab}!O${lineNumber}`,
              valueInputOption: "RAW",
              resource: { values: [["completed"]] }
            });
            console.log(`[RETRY PENDING] 🎉 SUCCÈS CJ pour ${internalId} ! Mise à jour status → completed`);
            fulfilled++;
            break;
          } else if (createData.error && createData.error.includes("Too Many Requests")) {
            createRetryAttempts++;
            console.log(`[RETRY PENDING] Rate limit sur create → attente 310s (tentative ${createRetryAttempts}/3)`);
            await delay(310000);
            continue;
          } else {
            throw new Error(createData.error || "Échec création CJ");
          }
        } catch (err) {
          console.error(`[RETRY PENDING] ❌ Erreur ligne ${lineNumber} pendant create: ${err.message}`);
          if (err.message.includes("Too Many Requests")) {
            createRetryAttempts++;
            await delay(310000);
            continue;
          } else {
            errors.push(`Ligne ${lineNumber}: ${err.message}`);
            break;
          }
        }
      }
    }
    const summary = `[RETRY PENDING] ✅ FIN - Traités: ${processed} | Réussis: ${fulfilled} | Erreurs: ${errors.length}`;
    console.log(summary);
    return { statusCode: 200, body: JSON.stringify({ success: true, processed, fulfilled, errors }) };
  } catch (error) {
    console.error("[RETRY PENDING] ERREUR GLOBALE:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }