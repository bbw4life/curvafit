// netlify/functions/create-reservation-stripe-session.js
// Lit RESERVATION_STRIPE_PRICE_ID depuis les variables d'environnement Netlify

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    if (!event.body) throw new Error('No data received');

    const { amount, program, customer } = JSON.parse(event.body);

    // ── Lire l'ID du prix depuis les variables Netlify ──
    const stripePriceId = process.env.RESERVATION_STRIPE_PRICE_ID || '';

    if (!stripePriceId) {
      throw new Error('RESERVATION_STRIPE_PRICE_ID not configured in Netlify environment variables.');
    }

    const BASE_URL = process.env.BASE_URL || '';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      customer_email: customer.email || undefined,
      metadata: {
        firstName: customer.firstName || '',
        lastName:  customer.lastName  || '',
        email:     customer.email     || '',
        phone:     customer.phone     || '',
        program:   program            || '',
        type:      'reservation',
        amount:    String(amount),
      },
      success_url: `${BASE_URL}/programs.html?res_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${BASE_URL}/programs.html`,
    });

    return response(200, { success: true, sessionId: session.id });

  } catch (err) {
    console.error('[create-reservation-stripe-session]', err.message);
    return response(500, { success: false, error: err.message });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}