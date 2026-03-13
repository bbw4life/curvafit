// netlify/functions/save-account.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { action = 'signup', lastName, firstName, email, phone = "", password, newsletter = "No", 
            line1, line2, city, state, zip, newPassword } = body;

    const normalize = (str) => str ? str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim() : "";
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_ACCOUNTS;

    // RANGES CORRIGÉS : priorité à "Feuille 1" (ton vrai nom d'onglet)
    const rangesToTry = [
      "Feuille 1!A:N", "Feuille 1!A1", "Feuille 1", "Feuille 1!A:Z",
      "CurvaAccount!A:N", "CurvaAccount!A1", "CurvaAccount", "CurvaAccount!A:Z"
    ];

    if (action === 'signup') {
      if (!lastName || !firstName || !email || !password) throw new Error("Données manquantes");
      const values = [[normalize(lastName), normalize(firstName), normalize(email).toLowerCase(), normalize(phone), normalize(password), newsletter, 0, 0, 0, "", "", "", "", ""]];
      let success = false;
      for (const range of rangesToTry) {
        try {
          await sheets.spreadsheets.values.append({ spreadsheetId, range, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", resource: { values } });
          console.log(`✅ Inscription écrite dans : ${range}`);
          success = true; break;
        } catch (e) { console.log(`❌ Échec append ${range}`); }
      }
      if (!success) throw new Error("Impossible d’écrire");
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // UPDATE ADDRESS (4 colonnes)
    if (action === 'update-address') {
      const userEmail = normalize(email).toLowerCase();
      let rows = null;
      for (const range of rangesToTry) {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        if (res.data.values) { rows = res.data.values; break; }
      }
      const rowIndex = rows.findIndex(row => normalize(row[2] || "").toLowerCase() === userEmail);
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      const rowNum = rowIndex + 1;

      // Mise à jour sur "Feuille 1" (le vrai onglet)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Feuille 1!J${rowNum}:N${rowNum}`,
        valueInputOption: "RAW",
        resource: { values: [[line1 || "", line2 || "", city || "", state || "", zip || ""]] }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // UPDATE PASSWORD
    if (action === 'update-password') {
      const userEmail = normalize(email).toLowerCase();
      let rows = null;
      for (const range of rangesToTry) {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        if (res.data.values) { rows = res.data.values; break; }
      }
      const rowIndex = rows.findIndex(row => normalize(row[2] || "").toLowerCase() === userEmail);
      if (rowIndex === -1) throw new Error("Email non reconnu");
      const rowNum = rowIndex + 1;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Feuille 1!E${rowNum}`,
        valueInputOption: "RAW",
        resource: { values: [[normalize(newPassword)]] }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    throw new Error("Action inconnue");
  } catch (error) {
    console.error("SAVE ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};