// netlify/functions/save-pending-order.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  console.log("🚀 SAVE-PENDING STARTED with body:", event.body);

  try {
    if (!event.body) {
      return response(400, { success: false, error: "No data received" });
    }

    console.log("📋 Checking env vars...");
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY ||
      !process.env.GOOGLE_SHEET_ID
    ) {
      throw new Error("Missing Google Sheets environment variables");
    }
    console.log("✅ Env vars present.");

    const { shipping, item, payment_provider, payment_id } = JSON.parse(event.body);

    console.log("📊 Parsed data:", {
      hasShipping: !!shipping,
      hasItem: !!item,
      payment_provider,
      payment_id
    });

    if (!shipping || !item || !payment_provider || !payment_id) {
      throw new Error("Missing required fields");
    }

    console.log("🔑 Creating Google auth...");
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });
    console.log("✅ Sheets client created.");

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const now = new Date().toISOString();
    const internalOrderId = `PENDING_${Date.now()}_${Math.floor(Math.random()*10000)}`;

    const values = [[
      internalOrderId,                 // A: internal_order_id
      payment_provider,                // B
      payment_id,                      // C
      shipping.fullName || "",         // D
      shipping.email || "",            // E
      item.cj_product_id || "",        // F
      item.cj_variant_id || "",        // G
      item.quantity || 1,              // H
      "pending_stock",                 // I
      "paid",                          // J
      now                              // K
    ]];

    console.log("📝 Appending values to sheet:", values);

    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "PendingOrders!A:K",
      valueInputOption: "RAW",
      resource: { values }
    });

    console.log("✅ Append successful:", appendResponse.data);

    return response(200, { success: true });

  } catch (error) {
    console.error("❌ SAVE PENDING ERROR:", error.message);
    if (error.response) {
      console.error("Google API ERROR DETAILS:", error.response.data);
    }
    return response(500, {
      success: false,
      error: "Failed to save pending order"
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