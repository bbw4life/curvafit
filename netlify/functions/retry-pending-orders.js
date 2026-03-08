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
    // === PRIORITÉ SUR "Feuille 1" car tes logs montrent que c'est l'onglet actif ===
    const rangesToTry = ["Feuille 1!A:Q", "PendingOrders!A:Q", "Sheet1!A:Q"];  // CHANGEMENT: Priorité à Feuille 1
    let rows = [];
    let activeTab = "";
    for (const range of rangesToTry) {
      try {
        console.log(`[RETRY PENDING] Test onglet: ${range.split('!')[0]}`);
        const getRes = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        rows = getRes.data.values || [];
        if (rows.length > 1) {
          activeTab = range.split('!')[0];
          console.log(`[RETRY PENDING] ✅ Onglet détecté : ${activeTab} (${rows.length} lignes)`);
          break;
        }
      } catch (e) {
        console.log(`[RETRY PENDING] ${range.split('!')[0]} non trouvé: ${e.message}`);
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
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const status = row[14] || "";
      if (!["pending_stock", "pending_rate_limit"].includes(status)) continue;
      processed++;
      const lineNumber = i + 2;
      const internalId = row[0];
      const shipping = {
        fullName: row[3] || "", email: row[4] || "", phone: row[5] || "",
        country: row[6] || "US", state: row[7] || "", city: row[8] || "",
        postalCode: row[9] || "", address: row[10] || ""
      };
      const cart = [{
        cj_product_id: row[11] || "",
        cj_variant_id: row[12] || "",
        quantity: parseInt(row[13]) || 1
      }];
      console.log(`[RETRY PENDING] 🔄 Traitement ligne ${lineNumber} (${status}) → ${internalId}`);
      try {
        if (processed > 1) {
          console.log(" ⏳ Attente 320s pour rate limit CJ...");
          await delay(320000);
        }
        const accessToken = await getAccessToken();
        // Check stock avec retry intégré (appel à check-cj-stock qui gère déjà les retries)
        const stockRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/check-cj-stock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cj_variant_id: cart[0].cj_variant_id })
        });
        const stockData = await stockRes.json();
        if (!stockData.success || !stockData.inStock) {
          errors.push(`Ligne ${lineNumber}: Stock insuffisant ou erreur (${stockData.error})`);
          continue;
        }
        // Create CJ Order
        const createRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/create-cj-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart, shipping })
        });
        const createData = await createRes.json();
        if (createData.success) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${activeTab}!O${lineNumber}`,
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
    }
    console.log(`[RETRY PENDING] ✅ FIN - Traités: ${processed} | Réussis: ${fulfilled} | Erreurs: ${errors.length}`);
    return { statusCode: 200, body: JSON.stringify({ success: true, processed, fulfilled, errors }) };
  } catch (error) {
    console.error("RETRY ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }