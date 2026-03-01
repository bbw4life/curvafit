const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    if (!event.body) {
      return response(400, { success: false, error: "No data received" });
    }

    const { cart, shipping } = JSON.parse(event.body);

    // Validation
    if (!Array.isArray(cart) || cart.length === 0) {
      return response(400, { success: false, error: "Cart is empty" });
    }

    if (!shipping || !shipping.fullName || !shipping.address) {
      return response(400, { success: false, error: "Shipping info missing" });
    }

    const PAYPAL_BASE = process.env.PAYPAL_ENV === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

    // 1️⃣ Get Access Token
    const auth = Buffer
      .from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`)
      .toString('base64');

    const tokenResponse = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to get PayPal access token");
    }

    const { access_token } = await tokenResponse.json();

    // 2️⃣ Calculate total securely
    let subtotal = 0;

    const items = cart.map(item => {
      const price = parseFloat(item.price);
      const quantity = parseInt(item.quantity);

      if (price <= 0 || quantity <= 0) {
        throw new Error("Invalid cart item");
      }

      subtotal += price * quantity;

      return {
        name: item.title,
        unit_amount: {
          currency_code: "USD",
          value: price.toFixed(2)
        },
        quantity: quantity.toString()
      };
    });

    const total = subtotal.toFixed(2);

    // 3️⃣ Create Order (CAPTURE direct)
    const orderBody = {
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: "USD",
          value: total,
          breakdown: {
            item_total: {
              currency_code: "USD",
              value: total
            }
          }
        },
        items: items,
        shipping: {
          name: {
            full_name: shipping.fullName
          },
          address: {
            address_line_1: shipping.address,
            admin_area_2: shipping.city || "",
            admin_area_1: shipping.state || "",
            postal_code: shipping.postalCode || "",
            country_code: shipping.country || "US"
          }
        }
      }],
      application_context: {
        return_url: `${process.env.BASE_URL}/thankyou.html`,
        cancel_url: `${process.env.BASE_URL}/checkout.html`
      }
    };

    const orderResponse = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(orderBody)
    });

    if (!orderResponse.ok) {
      const errText = await orderResponse.text();
      throw new Error(errText);
    }

    const orderData = await orderResponse.json();

    return response(200, {
      success: true,
      orderID: orderData.id
    });

  } catch (error) {
    console.error("PayPal Error:", error.message);
    return response(500, {
      success: false,
      error: "PayPal order creation failed"
    });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}