// netlify/functions/verify-payment.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');
const { google } = require('googleapis');

exports.handler = async (event) => {

  console.log("=== VERIFY PAYMENT STARTED ===");

  try {

    if (!event.body)
      throw new Error("No data received");

    const { provider, sessionId, orderID } = JSON.parse(event.body);

    console.log(`Provider: ${provider} | OrderID: ${orderID || 'N/A'}`);

    const paymentId = sessionId || orderID;

    // ================= DOUBLE PAYPAL PROTECTION =================

    if (provider === "paypal" && paymentId) {

      const alreadyProcessed = await isAlreadyProcessed(paymentId);

      if (alreadyProcessed) {

        console.log(`🚫 DOUBLE WEBHOOK PAYPAL (${paymentId})`);

        return response(200, { success: true });
      }
    }

    // ============================================================

    let cart = [];
    let shipping = {};
    let paymentVerified = false;

    const BASE_URL =
      process.env.BASE_URL ||
      process.env.URL ||
      `https://${event.headers.host}`;

    console.log(`🔗 BASE_URL : ${BASE_URL}`);

    // ================= STRIPE =================

    if (provider === "stripe") {

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== "paid")
        throw new Error("Stripe not paid");

      const lineItems =
        await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 });

      let storedCj = [];

      try {
        storedCj = JSON.parse(session.metadata?.cj_data || "[]");
      } catch {}

      cart = lineItems.data.map((li, i) => {

        const cjItem = storedCj[i] || {};

        return {
          title: li.description,
          price: (li.amount_total / 100) / li.quantity,
          quantity: parseInt(li.quantity) || 1,
          cj_product_id: cjItem.cj_product_id || null,
          cj_variant_id: cjItem.cj_variant_id || null
        };

      });

      try {
        shipping = JSON.parse(session.metadata?.shipping || "{}");
      } catch {}

      paymentVerified = true;
    }

    // ================= PAYPAL =================

    else if (provider === "paypal") {

      if (!orderID)
        throw new Error("Missing PayPal orderID");

      const PAYPAL_BASE =
        process.env.PAYPAL_ENV === "live"
          ? "https://api-m.paypal.com"
          : "https://api-m.sandbox.paypal.com";

      const auth =
        Buffer.from(
          `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
        ).toString("base64");

      const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {

        method: "POST",

        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },

        body: "grant_type=client_credentials"
      });

      const tokenData = await tokenRes.json();

      const access_token = tokenData.access_token;

      // CAPTURE seulement si pas déjà complété
      await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {

        method: "POST",

        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json"
        }

      });

      const orderRes = await fetch(
        `${PAYPAL_BASE}/v2/checkout/orders/${orderID}`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      );

      const orderData = await orderRes.json();

      if (orderData.status !== "COMPLETED")
        throw new Error("PayPal payment not completed");

      const purchaseUnit = orderData.purchase_units?.[0];

      const storedCj =
        purchaseUnit?.custom_id
          ? purchaseUnit.custom_id.split('|')
          : [];

      const itemsArray = purchaseUnit?.items || [];

      cart = itemsArray.map((item, i) => {

        const [cj_product_id, cj_variant_id] =
          storedCj[i]
            ? storedCj[i].split(':')
            : ['', ''];

        return {

          title: item.name,

          price: parseFloat(item.unit_amount?.value || 0),

          quantity: parseInt(item.quantity) || 1,

          cj_product_id: cj_product_id || null,

          cj_variant_id: cj_variant_id || null
        };

      });

      const payer = orderData.payer || {};
      const ship = purchaseUnit.shipping || {};

      shipping = {

        fullName:
          ship.name?.full_name ||
          `${payer.name?.given_name || ''} ${payer.name?.surname || ''}`.trim(),

        email: payer.email_address || "",

        address: ship.address?.address_line_1 || "",

        city: ship.address?.admin_area_2 || "",

        state: ship.address?.admin_area_1 || "",

        postalCode: ship.address?.postal_code || "",

        country: ship.address?.country_code || "US"
      };

      paymentVerified = true;
    }

    // ==========================================================

    if (!paymentVerified || cart.length === 0)
      throw new Error("Payment verification failed or cart empty");

    console.log(`✅ ${cart.length} item(s) ready`);

    // ================= FULFILLMENT =================

    for (let i = 0; i < cart.length; i++) {

      const item = cart[i];

      try {

        console.log(`🔄 ITEM ${i+1}/${cart.length} : ${item.cj_variant_id}`);

        if (!item.cj_variant_id) {

          console.log("⚠️ Pas de variant CJ → pending");

          await saveAsPending(item, shipping, BASE_URL, provider, paymentId);

          continue;
        }

        if (i > 0) {

          console.log("⏳ Rate limit CJ → attente 310s");

          await delay(310000);
        }

        // ================= STOCK =================

        const stockRes = await fetch(
          `${BASE_URL}/.netlify/functions/check-cj-stock`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cj_variant_id: item.cj_variant_id })
          }
        );

        const stockData = await stockRes.json();

        if (!stockData.success) {

          const status =
            stockData.isRateLimit
              ? "pending_rate_limit"
              : "pending_stock";

          await saveAsPending(item, shipping, BASE_URL, provider, paymentId, status);

          continue;
        }

        if (!stockData.inStock) {

          await saveAsPending(item, shipping, BASE_URL, provider, paymentId);

          continue;
        }

        // ================= CREATE ORDER =================

        const cjRes = await fetch(
          `${BASE_URL}/.netlify/functions/create-cj-order`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cart:[item], shipping })
          }
        );

        const cjData = await cjRes.json();

        if (!cjData.success) {

          const isRateLimit =
            (cjData.error || "").includes("Too Many Requests");

          const status =
            isRateLimit
              ? "pending_rate_limit"
              : "pending_stock";

          await saveAsPending(item, shipping, BASE_URL, provider, paymentId, status);
        }

      } catch (e) {

        console.error("ITEM ERROR", e.message);

        await saveAsPending(item, shipping, BASE_URL, provider, paymentId);
      }
    }

    console.log("🎯 Fulfillment terminé");

    return response(200,{ success:true });

  } catch (error) {

    console.error("VERIFY ERROR", error.message);

    return response(500,{
      success:false,
      error:error.message
    });
  }
};

// ================= DUPLICATE CHECK =================

async function isAlreadyProcessed(paymentId){

  try{

    const auth = new google.auth.GoogleAuth({

      credentials:{
        client_email:process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key:process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g,"\n")
      },

      scopes:["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({version:"v4",auth});

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const ranges = ["PendingOrders!C:C","Sheet1!C:C","Feuille 1!C:C"];

    for(const range of ranges){

      try{

        const res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range
        });

        const rows = res.data.values || [];

        if(rows.some(row=>row[0]===paymentId))
          return true;

      }catch{}
    }

    return false;

  }catch{

    return false;
  }
}

// ================= SAVE PENDING =================

async function saveAsPending(item,shipping,BASE_URL,provider,paymentId,status="pending_stock"){

  try{

    await fetch(`${BASE_URL}/.netlify/functions/save-pending-order`,{

      method:"POST",

      headers:{ "Content-Type":"application/json" },

      body:JSON.stringify({

        shipping,
        item,
        payment_provider:provider,
        payment_id:paymentId || "auto",
        status
      })

    });

  }catch(e){

    console.error("saveAsPending failed:",e.message);
  }
}

function delay(ms){
  return new Promise(r=>setTimeout(r,ms));
}

function response(statusCode,body){
  return {
    statusCode,
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify(body)
  };
}