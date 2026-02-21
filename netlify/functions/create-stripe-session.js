const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { cart, shipping } = JSON.parse(event.body);

    /* ================= VALIDATION ================= */

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Cart is empty" })
      };
    }

    if (!shipping || !shipping.email || !shipping.fullName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing shipping information" })
      };
    }

    /* ================= CALCULATE TOTAL SERVER SIDE ================= */

    let subtotal = 0;

    cart.forEach(item => {
      const price = Number(item.price);
      const quantity = Number(item.quantity);

      if (!price || !quantity) {
        throw new Error("Invalid cart item");
      }

      subtotal += price * quantity;
    });

    const taxes = subtotal * 0.1;
    const shippingCost = 10.00;

    /* ================= BUILD LINE ITEMS ================= */

    const lineItems = cart.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.title
        },
        unit_amount: Math.round(Number(item.price) * 100)
      },
      quantity: Number(item.quantity)
    }));

    // Tax line
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Tax (10%)' },
        unit_amount: Math.round(taxes * 100)
      },
      quantity: 1
    });

    // Shipping line
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Shipping' },
        unit_amount: Math.round(shippingCost * 100)
      },
      quantity: 1
    });

    /* ================= CREATE SESSION ================= */

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: shipping.email,

      line_items: lineItems,

      success_url: `${process.env.URL}/thankyou.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/checkout.html`,

      metadata: {
        shipping: JSON.stringify(shipping),
        cart: JSON.stringify(cart)
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ sessionId: session.id })
    };

  } catch (error) {
    console.error("Stripe Error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};