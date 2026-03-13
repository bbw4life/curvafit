// netlify/functions/save-account.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };

  try {
    const body = JSON.parse(event.body);
    const { action = 'signup', lastName, firstName, email, phone = "", password, newsletter = "No",
            line1, line2, city, state, zip, newPassword,
            totalAmount = 0, totalQuantity = 0, orderItems = [] } = body;

    const normalize = (str) => str ? str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim() : "";
    const auth = new google.auth.GoogleAuth({ credentials: { client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n") }, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_ACCOUNTS;

    function formatDate(date) {
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear().toString().slice(-2);
      return `${d}/${m}/${y}`;
    }

    const rangesToTry = ["Feuille 1!A:Z", "Order History!A:Z", "Feuille 1!A:N", "Order History!A:N", "Feuille 1", "Order History"];
    let sheetPrefix = "Feuille 1!";
    let rows = null;

    // Détection automatique de l'onglet (Feuille 1 ou Order History)
    for (const range of rangesToTry) {
      try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        if (res.data.values) {
          rows = res.data.values;
          sheetPrefix = range.split('!')[0] + '!';
          console.log(`✅ Onglet détecté : ${sheetPrefix}`);
          break;
        }
      } catch (e) {}
    }

    if (action === 'signup') {
      if (!lastName || !firstName || !email || !password) throw new Error("Données manquantes");
      const passNormalized = normalize(password).toLowerCase();
      const memberSince = formatDate(new Date());

      const values = [[normalize(lastName), normalize(firstName), normalize(email).toLowerCase(), normalize(phone), passNormalized, newsletter, 0, 0, 0, "", "", "", "", "", 0, memberSince, "[]"]];
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

    // === RECORD ORDER (tes 4 demandes) ===
    if (action === 'record-order') {
      if (!email) throw new Error("Email requis");
      const userEmail = normalize(email).toLowerCase();
      if (!rows) {
        for (const range of rangesToTry) {
          const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
          if (res.data.values) { rows = res.data.values; sheetPrefix = range.split('!')[0] + '!'; break; }
        }
      }
      const rowIndex = rows.findIndex(row => normalize(row[2] || "").toLowerCase() === userEmail);
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      const rowNum = rowIndex + 1;
      const currentRow = rows[rowIndex] || [];

      const newOrders = parseInt(currentRow[6] || 0) + 1;
      const newSpent = parseFloat(currentRow[7] || 0) + parseFloat(totalAmount);
      const newQtyCart = parseInt(currentRow[14] || 0) + parseInt(totalQuantity);

      let history = [];
      try { history = JSON.parse(currentRow[16] || "[]"); } catch(e) {}
      history.push({ date: formatDate(new Date()), total: parseFloat(totalAmount).toFixed(2), totalQuantity: parseInt(totalQuantity), items: orderItems });

      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${sheetPrefix}G${rowNum}`, valueInputOption: "RAW", resource: { values: [[newOrders]] } });
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${sheetPrefix}H${rowNum}`, valueInputOption: "RAW", resource: { values: [[newSpent]] } });
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${sheetPrefix}O${rowNum}`, valueInputOption: "RAW", resource: { values: [[newQtyCart]] } });
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${sheetPrefix}Q${rowNum}`, valueInputOption: "RAW", resource: { values: [[JSON.stringify(history)]] } });

      console.log(`✅ RECORD-ORDER OK → Orders:${newOrders} | Spent:${newSpent.toFixed(2)} | QtyCart:${newQtyCart}`);
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    throw new Error("Action inconnue");
  } catch (error) {
    console.error("SAVE ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};