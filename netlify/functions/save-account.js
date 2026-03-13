// netlify/functions/save-account.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);

    // ====================== MISE À JOUR MOT DE PASSE ======================
    if (body.action === 'updatePassword') {
      let { email, currentPassword, newPassword } = body;
      if (!email || !currentPassword || !newPassword) {
        throw new Error("Données manquantes pour mise à jour");
      }

      const normalize = (str) => str ? str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim() : "";
      const userEmail = normalize(email).toLowerCase();
      const currPassNorm = normalize(currentPassword);
      const newPassNorm = normalize(newPassword);

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"]
      });

      const sheets = google.sheets({ version: "v4", auth });
      const spreadsheetId = process.env.GOOGLE_SHEET_ID_ACCOUNTS;

      const rangesToTry = [
        "CurvaAccount!A:I", "CurvaAccount!A1", "CurvaAccount",
        "CurvaAccount!A:Z", "Sheet1!A:I", "Feuille 1!A:I"
      ];

      let rows = null;
      let sheetName = "CurvaAccount";

      for (const range of rangesToTry) {
        try {
          const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
          if (res.data.values && res.data.values.length > 0) {
            rows = res.data.values;
            sheetName = range.split('!')[0];
            break;
          }
        } catch (err) {}
      }

      if (!rows) throw new Error("Impossible de lire le Google Sheet");

      const rowIndex = rows.findIndex(row => {
        const sheetEmail = normalize(row[2] || '').toLowerCase();
        const sheetPass = row[4] || '';
        return sheetEmail === userEmail && sheetPass === currPassNorm;
      });

      if (rowIndex === -1) throw new Error("Mot de passe actuel incorrect");

      const rowNumber = rowIndex + 1;
      const updateRange = `${sheetName}!E${rowNumber}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: updateRange,
        valueInputOption: "RAW",
        resource: { values: [[newPassNorm]] }
      });

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ====================== INSCRIPTION NORMALE (code original intact) ======================
    let { lastName, firstName, email, phone = "", password, newsletter = "No" } = body;

    if (!lastName || !firstName || !email || !password) {
      throw new Error("Données manquantes");
    }

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

    const rangesToTry = [
      "CurvaAccount!A:I", "CurvaAccount!A1", "CurvaAccount",
      "CurvaAccount!A:Z", "Sheet1!A:I", "Feuille 1!A:I"
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