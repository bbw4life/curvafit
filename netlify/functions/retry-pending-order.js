// retry-pending-order.js
const { google } = require("googleapis");
const fetch = require("node-fetch");
exports.handler = async () => {
  console.log('[RETRY PENDING] 🚀 Démarrage - ' + new Date().toISOString());
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const rangesToTry = ["Feuille 1!A:P", "PendingOrders!A:P", "Sheet1!A:P"];
    let rows = [];
    let activeTab = "";
    for (const range of rangesToTry) {
      try {
        const getRes = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        rows = getRes.data.values || [];
        if (rows.length > 1) {
          activeTab = range.split('!')[0];
          console.log(`[RETRY PENDING] ✅ Onglet détecté : ${activeTab} (${rows.length} lignes)`);
          break;
        }
      } catch (e) {
        console.log(`[RETRY PENDING] ${range.split('!')[0]} non trouvé`);
      }
    }
    if (rows.length <= 1) {
      console.log('[RETRY PENDING] Aucune commande en attente');
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0 }) };
    }
    const dataRows = rows.slice(1);
    let processed = 0;
    let fulfilled = 0;
    let errors = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const status = row[13] || "";
      if (status !== "pending" && status !== "failed") continue;
      processed++;
      const lineNumber = i + 2;
      const internalId = row[0];
      const shipping = {
        fullName: row[3] || "", email: row[4] || "", phone: row[5] || "",
        country: row[6] || "United States", state: row[7] || "", city: row[8] || "",
        postalCode: row[9] || "", address: row[10] || ""
      };
      // Fetch countryCode if not present
      try {
        const countryRes = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(shipping.country)}?fullText=true&fields=cca2`);
        if (countryRes.ok) {
          const countryData = await countryRes.json();
          shipping.countryCode = countryData[0]?.cca2 || 'US';
        } else {
          shipping.countryCode = 'US';
        }
      } catch (err) {
        console.error("Failed to fetch country code:", err.message);
        shipping.countryCode = 'US';
      }
      const cart = [{
        variantsid: row[11] || "",
        quantity: parseInt(row[12]) || 1
      }];
      console.log(`[RETRY PENDING] 🔄 Traitement ligne ${lineNumber} (${status}) → ${internalId}`);
      try {
        // Directly create EPROLO Order
        const createRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/create-eprolo-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart, shipping })
        });
        const createData = await createRes.json();
        if (createData.success) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${activeTab}!N${lineNumber}`,
            valueInputOption: "RAW",
            resource: { values: [["successful"]] }
          });
          console.log(` 🎉 SUCCÈS EPROLO pour ${internalId} !`);
          fulfilled++;
        } else {
          throw new Error(createData.error || "Échec création EPROLO");
        }
      } catch (err) {
        console.error(` ❌ Erreur ligne ${lineNumber}:`, err.message);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${activeTab}!N${lineNumber}`,
          valueInputOption: "RAW",
          resource: { values: [["failed"]] }
        });
        errors.push(`Ligne ${lineNumber}: ${err.message}`);
      }
      break; // Process only one per invocation to respect rate limits
    }
    console.log(`[RETRY PENDING] ✅ FIN - Traités: ${processed} | Réussis: ${fulfilled}`);
    return { statusCode: 200, body: JSON.stringify({ success: true, processed, fulfilled, errors }) };
  } catch (error) {
    console.error("RETRY ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }