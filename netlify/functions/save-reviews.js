const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { action, fullName, email, title, rating, text, productId } = body;

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_REVIEWS;   // ← ton nouveau env var

    function formatReviewDate() {
      const d = new Date();
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${d.getFullYear()}-${monthNames[d.getMonth()]}-${d.getDate().toString().padStart(2, '0')}`;
    }

    const res = await sheets.spreadsheets.values.get({ 
      spreadsheetId, 
      range: "CustomersReviews!A:Z" 
    });
    const rows = res.data.values || [];

    // ====================== SAVE REVIEW ======================
    if (action === 'save-review') {
      if (!fullName || !email || !title || !rating || !text || !productId) {
        throw new Error("Toutes les données sont obligatoires");
      }
      if (!email.includes('@')) throw new Error("Email invalide");

      const date = formatReviewDate();
      const values = [[fullName.trim(), email.trim(), title.trim(), rating, text.trim(), date, productId]];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "CustomersReviews!A:G",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: { values }
      });

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ====================== GET REVIEWS ======================
    if (action === 'get-reviews') {
      if (!productId) throw new Error("Product ID manquant");

      const reviews = rows.slice(1) // skip header
        .filter(row => row[6] === productId)
        .map(row => ({
          fullName: row[0] || "",
          email: row[1] || "",
          title: row[2] || "",
          rating: parseInt(row[3]) || 5,
          text: row[4] || "",
          date: row[5] || ""
        }));

      return { 
        statusCode: 200, 
        body: JSON.stringify({ success: true, reviews }) 
      };
    }

    throw new Error("Action inconnue");
  } catch (error) {
    console.error("REVIEWS ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};