// paypal-create-order.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    if (!event.body) return response(400, { success: false, error: "No data" });

    const { cart, shipping, shipping_cost = "10.00", tax = "0.00" } = JSON.parse(event.body);

    if (!Array.isArray(cart) || cart.length === 0) {
      return response(400, { success: false, error: "Cart empty" });
    }

    const PAYPAL_BASE = process.env.PAYPAL_ENV === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

    // ====================== ACCESS TOKEN ======================
    const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64');
    const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const { access_token } = await tokenRes.json();

    // ====================== CALCULS ======================
    let subtotal = 0;
    const items = cart.map(item => {
      const price = parseFloat(item.price);
      const qty = parseInt(item.quantity);
      subtotal += price * qty;
      return {
        name: item.title,
        unit_amount: { currency_code: "USD", value: price.toFixed(2) },
        quantity: qty.toString()
      };
    });

    const shippingCost = parseFloat(shipping_cost);
    const taxAmount = parseFloat(tax);
    const finalTotal = (subtotal + shippingCost + taxAmount).toFixed(2);

    const custom_id = cart.map(item => `${item.cj_product_id || ''}:${item.cj_variant_id || ''}`).join('|');

    // ====================== CREATE ORDER ======================
    const orderBody = {
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: "USD",
          value: finalTotal,
          breakdown: {
            item_total: { currency_code: "USD", value: subtotal.toFixed(2) },
            shipping: { currency_code: "USD", value: shippingCost.toFixed(2) },
            tax_total: { currency_code: "USD", value: taxAmount.toFixed(2) }
          }
        },
        items: items,
        shipping: {
          name: { full_name: shipping.fullName },
          address: {
            address_line_1: shipping.address,
            admin_area_2: shipping.city || "",
            admin_area_1: shipping.state || "",
            postal_code: shipping.postalCode || "",
            country_code: shipping.countryCode || "US"
          }
        },
        custom_id: custom_id
      }],
      application_context: {
        return_url: `${process.env.BASE_URL}/thankyou.html`,
        cancel_url: `${process.env.BASE_URL}/checkout.html`
      }
    };

    // Prefill payer (email)
    if (shipping.email) {
      orderBody.payer = { email_address: shipping.email };
    }

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(orderBody)
    });

    if (!orderRes.ok) {
      const err = await orderRes.text();
      throw new Error(err);
    }

    const orderData = await orderRes.json();
    const orderID = orderData.id;

    // ====================== CORRECTION PRINCIPALE ======================
    // On sauvegarde IMMÉDIATEMENT le pending order avec le shipping complet reçu depuis checkout.js
    try {
      await fetch(`${process.env.BASE_URL}/.netlify/functions/save-pending-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping: shipping,           // ← nom complet du pays + countryCode + téléphone exact
          item: cart[0] || {},
          payment_provider: "paypal",
          payment_id: orderID,
          status: "pending_stock"
        })
      });
      console.log(`[PayPal] ✅ Pending order saved with FULL shipping (country + phone)`);
    } catch (saveErr) {
      console.error("[PayPal] Save pending non-blocking error:", saveErr.message);
    }

    return response(200, {
      success: true,
      orderID: orderID,
      paypalDomain: PAYPAL_BASE.includes("sandbox") ? "https://www.sandbox.paypal.com" : "https://www.paypal.com"
    });

  } catch (error) {
    console.error("PayPal Error:", error.message);
    return response(500, { success: false, error: error.message });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}