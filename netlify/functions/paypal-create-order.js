const paypal = require('@paypal/checkout-server-sdk');

const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

/* ================= ENVIRONMENT ================= */

const environment =
  process.env.NODE_ENV === "production"
    ? new paypal.core.LiveEnvironment(clientId, clientSecret)
    : new paypal.core.SandboxEnvironment(clientId, clientSecret);

const client = new paypal.core.PayPalHttpClient(environment);

/* ================= HANDLER ================= */

exports.handler = async (event) => {
  try {

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { cart, shipping } = JSON.parse(event.body);

    if (!cart || cart.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Cart empty" }) };
    }

    /* ================= CALCULATE TOTAL ================= */

    let subtotal = 0;

    cart.forEach(item => {
      subtotal += Number(item.price) * Number(item.quantity);
    });

    const taxes = subtotal * 0.1;
    const shippingCost = 10.00;
    const total = subtotal + taxes + shippingCost;

    /* ================= CREATE ORDER ================= */

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");

    request.requestBody({
      intent: 'CAPTURE',

      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: total.toFixed(2),
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: subtotal.toFixed(2)
            },
            tax_total: {
              currency_code: 'USD',
              value: taxes.toFixed(2)
            },
            shipping: {
              currency_code: 'USD',
              value: shippingCost.toFixed(2)
            }
          }
        },

        // 🔥 IMPORTANT POUR verify-payment.js
        custom_id: JSON.stringify({
          shipping,
          cart
        }),

        items: cart.map(item => ({
          name: item.title,
          unit_amount: {
            currency_code: 'USD',
            value: Number(item.price).toFixed(2)
          },
          quantity: Number(item.quantity)
        }))
      }],

      application_context: {
        return_url: `${process.env.URL}/thankyou.html`,
        cancel_url: `${process.env.URL}/checkout.html`
        }
    });

    const order = await client.execute(request);

    return {
      statusCode: 200,
      body: JSON.stringify({
        orderId: order.result.id
      })
    };

  } catch (error) {
    console.error("PayPal Create Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};