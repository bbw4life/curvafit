// retry-pending-order.js
const { google } = require("googleapis");
const fetch = require("node-fetch");

exports.handler = async () => {
  console.log('[RETRY PENDING] Function invoked');

  try {
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY ||
      !process.env.GOOGLE_SHEET_ID ||
      !process.env.BASE_URL
    ) {
      console.log('[RETRY PENDING] Missing env vars');
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

    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "PendingOrders!A:Q"
    });

    console.log('[RETRY PENDING] Sheets get response:', getRes.data);

    const rows = getRes.data.values || [];

    if (rows.length <= 1) {
      console.log('[RETRY PENDING] No pending rows');
      return result(0, 0, []);
    }

    const dataRows = rows.slice(1);

    let processed = 0;
    let fulfilled = 0;
    let errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];

      const fulfillmentStatus = row[14]; // Column O: fulfillment_status

      if (fulfillmentStatus !== "pending_stock") continue;

      processed++;

      const internalId = row[0];

      const shipping = {
        fullName: row[3],
        email: row[4],
        phone: row[5],
        country: row[6] || "US",
        state: row[7] || "",
        city: row[8] || "",
        postalCode: row[9] || "",
        address: row[10] || ""
      };

      const cart = [{
        cj_product_id: row[11],
        cj_variant_id: row[12],
        quantity: parseInt(row[13]) || 1
      }];

      console.log(`[RETRY PENDING] Processing row ${i + 2}:`, { internalId, shipping, cart });

      try {
        // 1️⃣ Check stock
        const stockRes = await fetch(
          `${process.env.BASE_URL}/.netlify/functions/check-cj-stock`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cj_variant_id: cart[0].cj_variant_id
            })
          }
        );

        const stockData = await stockRes.json();
        console.log(`[RETRY PENDING] Stock check for ${internalId}:`, stockData);

        if (!stockData.success || !stockData.inStock) {
          errors.push(`Row ${i + 2}: Out of stock`);
          continue;
        }

        // 2️⃣ Create CJ order
        const createRes = await fetch(
          `${process.env.BASE_URL}/.netlify/functions/create-cj-order`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cart, shipping })
          }
        );

        const createData = await createRes.json();
        console.log(`[RETRY PENDING] Create order for ${internalId}:`, createData);

        if (!createData.success) {
          throw new Error(createData.error || "Order creation failed");
        }

        // 3️⃣ Update fulfillment_status → completed
        const updateRange = `PendingOrders!O${i + 2}`;

        const updateRes = await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: updateRange,
          valueInputOption: "RAW",
          resource: { values: [["completed"]] }
        });

        console.log(`[RETRY PENDING] Update status for ${internalId}:`, updateRes.data);

        fulfilled++;

      } catch (err) {
        console.error(`[RETRY PENDING] Error for row ${i + 2}:`, err.message);
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    console.log('[RETRY PENDING] Summary:', { processed, fulfilled, errors });

    return result(processed, fulfilled, errors);

  } catch (error) {
    console.error("RETRY ERROR:", error.message, error.stack);
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