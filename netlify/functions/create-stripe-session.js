// create-stripe-session.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  console.log("[STRIPE SESSION] Function invoked");
  try {
    if (!event.body) throw new Error("No data received");
    const { cart, shipping } = JSON.parse(event.body);
    if (!Array.isArray(cart) || cart.length === 0) throw new Error("Invalid cart data");

    let subtotal = 0;
    cart.forEach(item => {
      subtotal += item.price * item.quantity;
    });
    const TAX_RATE = 0.1;
    const SHIPPING_COST = 10.00;
    const taxes = subtotal * TAX_RATE;

    const line_items = [
      ...cart.map(item => ({
        price_data: {
          currency: 'usd',
          product_data: { name: item.title },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      {
        price_data: {
          currency: 'usd',
          product_data: { name: 'Shipping' },
          unit_amount: Math.round(SHIPPING_COST * 100),
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: 'usd',
          product_data: { name: 'Taxes' },
          unit_amount: Math.round(taxes * 100),
        },
        quantity: 1,
      },
    ];

    const eproloData = cart.map(item => ({
      eprolo_variant_id: item.eprolo_variant_id || ''
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: line_items,
      mode: 'payment',
      success_url: `${process.env.BASE_URL}/thankyou.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/checkout.html`,
      metadata: {
        eprolo_data: JSON.stringify(eproloData),
        shipping: JSON.stringify(shipping)
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id })
    };
  } catch (error) {
    console.error("[STRIPE SESSION ERROR]", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};