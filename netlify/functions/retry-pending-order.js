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
    const range = "PendingOrders!A:Q";
    const getRes = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = getRes.data.values || [];
    if (rows.length <= 1) {
      console.log('[RETRY PENDING] Aucune commande en attente');
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0 }) };
    }
    const dataRows = rows.slice(1);
    const retryDelays = {
      "pending_stock": 24 * 60 * 60 * 1000, // 24h
      "pending_create": 5 * 60 * 1000, // 5 min
      "pending_rate_check": 5 * 60 * 1000, // 5 min
      "pending_rate_create": 5 * 60 * 1000 // 5 min
    };
    const nowMs = Date.now();
    let eligible = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const status = row[14] || "";
      const timestamp = row[16] || "";
      const delay = retryDelays[status];
      if (delay === undefined) continue;
      const timestampMs = Date.parse(timestamp);
      if (isNaN(timestampMs)) continue;
      const ageMs = nowMs - timestampMs;
      if (ageMs > delay) {
        eligible.push({
          lineNumber: i + 2,
          row,
          ageMs,
          timestampMs
        });
      }
    }
    if (eligible.length === 0) {
      console.log('[RETRY PENDING] Aucune commande éligible pour retry');
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0 }) };
    }
    eligible.sort((a, b) => a.timestampMs - b.timestampMs);
    const toProcess = eligible[0];
    const lineNumber = toProcess.lineNumber;
    const row = toProcess.row;
    const status = row[14];
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
    let newStatus = status;
    let updateTimestamp = true;
    try {
      await getAccessToken();
      if (["pending_stock", "pending_rate_check"].includes(status)) {
        const stockRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/check-cj-stock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cj_variant_id: cart[0].cj_variant_id })
        });
        const stockData = await stockRes.json();
        if (stockData.isRateLimit) {
          console.log(` ⚠️ Rate limit sur stock check → set pending_rate_check`);
          newStatus = "pending_rate_check";
          updateTimestamp = true;
        } else if (!stockData.success) {
          console.log(` ❌ Erreur stock check → set pending_stock`);
          newStatus = "pending_stock";
          updateTimestamp = true;
        } else if (stockData.inStock) {
          console.log(` ✅ Stock disponible → set pending_create`);
          newStatus = "pending_create";
          updateTimestamp = true;
        } else {
          console.log(` ❌ Toujours out of stock → keep pending_stock, no timestamp update`);
          newStatus = "pending_stock";
          updateTimestamp = false;
        }
      } else if (["pending_create", "pending_rate_create"].includes(status)) {
        const createRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/create-cj-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart, shipping })
        });
        const createData = await createRes.json();
        if (createData.success) {
          console.log(` 🎉 SUCCÈS CJ pour ${internalId} !`);
          newStatus = "completed";
          updateTimestamp = false; // no need
        } else {
          const errorMsg = createData.error || '';
          if (errorMsg.includes("Too Many Requests")) {
            console.log(` ⚠️ Rate limit sur create → set pending_rate_create`);
            newStatus = "pending_rate_create";
            updateTimestamp = true;
          } else {
            console.log(` ❌ Erreur create: ${errorMsg} → keep pending_create`);
            newStatus = "pending_create";
            updateTimestamp = true;
          }
        }
      }
    } catch (err) {
      console.error(` ❌ Erreur ligne ${lineNumber}:`, err.message);
      updateTimestamp = true;
      if (err.message.includes("Too Many Requests")) {
        if (["pending_stock", "pending_rate_check"].includes(status)) {
          newStatus = "pending_rate_check";
        } else {
          newStatus = "pending_rate_create";
        }
      } // else keep newStatus
    }
    const activeTab = "PendingOrders";
    if (updateTimestamp) {
      const now = new Date().toISOString();
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${activeTab}!Q${lineNumber}`,
        valueInputOption: "RAW",
        resource: { values: [[now]] }
      });
    }
    if (newStatus !== status) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${activeTab}!O${lineNumber}`,
        valueInputOption: "RAW",
        resource: { values: [[newStatus]] }
      });
    }
    console.log(`[RETRY PENDING] ✅ FIN - Traités: 1 | Status final: ${newStatus}`);
    return { statusCode: 200, body: JSON.stringify({ success: true, processed: 1 }) };
  } catch (error) {
    console.error("RETRY ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};