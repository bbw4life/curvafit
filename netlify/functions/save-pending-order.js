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
    // Find the correct sheet
    const rangesToTry = ["PendingOrders!A:Q", "Sheet1!A:Q", "Feuille 1!A:Q"];
    let activeRange = null;
    for (const range of rangesToTry) {
      try {
        await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: range
        });
        activeRange = range;
        console.log(`[SAVE PENDING] Onglet actif détecté: ${range}`);
        break;
      } catch (e) {
        console.log(`[SAVE PENDING] Range ${range} non trouvé: ${e.message}`);
      }
    }
    if (!activeRange) throw new Error("Aucun onglet valide trouvé.");
    // Check if already exists for this payment_id and cj_variant_id
    const fullRange = activeRange.replace('A:Q', 'A:R'); // to be safe
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: fullRange
    });
    const rows = getRes.data.values || [];
    const variantId = item.cj_variant_id || '';
    const exists = rows.some(row => row[2] === payment_id && row[12] === variantId);
    if (exists) {
      console.log(`[SAVE PENDING] Entrée déjà existante pour ${payment_id} et ${variantId} → SKIP`);
      return response(200, { success: true, message: "Already exists" });
    }
    // Proceed to append
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
      status,
      "paid",
      now
    ]];
    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: activeRange,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: { values }
    });
    console.log(`[SAVE PENDING] ✅ SAUVEGARDE OK dans ${activeRange} | ID: ${internalOrderId}`);
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