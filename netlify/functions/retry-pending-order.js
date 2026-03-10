// retry-pending-order.js
const { google } = require("googleapis");
const fetch = require("node-fetch");
// === CACHE GLOBAL DU TOKEN ===
let cachedToken = null;
let tokenExpiry = 0;
async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    console.log("[CJ AUTH] ✅ Token en cache utilisé");
    return cachedToken;
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
  if (!tokenRes.ok || tokenData.code !== 200) throw new Error(tokenData.message || 'Token failed');
  cachedToken = tokenData.data.accessToken;
  tokenExpiry = now + 1000 * 60 * 110;
  console.log("[CJ AUTH] ✅ Nouveau token mis en cache");
  return cachedToken;
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
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const status = row[14] || "";
      if (!["pending_stock", "pending_rate_limit", "pending_cj_queue"].includes(status)) continue;
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
        await getAccessToken(); // Ensure token is fresh
        await delay(2000); // petite pause sécurité
        // Directly create CJ Order
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
      break; // Process only one per invocation to respect rate limits
    }
    console.log(`[RETRY PENDING] ✅ FIN - Traités: ${processed} | Réussis: ${fulfilled}`);
    return { statusCode: 200, body: JSON.stringify({ success: true, processed, fulfilled, errors }) };
  } catch (error) {
    console.error("RETRY ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }