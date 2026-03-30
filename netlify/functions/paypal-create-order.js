const fetch = require('node-fetch');

// ── Fetch settings from products.data.json ──────────────────────────
async function getSettings() {
  try {
    const BASE_URL = process.env.BASE_URL || '';
    const res = await fetch(`${BASE_URL}/products.data.json`);
    if (!res.ok) throw new Error('Failed to fetch products.data.json');
    const data = await res.json();
    const settings = data.find(p => p.type === 'settings') || {};
    return settings;
  } catch (err) {
    console.warn('[PAYPAL] Could not load products.data.json, using defaults:', err.message);
    return {};
  }
}

// ── Enforce free promo items (price = 0) from settings ───────────────
function sanitizeCart(cart, settings) {
  const cd = settings.cart_drawer || {};
  const buyQty = parseInt(cd.promo_buy_quantity) || 0;
  const getQty = parseInt(cd.promo_get_quantity) || 0;

  if (!buyQty || !getQty) return cart;

  const paidItems = cart.filter(i => !i.isFreePromo);
  const paidQty = paidItems.reduce((sum, i) => sum + (parseInt(i.quantity) || 0), 0);

  return cart.map(item => {
    if (item.isFreePromo) {
      if (paidQty >= buyQty) {
        return { ...item, price: 0 };
      } else {
        return { ...item, isFreePromo: false };
      }
    }
    return item;
  });
}

// ── Compute effective shipping & tax based on settings ───────────────
function computeTotals(cart, settings) {
  const cd = settings.cart_drawer || {};

  const SHIPPING_COST = parseFloat(settings.shipping_cost) || 10.00;
  const TAX_RATE = parseFloat(settings.tax_rate) || 0.10;
  const freeShippingThreshold = parseFloat(cd.free_shipping_threshold) || 0;

  const subtotal = cart.reduce((sum, item) => {
    return sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0);
  }, 0);

  const qualifiesForFreeShipping = freeShippingThreshold > 0 && subtotal >= freeShippingThreshold;

  const effectiveShipping = qualifiesForFreeShipping ? 0 : SHIPPING_COST;
  const effectiveTax = qualifiesForFreeShipping ? 0 : subtotal * TAX_RATE;

  return {
    subtotal,
    shippingCost: effectiveShipping,
    taxAmount: effectiveTax,
  };
}

exports.handler = async (event) => {
  try {
    if (!event.body) return response(400, { success: false, error: "No data" });

    const { cart: rawCart, shipping } = JSON.parse(event.body);

    if (!Array.isArray(rawCart) || rawCart.length === 0) {
      return response(400, { success: false, error: "Cart empty" });
    }

    // ── Load settings server-side ──
    const settings = await getSettings();
    const cart = sanitizeCart(rawCart, settings);
    const { subtotal, shippingCost, taxAmount } = computeTotals(cart, settings);

    const PAYPAL_BASE = process.env.PAYPAL_ENV === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

    const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64');
    const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    if (!tokenRes.ok) throw new Error("Failed to get PayPal token");
    const { access_token } = await tokenRes.json();

    const items = cart.map(item => {
      const price = parseFloat(item.price);
      const qty = parseInt(item.quantity);
      if (price < 0 || !qty || qty <= 0) throw new Error("Invalid item");
      return {
        name: item.isFreePromo ? `🎁 FREE: ${item.title}` : item.title,
        unit_amount: { currency_code: "USD", value: price.toFixed(2) },
        quantity: qty.toString(),
        sku: item.cj_variant_id || '',
        description: `${item.color || 'N/A'}|${item.image || ''}`
      };
    });

    const finalTotal = (subtotal + shippingCost + taxAmount).toFixed(2);
    const custom_id = cart.map(item => item.cj_variant_id || '').join('|');

    const fullName = `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim();
    const orderBody = {
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: `${fullName}|${shipping.phone || ''}|${shipping.email || ''}|${shipping.countryCode || 'US'}|${shipping.shipping_method || 'Standard Shipping'}`,
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
          name: { full_name: fullName },
          address: {
            address_line_1: shipping.address || '',
            address_line_2: '',
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

    let payer = {};
    if (shipping.email) payer.email_address = shipping.email;
    if (shipping.firstName || shipping.lastName) {
      payer.name = { given_name: shipping.firstName || '', surname: shipping.lastName || '' };
    }
    if (shipping.phone && shipping.countryCode) {
      try {
        const countryRes = await fetch(`https://restcountries.com/v3.1/alpha/${shipping.countryCode}?fields=idd`);
        const countryData = await countryRes.json();
        let callingCode = countryData.idd.root.replace('+', '') + (countryData.idd.suffixes ? countryData.idd.suffixes[0] : '');
        let nationalNumber = shipping.phone.replace(/^\+/, '').replace(/\D/g, '');
        if (nationalNumber.startsWith(callingCode)) nationalNumber = nationalNumber.slice(callingCode.length);
        payer.phone = { phone_type: "MOBILE", phone_number: { country_code: callingCode, national_number: nationalNumber } };
      } catch (err) {}
    }
    orderBody.payer = payer;

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(orderBody)
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      throw new Error(errText || "PayPal order creation failed");
    }
    const orderData = await orderRes.json();

    return response(200, {
      success: true,
      orderID: orderData.id,
      paypalDomain: PAYPAL_BASE.includes("sandbox") ? "https://www.sandbox.paypal.com" : "https://www.paypal.com"
    });

  } catch (error) {
    console.error("[PAYPAL] Global error:", error.message);
    return response(500, { success: false, error: "PayPal order creation failed" });
  }
};

function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}