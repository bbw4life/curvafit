// retry-pending-order.js
const { google } = require("googleapis");
const fetch = require("node-fetch");

// Map pour country name
const countryMap = {
  'US': 'United States',
  'CA': 'Canada',
  'DO': 'Dominican Republic',
  'BO': 'Bolivia',
  // Ajoute d'autres
};

// Fonction pour obtenir le token depuis Google Sheet (même que dans create-cj-order)
async function getAccessTokenFromSheet() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const now = Date.now();

  let token;
  let expiry;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Config!A1:A2'
    });
    const values = res.data.values || [];
    token = values[0] ? values[0][0] : null;
    expiry = values[1] ? parseInt(values[1][0]) : 0;
  } catch (e) {
    console.log("[CJ AUTH] Pas de Config sheet ou erreur lecture:", e.message);
  }

  if (token && now < expiry) {
    console.log("[CJ AUTH] ✅ Token en cache (sheet) utilisé");
    return token;
  }

  console.log("[CJ AUTH] 🔄 Demande nouveau token...");
  if (!process.env.CJ_API_KEY) throw new Error("Missing CJ_API_KEY");
  const tokenRes = await fetch(
    "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: process.env.CJ_API_KEY })
    }
  );
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || tokenData.code !== 200) {
    throw new Error(tokenData.message || "Failed to get CJ access token");
  }
  const newToken = tokenData.data.accessToken;
  const newExpiry = now + 1000 * 60 * 110; // 110 minutes

  // Sauvegarder dans sheet, mais skip si erreur (fallback to no save)
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Config!A1:A2',
      valueInputOption: "RAW",
      resource: { values: [[newToken], [newExpiry]] }
    });
    console.log("[CJ AUTH] ✅ Nouveau token sauvé dans sheet");
  } catch (e) {
    console.error("[CJ AUTH] Erreur sauvegarde token dans sheet (skip):", e.message);
  }

  return newToken;
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
    const rangesToTry = ["Feuille 1!A:P", "PendingOrders!A:P", "Sheet1!A:P"]; // A:P
    let rows = [];
    let activeTab = "";
    for (const range of rangesToTry) {
      try {
        const getRes = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        rows = getRes.data.values || [];
        if (rows.length > 1) {
          activeTab = range.split('!')[0];
          console.log(`[RETRY PENDING] ✅ Onglet détecté : ${activeTab} (${rows.length} lignes)`);
          break;
        }
      } catch (e) {
        console.log(`[RETRY PENDING] ${range.split('!')[0]} non trouvé`);
      }
    }
    if (rows.length <= 1) {
      console.log('[RETRY PENDING] Aucune commande en attente');
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0 }) };
    }
    const dataRows = rows.slice(1);
    let processed = 0;
    let fulfilled = 0;
    let errors = [];
    let found = false;
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const status = row[13] || ""; // N: status
      if (!["pending_stock", "pending_rate_limit"].includes(status)) continue;
      found = true;
      processed++;
      const lineNumber = i + 2;
      const internalId = row[1] || 'unknown'; // B: payment_id
      const shipping = {
        fullName: row[2] || "", // C
        email: row[3] || "", // D
        phone: row[4] || "", // E
        countryCode: row[5] || "US", // F
        countryName: countryMap[row[5]] || row[5],
        state: row[6] || "", // G
        city: row[7] || "", // H
        postalCode: row[8] || "", // I
        address: row[9] || "" // J
      };
      const cart = [{
        cj_product_id: row[10] || "", // K
        cj_variant_id: row[11] || "", // L
        quantity: parseInt(row[12]) || 1 // M
      }];
      console.log(`[RETRY PENDING] 🔄 Traitement ligne ${lineNumber} (${status}) → ${internalId}`);
      try {
        await getAccessTokenFromSheet(); // Assure token frais
        const createRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/create-cj-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart, shipping })
        });
        const createData = await createRes.json();
        if (createData.success) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${activeTab}!N${lineNumber}`, // N for status
            valueInputOption: "RAW",
            resource: { values: [["completed"]] }
          });
          console.log(` 🎉 SUCCÈS CJ pour ${internalId} !`);
          fulfilled++;
        } else {
          throw new Error(createData.error || "Échec création CJ");
        }
      } catch (err) {
        console.error(` ❌ Erreur ligne ${lineNumber}:`, err.message);
        errors.push(`Ligne ${lineNumber}: ${err.message}`);
      }
      break; // Traite seulement un par run
    }
    if (!found) {
      console.log('[RETRY PENDING] Aucune pending à traiter');
    }
    console.log(`[RETRY PENDING] ✅ FIN - Traités: ${processed} | Réussis: ${fulfilled}`);
    return { statusCode: 200, body: JSON.stringify({ success: true, processed, fulfilled, errors }) };
  } catch (error) {
    console.error("RETRY ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }