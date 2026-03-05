const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    if (!event.body) {
      return response(400, { success: false, error: "No data received" });
    }

    const { cart, shipping } = JSON.parse(event.body);

    if (!Array.isArray(cart) || cart.length === 0) {
      return response(400, { success: false, error: "Cart is empty" });
    }

    if (!shipping || !shipping.email || !shipping.fullName) {
      return response(400, { success: false, error: "Shipping info missing" });
    }

    let subtotal = 0;

    const lineItems = cart.map((item, index) => {
      // === DEBUG POUR VOIR EXACTEMENT CE QUI MANQUE ===
      console.log(`[STRIPE] Item ${index}:`, {
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        cj_product_id: item.cj_product_id,
        cj_variant_id: item.cj_variant_id
      });

      if (!item.price || !item.quantity || !item.title) {
        throw new Error(`Invalid cart item #${index}: missing price/quantity/title`);
      }

      const price = parseFloat(item.price);
      const quantity = parseInt(item.quantity);

      if (price <= 0 || quantity <= 0) {
        throw new Error(`Invalid price or quantity for item #${index}`);
      }

      // cj_ fields rendus optionnels (plus jamais de crash)
      if (!item.cj_product_id) {
        console.warn(`[STRIPE] Warning: Item #${index} has no cj_product_id`);
      }

      subtotal += price * quantity;

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.title,
            metadata: {
              cj_product_id: item.cj_product_id || '',
              cj_variant_id: item.cj_variant_id || '',
              size: item.size || '',
              color: item.color || ''
            }
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: shipping.email,
      success_url: `${process.env.BASE_URL}/thankyou.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/checkout.html`,
      metadata: {
        cart: JSON.stringify(cart),
        shipping: JSON.stringify(shipping),
        subtotal: subtotal.toFixed(2),
        provider: "stripe"
      }
    });

    return response(200, {
      success: true,
      sessionId: session.id
    });

  } catch (error) {
    console.error("Stripe Session Error:", error.message);
    return response(500, {
      success: false,
      error: error.message || "Payment session creation failed"
    });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}