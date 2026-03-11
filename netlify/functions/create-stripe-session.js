// create-stripe-session.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    if (!event.body) throw new Error("No data received");
    const { cart, shipping } = JSON.parse(event.body);
    if (!Array.isArray(cart) || cart.length === 0) throw new Error("Invalid cart data");

    const lineItems = cart.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: { name: item.title || 'Product' },
        unit_amount: Math.round((parseFloat(item.price) || 0) * 100),
      },
      quantity: parseInt(item.quantity) || 1,
    }));

    const eprolo_data = cart.map(item => item.variantsid || '');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.BASE_URL}/thankyou.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/checkout.html`,
      metadata: {
        eprolo_data: JSON.stringify(eprolo_data),
        shipping: JSON.stringify(shipping),
      },
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