// thankyou.js — Curvafit order confirmation
async function prepareEbookAccess(paymentId) {
    if (!paymentId) return;

    for (let attempt = 0; attempt < 8; attempt++) {
        try {
            const response = await fetch('/ebook-download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'prepare-order', paymentId })
            });
            const data = await response.json();

            if (response.status === 202 && data.pending) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            if (response.ok && data.success) {
                sessionStorage.setItem('ebookSelections', JSON.stringify(data.ebooks || []));
                sessionStorage.setItem('ebookAccessToken', data.ebookAccessToken || '');
                sessionStorage.setItem('ebookAccessExpiresAt', String(data.ebookAccessExpiresAt || 0));
            } else if (data.expired) {
                sessionStorage.removeItem('ebookAccessToken');
                sessionStorage.removeItem('ebookAccessExpiresAt');
            }
            return;
        } catch (error) {
            console.warn('[EBOOK DOWNLOAD] Access preparation failed:', error.message);
            return;
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Curvafit thankyou.html loaded - Starting verification...");

    const spinner   = document.getElementById('spinner');
    const messageEl = document.getElementById('message');
    const buttonsEl = document.getElementById('buttons');

    const urlParams  = new URLSearchParams(window.location.search);
    const sessionId  = urlParams.get('session_id');
    const orderID    = urlParams.get('token');
    const forceReset = urlParams.get('reset') === '1';

    // ── NOWPayments : commande déjà traitée par le webhook ──
        const provider = urlParams.get('provider') || '';
         if (provider === 'nowpayments') {
            const nowpaymentsOrderId = urlParams.get('orderId') || '';
            if (nowpaymentsOrderId) {
                await prepareEbookAccess(nowpaymentsOrderId);
            }
            localStorage.removeItem('cart');
            if (spinner) spinner.style.display = 'none';
            showSuccess();
            return;
        }

    console.log(`📌 sessionId: ${sessionId} | orderID: ${orderID} | forceReset: ${forceReset}`);

    if (forceReset) {
        sessionStorage.clear();
        console.log("🔄 sessionStorage cleared (forceReset)");
    }

    let payload = null;
    if (sessionId) payload = { provider: 'stripe',  sessionId };
    else if (orderID) payload = { provider: 'paypal', orderID  };

    if (!payload) {
        displayError("We couldn’t find the payment information for this order. Please return to checkout or contact Curvafit support.");
        spinner.style.display = "none";
        return;
    }

    const verifiedId = sessionId || orderID;
    if (sessionStorage.getItem("paymentVerified") === verifiedId) {
        console.log("✅ Already verified in this session — skipping server call");
        localStorage.removeItem('cart');
        await prepareEbookAccess(verifiedId);
        spinner.style.display = "none";
        showSuccess();
        return;
    }

    try {
        const functionUrl = `${window.location.origin}/verify-payment`;
        console.log(`📡 Calling: ${functionUrl}`);

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log(`📡 Response status: ${response.status}`);

        if (response.status === 404) {
            throw new Error("We’re having trouble confirming this payment right now. Please try again shortly or contact Curvafit support.");
        }

        const data = await response.json();
        console.log("📦 Data received:", data);

        if (!response.ok || !data.success) {
            throw new Error(data.error || "We couldn’t confirm this order. Please contact Curvafit support for help.");
        }

        sessionStorage.setItem("paymentVerified", verifiedId);
        if (data.orderNumber) sessionStorage.setItem("orderNumber", data.orderNumber);
        localStorage.removeItem('cart');
        await prepareEbookAccess(verifiedId);

        showSuccess();
        console.log("🎉 Payment verification completed — Welcome to Curvafit!");

    } catch (error) {
        console.error("❌ ERREUR COMPLETE:", error);
        displayError(error.message || "Something went wrong while confirming this order. Please contact Curvafit support.");
    } finally {
        spinner.style.display = "none";
    }
});

// ── Reveal all extra sections with staggered animation ──
function revealExtraSections() {
    const ids = [
        'ty-order-details-section',
        'ty-order-summary-section',
        'next-steps-section',
        'gratitude-section',
        'share-section',
        'bbw-banner-section',
        'support-bar-section',
        'ty-footer-section',
        'success-icon'
    ];
    ids.forEach((id, i) => {
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) el.style.display = (id === 'success-icon') ? 'flex' : '';
        }, i * 180);
    });
    // Update main title
    const h1 = document.querySelector('.container > h1');
    if (h1) {
        h1.textContent = 'Order Confirmed! 🎉';
        h1.style.background = 'linear-gradient(135deg, var(--ty-rose-deep), var(--ty-rose))';
        h1.style.webkitBackgroundClip = 'text';
        h1.style.webkitTextFillColor = 'transparent';
        h1.style.backgroundClip = 'text';
    }

    // Order number — numéro propre (BBW-100001...) renvoyé par verify-payment
    // et gardé en sessionStorage. Repli sur l'ancien comportement (dérivé de
    // l'ID de paiement brut) seulement si absent (très anciennes sessions).
    const orderNumberEl = document.getElementById('ty-order-number');
    if (orderNumberEl) {
        const savedOrderNumber = sessionStorage.getItem('orderNumber');
        if (savedOrderNumber) {
            orderNumberEl.textContent = savedOrderNumber;
        } else {
            const urlParams = new URLSearchParams(window.location.search);
            const rawId = urlParams.get('session_id') || urlParams.get('token') || '';
            orderNumberEl.textContent = rawId ? '#' + rawId.slice(-10).toUpperCase() : '—';
        }
    }
    const orderDateEl = document.getElementById('ty-order-date');
    if (orderDateEl) {
        orderDateEl.textContent = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    loadOrderSummary();
}

// ── Order Summary : récupère la dernière commande depuis le Sheet
//    (bbw4life-accounts, colonne "history", écrite par verify-payment →
//    save-account/record-order) — pas le panier local (déjà vidé à ce
//    stade) et pas de recalcul approximatif : le "total" vient du vrai
//    montant facturé par Stripe/PayPal (inclut le choix de livraison
//    réel fait au checkout, gratuite ou payante).
function loadOrderSummary() {
    const section = document.getElementById('ty-order-summary-section');
    if (!section) return;

    const userEmail = localStorage.getItem('userEmail');
    const userToken = localStorage.getItem('userAccountToken');
    if (!userEmail || !userToken) { section.style.display = 'none'; return; }

    fetch('/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-stats', email: userEmail, token: userToken })
    })
        .then(r => r.json())
        .then(data => {
            const history = Array.isArray(data.history) ? data.history : [];
            const lastOrder = history[history.length - 1];
            if (!lastOrder || !Array.isArray(lastOrder.items) || lastOrder.items.length === 0) {
                section.style.display = 'none';
                return;
            }

            const itemsEl = document.getElementById('ty-order-summary-items');
            if (itemsEl) {
                itemsEl.innerHTML = lastOrder.items.map(item => {
                    const variantParts = [item.color, item.size].filter(Boolean).join(' / ');
                    return `
                        <div class="ty-order-summary__item">
                            <img src="${item.image || ''}" alt="${item.title || ''}" loading="lazy">
                            <div class="ty-order-summary__item-info">
                                <strong>${item.title || ''}</strong>
                                ${variantParts ? `<span>${variantParts}</span>` : ''}
                                <span>Qty: ${item.quantity || 1}</span>
                            </div>
                            <div class="ty-order-summary__item-price">$${parseFloat(item.lineTotal || (item.price * item.quantity) || 0).toFixed(2)}</div>
                        </div>`;
                }).join('');
            }

            const subtotal = lastOrder.items.reduce((sum, item) => sum + parseFloat(item.lineTotal || (item.price * item.quantity) || 0), 0);
            const total = parseFloat(lastOrder.total) || subtotal;
            const shippingAndTax = total - subtotal;

            const subtotalEl = document.getElementById('ty-summary-subtotal');
            if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;

            const shippingRow = document.getElementById('ty-summary-shipping-row');
            const shippingEl  = document.getElementById('ty-summary-shipping');
            if (shippingRow && shippingEl) {
                if (shippingAndTax > 0.01) {
                    shippingEl.textContent = `$${shippingAndTax.toFixed(2)}`;
                    shippingRow.style.display = '';
                } else if (shippingAndTax <= 0.01 && shippingAndTax >= -0.01) {
                    shippingEl.textContent = 'Free';
                    shippingRow.style.display = '';
                }
            }

            const totalEl = document.getElementById('ty-summary-total');
            if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
        })
        .catch(() => { section.style.display = 'none'; });
}

// ── Bandeau promo (photo bienvenue) + liens sociaux du footer : lus
//    depuis settings.promos[0] / settings.social_links — même système
//    que src/components/footer.js (window.__allProducts, déjà chargé
//    par script.js — pas de fetch séparé qui pourrait arriver trop
//    tard ou échouer silencieusement, laissant les liens sur "#").
function applyPromoAndSocialLinks() {
    const all = window.__allProducts || [];
    const settings = all.find(p => p.type === 'settings') || {};

    const pctEl  = document.getElementById('ty-promo-pct');
    const codeEl = document.getElementById('ty-promo-code');
    const promo = (settings.promos || [])[0];
    if (promo) {
        if (pctEl)  pctEl.textContent  = `${promo.percent}% OFF`;
        if (codeEl) codeEl.textContent = promo.code;
    }

    const socialLinks = settings.social_links || {};
    const socialMap = {
        'ty-social-instagram': socialLinks.instagram,
        'ty-social-facebook':  socialLinks.facebook,
        'ty-social-tiktok':    socialLinks.tiktok,
        'ty-social-pinterest': socialLinks.pinterest,
        'ty-social-youtube':   socialLinks.youtube,
        'ty-social-whatsapp':  socialLinks.whatsapp
    };
    Object.entries(socialMap).forEach(([id, url]) => {
        const el = document.getElementById(id);
        if (el && url) el.href = url;
    });
}

function waitForProductsThenApply() {
    if (window.__allProducts && window.__allProducts.length) {
        applyPromoAndSocialLinks();
        return;
    }
    let tries = 0;
    const iv = setInterval(() => {
        tries++;
        if (window.__allProducts && window.__allProducts.length) {
            clearInterval(iv);
            applyPromoAndSocialLinks();
        } else if (tries > 50) {
            clearInterval(iv);
            // Dernier recours : fetch direct si script.js n'a jamais abouti.
            fetch('/products.data.json')
                .then(r => r.json())
                .then(data => {
                    window.__allProducts = window.__allProducts || data;
                    applyPromoAndSocialLinks();
                })
                .catch(() => {});
        }
    }, 100);
}
document.addEventListener('DOMContentLoaded', waitForProductsThenApply);

// ── Show success state ──
async function initializeEbookDownloads() {
    const section = document.getElementById('ebook-download-section');
    const buttonsEl = document.getElementById('ebook-download-buttons');
    const timerEl = document.getElementById('ebook-download-timer');
    if (!section || !buttonsEl || window.__ebookDownloadsInitialized) return;
    window.__ebookDownloadsInitialized = true;

    const token = sessionStorage.getItem('ebookAccessToken') || '';
    const expiresAt = Number(sessionStorage.getItem('ebookAccessExpiresAt') || 0);
    if (!token || !expiresAt || Date.now() >= expiresAt) return;

    const hideDownloads = () => {
        section.style.display = 'none';
        buttonsEl.replaceChildren();
    };

    let timerInterval;
    const updateTimer = () => {
        const remaining = Math.max(0, expiresAt - Date.now());
        if (!remaining) {
            clearInterval(timerInterval);
            hideDownloads();
            return;
        }
        const seconds = Math.ceil(remaining / 1000);
        timerEl.textContent = `Download access closes in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.`;
    };

    try {
        const response = await fetch('/ebook-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'availability', token })
        });
        const data = await response.json();
        if (!response.ok || !data.success) return;

        const availableEbooks = (data.ebooks || []).filter(item => item.available && item.configured);
        if (!availableEbooks.length) return;

        section.style.display = '';
        timerInterval = setInterval(updateTimer, 1000);
        updateTimer();

        const languageLabels = { en: 'English', fr: 'Français', es: 'Español' };
        availableEbooks.forEach(item => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'ebook-download-button';
            button.textContent = `Download ${item.title || 'ebook'} — ${languageLabels[item.language] || item.language}`;
            button.addEventListener('click', async () => {
                if (Date.now() >= expiresAt || button.disabled) return;
                button.disabled = true;
                button.textContent = 'Preparing your download…';

                try {
                    const downloadResponse = await fetch('/ebook-download', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'download', token, variantId: item.variantId })
                    });

                    if (!downloadResponse.ok) {
                        let error = 'The download could not be completed. Please try again.';
                        try { error = (await downloadResponse.json()).error || error; } catch (_) {}
                        throw new Error(error);
                    }

                    const file = await downloadResponse.blob();
                    const objectUrl = URL.createObjectURL(file);
                    const link = document.createElement('a');
                    link.href = objectUrl;
                    link.download = `${(item.title || 'Curvafit-guide').replace(/[^a-z0-9]+/gi, '-')}-${item.language}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

                    const completeResponse = await fetch('/ebook-download', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'complete', token, variantId: item.variantId })
                    });
                    const completion = await completeResponse.json();
                    if (!completeResponse.ok || !completion.success) {
                        throw new Error(completion.error || 'The download status could not be saved.');
                    }

                    button.textContent = 'Downloaded';
                    button.classList.add('is-downloaded');
                } catch (error) {
                    button.disabled = Date.now() >= expiresAt;
                    button.textContent = Date.now() >= expiresAt
                        ? 'Download window closed'
                        : `Retry — ${item.title || 'ebook'} (${languageLabels[item.language] || item.language})`;
                    button.title = error.message;
                    console.error('[EBOOK DOWNLOAD]', error);
                }
            });
            buttonsEl.appendChild(button);
        });
    } catch (error) {
        console.error('[EBOOK DOWNLOAD] Availability check failed:', error);
        hideDownloads();
    }
}

function showSuccess() {
    document.getElementById('message').innerHTML = `
        <h2>Thank you for choosing Curvafit 💜</h2>
        <p>Your payment has been confirmed and your order is in progress.</p>
        <p>✅ <strong>Your order is confirmed.</strong></p>
        <p>If your order includes a digital guide, its download button will appear below when access is ready. For physical items, check your email for order updates.</p>
        <p><em>No shortcuts. No miracles. Real progress, one habit at a time.</em></p>
    `;
    document.getElementById('message').style.display = 'block';
    document.getElementById('buttons').style.display = 'block';
    initializeEbookDownloads();

    // ✅ Appel direct ici — revealExtraSections est dans le même fichier
    revealExtraSections();
}

// ── Show error state ──
function displayError(message) {
    document.getElementById('message').innerHTML = `<p class="error">${message}</p>`;
    document.getElementById('message').style.display = 'block';
    document.getElementById('buttons').style.display = 'block';
}

// ── Footer year + share buttons (moved out of inline <script> for CSP compliance) ──
document.addEventListener('DOMContentLoaded', () => {
    const yearEl = document.getElementById('ty-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // ── Copy link button ──
    document.getElementById('copy-link-btn')?.addEventListener('click', function() {
        const msg = `I just placed an order with Curvafit. Gentle guides and practical tools to help build steady habits, one step at a time. ${window.location.origin}`;

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(msg).then(() => {
                this.innerHTML = '<i class="fas fa-check"></i> Copied!';
                this.style.background = 'var(--green)';
                this.style.color = '#fff';
                this.style.borderColor = 'var(--green)';
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-link"></i> Copy Link';
                    this.style.background = '';
                    this.style.color = '';
                    this.style.borderColor = '';
                }, 2500);
            });
        } else {
            const el = document.createElement('textarea');
            el.value = msg;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            this.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                this.innerHTML = '<i class="fas fa-link"></i> Copy Link';
            }, 2500);
        }
    });

    // ── Instagram share button ──
    document.getElementById('share-instagram-btn')?.addEventListener('click', function(e) {
        e.preventDefault();

        const msg = `I just placed an order with Curvafit. Gentle guides and practical tools to help build steady habits, one step at a time. ${window.location.origin}`;

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(msg).then(() => {
                this.innerHTML = '<i class="fab fa-instagram"></i> Message Copied!';
                setTimeout(() => {
                    window.open('https://www.instagram.com', '_blank');
                    this.innerHTML = '<i class="fab fa-instagram"></i> Instagram';
                }, 800);
            });
        } else {
            const el = document.createElement('textarea');
            el.value = msg;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            this.innerHTML = '<i class="fab fa-instagram"></i> Message Copied!';
            setTimeout(() => {
                window.open('https://www.instagram.com', '_blank');
                this.innerHTML = '<i class="fab fa-instagram"></i> Instagram';
            }, 800);
        }
    });

    // ── Footer newsletter : même action/contrat que le popup newsletter
    //    principal (footer.js → action:'newsletter-subscribe') — écrit
    //    dans le même Sheet bbw4life-accounts. Seul l'email est requis
    //    côté fonction, donc ce mini-formulaire (email + bouton) suffit.
    const nlForm  = document.getElementById('ty-footer-newsletter-form');
    const nlEmail = document.getElementById('ty-footer-newsletter-email');
    const nlBtn   = document.getElementById('ty-footer-newsletter-btn');
    const nlMsg   = document.getElementById('ty-footer-newsletter-msg');

    nlForm?.addEventListener('submit', function (e) {
        e.preventDefault();
        const email = (nlEmail.value || '').trim();
        if (!email) return;

        nlBtn.disabled = true;
        nlMsg.textContent = '';
        nlMsg.className = 'ty-footer__newsletter-msg';

        fetch('/save-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'newsletter-subscribe', email })
        })
            .then(r => r.json())
            .then(data => {
                if (data && data.success !== false) {
                    nlMsg.textContent = 'Thank you for subscribing!';
                    nlMsg.classList.add('is-success');
                    nlForm.reset();
                } else {
                    nlMsg.textContent = (data && data.error) || 'Something went wrong. Please try again.';
                    nlMsg.classList.add('is-error');
                }
            })
            .catch(() => {
                nlMsg.textContent = 'Something went wrong. Please try again.';
                nlMsg.classList.add('is-error');
            })
            .finally(() => { nlBtn.disabled = false; });
    });
});
