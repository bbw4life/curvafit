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
            totalAmount = 0, totalQuantity = 0, orderItems = [],
            currentCartQuantity = null } = body;

    const normalize = (str) => str ? str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_ACCOUNTS;

    function formatDate() {
      const d = new Date();
      return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear().toString().slice(-2)}`;
    }

    // === RECHERCHE DE LA LIGNE (Feuille 1) ===
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Feuille 1!A:Z" });
    let rows = res.data.values || [];
    const rowIndex = rows.findIndex(row => normalize(row[2] || "") === normalize(email));
    const rowNum = rowIndex + 1;

    // ==================== SIGNUP (Member Since auto) ====================
    if (action === 'signup') {
      if (!lastName || !firstName || !email || !password) throw new Error("Données manquantes");
      const passNormalized = normalize(password);
      const memberSince = formatDate();

      const values = [[normalize(lastName), normalize(firstName), normalize(email), normalize(phone), passNormalized, newsletter,
                       0, 0, 0, "", "", "", "", "", 0, memberSince, "[]"]];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Feuille 1!A:Z",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: { values }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== UPDATE ADDRESS ====================
    if (action === 'update-address') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Feuille 1!J${rowNum}:N${rowNum}`,
        valueInputOption: "RAW",
        resource: { values: [[line1 || "", line2 || "", city || "", state || "", zip || ""]] }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== UPDATE PASSWORD ====================
    if (action === 'update-password') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      const newPassNormalized = normalize(newPassword);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Feuille 1!E${rowNum}`,
        valueInputOption: "RAW",
        resource: { values: [[newPassNormalized]] }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== UPDATE CART QUANTITY (LIVE) ====================
    if (action === 'update-cart-quantity') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Feuille 1!O${rowNum}`,
        valueInputOption: "RAW",
        resource: { values: [[currentCartQuantity]] }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== RECORD ORDER (Orders + Spent + History) ====================
    if (action === 'record-order') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      const currentRow = rows[rowIndex] || [];

      const newOrders = parseInt(currentRow[6] || 0) + 1;
      const newSpent = parseFloat(currentRow[7] || 0) + parseFloat(totalAmount);
      const newQtyCart = parseInt(currentRow[14] || 0) + parseInt(totalQuantity);

      let history = [];
      try { history = JSON.parse(currentRow[16] || "[]"); } catch(e) {}
      history.push({
        date: formatDate(),
        total: parseFloat(totalAmount).toFixed(2),
        totalQuantity: parseInt(totalQuantity),
        items: orderItems.map(item => ({
          title: item.title,
          price: parseFloat(item.price).toFixed(2),
          quantity: parseInt(item.quantity),
          total: parseFloat(item.total).toFixed(2),
          color: item.color || "",  // Vide si non fourni
          image: item.image || ""   // Vide si non fourni
        }))
      });

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          valueInputOption: "RAW",
          data: [
            { range: `Feuille 1!G${rowNum}`, values: [[newOrders]] },
            { range: `Feuille 1!H${rowNum}`, values: [[newSpent]] },
            { range: `Feuille 1!O${rowNum}`, values: [[newQtyCart]] },
            { range: `Feuille 1!Q${rowNum}`, values: [[JSON.stringify(history)]] }
          ]
        }
      });

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== GET STATS (étendu avec history) ====================
    if (action === 'get-stats') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      const currentRow = rows[rowIndex] || [];
      let history = [];
      try { history = JSON.parse(currentRow[16] || "[]"); } catch(e) {}
      return { 
        statusCode: 200, 
        body: JSON.stringify({
          orders: parseInt(currentRow[6] || 0),
          totalSpent: parseFloat(currentRow[7] || 0),
          quantityInCart: parseInt(currentRow[14] || 0),
          history
        }) 
      };
    }

    // ==================== NOUVELLE ACTION: GET ACCOUNT (pour profil complet) ====================
    if (action === 'get-account') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      const currentRow = rows[rowIndex] || [];
      let history = [];
      try { history = JSON.parse(currentRow[16] || "[]"); } catch(e) {}
      return { 
        statusCode: 200, 
        body: JSON.stringify({
          success: true,
          lastName: currentRow[0] || "",
          firstName: currentRow[1] || "",
          email: currentRow[2] || "",
          phone: currentRow[3] || "",
          line1: currentRow[9] || "",
          line2: currentRow[10] || "",
          city: currentRow[11] || "",
          state: currentRow[12] || "",
          zip: currentRow[13] || "",
          orders: parseInt(currentRow[6] || 0),
          totalSpent: parseFloat(currentRow[7] || 0),
          memberSince: currentRow[15] || "January 2026",
          history
        }) 
      };
    }

    throw new Error("Action inconnue");
  } catch (error) {
    console.error("SAVE ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};