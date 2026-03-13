// netlify/functions/save-account.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { action = 'signup', lastName, firstName, email, phone = "", password, newsletter = "No", 
            line1, line2, city, state, zip, newPassword,
            totalAmount = 0, totalQuantity = 0, orderItems = [] } = body;  // ← AJOUT pour record-order

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

    // === FORMAT DATE (identique à script.js) ===
    function formatDate(date) {
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear().toString().slice(-2);
      return `${d}/${m}/${y}`;
    }

    const rangesToTry = [
      "Order History!A:N", "Order History!A1", "Order History", "Order History!A:Z",
      "Feuille 1!A:N", "Feuille 1!A1", "Feuille 1", "Feuille 1!A:Z",
      "CurvaAccount!A:N", "CurvaAccount!A1", "CurvaAccount", "CurvaAccount!A:Z"
    ];

    // ==================== SIGNUP (point 1 : Member Since auto) ====================
    if (action === 'signup') {
      if (!lastName || !firstName || !email || !password) throw new Error("Données manquantes");
      const passNormalized = normalize(password).toLowerCase();
      const today = new Date();
      const memberSince = formatDate(today);

      const values = [
        [
          normalize(lastName), normalize(firstName), normalize(email).toLowerCase(),
          normalize(phone), passNormalized, newsletter,
          0, 0, 0, "", "", "", "", "",   // jusqu'à N (ZIP)
          0,                             // O → Quantity in Cart
          memberSince,                   // P → Member Since (date création auto)
          "[]"                           // Q → Order History (tableau JSON vide)
        ]
      ];

      let success = false;
      for (const range of rangesToTry) {
        try {
          await sheets.spreadsheets.values.append({
            spreadsheetId, range, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
            resource: { values }
          });
          console.log(`✅ Inscription écrite dans : ${range}`);
          success = true; break;
        } catch (e) {}
      }
      if (!success) throw new Error("Impossible d’écrire");
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== UPDATE ADDRESS ====================
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

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Order History!J${rowNum}:N${rowNum}`,   // ← changé pour ton nouvel onglet
        valueInputOption: "RAW",
        resource: { values: [[line1 || "", line2 || "", city || "", state || "", zip || ""]] }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== UPDATE PASSWORD ====================
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
      const newPassNormalized = normalize(newPassword).toLowerCase();

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Order History!E${rowNum}`,   // ← changé pour ton onglet
        valueInputOption: "RAW",
        resource: { values: [[newPassNormalized]] }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== RECORD ORDER (points 2, 3, 4) ====================
    if (action === 'record-order') {
      if (!email) throw new Error("Email requis pour record-order");
      const userEmail = normalize(email).toLowerCase();
      let rows = null;
      for (const range of rangesToTry) {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        if (res.data.values) { rows = res.data.values; break; }
      }
      const rowIndex = rows.findIndex(row => normalize(row[2] || "").toLowerCase() === userEmail);
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      const rowNum = rowIndex + 1;
      const currentRow = rows[rowIndex] || [];

      // Calculs
      const currentOrders = parseInt(currentRow[6] || 0);
      const newOrders = currentOrders + 1;

      const currentSpent = parseFloat(currentRow[7] || 0);
      const newSpent = currentSpent + parseFloat(totalAmount);

      const currentQtyCart = parseInt(currentRow[14] || 0);
      const newQtyCart = currentQtyCart + parseInt(totalQuantity);

      let history = [];
      const historyStr = currentRow[16] || "[]";
      try { history = JSON.parse(historyStr); } catch (e) { history = []; }

      const today = new Date();
      const orderDate = formatDate(today);

      history.push({
        date: orderDate,
        total: parseFloat(totalAmount).toFixed(2),
        totalQuantity: parseInt(totalQuantity),
        items: orderItems  // ← contient quantity, variant, image variant, etc.
      });

      const newHistoryStr = JSON.stringify(history);

      // Mises à jour (4 colonnes)
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `Order History!G${rowNum}`, valueInputOption: "RAW",
        resource: { values: [[newOrders]] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `Order History!H${rowNum}`, valueInputOption: "RAW",
        resource: { values: [[newSpent]] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `Order History!O${rowNum}`, valueInputOption: "RAW",
        resource: { values: [[newQtyCart]] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `Order History!Q${rowNum}`, valueInputOption: "RAW",
        resource: { values: [[newHistoryStr]] }
      });

      console.log(`✅ Order enregistré pour ${email} (Orders:${newOrders} | Spent:${newSpent} | QtyCart:${newQtyCart})`);
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    throw new Error("Action inconnue");
  } catch (error) {
    console.error("SAVE ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};