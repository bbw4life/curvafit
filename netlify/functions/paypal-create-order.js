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
    // ====================== CALCULS SÉCURISÉS ======================
    let subtotal = 0;
    const items = cart.map(item => {
      const price = parseFloat(item.price);
      const qty = parseInt(item.quantity);
      if (!price || !qty || price <= 0) throw new Error("Invalid item");
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
    // ====================== COMPACT CUSTOM_ID WITH CJ IDS ======================
    const custom_id = cart
  .map(item => `${item.cj_product_id || ''}:${item.cj_variant_id || ''}`)
  .join('|');
    // ====================== CREATE ORDER ======================
    const orderBody = {
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: shipping.phone || '', // Store frontend phone here for fallback
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
    // ====================== PREFILL PAYER FOR PHONE AND EMAIL ======================
    let payer = {};
    if (shipping.email) {
      payer.email_address = shipping.email;
    }
    if (shipping.fullName) {
      const [givenName, ...surnameParts] = shipping.fullName.split(' ');
      payer.name = {
        given_name: givenName || '',
        surname: surnameParts.join(' ') || ''
      };
    }
    if (shipping.phone && shipping.countryCode) {
      try {
        const countryRes = await fetch(`https://restcountries.com/v3.1/alpha/${shipping.countryCode}?fields=idd`);
        const countryData = await countryRes.json();
        let callingCode = countryData.idd.root.replace('+', '') + (countryData.idd.suffixes ? countryData.idd.suffixes[0] : '');
        let nationalNumber = shipping.phone.replace(`+${callingCode}`, '').replace(/\D/g, '');
        payer.phone = {
          phone_type: "MOBILE",
          phone_number: {
            country_code: callingCode,
            national_number: nationalNumber
          }
        };
      } catch (err) {
        console.error("Failed to prefill phone:", err);
      }
    }
    orderBody.payer = payer;
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
      console.error("PayPal Error:", err);
      throw new Error(err);
    }
    const orderData = await orderRes.json();
    return response(200, {
      success: true,
      orderID: orderData.id,
      paypalDomain: PAYPAL_BASE.includes("sandbox")
        ? "https://www.sandbox.paypal.com"
        : "https://www.paypal.com"
    });
  } catch (error) {
    console.error("PayPal Error:", error.message);
    return response(500, { success: false, error: "PayPal order creation failed" });
  }
};
function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}