const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paypal = require('@paypal/checkout-server-sdk');
const { google } = require('googleapis');

/* ================= PAYPAL ================= */

const paypalEnvironment =
  process.env.NODE_ENV === "production"
    ? new paypal.core.LiveEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      )
    : new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      );

const paypalClient = new paypal.core.PayPalHttpClient(paypalEnvironment);

/* ================= GOOGLE SHEETS ================= */

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

async function appendToGoogleSheets(data) {
  const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({
    version: "v4",
    auth: await auth.getClient(),
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: "Sheet1!A:L",
    valueInputOption: "RAW",
    resource: {
      values: [[
        data.orderId,
        data.shipping.fullName,
        data.shipping.email,
        data.shipping.phone,
        data.shipping.country,
        data.shipping.city,
        data.shipping.postalCode,
        data.shipping.address,
        data.cart.map(i => `${i.title} x ${i.quantity}`).join(", "),
        data.total,
        data.paymentMethod,
        new Date().toISOString(),
      ]],
    },
  });
}

/* ================= MAIN HANDLER ================= */

exports.handler = async (event) => {
  try {

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { sessionId, orderId, paymentMethod } = JSON.parse(event.body);

    let orderData = null;

    /* ================= STRIPE ================= */

    if (paymentMethod === "stripe" && sessionId) {

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (!session || session.payment_status !== "paid") {
        return { statusCode: 400, body: JSON.stringify({ success: false }) };
      }

      if (!session.metadata || !session.metadata.shipping || !session.metadata.cart) {
        return { statusCode: 400, body: JSON.stringify({ success: false }) };
      }

      orderData = {
        orderId: session.id,
        shipping: JSON.parse(session.metadata.shipping),
        cart: JSON.parse(session.metadata.cart),
        total: session.amount_total / 100,
        paymentMethod: "Stripe",
      };
    }

    /* ================= PAYPAL ================= */

    if (paymentMethod === "paypal" && orderId) {

      const request = new paypal.orders.OrdersGetRequest(orderId);
      const order = await paypalClient.execute(request);

      if (!order || order.result.status !== "COMPLETED") {
        return { statusCode: 400, body: JSON.stringify({ success: false }) };
      }

      const purchaseUnit = order.result.purchase_units[0];

      if (!purchaseUnit.custom_id) {
        return { statusCode: 400, body: JSON.stringify({ success: false }) };
      }

      const customData = JSON.parse(purchaseUnit.custom_id);

      orderData = {
        orderId: orderId,
        shipping: customData.shipping,
        cart: purchaseUnit.items.map(i => ({
          title: i.name,
          quantity: i.quantity,
          price: parseFloat(i.unit_amount.value)
        })),
        total: parseFloat(purchaseUnit.amount.value),
        paymentMethod: "PayPal",
      };
    }

    /* ================= FINAL CHECK ================= */

    if (!orderData) {
      return { statusCode: 400, body: JSON.stringify({ success: false }) };
    }

    await appendToGoogleSheets(orderData);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        orderId: orderData.orderId,
        total: orderData.total,
        cart: orderData.cart
      }),
    };

  } catch (error) {
    console.error("Verify Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};