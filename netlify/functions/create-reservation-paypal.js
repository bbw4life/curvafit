// netlify/functions/create-reservation-paypal.js

const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    if (!event.body) throw new Error('No data received');

    const { amount, program, customer } = JSON.parse(event.body);

    const BASE_URL    = process.env.BASE_URL || '';
    const PAYPAL_BASE = process.env.PAYPAL_ENV === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    // ── Token PayPal ──
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
    ).toString('base64');

    const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!tokenRes.ok) throw new Error('Failed to get PayPal token');
    const { access_token } = await tokenRes.json();

    // ── Créer l'ordre PayPal (one-time payment) ──
    const orderBody = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: parseFloat(amount).toFixed(2),
          },
          description: `CurvaFit Reservation — ${program || 'Program'}`,
          custom_id: `${customer.email || ''}|${program || ''}|reservation`,
        },
      ],
      application_context: {
        return_url: `${BASE_URL}/programs.html?res_token={token}&res_subscription_id={subscription_id}`,
        cancel_url: `${BASE_URL}/programs.html`,
        brand_name: 'CurvaFit',
        user_action: 'PAY_NOW',
      },
    };

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderBody),
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      throw new Error(errText || 'PayPal order creation failed');
    }

    const orderData   = await orderRes.json();
    const approvalLink = orderData.links.find(l => l.rel === 'approve');
    if (!approvalLink) throw new Error('No PayPal approval URL found');

    return response(200, { success: true, approvalUrl: approvalLink.href });

  } catch (err) {
    console.error('[create-reservation-paypal]', err.message);
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