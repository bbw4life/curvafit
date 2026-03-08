// save-pending-order.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  console.log('[SAVE PENDING] Function invoked');

  try {
    if (!event.body) return response(400, { success: false, error: "No data" });

    const { shipping, item, payment_provider, payment_id } = JSON.parse(event.body);
    if (!payment_id) throw new Error("Missing payment_id");

    // === DÉDOUBLONNAGE (empêche les doubles webhook PayPal) ===
    const alreadyExists = await checkIfExists(payment_id);
    if (alreadyExists) {
      console.log(`[SAVE PENDING] Déjà existant (${payment_id}) → skip`);
      return response(200, { success: true, skipped: true });
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
      internalOrderId, payment_provider, payment_id,
      shipping.fullName || "", shipping.email || "", shipping.phone || "",
      shipping.country || "US", shipping.state || "", shipping.city || "",
      shipping.postalCode || "", shipping.address || "",
      item.cj_product_id || "", item.cj_variant_id || "",
      item.quantity || 1,
      "pending_stock", "paid", now
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "PendingOrders!A:Q",   // maintenant ça marche
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: { values }
    });

    console.log(`[SAVE PENDING] ✅ Sauvegardé : ${payment_id}`);
    return response(200, { success: true });

  } catch (error) {
    console.error("SAVE PENDING ERROR:", error.message);
    return response(500, { success: false, error: error.message });
  }
};

// Vérifie si le payment_id existe déjà
async function checkIfExists(payment_id) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "PendingOrders!C:C" // colonne payment_id
    });
    const rows = res.data.values || [];
    return rows.some(row => row[0] === payment_id);
  } catch (e) {
    return false; // si le sheet est vide, on continue
  }
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}