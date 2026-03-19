const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');
const { google } = require('googleapis');
 
exports.handler = async (event) => {
  console.log("=== VERIFY PAYMENT STARTED ===");
  try {
    if (!event.body) throw new Error("No data received");
    const { provider, sessionId, orderID } = JSON.parse(event.body);
    console.log(`Provider: ${provider} | OrderID: ${orderID || 'N/A'}`);
    const paymentId = sessionId || orderID;
    if (!paymentId) throw new Error("Missing payment ID");
 
    const alreadyProcessed = await isAlreadyProcessed(paymentId);
    if (alreadyProcessed) {
      console.log(`🚫 DUPLICATE DETECTED (${paymentId}) → SKIP`);
      return response(200, { success: true, message: "Duplicate - already processed" });
    }
 
    let cart = [];
    let shipping = {};
    let paymentVerified = false;
    let session;
    let purchaseUnit;
    const BASE_URL = process.env.BASE_URL || process.env.URL || `https://${event.headers.host}`;
    console.log(`🔗 BASE_URL utilisée : ${BASE_URL}`);
 
    // ====================== STRIPE ======================
    if (provider === "stripe") {
      session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") throw new Error("Stripe not paid");
 
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 });
 
      const storedEprolo      = JSON.parse(session.metadata.eprolo_data    || "[]");
      const storedImages      = JSON.parse(session.metadata.images          || "[]");
      // CORRECTION : lecture des nouvelles métadonnées couleur / taille / image variant
      const storedColors      = JSON.parse(session.metadata.colors          || "[]");
      const storedSizes       = JSON.parse(session.metadata.sizes           || "[]");
      const storedImgVariant  = JSON.parse(session.metadata.images_variant  || "[]");
 
      cart = lineItems.data
        .filter(li => li.description !== 'Shipping' && li.description !== 'Taxes')
        .map((li, i) => {
          const eproloItem = storedEprolo[i] || {};
          return {
            title:      li.description,
            price:      (li.amount_total / 100) / li.quantity,
            quantity:   li.quantity,
            variantsid: eproloItem.variantsid || null,
            // CORRECTION : image_variant = image de la couleur choisie
            image:          storedImgVariant[i] || storedImages[i] || '',
            image_variant:  storedImgVariant[i] || storedImages[i] || '',
            // CORRECTION : couleur et taille maintenant récupérées
            color: storedColors[i] || '',
            size:  storedSizes[i]  || ''
          };
        });
 
      shipping = JSON.parse(session.metadata.shipping || "{}");
      paymentVerified = true;
 
    // ====================== PAYPAL (inchangé) ======================
    } else if (provider === "paypal") {
      const PAYPAL_BASE = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");
      const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
      const { access_token } = await tokenRes.json();
 
      const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}`, { headers: { Authorization: `Bearer ${access_token}` } });
      const orderData = await orderRes.json();
 
      if (orderData.status === "APPROVED") {
        await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, { method: "POST", headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" } });
      }
 
      const finalOrderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}`, { headers: { Authorization: `Bearer ${access_token}` } });
      const finalOrderData = await finalOrderRes.json();
      if (finalOrderData.status !== "COMPLETED") throw new Error("PayPal payment not completed");
 
      purchaseUnit = finalOrderData.purchase_units?.[0] || {};
      const storedVariants = purchaseUnit.custom_id ? purchaseUnit.custom_id.split('|') : [];
      const itemsArray = purchaseUnit.items || [];
 
      cart = itemsArray.map((item) => {
        const descParts = (item.description || '').split('|');
        return {
          title:         item.name,
          price:         parseFloat(item.unit_amount.value),
          quantity:      parseInt(item.quantity),
          variantsid:    item.sku || storedVariants[0] || null,
          image:         descParts[1] || item.description || '',
          image_variant: descParts[1] || item.description || '',
          color:         descParts[0] && descParts[0] !== 'N/A' ? descParts[0] : '',
          size:          ''
        };
      });
 
      if (cart.length === 0 && storedVariants.length > 0) {
        cart = storedVariants.map((str, i) => ({
          title: `Product ${i+1}`, price: 0, quantity: 1,
          variantsid: str || null, image: '', image_variant: '', color: '', size: ''
        }));
      }
 
      const payer = finalOrderData.payer || {};
      const ship = purchaseUnit.shipping || {};
      const refParts = purchaseUnit.reference_id ? purchaseUnit.reference_id.split('|') : [];
 
      let countryCode = refParts[3] || ship.address?.country_code || "US";
      let countryName = "United States";
      try {
        const countryRes = await fetch(`https://restcountries.com/v3.1/alpha/${countryCode}?fields=name`);
        if (countryRes.ok) {
          const data = await countryRes.json();
          countryName = data.name.common || countryName;
        }
      } catch (err) {}
 
      let email = refParts[2] || payer.email_address || '';
      let firstName = payer.name?.given_name || '';
      let lastName = payer.name?.surname || '';
      if (firstName.toLowerCase() === 'john' && lastName.toLowerCase() === 'doe') {
        const nameParts = (refParts[0] || '').split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }
 
      shipping = {
        firstName, lastName, email,
        phone: payer.phone?.phone_number ? `+${payer.phone.phone_number.country_code || ''}${payer.phone.phone_number.national_number || ''}` : refParts[1] || '',
        address: ship.address?.address_line_1 || "",
        city: ship.address?.admin_area_2 || "",
        state: ship.address?.admin_area_1 || "",
        postalCode: ship.address?.postal_code || "",
        country: countryName,
        countryCode: countryCode,
        shipping_method: refParts[4] || "Standard Shipping"
      };
      paymentVerified = true;
    }
 
    if (!paymentVerified || cart.length === 0) throw new Error("Payment verification failed or cart empty");
 
    let totalAmount = provider === "stripe"
      ? session.amount_total / 100
      : parseFloat(purchaseUnit.amount.value);
 
    const totalQuantity = cart.reduce((acc, item) => acc + item.quantity, 0);
 
    // CORRECTION : orderItems inclut maintenant color, size, image_variant
    const orderItems = cart.map(item => ({
      title:         item.title,
      color:         item.color         || '',
      size:          item.size          || '',
      image_variant: item.image_variant || item.image || '',
      price:         item.price,
      quantity:      item.quantity,
      lineTotal:     item.price * item.quantity,
      variantsid:    item.variantsid    || ''
    }));
 
    if (shipping.email) {
      await fetch(`${BASE_URL}/.netlify/functions/save-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: 'record-order',
          email: shipping.email,
          totalAmount,
          totalQuantity,
          orderItems
        })
      });
    }
 
    console.log("=== DÉBUT FULFILLMENT SÉQUENTIEL ===");
    const cartMap = {};
    cart.forEach(item => {
      const vid = item.variantsid || null;
      if (vid) {
        if (!cartMap[vid]) cartMap[vid] = { title: item.title, price: item.price, quantity: 0, variantsid: vid };
        cartMap[vid].quantity += item.quantity;
      }
    });
    const groupedCart = Object.values(cartMap);
    const readyForEprolo = groupedCart.filter(item => item.variantsid);
    const notReady = cart.filter(item => !item.variantsid);
 
    for (const item of notReady) await saveAsPending(item, shipping, BASE_URL, provider, paymentId);
    for (const item of readyForEprolo) await saveAsPending(item, shipping, BASE_URL, provider, paymentId, "pending");
 
    console.log("🎯 Fulfillment terminé");
    return response(200, { success: true, fulfillmentStatus: "processing" });
 
  } catch (error) {
    console.error("=== VERIFY PAYMENT ERROR ===", error.message);
    return response(500, { success: false, error: error.message });
  }
};
 
// ====================== ANTI-DUPLICATE ======================
async function isAlreadyProcessed(paymentId) {
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
    const rangesToTry = ["PendingOrders!A:Z", "Sheet1!A:Z", "Feuille 1!A:Z", "Orders!A:Z", "Sheet2!A:Z"];
 
    for (const range of rangesToTry) {
      try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        const rows = res.data.values || [];
        for (const row of rows) {
          if (row.some(cell => cell && cell.toString().includes(paymentId))) return true;
        }
      } catch (e) {}
    }
 
    let marked = false;
    for (const range of rangesToTry) {
      const sheetName = range.split('!')[0];
      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A:A`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [[`PROCESSED_${paymentId}`, new Date().toISOString(), 'VERIFIED_BY_ANTI_DUPLICATE']] }
        });
        marked = true;
        console.log(`[ANTI-DUPLICATE] Marked ${paymentId}`);
        break;
      } catch (e) {}
    }
    if (!marked) console.error("[ANTI-DUPLICATE] WARNING: Could not mark");
    return false;
  } catch (e) {
    console.error("[DUPLICATE CHECK ERROR]", e.message);
    return false;
  }
}
 
async function saveAsPending(item, shipping, BASE_URL, provider, paymentId, status = "pending_stock") {
  try {
    await fetch(`${BASE_URL}/.netlify/functions/save-pending-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipping, item, payment_provider: provider, payment_id: paymentId || "auto", status })
    });
  } catch (e) {
    console.error("saveAsPending failed:", e.message);
  }
}
 
function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}