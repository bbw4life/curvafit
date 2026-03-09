// save-pending-order.js
const { google } = require('googleapis');
exports.handler = async (event) => {
  console.log('[SAVE PENDING] Function invoked');
  try {
    if (!event.body) {
      return response(400, { success: false, error: "No data received" });
    }
    const body = JSON.parse(event.body);
    let { shipping, item, payment_provider, payment_id, status = "pending_stock" } = body;
    if (!payment_id) throw new Error("Missing payment_id");
    console.log(`[SAVE PENDING] Tentative pour payment_id: ${payment_id} | status: ${status}`);
    // Normalize strings to remove accents (mais seulement si nécessaire, pour éviter pertes)
    const normalize = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
    shipping.fullName = normalize(shipping.fullName);
    shipping.email = shipping.email || ""; // Pas de normalize pour email
    shipping.phone = shipping.phone || "";
    shipping.country = shipping.country || "US";
    shipping.state = shipping.state || "";
    shipping.city = shipping.city || "";
    shipping.postalCode = shipping.postalCode || "";
    shipping.address = normalize(shipping.address);
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
      internalOrderId,         // A
      payment_provider,        // B
      payment_id,              // C
      shipping.fullName,       // D
      shipping.email,          // E
      shipping.phone,          // F
      shipping.country,        // G
      shipping.state,          // H
      shipping.city,           // I
      shipping.postalCode,     // J
      shipping.address,        // K
      item.cj_product_id || "",// L
      item.cj_variant_id || "",// M
      item.quantity || 1,      // N
      status,                  // O
      "paid",                  // P
      now                      // Q
    ]];
    // === PRIORITÉ À PendingOrders, ET CRÉATION SI ABSENT ===
    const preferredTab = "PendingOrders";
    const rangesToTry = [`${preferredTab}!A:Q`, "Sheet1!A:Q", "Feuille 1!A:Q"];
    let success = false;
    let activeRange = rangesToTry[0]; // Par défaut PendingOrders
    try {
      // Vérifie si l'onglet existe, sinon crée-le
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetExists = spreadsheet.data.sheets.some(s => s.properties.title === preferredTab);
      if (!sheetExists) {
        console.log(`[SAVE PENDING] Création de l'onglet ${preferredTab}`);
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: { requests: [{ addSheet: { properties: { title: preferredTab } } }] }
        });
      }
    } catch (err) {
      console.error(`[SAVE PENDING] Erreur création onglet: ${err.message}`);
    }
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