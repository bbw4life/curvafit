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
    const rangesToTry = ["Feuille 1!A:Q", "PendingOrders!A:Q", "Sheet1!A:Q"];
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
    // Group rows by payment_id
    const groups = {};
    dataRows.forEach((row, index) => {
      const paymentId = row[2] || "";
      const status = row[14] || "";
      if (status === "pending" || status === "failed") {
        if (!groups[paymentId]) {
          groups[paymentId] = [];
        }
        groups[paymentId].push({ row, lineNumber: index + 2 });
      }
    });
    const paymentIds = Object.keys(groups);
    if (paymentIds.length === 0) {
      console.log('[RETRY PENDING] Aucune commande en attente ou échouée');
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0 }) };
    }
    // Process only one group (one payment_id) per invocation
    const paymentIdToProcess = paymentIds[0]; // Oldest or first
    const group = groups[paymentIdToProcess];
    let processed = 1; // One order (group)
    let fulfilled = 0;
    let errors = [];
    // Extract shipping from first row (assuming same for all)
    const firstRow = group[0].row;
    const shipping = {
      fullName: firstRow[3] || "", email: firstRow[4] || "", phone: firstRow[5] || "",
      country: firstRow[6] || "United States", state: firstRow[7] || "", city: firstRow[8] || "",
      postalCode: firstRow[9] || "", address: firstRow[10] || ""
    };
    // Fetch countryCode if not present
    let countryCode = 'US';
    try {
      const countryRes = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(shipping.country)}?fullText=true&fields=cca2`);
      if (countryRes.ok) {
        const countryData = await countryRes.json();
        countryCode = countryData[0]?.cca2 || 'US';
      }
    } catch (err) {
      console.error("Failed to fetch country code:", err.message);
    }
    shipping.countryCode = countryCode;
    // Derive province_code from checkout state input (first two letters uppercase)
    let provinceCode = shipping.state.substring(0, 2).toUpperCase() || '';
    shipping.provinceCode = provinceCode;
    // Collect cart items, group by variantsid and sum quantities
    const cartMap = {};
    group.forEach(({ row }) => {
      const variantsid = row[12] || "";
      const quantity = parseInt(row[13]) || 1;
      if (variantsid) {
        if (!cartMap[variantsid]) {
          cartMap[variantsid] = 0;
        }
        cartMap[variantsid] += quantity;
      }
    });
    const cart = Object.keys(cartMap).map(variantsid => ({
      variantsid,
      quantity: cartMap[variantsid]
    }));
    if (cart.length === 0) {
      errors.push(`Payment ${paymentIdToProcess}: No valid items`);
      // Update all to failed
      for (const { lineNumber } of group) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${activeTab}!O${lineNumber}`,
          valueInputOption: "RAW",
          resource: { values: [["failed"]] }
        });
      }
      return { statusCode: 200, body: JSON.stringify({ success: true, processed, fulfilled, errors }) };
    }
    console.log(`[RETRY PENDING] 🔄 Traitement commande ${paymentIdToProcess} (${group.length} items)`);
    try {
      // Create EPROLO Order
      const createRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/create-eprolo-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart, shipping })
      });
      const createData = await createRes.json();
      if (createData.success) {
        // Update all rows to successful
        for (const { lineNumber } of group) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${activeTab}!O${lineNumber}`,
            valueInputOption: "RAW",
            resource: { values: [["successful"]] }
          });
        }
        console.log(` 🎉 SUCCÈS EPROLO pour ${paymentIdToProcess} !`);
        fulfilled = 1;
      } else {
        throw new Error(createData.error || "Échec création EPROLO");
      }
    } catch (err) {
      console.error(` ❌ Erreur pour ${paymentIdToProcess}:`, err.message);
      // Update all to failed
      for (const { lineNumber } of group) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${activeTab}!O${lineNumber}`,
          valueInputOption: "RAW",
          resource: { values: [["failed"]] }
        });
      }
      errors.push(`Commande ${paymentIdToProcess}: ${err.message}`);
    }
    console.log(`[RETRY PENDING] ✅ FIN - Traités: ${processed} | Réussis: ${fulfilled}`);
    return { statusCode: 200, body: JSON.stringify({ success: true, processed, fulfilled, errors }) };
  } catch (error) {
    console.error("RETRY ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }