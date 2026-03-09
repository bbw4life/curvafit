// save-pending-order.js
const { google } = require('googleapis');
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
    const rangesToTry = ["Feuille 1!A:Q", "PendingOrders!A:Q", "Sheet1!A:Q"];  // Priorisé Feuille 1
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