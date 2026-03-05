// netlify/functions/verify-payment.js  ← VERSION FINALE CORRIGÉE
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    if (!event.body) return response(400, { success: false, error: "No data" });

    const { provider, sessionId, orderID } = JSON.parse(event.body);
    let cart = [];
    let shipping = {};
    let paymentId = sessionId || orderID;

    console.log(`[VERIFY] Début vérification - Provider: ${provider}`);

    // ====================== STRIPE ======================
    if (provider === "stripe") {
      if (!sessionId) throw new Error("Missing Stripe sessionId");
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== "paid") throw new Error("Stripe payment not completed");

      cart = JSON.parse(session.metadata.cart || "[]");
      shipping = JSON.parse(session.metadata.shipping || "{}");
      console.log(`[STRIPE] ${cart.length} articles récupérés`);

    // ====================== PAYPAL ======================
    } else if (provider === "paypal") {
      if (!orderID) throw new Error("Missing PayPal orderID");

      const PAYPAL_BASE = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");

      const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials"
      });
      const { access_token } = await tokenRes.json();

      const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" }
      });
      const orderData = await captureRes.json();

      if (orderData.status !== "COMPLETED") throw new Error("PayPal payment not completed");

      const purchaseUnit = orderData.purchase_units[0];
      const storedCj = purchaseUnit.custom_id ? purchaseUnit.custom_id.split('|') : [];

      cart = purchaseUnit.items.map((ppItem, i) => {
        const parts = storedCj[i] ? storedCj[i].split(':') : ['', ''];
        return {
          title: ppItem.name,
          price: parseFloat(ppItem.unit_amount.value),
          quantity: parseInt(ppItem.quantity),
          cj_product_id: parts[0] || null,
          cj_variant_id: parts[1] || null
        };
      });

      shipping = {
        fullName: purchaseUnit.shipping?.name?.full_name || "",
        email: orderData.payer?.email_address || "",
        address: purchaseUnit.shipping?.address?.address_line_1 || "",
        city: purchaseUnit.shipping?.address?.admin_area_2 || "",
        state: purchaseUnit.shipping?.address?.admin_area_1 || "",
        postalCode: purchaseUnit.shipping?.address?.postal_code || "",
        country: purchaseUnit.shipping?.address?.country_code || "US"
      };
      console.log(`[PAYPAL] ${cart.length} articles reconstruits avec CJ data`);
    } else {
      throw new Error("Invalid provider");
    }

    if (!cart.length) throw new Error("Cart vide après vérification");

    // ====================== FULFILLMENT CJ ======================
    console.log(`[FULFILLMENT] Lancement pour ${cart.length} produit(s)...`);

    let fulfilled = 0;
    let pending = 0;

    for (const item of cart) {
      try {
        if (!item.cj_variant_id) {
          console.error(`[ITEM] Pas de cj_variant_id pour : ${item.title}`);
          pending++;
          continue;
        }

        // === 1. CHECK STOCK ===
        const stockRes = await fetch(`/.netlify/functions/check-cj-stock`, {  // ← CHEMIN RELATIF (LE PLUS FIABLE)
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cj_variant_id: item.cj_variant_id })
        });
        const stockData = await stockRes.json();

        console.log(`[STOCK] ${item.title} (${item.cj_variant_id}) → inStock: ${stockData.inStock} | stock: ${stockData.stock}`);

        // === 2. CREATE ORDER CHEZ CJ ===
        if (stockData.inStock === true) {
          const cjRes = await fetch(`/.netlify/functions/create-cj-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cart: [item], shipping })
          });
          const cjData = await cjRes.json();

          if (cjData.success) {
            console.log(`[CJ SUCCESS] Commande créée pour ${item.title} → CJ Order: ${cjData.cjOrderId}`);
            fulfilled++;
          } else {
            console.error(`[CJ ERROR]`, cjData);
            pending++;
          }
        } else {
          // === 3. SAVE PENDING (structure corrigée) ===
          await fetch(`/.netlify/functions/save-pending-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              shipping,
              item,                    // ← item (singulier) comme attendu
              payment_provider: provider,
              payment_id: paymentId
            })
          });
          console.log(`[PENDING] ${item.title} sauvegardé en attente de stock`);
          pending++;
        }
      } catch (itemErr) {
        console.error(`[ITEM ERROR] ${item.title}:`, itemErr.message);
        pending++;
      }
    }

    return response(200, {
      success: true,
      paymentVerified: true,
      fulfillmentStatus: pending === 0 ? "completed" : "partial_pending",
      fulfilled,
      pending
    });

  } catch (error) {
    console.error("[VERIFY CRITICAL ERROR]:", error.message);
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