const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };

  try {
    const body = JSON.parse(event.body);
    let { lastName, firstName, email, phone = "", password, newsletter = "No" } = body;

    if (!lastName || !firstName || !email || !password) throw new Error("Données manquantes");

    const normalize = (str) => str ? str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim() : "";
    lastName = normalize(lastName);
    firstName = normalize(firstName);
    email = normalize(email).toLowerCase();
    phone = normalize(phone);

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_ACCOUNTS;

    const values = [[lastName, firstName, email, phone, password, newsletter, 0, 0, 0]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "CurvaAccount!A:I",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: { values }
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};