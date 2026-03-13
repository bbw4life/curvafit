// netlify/functions/save-account.js
const { google } = require('googleapis');
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
  try {
    const body = JSON.parse(event.body);
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n") },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_ACCOUNTS;
    const normalize = (str) => str ? str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim() : "";

    // === CRÉATION COMPTE ===
    if (!body.action) {
      let { lastName, firstName, email, phone = "", password, newsletter = "No" } = body;
      if (!lastName || !firstName || !email || !password) throw new Error("Données manquantes");
      lastName = normalize(lastName); firstName = normalize(firstName); email = normalize(email).toLowerCase(); phone = normalize(phone);
      const values = [[lastName, firstName, email, phone, password, newsletter, 0, 0, 0, ""]];
      const rangesToTry = ["CurvaAccount!A:J", "CurvaAccount!A1", "CurvaAccount", "CurvaAccount!A:Z"];
      let success = false;
      for (const range of rangesToTry) {
        try {
          await sheets.spreadsheets.values.append({ spreadsheetId, range, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", resource: { values } });
          success = true; break;
        } catch (e) {}
      }
      if (!success) throw new Error("Impossible d’écrire");
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // === UPDATE ADRESSE OU PASSWORD ===
    const { action, email, address, password } = body;
    if (!email) throw new Error("Email requis");
    const rangesToTry = ["CurvaAccount!A:J", "CurvaAccount!A1", "CurvaAccount", "CurvaAccount!A:Z"];
    let rows = null; let rowIndex = -1;
    for (const range of rangesToTry) {
      try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        if (res.data.values) {
          rows = res.data.values;
          rowIndex = rows.findIndex(row => (row[2] || "").toLowerCase() === email.toLowerCase());
          if (rowIndex !== -1) break;
        }
      } catch (e) {}
    }
    if (rowIndex === -1) throw new Error("Compte non trouvé");
    const realRow = rowIndex + 1;

    if (action === 'update-address') {
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `CurvaAccount!J${realRow}`, valueInputOption: "RAW", resource: { values: [[normalize(address)]] } });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }
    if (action === 'update-password') {
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `CurvaAccount!E${realRow}`, valueInputOption: "RAW", resource: { values: [[normalize(password)]] } });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }
    throw new Error("Action inconnue");
  } catch (error) {
    console.error("SAVE ACCOUNT ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};