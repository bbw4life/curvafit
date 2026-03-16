// netlify/functions/save-message.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { firstName, lastName, email, subject, message } = body;

    if (!firstName || !lastName || !email || !subject || !message) {
      throw new Error("All fields are required");
    }

    const normalize = (str) => str ? str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_MESSAGES;   // ← TON NOUVEL ID

    function formatDate() {
      const d = new Date();
      return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear().toString().slice(-2)}`;
    }

    // On ajoute la date en colonne F (bonus très utile, tu peux la cacher dans Sheets si tu veux)
    const values = [[
      normalize(firstName),
      normalize(lastName),
      normalize(email),
      subject,
      message,
      formatDate()
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "ContactMessages!A:F",           // ← Nom de ta feuille
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: { values: [values] }          // Important : tableau 2D
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error("SAVE MESSAGE ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};