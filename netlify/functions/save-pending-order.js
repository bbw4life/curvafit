// save-pending-order.js
const { google } = require('googleapis');
async function isAlreadyProcessed(paymentId) {
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
    const rangesToTry = ["PendingOrders!C:C", "Sheet1!C:C", "Feuille 1!C:C"];
    for (const range of rangesToTry) {
      try {
        let attempt = 0;
        while (attempt < 3) {
          const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: range
          });
          const rows = res.data.values || [];
          if (rows.some(row => row[0] === paymentId)) {
            return true;
          }
          attempt++;
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 1000)); // Wait 1s
          }
        }
      } catch (e) {
        // next range
      }
    }
    return false;
  } catch (e) {
    console.error("[DUPLICATE CHECK ERROR in save]", e.message);
    return false;
  }
}
exports.handler = async (event) => {
  console.log('[SAVE PENDING] Function invoked');
  try {
    if (!event.body) {
      return response(400, { success: false, error: "No data received" });
    }
    const body = JSON.parse(event.body);
    const { shipping, item, payment_provider, payment_id, status = "pending_stock" } = body;
    if (!payment_id) throw new Error("Missing payment_id");
    console.log(`[SAVE PENDING] Tentative pour payment_id: ${payment_id} | status: ${status}`);
    // Check for duplicate before saving
    const alreadySaved = await isAlreadyProcessed(payment_id);
    if (alreadySaved) {
      console.log(`[SAVE PENDING] Already saved for ${payment_id} → SKIP`);
      return response(200, { success: true, message: "Already saved" });
    }
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const now = new Date().toISOString();
    const internalOrderId = `PENDING_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const values = [[
      internalOrderId,
      payment_provider,
      payment_id,
      shipping.fullName || "",
      shipping.email || "",
      shipping.phone || "",
      shipping.country || "US",
      shipping.state || "",
      shipping.city || "",
      shipping.postalCode || "",
      shipping.address || "",
      item.cj_product_id || "",
      item.cj_variant_id || "",
      item.quantity || 1,
      status, // pending_stock ou pending_rate_limit
      "paid",
      now
    ]];
    // === TEST AUTOMATIQUE DE L'ONGLET ===
    const rangesToTry = ["PendingOrders!A:Q", "Sheet1!A:Q", "Feuille 1!A:Q"];
    let success = false;
    for (const range of rangesToTry) {
      try {
        console.log(`[SAVE PENDING] Essai range → ${range}`);
        const appendRes = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: range,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          resource: { values }
        });
        console.log(`[SAVE PENDING] ✅ SAUVEGARDE OK dans ${range} | ID: ${internalOrderId}`);
        success = true;
        break;
      } catch (err) {
        console.log(`[SAVE PENDING] ❌ Échec avec ${range} → ${err.message}`);
      }
    }
    if (!success) throw new Error("Aucun nom d'onglet n'a fonctionné. Vérifie le nom exact en bas de ton Google Sheet.");
    return response(200, { success: true });
  } catch (error) {
    console.error("SAVE PENDING ERROR:", error.message);
    console.error("Stack:", error.stack);
    return response(500, { success: false, error: error.message });
  }
};
function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}