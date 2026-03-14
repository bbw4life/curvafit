// verify-payment.js
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

    // ====================== PROTECTION DOUBLE PROCESSING ======================
    const alreadyProcessed = await isAlreadyProcessed(paymentId);
    if (alreadyProcessed) {
      console.log(`🚫 DUPLICATE DETECTED (${paymentId}) → SKIP`);
      return response(200, { success: true, message: "Duplicate - already processed" });
    }
    // ============================================================================

    let cart = [];
    let shipping = {};
    let paymentVerified = false;
    let session = null;          // ← FIX Stripe
    let purchaseUnit = null;     // ← FIX PayPal
    const BASE_URL = process.env.BASE_URL || process.env.URL || `https://${event.headers.host}`;
    console.log(`🔗 BASE_URL utilisée : ${BASE_URL}`);

    // ====================== STRIPE ======================
    if (provider === "stripe") {
      session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") throw new Error("Stripe not paid");
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 });
      const storedEprolo = JSON.parse(session.metadata.eprolo_data || "[]");
      cart = lineItems.data
        .filter(li => li.description !== 'Shipping' && li.description !== 'Taxes')
        .map((li, i) => {
          const eproloItem = storedEprolo[i] || {};
          return {
            title: li.description,
            price: (li.amount_total / 100) / li.quantity,
            quantity: li.quantity,
            variantsid: eproloItem.variantsid || null
          };
        });
      shipping = JSON.parse(session.metadata.shipping || "{}");
      paymentVerified = true;
    }

    // ====================== PAYPAL ======================
    else if (provider === "paypal") {
      const PAYPAL_BASE = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");
      const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
      const { access_token } = await tokenRes.json();
      
      const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}`, { headers: { Authorization: `Bearer ${access_token}` } });
      if (!orderRes.ok) throw new Error("PayPal order fetch failed");
      const orderData = await orderRes.json();
      
      if (orderData.status === "APPROVED") {
        const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, { method: "POST", headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" } });
        if (!captureRes.ok) throw new Error("PayPal capture failed");
      }
      
      const finalOrderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}`, { headers: { Authorization: `Bearer ${access_token}` } });
      const finalOrderData = await finalOrderRes.json();
      if (finalOrderData.status !== "COMPLETED") throw new Error("PayPal payment not completed");
      
      purchaseUnit = finalOrderData.purchase_units?.[0];
      const storedVariants = purchaseUnit?.custom_id ? purchaseUnit.custom_id.split('|') : [];
      const itemsArray = purchaseUnit?.items || [];
      cart = itemsArray.map((item, i) => ({
        title: item.name,
        price: parseFloat(item.unit_amount.value),
        quantity: parseInt(item.quantity),
        variantsid: storedVariants[i] || null
      }));
      
      const payer = finalOrderData.payer || {};
      const ship = purchaseUnit.shipping || {};
      shipping = {
        firstName: payer.name?.given_name || '',
        lastName: payer.name?.surname || '',
        email: payer.email_address || '',
        phone: payer.phone?.phone_number ? `+${payer.phone.phone_number.country_code || ''}${payer.phone.phone_number.national_number || ''}` : '',
        address: ship.address?.address_line_1 || "",
        city: ship.address?.admin_area_2 || "",
        state: ship.address?.admin_area_1 || "",
        postalCode: ship.address?.postal_code || "",
        country: ship.address?.country_code || "United States",
        countryCode: ship.address?.country_code || "",
        shipping_method: "Standard Shipping"
      };
      paymentVerified = true;
    }

    if (!paymentVerified || cart.length === 0) throw new Error("Payment verification failed or cart empty");

    // ====================== RECORD ORDER (Orders + Total Spent + Order History) ======================
    console.log("💾 Mise à jour Orders / Spent / History dans Google Sheet...");

    const totalPaid = provider === "stripe" 
        ? (session.amount_total / 100) 
        : provider === "paypal" 
            ? parseFloat(purchaseUnit?.amount?.value || 0) 
            : cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    const totalQty = cart.reduce((sum, i) => sum + (i.quantity || 0), 0);

    const orderItems = cart.map(item => ({
        title: item.title || "Produit",
        quantity: item.quantity || 1,
        price: item.price || 0,
        size: null,
        color: null,
        image: null,
        cj_variant_id: item.variantsid || null
    }));

    const customerEmail = shipping.email || "";

    if (customerEmail) {
        await fetch(`${BASE_URL}/.netlify/functions/save-account`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'record-order',
                email: customerEmail,
                totalAmount: totalPaid,
                totalQuantity: totalQty,
                orderItems
            })
        }).catch(e => console.error("⚠️ Record-order non bloquant :", e.message));

        console.log(`✅ Record-order lancé avec email : ${customerEmail} | Total: $${totalPaid} | Qty: ${totalQty}`);
    } else {
        console.error("❌ Pas d'email client trouvé → record-order ignoré");
    }
    // =================================================================================================

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
        await saveAsPending(item, shipping, BASE_URL, provider, paymentId, "pending");
      }
    }
    console.log("🎯 Fulfillment terminé");
    return response(200, { success: true, fulfillmentStatus: "processing" });

  } catch (error) {
    console.error("=== VERIFY PAYMENT ERROR ===", error.message);
    return response(500, { success: false, error: error.message });
  }
};

// ====================== FONCTION ANTI-DOUBLE ======================
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
          if (row.some(cell => cell && cell.toString().includes(paymentId))) {
            console.log(`✅ Doublon trouvé dans ${range} pour ${paymentId}`);
            return true;
          }
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