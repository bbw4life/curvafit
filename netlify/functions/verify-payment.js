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
    if (alreadyProcessed) return response(200, { success: true, message: "Duplicate - already processed" });

    let cart = [];
    let shipping = {};
    let paymentVerified = false;
    let totalAmount = 0;
    const BASE_URL = process.env.BASE_URL || `https://${event.headers.host}`;

    // ====================== STRIPE ======================
    if (provider === "stripe") {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 });
      const storedEprolo = JSON.parse(session.metadata.eprolo_data || "[]");
      cart = lineItems.data
        .filter(li => li.description !== 'Shipping' && li.description !== 'Taxes')
        .map((li, i) => {
          const e = storedEprolo[i] || {};
          return {
            title: li.description,
            price: (li.amount_total / 100) / li.quantity,
            quantity: li.quantity,
            variantsid: e.variantsid || null,
            color: e.color || 'Standard',
            image: e.image || ''
          };
        });
      shipping = JSON.parse(session.metadata.shipping || "{}");
      totalAmount = session.amount_total / 100;
      paymentVerified = true;

    // ====================== PAYPAL (CODE ORIGINAL RESTAURÉ À 100%) ======================
    } else if (provider === "paypal") {
      const PAYPAL_BASE = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");
      const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
      const { access_token } = await tokenRes.json();
     
      const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}`, { headers: { Authorization: `Bearer ${access_token}` } });
      if (!orderRes.ok) {
        const orderErr = await orderRes.text();
        console.error("[PAYPAL] Fetch order error:", orderErr);
        throw new Error("PayPal order fetch failed");
      }
      const orderData = await orderRes.json();
      console.log("[PAYPAL] Order status:", orderData.status);
     
      if (orderData.status === "COMPLETED") {
        console.log("[PAYPAL] Already completed");
      } else if (orderData.status === "APPROVED") {
        const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, { method: "POST", headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" } });
        if (!captureRes.ok) {
          const captureErr = await captureRes.json();
          console.error("[PAYPAL] Capture error full:", JSON.stringify(captureErr));
          if (captureErr.name === "RESOURCE_CONFLICT" && captureErr.details[0].issue === "DUPLICATE_INVOICE_ID") {
            console.log("[PAYPAL] Already captured");
          } else {
            throw new Error("PayPal capture failed: " + JSON.stringify(captureErr));
          }
        }
      } else {
        throw new Error(`PayPal invalid status: ${orderData.status}`);
      }
     
      const finalOrderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}`, { headers: { Authorization: `Bearer ${access_token}` } });
      const finalOrderData = await finalOrderRes.json();
      if (finalOrderData.status !== "COMPLETED") throw new Error("PayPal payment not completed");
     
      const purchaseUnit = finalOrderData.purchase_units?.[0];
      const storedData = purchaseUnit?.custom_id ? purchaseUnit.custom_id.split('||') : [];
      const itemsArray = purchaseUnit?.items || [];
      cart = itemsArray.map((item, i) => {
        const stored = storedData[i] ? storedData[i].split('|') : [];
        return { 
          title: item.name, 
          price: parseFloat(item.unit_amount.value), 
          quantity: parseInt(item.quantity), 
          variantsid: stored[0] || null,
          color: stored[1] || 'Standard',
          image: ''  // PayPal n'envoie pas l'image (optionnel)
        };
      });
      if (cart.length === 0 && storedVariants.length > 0) {
        cart = storedVariants.map((str, i) => ({
          title: `Product ${i+1}`, 
          price: 0, 
          quantity: 1, 
          variantsid: str || null 
        }));
      }
      const payer = finalOrderData.payer || {};
      const ship = purchaseUnit.shipping || {};
      const countryCodeFromPayPal = ship.address?.country_code || "US";
      let countryName = "United States";
      try {
        const countryRes = await fetch(`https://restcountries.com/v3.1/alpha/${countryCodeFromPayPal}?fields=name`);
        if (countryRes.ok) {
          const countryData = await countryRes.json();
          countryName = countryData.name.common || countryName;
        }
      } catch (err) {}
      const refParts = purchaseUnit.reference_id ? purchaseUnit.reference_id.split('|') : [];
      let shipping_method = refParts[4] || "Standard Shipping";
      let storedFullName = refParts[0] || '';
      let phone = payer.phone?.phone_number ? `+${payer.phone.phone_number.country_code || ''}${payer.phone.phone_number.national_number || ''}` : refParts[1] || '';
      let email = payer.email_address || refParts[2] || '';
      let fallbackCountryCode = refParts[3] || countryCodeFromPayPal;
      let firstName = payer.name?.given_name || '';
      let lastName = payer.name?.surname || '';
      if (firstName.toLowerCase() === 'john' && lastName.toLowerCase() === 'doe') {
        const nameParts = storedFullName.split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }
      shipping = {
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        address: ship.address?.address_line_1 || "",
        city: ship.address?.admin_area_2 || "",
        state: ship.address?.admin_area_1 || "",
        postalCode: ship.address?.postal_code || "",
        country: countryName,
        countryCode: fallbackCountryCode,
        shipping_method: shipping_method
      };
      totalAmount = parseFloat(finalOrderData.purchase_units?.[0]?.amount?.value || 0);  // ← AJOUTÉ
      paymentVerified = true;
    }

    if (!paymentVerified || cart.length === 0) throw new Error("Payment verification failed or cart empty");
    console.log("=== DÉBUT FULFILLMENT SÉQUENTIEL ===");

    const cartMap = {};
    cart.forEach(item => {
      const vid = item.variantsid || null;
      if (vid) {
        if (!cartMap[vid]) {
          cartMap[vid] = { title: item.title, price: item.price, quantity: 0, variantsid: vid };
        }
        cartMap[vid].quantity += item.quantity;
      }
    });
    const groupedCart = Object.values(cartMap);
    let readyForEprolo = groupedCart.filter(item => item.variantsid);
    const notReady = cart.filter(item => !item.variantsid);
    for (const item of notReady) {
      await saveAsPending(item, shipping, BASE_URL, provider, paymentId);
    }
    if (readyForEprolo.length > 0) {
      console.log(`✅ ${readyForEprolo.length} unique item(s) ready for Eprolo`);
      for (const item of readyForEprolo) {
        await saveAsPending(item, shipping, BASE_URL, provider, paymentId, "pending_stock");
      }
    }
    console.log("🎯 Fulfillment terminé");

    // ==================== RECORD ORDER (avec COLOR + IMAGE) ====================
    if (shipping && shipping.email) {
      const totalQuantity = cart.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
      const orderItems = cart.map(item => ({
        title: item.title || "Product",
        price: parseFloat(item.price) || 0,
        quantity: parseInt(item.quantity) || 0,
        variant: item.color || 'Standard',
        image: item.image || '',
        lineTotal: ((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0)).toFixed(2)
      }));

      await fetch(`${BASE_URL}/.netlify/functions/save-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "record-order", email: shipping.email, totalAmount, totalQuantity, orderItems })
      });
    }

    return response(200, { success: true, fulfillmentStatus: "processing" });
  } catch (error) {
    console.error("=== VERIFY PAYMENT ERROR ===", error.message);
    return response(500, { success: false, error: error.message });
  }
};

// ====================== FONCTIONS AUXILIAIRES (inchangées) ======================
async function isAlreadyProcessed(paymentId) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n") },
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
  } catch (e) { console.error("saveAsPending failed:", e.message); }
}

function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}