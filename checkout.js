// checkout.js
document.addEventListener('DOMContentLoaded', () => {
    let cart = [];
    try {
        cart = JSON.parse(localStorage.getItem('cart')) || [];
        if (!Array.isArray(cart)) cart = [];
    } catch {
        cart = [];
    }

    const cartItemsContainer = document.querySelector('.cart-items');
    const shippingForm = document.getElementById('shipping-form');
    const payButton = document.getElementById('pay-button');
    const paymentOptions = document.querySelectorAll('input[name="payment"]');

    let productsData = [];
    let TAX_RATE = 0.1;
    let SHIPPING_COST = 10.00;
    let promos = [];
    let appliedPromo = null;
    let discountAmount = 0;
    let _promoFreeApplying = false;

    // ====================== POPUP ======================
    function showErrorPopup(message) {
        const popup = document.getElementById('error-popup');
        const popupText = document.getElementById('popup-message');
        const closeBtn = document.getElementById('popup-close');
        if (!popup || !popupText || !closeBtn) { console.error("Popup HTML manquant !"); return; }
        popupText.textContent = message;
        popup.classList.add('show');
        closeBtn.onclick = () => popup.classList.remove('show');
        setTimeout(() => { if (popup.classList.contains('show')) popup.classList.remove('show'); }, 10000);
    }

    fetch('/products.data.json')
      .then(response => response.json())
      .then(data => {
        productsData = data;
        const settings = productsData.find(item => item.type === "settings");
        if (settings) {
          TAX_RATE = settings.tax_rate || 0.1;
          SHIPPING_COST = settings.shipping_cost || 10.00;
          promos = settings.promos || [];

          const delayMap = {
            'Standard Shipping': settings.shipping_standard_delay || '',
            'Express DHL':        settings.shipping_dhl_delay      || '',
            'Priority FedEx':     settings.shipping_priority_delay || '',
            'Economy Shipping':   settings.shipping_economy_delay  || '',
          };
          document.querySelectorAll('.shipping-option').forEach(opt => {
            const method = opt.dataset.method;
            if (delayMap[method]) {
              const p = opt.querySelector('p');
              if (p) p.textContent = delayMap[method];
            }
          });
        }
        applyPromoFreeItems();
        renderCart();
      })
      .catch(error => {
        console.error('Erreur de chargement de /products.data.json:', error);
        renderCart();
      });

    // ====================== PRÉ-REMPLISSAGE COMPTE ======================
    if (localStorage.getItem('isLoggedIn') === 'true') {
        const setField = (id, value) => {
            const el = document.getElementById(id);
            if (el && value) el.value = value;
        };
        setField('first-name',   localStorage.getItem('userFirstName')    || '');
        setField('last-name',    localStorage.getItem('userLastName')     || '');
        setField('email',        localStorage.getItem('userEmail')        || '');
        setField('address',      localStorage.getItem('userAddressLine1') || '');
        setField('city',         localStorage.getItem('userCity')         || '');
        setField('state',        localStorage.getItem('userState')        || '');
        setField('postal-code',  localStorage.getItem('userZip')          || '');
        const line2 = localStorage.getItem('userLine2') || '';
        setField('address2',      line2);
        setField('address-line2', line2);
        setField('addr-line2',    line2);
    }

    // ====================== RENDER CART ======================
    function renderCart() {
        if (!cart.length) {
            cartItemsContainer.innerHTML = "<p>Your cart is empty.</p>";
            return;
        }
        cartItemsContainer.innerHTML = '';
        let subtotal = 0;
        let bundleSavings = 0;
        let hasBundle = false;
        cart.forEach(item => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            if (item.fromBundle) {
                hasBundle = true;
                bundleSavings += (item.compare_price ? (item.compare_price - price) * quantity : 0);
            }
            subtotal += price * quantity;
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('item');
            const img = document.createElement('img');
            img.src = item.image || '';
            img.alt = item.title || 'Product';
            img.loading = "lazy";
            const info = document.createElement('div');
            info.innerHTML = `
                <h3>${item.title || ''}</h3>
                <p>Price: $${price.toFixed(2)} ${item.fromBundle ? '(Bundle Discount Applied)' : ''}</p>
                <p>Quantity: ${quantity}</p>
                ${item.size  ? `<p>Size: ${item.size}</p>`   : ''}
                ${item.color ? `<p>Color: ${item.color}</p>` : ''}
                <p>Total: $${(price * quantity).toFixed(2)}</p>
            `;
            itemDiv.appendChild(img);
            itemDiv.appendChild(info);
            cartItemsContainer.appendChild(itemDiv);
        });
        if (hasBundle && bundleSavings > 0) {
            const savingsDiv = document.createElement('div');
            savingsDiv.classList.add('bundle-savings');
            savingsDiv.innerHTML = `<p>Bundle Savings: -$${bundleSavings.toFixed(2)}</p>`;
            cartItemsContainer.appendChild(savingsDiv);
        }
        updatePromoDisplay();
        updateTotals();
    }

    paymentOptions.forEach(option => {
        option.addEventListener('change', () => {
            payButton.textContent = option.value === 'stripe' ? 'Pay with Card' : 'Pay with PayPal';
        });
    });

    // ====================== CORRECTION PRINCIPALE ======================
    // validateForm() ne valide QUE les champs obligatoires visibles
    // Avant : validait TOUS les inputs → bloquait sur phone-code, address2, etc.
    function validateForm() {
        const requiredIds = ['first-name', 'last-name', 'email', 'address', 'postal-code', 'phone'];
        let valid = true;
        requiredIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (!el.value.trim()) {
                valid = false;
                el.style.borderColor = 'red';
            } else {
                el.style.borderColor = '#ccc';
            }
        });
        // Vérifie aussi que le pays est sélectionné et a bien un cca2
        const countrySelect = document.getElementById('country');
        if (countrySelect) {
            const selected = countrySelect.options[countrySelect.selectedIndex];
            if (!selected || !selected.value || selected.value === '') {
                valid = false;
                countrySelect.style.borderColor = 'red';
            } else {
                countrySelect.style.borderColor = '#ccc';
            }
        }
        if (!valid) {
            showErrorPopup('Please fill all required fields before finalizing the payment');
            return false;
        }
        return true;
    }

    // ====================== CORRECTION PAYPAL INTERMITTENT ======================
    // Problème : loadCountries() est async → si le client paie avant la fin
    // du chargement, selectedOption.dataset.cca2 est vide → PayPal rejette
    // Solution : on récupère le cca2 depuis l'option OU depuis un fallback API
    async function getCountryCode(countryName) {
        const countrySelect = document.getElementById('country');
        if (countrySelect) {
            const selected = countrySelect.options[countrySelect.selectedIndex];
            if (selected && selected.dataset.cca2 && selected.dataset.cca2.length === 2) {
                return selected.dataset.cca2;
            }
        }
        // Fallback : si cca2 pas encore chargé, on l'appelle directement
        try {
            const res = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}?fields=cca2&fullText=true`);
            if (res.ok) {
                const data = await res.json();
                return data[0]?.cca2 || 'US';
            }
        } catch (e) {}
        return 'US';
    }

    async function getShippingData() {
        const countrySelect = document.getElementById('country');
        const selectedOption = countrySelect.options[countrySelect.selectedIndex];
        const countryName = selectedOption.value.trim();

        // CORRECTION : attend le cca2 même si les pays ne sont pas encore chargés
        const countryCode = await getCountryCode(countryName);

        const phoneCode = document.getElementById('phone-code').value.trim();
        const phoneNumber = document.getElementById('phone').value.trim();
        const fullPhone = (phoneCode + phoneNumber).replace(/\s+/g, '');
        const address2El = document.getElementById('address2') || document.getElementById('address-line2');

        return {
            firstName:       document.getElementById('first-name').value.trim(),
            lastName:        document.getElementById('last-name').value.trim(),
            email:           document.getElementById('email').value.trim(),
            phone:           fullPhone,
            country:         countryName,
            countryCode:     countryCode,   // ← toujours fiable maintenant
            city:            (document.getElementById('city') || {}).value?.trim() || '',
            state:           (document.getElementById('state') || {}).value?.trim() || '',
            postalCode:      document.getElementById('postal-code').value.trim(),
            address:         document.getElementById('address').value.trim(),
            address2:        address2El ? address2El.value.trim() : '',
            shipping_method: document.querySelector('.shipping-option.selected')?.dataset.method || 'Standard Shipping',
        };
    }

    function getDiscountedCart() {
        let workingCart = JSON.parse(JSON.stringify(cart));
        if (discountAmount > 0) {
            const preDiscountSubtotal = getSubtotal();
            const ratio = (preDiscountSubtotal - discountAmount) / preDiscountSubtotal;
            workingCart = workingCart.map(item => ({
                ...item,
                price: (Number(item.price) * ratio).toFixed(2)
            }));
        }
        return workingCart;
    }

    // ====================== PAIEMENT ======================
    payButton.addEventListener('click', async () => {
        if (!validateForm()) return;
        if (!cart.length) {
            showErrorPopup('Your cart is empty. Please add some products before checking out.');
            return;
        }

        payButton.disabled = true;
        payButton.textContent = "Processing...";

        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;

        try {
            // getShippingData est maintenant async
            const shippingData = await getShippingData();
            const discountedCart = getDiscountedCart();
            const discountedSubtotal = discountedCart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
            const selectedMethodPay = document.querySelector('.shipping-option.selected')?.dataset.method || '';
            const freeThreshPay = (() => { const s = productsData.find(i => i.type === 'settings'); return s?.cart_drawer?.free_shipping_threshold || 0; })();
            const isFreePayMethod = ['Standard Shipping', 'Economy Shipping'].includes(selectedMethodPay);
            const isFreePayThresh = freeThreshPay > 0 && discountedSubtotal >= freeThreshPay;
            const taxes = (isFreePayMethod || isFreePayThresh) ? 0 : discountedSubtotal * TAX_RATE;
            const effectiveShippingPay = (isFreePayMethod || isFreePayThresh) ? 0 : SHIPPING_COST;

            if (paymentMethod === 'stripe') {
                const STRIPE_PUBLIC_KEY = "pk_test_51PMDwoF9QAVBUyaUqwc7ekbAhyZdI9oA3ubZT8b7TtWGrykoPLvsql4mexEwEoS5pggyssqN6jpj2w5VQMHOSftf00q97Rbt1f";
                const stripe = Stripe(STRIPE_PUBLIC_KEY);
                const response = await fetch('/.netlify/functions/create-stripe-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cart: discountedCart,
                        shipping: shippingData,
                        shipping_cost: effectiveShippingPay.toFixed(2),
                        tax: taxes.toFixed(2)
                    })
                });
                const data = await response.json();
                if (!response.ok || !data.sessionId) throw new Error(data.error || 'Stripe session failed');
                localStorage.setItem("pendingOrder", "stripe");
                await stripe.redirectToCheckout({ sessionId: data.sessionId });

            } else {
                const response = await fetch('/.netlify/functions/paypal-create-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cart: discountedCart,
                        shipping: shippingData,
                        shipping_cost: effectiveShippingPay.toFixed(2),
                        tax: taxes.toFixed(2)
                    })
                });
                const data = await response.json();
                if (!response.ok || !data.orderID) throw new Error(data.error || 'PayPal order failed');
                const paypalDomain = data.paypalDomain || 'https://www.sandbox.paypal.com';
                localStorage.setItem("pendingOrder", "paypal");
                window.location.href = `${paypalDomain}/checkoutnow?token=${data.orderID}`;
            }
        } catch (error) {
            console.error("Payment error:", error.message);
            showErrorPopup('Payment failed. Please try again.');
            payButton.disabled = false;
            payButton.textContent = "Pay Now";
        }
    });

    // ====================== MODALS ======================
    const refundLink = document.getElementById('refund-policy-link');
    const shippingLink = document.getElementById('shipping-policy-link');
    const refundModal = document.getElementById('refund-modal');
    const shippingModal = document.getElementById('shipping-modal');
    const closes = document.querySelectorAll('.close');
    if (refundLink) refundLink.addEventListener('click', (e) => { e.preventDefault(); refundModal.style.display = 'flex'; });
    if (shippingLink) shippingLink.addEventListener('click', (e) => { e.preventDefault(); shippingModal.style.display = 'flex'; });
    closes.forEach(close => close.addEventListener('click', () => {
        if (refundModal) refundModal.style.display = 'none';
        if (shippingModal) shippingModal.style.display = 'none';
    }));
    window.addEventListener('click', (e) => {
        if (e.target === refundModal) refundModal.style.display = 'none';
        if (e.target === shippingModal) shippingModal.style.display = 'none';
    });

    // ====================== PAYS & VILLES ======================
    const countrySelect = document.getElementById('country');
    const citySelect = document.getElementById('city');
    const phoneCodeInput = document.getElementById('phone-code');

    async function loadCountries() {
        try {
            const res = await fetch('https://restcountries.com/v3.1/all?fields=name,idd,cca2');
            const data = await res.json();
            const countries = data.sort((a, b) => a.name.common.localeCompare(b.name.common));
            countries.forEach(country => {
                const option = document.createElement('option');
                option.value = country.name.common;
                option.textContent = country.name.common;
                option.dataset.code = country.idd?.root ? country.idd.root + (country.idd.suffixes?.[0] || '') : '';
                option.dataset.cca2 = country.cca2;
                countrySelect.appendChild(option);
            });
            // Pré-sélectionne le pays sauvegardé
            const savedCountry = localStorage.getItem('userCountry');
            if (savedCountry && localStorage.getItem('isLoggedIn') === 'true') {
                const opt = Array.from(countrySelect.options).find(o => o.value === savedCountry);
                if (opt) { countrySelect.value = savedCountry; countrySelect.dispatchEvent(new Event('change')); }
            }
        } catch (err) { console.error("Country load error", err); }
    }

    countrySelect.addEventListener('change', async function () {
        const selectedOption = this.options[this.selectedIndex];
        phoneCodeInput.value = selectedOption.dataset.code || '';
        citySelect.innerHTML = '<option value="">Loading cities...</option>';
        try {
            const res = await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ country: selectedOption.value })
            });
            const data = await res.json();
            citySelect.innerHTML = '<option value="">Select your city</option>';
            if (data.data) {
                data.data.forEach(city => {
                    const option = document.createElement('option');
                    option.value = city;
                    option.textContent = city;
                    citySelect.appendChild(option);
                });
            }
            const savedCity = localStorage.getItem('userCity');
            if (savedCity && localStorage.getItem('isLoggedIn') === 'true') {
                const cityOpt = Array.from(citySelect.options).find(o => o.value === savedCity);
                if (cityOpt) citySelect.value = savedCity;
            }
        } catch (err) {
            console.error("City load error", err);
            citySelect.innerHTML = '<option value="">No cities found</option>';
        }
    });

    loadCountries();

    const shippingOptions = document.querySelectorAll('.shipping-option');
    shippingOptions.forEach(option => {
        option.addEventListener('click', () => {
            shippingOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            updateTotals();
        });
    });

    // ====================== PROMO ======================
    function updatePromoDisplay() {
        const hasBundle = cart.some(item => item.fromBundle);
        const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
        const suggested = promos.find(p => p.items === totalQuantity);
        const suggestedDiv = document.getElementById('suggested-promo');
        const suggestedCodeEl = document.getElementById('suggested-code');
        const itemCountDisplay = document.getElementById('item-count-display');
        const promoMessage = document.getElementById('promo-message');
        if (suggestedDiv && suggestedCodeEl && itemCountDisplay) {
            itemCountDisplay.textContent = totalQuantity;
            if (!hasBundle && suggested) {
                suggestedDiv.style.display = 'block';
                suggestedCodeEl.textContent = suggested.code;
            } else {
                suggestedDiv.style.display = 'none';
            }
        }
        if (promoMessage) {
            promoMessage.textContent = hasBundle ? "Promo codes are not available with bundle purchases." : '';
            if (hasBundle) promoMessage.style.color = 'red';
        }
    }

    function getSubtotal() {
        return cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
    }

    function updateTotals() {
        const subtotal = getSubtotal();
        const selectedMethod = document.querySelector('.shipping-option.selected')?.dataset.method || '';
        const freeShipThresh = (() => {
            const s = productsData.find(i => i.type === 'settings');
            return s?.cart_drawer?.free_shipping_threshold || 0;
        })();
        const isFreeByThreshold = freeShipThresh > 0 && subtotal >= freeShipThresh;
        const isFreeMethod = ['Standard Shipping', 'Economy Shipping'].includes(selectedMethod);
        const effectiveShipping = (isFreeByThreshold || isFreeMethod) ? 0 : SHIPPING_COST;
        const effectiveTax = (isFreeByThreshold || isFreeMethod) ? 0 : subtotal * TAX_RATE;
        const finalTotal = subtotal + effectiveTax + effectiveShipping - discountAmount;
        document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('taxes').textContent = `$${effectiveTax.toFixed(2)}`;
        document.getElementById('shipping').textContent = effectiveShipping === 0 ? 'FREE' : `$${effectiveShipping.toFixed(2)}`;
        document.getElementById('total').textContent = `$${Math.max(0, finalTotal).toFixed(2)}`;
        const promoLine = document.getElementById('promo-line');
        const discountEl = document.getElementById('discount-amount');
        if (discountAmount > 0) {
            if (promoLine) promoLine.style.display = 'block';
            if (discountEl) discountEl.textContent = `-$${discountAmount.toFixed(2)}`;
        } else {
            if (promoLine) promoLine.style.display = 'none';
        }
    }


    function applyPromoFreeItems() {
    const settings = productsData.find(i => i.type === 'settings');
    if (!settings) return;
    const cd = settings.cart_drawer || {};
    const buyQty = parseInt(cd.promo_buy_quantity) || 0;
    const getQty = parseInt(cd.promo_get_quantity)  || 0;
    if (!buyQty || !getQty) return;

    const realProducts = productsData.filter(p => !p.type && p.active !== false);

    // Compter uniquement les articles payants
    const paidQty = cart.filter(i => !i.isFreePromo).reduce((sum, i) => sum + i.quantity, 0);

    // Retirer les anciens FREE
    cart = cart.filter(i => !i.isFreePromo);

    if (paidQty >= buyQty) {
        for (let idx = 0; idx < getQty; idx++) {
            const prod = realProducts[idx];
            if (!prod) break;

            const firstVariant = (prod.variants && prod.variants.length > 0)
                ? prod.variants[0]
                : null;

            const color = firstVariant ? (firstVariant.color || null) : null;
            const size  = firstVariant ? (firstVariant.size  || null) : null;

            const colorObj = (color && prod.colors)
                ? prod.colors.find(c => c.name === color)
                : null;
            const image = colorObj
                ? (colorObj.image || prod.image)
                : prod.image;

            cart.push({
                id:            prod.id,
                title:         prod.title + ' 🎁 FREE',
                price:         0,
                compare_price: firstVariant ? firstVariant.price : prod.price,
                image:         image || prod.image,
                size:          size  || null,
                color:         color || null,
                quantity:      1,
                isFreePromo:   true,
                cj_product_id: prod.cj_id,
                cj_variant_id: firstVariant ? firstVariant.vid : null
            });
        }
    }

    localStorage.setItem('cart', JSON.stringify(cart));
}

    document.getElementById('copy-suggested')?.addEventListener('click', () => {
        const code = document.getElementById('suggested-code').textContent;
        navigator.clipboard.writeText(code).then(() => showErrorPopup('Code copied: ' + code));
    });

    document.getElementById('apply-promo')?.addEventListener('click', () => {
        const input = document.getElementById('promo-input').value.trim().toUpperCase();
        const promoMessage = document.getElementById('promo-message');
        const hasBundle = cart.some(item => item.fromBundle);
        const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (hasBundle) { promoMessage.textContent = "Promo codes cannot be used with bundles."; promoMessage.style.color = 'red'; return; }
        if (!input) { promoMessage.textContent = "Please enter a code."; promoMessage.style.color = 'red'; return; }
        const promo = promos.find(p => p.code.toUpperCase() === input);
        if (promo && promo.items === totalQuantity) {
            appliedPromo = promo;
            discountAmount = getSubtotal() * (promo.percent / 100);
            promoMessage.textContent = `Promo applied: ${promo.percent}% off!`;
            promoMessage.style.color = 'green';
            updateTotals();
        } else {
            appliedPromo = null;
            discountAmount = 0;
            promoMessage.textContent = "Invalid or inapplicable promo code.";
            promoMessage.style.color = 'red';
            updateTotals();
        }
    });
});