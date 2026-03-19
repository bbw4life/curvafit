// create-stripe-session.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    if (!event.body) throw new Error("No data received");
    
    const { cart, shipping, shipping_cost = "10.00", tax = "0.00" } = JSON.parse(event.body);

    if (!Array.isArray(cart) || cart.length === 0) throw new Error("Invalid cart data");

    let subtotal = 0;
    const lineItems = cart.map(item => {
      const price = parseFloat(item.price);
      const qty = parseInt(item.quantity);
      if (!price || !qty || price <= 0) throw new Error("Invalid item");
      subtotal += price * qty;

      const variantParts = [];
      if (item.color) variantParts.push(`Color: ${item.color}`);
      if (item.size) variantParts.push(`Size: ${item.size}`);

      return {
        price_data: {
          currency: 'usd',
          product_data: { 
            name: item.title,
            images: item.image ? [item.image] : [],
            ...(variantParts.length > 0 && { description: variantParts.join(' | ') })
          },
          unit_amount: Math.round(price * 100)
        },
        quantity: qty
      };
    });

    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Shipping' },
        unit_amount: Math.round(parseFloat(shipping_cost) * 100)
      },
      quantity: 1
    });

    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Taxes' },
        unit_amount: Math.round(parseFloat(tax) * 100)
      },
      quantity: 1
    });

    const eproloData = cart.map(item => ({
      variantsid: item.cj_variant_id || ''
    }));

    const imagesData = cart.map(item => item.image || '');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.BASE_URL}/thankyou.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/checkout.html`,
      metadata: {
        eprolo_data: JSON.stringify(eproloData),
        shipping: JSON.stringify(shipping),
        images: JSON.stringify(imagesData)
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, sessionId: session.id })
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