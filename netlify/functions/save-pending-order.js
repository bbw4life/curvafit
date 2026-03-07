// save-pending-order.js (corrigé avec plus de logs et gestion d'erreurs)
const { google } = require('googleapis');

exports.handler = async (event) => {
  console.log('[SAVE PENDING] Function invoked with event:', event);

  try {
    if (!event.body) {
      console.log('[SAVE PENDING] No body in event');
      return response(400, { success: false, error: "No data received" });
    }

    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY ||
      !process.env.GOOGLE_SHEET_ID
    ) {
      console.log('[SAVE PENDING] Missing Google env vars');
      throw new Error("Missing Google Sheets environment variables");
    }

    console.log('[SAVE PENDING] Sheet ID:', process.env.GOOGLE_SHEET_ID);
    console.log('[SAVE PENDING] Service Account Email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);

    const { shipping, item, payment_provider, payment_id } = JSON.parse(event.body);
    if (!shipping || !item || !payment_provider || !payment_id) {
      console.log('[SAVE PENDING] Missing fields in body:', { shipping, item, payment_provider, payment_id });
      throw new Error("Missing required fields");
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
      internalOrderId, // A: internal_order_id
      payment_provider, // B: payment_provider
      payment_id, // C: payment_id
      shipping.fullName || "", // D: fullName
      shipping.email || "", // E: email
      shipping.phone || "", // F: phone
      shipping.country || "US", // G: country
      shipping.state || "", // H: state
      shipping.city || "", // I: city
      shipping.postalCode || "", // J: postalCode
      shipping.address || "", // K: address
      item.cj_product_id || "", // L: cj_product_id
      item.cj_variant_id || "", // M: cj_variant_id
      item.quantity || 1, // N: quantity
      "pending_stock", // O: fulfillment_status
      "paid", // P: paid
      now // Q: timestamp
    ]];

    console.log('[SAVE PENDING] Appending values:', values);

    try {
      const appendRes = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "PendingOrders!A:Q",
        valueInputOption: "RAW",
        resource: { values }
      });
      console.log('[SAVE PENDING] Append response:', appendRes.data);
    } catch (appendError) {
      console.error('[SAVE PENDING] Append failed:', appendError.message, appendError.stack);
      throw appendError;
    }

    return response(200, { success: true });

  } catch (error) {
    console.error("SAVE PENDING ERROR:", error.message, error.stack);
    return response(500, {
      success: false,
      error: "Failed to save pending order: " + error.message
    });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}