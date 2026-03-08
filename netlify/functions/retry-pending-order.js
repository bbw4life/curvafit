// retry-pending-order.js

const { google } = require("googleapis");
const fetch = require("node-fetch");


// ===============================
// TOKEN CACHE
// ===============================

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {

  const now = Date.now();

  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  if (!process.env.CJ_API_KEY) {
    throw new Error("Missing CJ_API_KEY");
  }

  const tokenRes = await fetch(
    "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: process.env.CJ_API_KEY })
    }
  );

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || tokenData.code !== 200) {
    throw new Error(tokenData.message || "Token failed");
  }

  cachedToken = tokenData.data.accessToken;
  tokenExpiry = now + (1000 * 60 * 110);

  return cachedToken;
}


// ===============================
// MAIN FUNCTION
// ===============================

exports.handler = async () => {

  console.log("[RETRY PENDING] 🚀 Start " + new Date().toISOString());

  try {

    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY ||
      !process.env.GOOGLE_SHEET_ID
    ) {
      throw new Error("Missing Google environment variables");
    }

    if (!process.env.BASE_URL) {
      throw new Error("Missing BASE_URL environment variable");
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({
      version: "v4",
      auth
    });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const rangesToTry = [
      "PendingOrders!A:Q",
      "Sheet1!A:Q",
      "Feuille 1!A:Q"
    ];

    let rows = [];
    let activeTab = "";

    for (const range of rangesToTry) {

      try {

        const res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range
        });

        rows = res.data.values || [];

        if (rows.length > 1) {
          activeTab = range.split("!")[0];
          console.log(`[RETRY PENDING] Sheet detected: ${activeTab}`);
          break;
        }

      } catch {
        console.log(`[RETRY PENDING] ${range} not found`);
      }

    }

    if (rows.length <= 1) {

      console.log("[RETRY PENDING] No pending orders");

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          processed: 0
        })
      };

    }

    const dataRows = rows.slice(1);

    let processed = 0;
    let fulfilled = 0;
    let errors = [];


    for (let i = 0; i < dataRows.length; i++) {

      const row = dataRows[i];

      const status = row[14] || "";

      if (!["pending_stock", "pending_rate_limit"].includes(status)) {
        continue;
      }

      processed++;

      const lineNumber = i + 2;
      const internalId = row[0] || "";

      const shipping = {
        fullName: row[3] || "",
        email: row[4] || "",
        phone: row[5] || "",
        country: row[6] || "US",
        state: row[7] || "",
        city: row[8] || "",
        postalCode: row[9] || "",
        address: row[10] || ""
      };

      const cart = [{
        cj_product_id: row[11] || "",
        cj_variant_id: row[12] || "",
        quantity: parseInt(row[13]) || 1
      }];

      console.log(`[RETRY PENDING] Processing line ${lineNumber} (${status})`);

      try {

        if (processed > 1) {
          await delay(10000);
        }

        const createRes = await fetch(
          `${process.env.BASE_URL}/.netlify/functions/create-cj-order`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              cart,
              shipping
            })
          }
        );

        const createData = await createRes.json();

        if (createData.success) {

          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${activeTab}!O${lineNumber}`,
            valueInputOption: "RAW",
            resource: {
              values: [["completed"]]
            }
          });

          console.log(`[RETRY PENDING] 🎉 CJ order success: ${internalId}`);

          fulfilled++;

        } else {

          throw new Error(createData.error || "CJ order failed");

        }

      } catch (err) {

        console.error(`[RETRY PENDING] Error line ${lineNumber}:`, err.message);

        errors.push(`Line ${lineNumber}: ${err.message}`);

      }

    }

    console.log(`[RETRY PENDING] Finished | Processed: ${processed} | Success: ${fulfilled}`);

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

  catch (error) {

    console.error("[RETRY PENDING ERROR]", error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };

  }

};


function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}