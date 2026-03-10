// thankyou.js - VERSION COMPLÈTE ET OPTIMISÉE (anti-double + shipping complet PayPal)
document.addEventListener('DOMContentLoaded', async () => {
    
    // === PROTECTION ANTI-DOUBLE APPEL (résout le rate limit CJ) ===
    if (window.verifyPaymentAlreadyRunning) {
        console.log("🚫 Double appel à verify-payment bloqué");
        return;
    }
    window.verifyPaymentAlreadyRunning = true;
    // ============================================================

    console.log("🚀 thankyou.html LOADED - Starting verification...");

    const spinner = document.getElementById('spinner');
    const messageEl = document.getElementById('message');
    const buttonsEl = document.getElementById('buttons');

    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const orderID = urlParams.get('token');
    const forceReset = urlParams.get('reset') === '1';

    console.log(`📌 sessionId: ${sessionId} | orderID: ${orderID} | forceReset: ${forceReset}`);

    if (forceReset) {
        sessionStorage.clear();
        console.log("🔄 sessionStorage cleared (forceReset)");
    }

    let payload = null;

    if (sessionId) {
        // === STRIPE ===
        payload = { provider: 'stripe', sessionId };
        console.log("🔵 Mode Stripe détecté");
    } 
    else if (orderID) {
        // === PAYPAL - Récupération du shipping complet (pays + countryCode + téléphone) ===
        const savedShippingKey = `pendingPaypalShipping_${orderID}`;
        const savedShipping = localStorage.getItem(savedShippingKey);
        const shippingData = savedShipping ? JSON.parse(savedShipping) : null;

        if (shippingData) {
            console.log("✅ Shipping COMPLET récupéré pour PayPal :", {
                fullName: shippingData.fullName,
                country: shippingData.country,
                countryCode: shippingData.countryCode,
                phone: shippingData.phone
            });
        } else {
            console.warn("⚠️ Aucun shipping sauvegardé pour cet orderID PayPal");
        }

        payload = { 
            provider: 'paypal', 
            orderID,
            shipping: shippingData   // ← Transmission du vrai pays + code ISO + téléphone
        };
        
        // Nettoyage (on supprime après utilisation)
        localStorage.removeItem(savedShippingKey);
    }

    if (!payload) {
        displayError("We're sorry, but we couldn't find your payment information. Please contact CurvaFit support for assistance.");
        spinner.style.display = "none";
        return;
    }

    console.log("🔄 Bypassing alreadyVerified check for debugging");

    try {
        const functionUrl = `${window.location.origin}/.netlify/functions/verify-payment`;
        console.log(`📡 Calling verify-payment: ${functionUrl}`);

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log(`📡 Response status: ${response.status}`);

        if (response.status === 404) {
            throw new Error("We're experiencing a temporary issue with order verification. Please try again later.");
        }

        const data = await response.json();
        console.log("📦 Data received from verify-payment:", data);

        if (!response.ok || !data.success) {
            throw new Error(data.error || "There was an issue verifying your order.");
        }

        sessionStorage.setItem("paymentVerified", sessionId || orderID);
        showSuccess();
        console.log("🎉 VERIFICATION COMPLETED SUCCESSFULLY");

    } catch (error) {
        console.error("❌ ERREUR COMPLETE:", error);
        displayError(error.message || "An unexpected error occurred. Please contact CurvaFit support.");
    } finally {
        spinner.style.display = "none";
    }
});

function showSuccess() {
    document.getElementById('message').innerHTML = `
        <h1>Thank You for Your Order, Dear Customer!</h1>
        <p>We are delighted that you chose CurvaFit with full confidence!</p>
        <p>✅ Your order has been confirmed!</p>
        <p>Your order will arrive soon.</p>
        <p>Please check your email inbox for your order tracking number!</p>
        <p>You can reorder below and take advantage of our offers.</p>
    `;
    document.getElementById('message').style.display = 'block';
    document.getElementById('buttons').style.display = 'block';
}

function displayError(message) {
    document.getElementById('message').innerHTML = `<p class="error">${message}</p>`;
    document.getElementById('message').style.display = 'block';
    document.getElementById('buttons').style.display = 'block';
}