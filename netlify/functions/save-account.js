// netlify/functions/save-account.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);
    let { lastName, firstName, email, phone = "", password, newsletter = "No" } = body;

    if (!lastName || !firstName || !email || !password) {
      throw new Error("Données manquantes");
    }

    // Normalisation (comme dans tes autres fonctions)
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

    // === LA PARTIE QUI RÉSOUT TON PROBLÈME ===
    const rangesToTry = [
      "CurvaAccount!A:I",     // ton onglet + colonnes
      "CurvaAccount!A1",      // format que je t’avais donné
      "CurvaAccount",         // juste le nom
      "CurvaAccount!A:Z",     // plus large
      "Sheet1!A:I",           // au cas où
      "Feuille 1!A:I"
    ];

    let success = false;
    let usedRange = "";

    for (const range of rangesToTry) {
      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          resource: { values }
        });
        console.log(`✅ SAUVEGARDE OK dans : ${range}`);
        success = true;
        usedRange = range;
        break;
      } catch (err) {
        console.log(`❌ Échec avec ${range} → ${err.message}`);
      }
    }

    if (!success) {
      throw new Error("Impossible d’écrire dans le Google Sheet (aucun range n’a fonctionné)");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, usedRange })
    };

  } catch (error) {
    console.error("SAVE ACCOUNT ERROR:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};