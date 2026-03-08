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
    // === PRIORITÉ SUR "Feuille 1" (le seul qui marche dans tes logs) ===
    const rangesToTry = ["PendingOrders!A:Q", "Sheet1!A:Q", "Feuille 1!A:Q"];
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
    const now = new Date();
    let eligible = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const status = row[14] || ""; // O
      if (!["pending_create", "pending_rate_limit", "pending_stock", "pending_no_variant"].includes(status)) continue;
      if (!row[12]) continue; // M: cj_variant_id must exist
      const savedTimeStr = row[16]; // Q
      const savedTime = new Date(savedTimeStr);
      if (isNaN(savedTime.getTime())) continue; // invalid date
      let delayMs;
      if (status === "pending_create" || status === "pending_rate_limit") {
        delayMs = 1 * 60 * 1000; // 1 min
      } else if (status === "pending_stock") {
        delayMs = 24 * 60 * 60 * 1000; // 24h
      } else {
        continue; // skip pending_no_variant
      }
      if (now.getTime() - savedTime.getTime() >= delayMs) {
        eligible.push({
          lineNumber: i + 2,
          savedTime: savedTime.getTime(),
          status,
          internalId: row[0],
          shipping: {
            fullName: row[3] || "", email: row[4] || "", phone: row[5] || "",
            country: row[6] || "US", state: row[7] || "", city: row[8] || "",
            postalCode: row[9] || "", address: row[10] || ""
          },
          cart: [{
            cj_product_id: row[11] || "",
            cj_variant_id: row[12] || "",
            quantity: parseInt(row[13]) || 1
          }]
        });
      }
    }
    if (eligible.length === 0) {
      console.log('[RETRY PENDING] Aucune commande éligible');
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0 }) };
    }
    // Sort by oldest first
    eligible.sort((a, b) => a.savedTime - b.savedTime);
    // Process only the oldest one
    const toProcess = eligible[0];
    const { lineNumber, status, internalId, shipping, cart } = toProcess;
    console.log(`[RETRY PENDING] 🔄 Traitement de la plus ancienne éligible ligne ${lineNumber} (${status}) → ${internalId}`);
    let needStockCheck = (status === "pending_stock" || status === "pending_rate_limit");
    try {
      const accessToken = await getAccessToken();
      let inStock = true;
      if (needStockCheck) {
        // Check stock
        const stockRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/check-cj-stock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cj_variant_id: cart[0].cj_variant_id })
        });
        const stockData = await stockRes.json();
        if (stockData.isRateLimit || !stockData.success) {
          console.log(` ❌ ${stockData.isRateLimit ? 'Rate limit' : 'Erreur'} sur check stock → reset saved_time`);
          await updateSavedTime(sheets, spreadsheetId, activeTab, lineNumber, now.toISOString());
          return { statusCode: 200, body: JSON.stringify({ success: true, processed: 1, fulfilled: 0 }) };
        }
        inStock = stockData.inStock;
      }
      if (!inStock) {
        console.log(` ❌ Stock insuffisant → reset saved_time pour retry plus tard`);
        await updateSavedTime(sheets, spreadsheetId, activeTab, lineNumber, now.toISOString());
        return { statusCode: 200, body: JSON.stringify({ success: true, processed: 1, fulfilled: 0 }) };
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
        return { statusCode: 200, body: JSON.stringify({ success: true, processed: 1, fulfilled: 1 }) };
      } else {
        const isRateLimit = createData.error.includes("Too Many Requests");
        console.log(` ❌ Échec création CJ ${isRateLimit ? '(rate limit)' : ''} → reset saved_time`);
        if (isRateLimit) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${activeTab}!O${lineNumber}`,
            valueInputOption: "RAW",
            resource: { values: [["pending_rate_limit"]] }
          });
        }
        await updateSavedTime(sheets, spreadsheetId, activeTab, lineNumber, now.toISOString());
        return { statusCode: 200, body: JSON.stringify({ success: true, processed: 1, fulfilled: 0 }) };
      }
    } catch (err) {
      console.error(` ❌ Erreur ligne ${lineNumber}:`, err.message);
      const isRateLimit = err.message.includes("Too Many Requests");
      if (isRateLimit) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${activeTab}!O${lineNumber}`,
          valueInputOption: "RAW",
          resource: { values: [["pending_rate_limit"]] }
        });
      }
      await updateSavedTime(sheets, spreadsheetId, activeTab, lineNumber, now.toISOString());
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 1, fulfilled: 0 }) };
    }
  } catch (error) {
    console.error("RETRY ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
async function updateSavedTime(sheets, spreadsheetId, activeTab, lineNumber, newTime) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${activeTab}!Q${lineNumber}`,
    valueInputOption: "RAW",
    resource: { values: [[newTime]] }
  });
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }