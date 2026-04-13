const { google } = require('googleapis');

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.CURVAFIT_ANALITIQUE_SHEET_ID;

    if (event.httpMethod === "GET") {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "CurvafitAnalitique!A:O"  // ✅ corrigé
      });
      const rows = res.data.values || [];
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, rows }) };
    }

    if (event.httpMethod === "POST") {
      if (!event.body) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: "No body" }) };
      const data = JSON.parse(event.body);

      const row = [[
        data.timestamp         || new Date().toISOString(),
        data.sessionId         || "",
        data.country           || "Unknown",
        data.city              || "Unknown",
        data.pageUrl           || "",
        data.pageTitle         || "",
        data.timeOnPage        || 0,
        data.clicks            || 0,
        data.menuClicks        || 0,
        data.scrollDepth       || 0,
        data.referrer          || "direct",
        data.device            || "desktop",
        data.browser           || "unknown",
        data.screenWidth       || 0,
        data.actionsCount      || 0
      ]];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "CurvafitAnalitique!A:O",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: { values: row }
      });

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
  } catch (err) {
    console.error("[ANALYTICS]", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};