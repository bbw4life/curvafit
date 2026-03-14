// verify-payment.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');
const { google } = require('googleapis');

exports.handler = async (event) => {
  console.log("=== VERIFY PAYMENT STARTED ===");
  try {
    if (!event.body) throw new Error("No data received");
    const { provider, sessionId, orderID } = JSON.parse(event.body);
    const paymentId = sessionId || orderID;
    if (!paymentId) throw new Error("Missing payment ID");

    const alreadyProcessed = await isAlreadyProcessed(paymentId);
    if (alreadyProcessed) {
      return response(200, { success: true, message: "Duplicate - already processed" });
    }

    let cart = [];
    let shipping = {};
    let paymentVerified = false;
    let session;
    let purchaseUnit;
    const BASE_URL = process.env.BASE_URL || process.env.URL || `https://${event.headers.host}`;

    if (provider === "stripe") {
      // === STRIPE (inchangé, tu as dit que c'est parfait) ===
      session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") throw new Error("Stripe not paid");
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 });
      const storedEprolo = JSON.parse(session.metadata.eprolo_data || "[]");
      const storedImages = JSON.parse(session.metadata.images || "[]");
      cart = lineItems.data
        .filter(li => li.description !== 'Shipping' && li.description !== 'Taxes')
        .map((li, i) => {
          const eproloItem = storedEprolo[i] || {};
          return {
            title: li.description,
            price: (li.amount_total / 100) / li.quantity,
            quantity: li.quantity,
            variantsid: eproloItem.variantsid || null,
            image: storedImages[i] || '',
            color: '' // Stripe garde son comportement actuel
          };
        });
      shipping = JSON.parse(session.metadata.shipping || "{}");
      paymentVerified = true;

    } else if (provider === "paypal") {
      // === PAYPAL (corrigé) ===
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

      purchaseUnit = finalOrderData.purchase_units?.[0] || {};
      const storedVariants = purchaseUnit.custom_id ? purchaseUnit.custom_id.split('|') : [];
      const itemsArray = purchaseUnit.items || [];

      cart = itemsArray.map((item) => {
        const descParts = (item.description || '').split('|');
        return {
          title: item.name,
          price: parseFloat(item.unit_amount.value),
          quantity: parseInt(item.quantity),
          variantsid: item.sku || storedVariants[0] || null,
          image: descParts[1] || item.description || '',
          color: descParts[0] !== 'N/A' ? descParts[0] : ''   // ← NOUVELLE LIGNE
        };
      });

      const payer = finalOrderData.payer || {};
      const ship = purchaseUnit.shipping || {};
      const refParts = purchaseUnit.reference_id ? purchaseUnit.reference_id.split('|') : [];

      // === CORRECTION EMAIL : on prend TOUJOURS l'email du formulaire checkout (refParts[2]) ===
      let email = refParts[2] || payer.email_address || '';
      let firstName = payer.name?.given_name || '';
      let lastName = payer.name?.surname || '';
      if (firstName.toLowerCase() === 'john' && lastName.toLowerCase() === 'doe') {
        const nameParts = (refParts[0] || '').split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      shipping = {
        firstName, lastName,
        email,
        phone: payer.phone?.phone_number ? `+${payer.phone.phone_number.country_code || ''}${payer.phone.phone_number.national_number || ''}` : refParts[1] || '',
        address: ship.address?.address_line_1 || "",
        city: ship.address?.admin_area_2 || "",
        state: ship.address?.admin_area_1 || "",
        postalCode: ship.address?.postal_code || "",
        country: "United States",
        countryCode: refParts[3] || ship.address?.country_code || "US",
        shipping_method: refParts[4] || "Standard Shipping"
      };
      paymentVerified = true;
    }

    if (!paymentVerified || cart.length === 0) throw new Error("Payment verification failed or cart empty");

    // ====================== UPDATE USER PROFILE ======================
    let totalAmount = provider === "stripe" ? session.amount_total / 100 : parseFloat(purchaseUnit.amount.value);
    const totalQuantity = cart.reduce((acc, item) => acc + item.quantity, 0);

    const orderItems = cart.map(item => ({
      title: item.title,
      variant_color: item.color || '',           // ← CORRIGÉ (plus jamais N/A)
      image_variant: item.image || '',
      price: item.price,
      quantity: item.quantity,
      lineTotal: item.price * item.quantity,
      variantsid: item.variantsid || ''
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

    // === Fulfillment (inchangé) ===
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

    return response(200, { success: true, fulfillmentStatus: "processing" });
  } catch (error) {
    console.error("=== VERIFY PAYMENT ERROR ===", error.message);
    return response(500, { success: false, error: error.message });
  }
};
// ====================== FONCTION ANTI-DOUBLE (VERSION CORRIGÉE - PLUS JAMAIS DE DUPLICATE) ======================
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
   
    const rangesToTry = [
      "PendingOrders!A:Z",
      "Sheet1!A:Z",
      "Feuille 1!A:Z",
      "Orders!A:Z",
      "Sheet2!A:Z"
    ];
    for (const range of rangesToTry) {
      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: range
        });
        const rows = res.data.values || [];
        for (const row of rows) {
          if (row.some(cell => cell && cell.toString().includes(paymentId))) {
            console.log(`✅ Doublon trouvé dans ${range} pour ${paymentId}`);
            return true;
          }
        }
      } catch (e) {
        // pass to next range
      }
    }
    return false;
  } catch (e) {
    console.error("[DUPLICATE CHECK ERROR]", e.message);
    return false;
  }
}
// ============================================================================
async function saveAsPending(item, shipping, BASE_URL, provider, paymentId, status = "pending_stock") {
  try {
    await fetch(`${BASE_URL}/.netlify/functions/save-pending-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipping, item, payment_provider: provider, payment_id: paymentId || "auto", status })
    });
  } catch (e) { console.error("saveAsPending failed:", e.message); }
}
function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}