const { google } = require("googleapis");
const fetch = require("node-fetch");

exports.handler = async () => {
  try {
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY ||
      !process.env.GOOGLE_SHEET_ID ||
      !process.env.BASE_URL
    ) {
      throw new Error("Missing environment variables");
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

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "PendingOrders!A:K"
    });

    const rows = response.data.values || [];

    if (rows.length <= 1) {
      return result(0, 0, []);
    }

    const dataRows = rows.slice(1);

    let processed = 0;
    let fulfilled = 0;
    let errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];

      const fulfillmentStatus = row[8]; // Column I

      if (fulfillmentStatus !== "pending_stock") continue;

      processed++;

      const internalId = row[0];
      const shipping = {
        fullName: row[3],
        email: row[4]
      };

      const item = {
        cj_product_id: row[5],
        cj_variant_id: row[6],
        quantity: parseInt(row[7]) || 1
      };

      try {
        // 1️⃣ Check stock
        const stockRes = await fetch(
          `${process.env.BASE_URL}/.netlify/functions/check-cj-stock`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cj_variant_id: item.cj_variant_id
            })
          }
        );

        const stockData = await stockRes.json();

        if (!stockData.inStock) continue;

        // 2️⃣ Create CJ order
        await fetch(
          `${process.env.BASE_URL}/.netlify/functions/create-cj-order`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item, shipping })
          }
        );

        // 3️⃣ Update fulfillment_status → completed
        const updateRange = `PendingOrders!I${i + 2}`;

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: updateRange,
          valueInputOption: "RAW",
          resource: { values: [["completed"]] }
        });

        fulfilled++;

      } catch (err) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    return result(processed, fulfilled, errors);

  } catch (error) {
    console.error("RETRY ERROR:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

function result(processed, fulfilled, errors) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      processed,
      fulfilled,
      errors
    })
  };
}