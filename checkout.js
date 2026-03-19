document.addEventListener('DOMContentLoaded', () => {
    let cart = [];
    try {
        cart = JSON.parse(localStorage.getItem('cart')) || [];
        if (!Array.isArray(cart)) cart = [];
    } catch {
        cart = [];
    }

    const cartItemsContainer = document.querySelector('.cart-items');
    const subtotalElement = document.getElementById('subtotal');
    const taxesElement = document.getElementById('taxes');
    const shippingElement = document.getElementById('shipping');
    const totalElement = document.getElementById('total');
    const shippingForm = document.getElementById('shipping-form');
    const payButton = document.getElementById('pay-button');
    const paymentOptions = document.querySelectorAll('input[name="payment"]');

    let productsData = [];
    let TAX_RATE = 0.1;
    let SHIPPING_COST = 10.00;
    let promos = [];
    let appliedPromo = null;
    let discountAmount = 0;

    // ====================== FONCTION POPUP ======================
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
    // ====================== FIN POPUP ======================

    fetch('/products.data.json')
      .then(response => response.json())
      .then(data => {
        productsData = data;
        const settings = productsData.find(item => item.type === "settings");
        if (settings) {
          TAX_RATE = settings.tax_rate || 0.1;
          SHIPPING_COST = settings.shipping_cost || 10.00;
          promos = settings.promos || [];
        }
        renderCart();
      })
      .catch(error => {
        console.error('Erreur de chargement de /products.data.json:', error);
        renderCart();
      });

    // ====================== CORRECTION 2 ======================
    // Pré-remplissage des champs depuis localStorage (données compte)
    // On teste plusieurs IDs possibles pour chaque champ car
    // le HTML peut avoir 'address2' OU 'address-line2' selon la version
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

        // address2 peut avoir plusieurs IDs selon la version du HTML
        const line2 = localStorage.getItem('userLine2') || '';
        setField('address2',      line2);
        setField('address-line2', line2);
        setField('addr-line2',    line2);

        // Pays
        const countrySelect = document.getElementById('country');
        const savedCountry = localStorage.getItem('userCountry');
        if (countrySelect && savedCountry) {
            // On attend que les pays soient chargés (loadCountries est async)
            // On utilise un MutationObserver ou un petit polling
            const trySetCountry = () => {
                const opt = Array.from(countrySelect.options).find(o => o.value === savedCountry);
                if (opt) {
                    countrySelect.value = savedCountry;
                    countrySelect.dispatchEvent(new Event('change'));
                }
            };
            // Essaie tout de suite, puis après chargement des options
            trySetCountry();
            setTimeout(trySetCountry, 1500);
        }
    }
    // ====================== FIN CORRECTION 2 ======================

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
            const itemTotal = price * quantity;
            if (item.fromBundle) {
                hasBundle = true;
                bundleSavings += (item.compare_price ? (item.compare_price - price) * quantity : 0);
            }
            subtotal += itemTotal;
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('item');
            const img = document.createElement('img');
            img.src = item.image || '';
            img.alt = item.title || 'Product';
            img.loading = "lazy";
            let sizeHtml  = item.size  ? `<p>Size: ${item.size}</p>`  : '';
            let colorHtml = item.color ? `<p>Color: ${item.color}</p>` : '';
            const info = document.createElement('div');
            info.innerHTML = `
                <h3>${item.title || ''}</h3>
                <p>Price: $${price.toFixed(2)} ${item.fromBundle ? '(Bundle Discount Applied)' : ''}</p>
                <p>Quantity: ${quantity}</p>
                ${sizeHtml}
                ${colorHtml}
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

    function validateForm() {
        const inputs = shippingForm.querySelectorAll('input, textarea');
        let valid = true;
        inputs.forEach(input => {
            if (!input.value.trim()) {
                valid = false;
                input.style.borderColor = 'red';
            } else {
                input.style.borderColor = '#ccc';
            }
        });
        if (!valid) {
            showErrorPopup('Please fill all the forms before finalizing the payment');
            return false;
        }
        return true;
    }

    function getShippingData() {
        const countrySelect = document.getElementById('country');
        const selectedOption = countrySelect.options[countrySelect.selectedIndex];
        const phoneCode = document.getElementById('phone-code').value.trim();
        const phoneNumber = document.getElementById('phone').value.trim();
        const fullPhone = (phoneCode + phoneNumber).replace(/\s+/g, '');

        // Cherche address2 sous les deux IDs possibles
        const address2El = document.getElementById('address2') || document.getElementById('address-line2');

        return {
            firstName:       document.getElementById('first-name').value.trim(),
            lastName:        document.getElementById('last-name').value.trim(),
            email:           document.getElementById('email').value.trim(),
            phone:           fullPhone,
            country:         selectedOption.value.trim(),
            countryCode:     selectedOption.dataset.cca2 || '',
            city:            document.getElementById('city').value.trim(),
            state:           document.getElementById('state').value.trim(),
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

    payButton.addEventListener('click', async () => {
        if (!validateForm()) return;
        if (!cart.length) {
            showErrorPopup('Your cart is empty. Please add some products before checking out.');
            return;
        }

        payButton.disabled = true;
        payButton.textContent = "Processing...";

        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
        const shippingData = getShippingData();

        try {
            const discountedCart = getDiscountedCart();
            const discountedSubtotal = discountedCart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
            const taxes = discountedSubtotal * TAX_RATE;

            if (paymentMethod === 'stripe') {
                const STRIPE_PUBLIC_KEY = "pk_test_51PMDwoF9QAVBUyaUqwc7ekbAhyZdI9oA3ubZT8b7TtWGrykoPLvsql4mexEwEoS5pggyssqN6jpj2w5VQMHOSftf00q97Rbt1f";
                const stripe = Stripe(STRIPE_PUBLIC_KEY);
                const response = await fetch('/.netlify/functions/create-stripe-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cart: discountedCart,
                        shipping: shippingData,
                        shipping_cost: SHIPPING_COST.toFixed(2),
                        tax: taxes.toFixed(2)
                    })
                });
                const data = await response.json();
                if (!response.ok || !data.sessionId) throw new Error(data.error || 'Stripe session failed');
                localStorage.setItem("pendingOrder", "stripe");
                await stripe.redirectToCheckout({ sessionId: data.sessionId });
            } else {
                const bodyData = {
                    cart: discountedCart,
                    shipping: shippingData,
                    shipping_cost: SHIPPING_COST.toFixed(2),
                    tax: taxes.toFixed(2)
                };
                const response = await fetch('/.netlify/functions/paypal-create-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyData)
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
            // Re-tente de sélectionner le pays sauvegardé après chargement
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
            // Pré-sélectionne la ville sauvegardée
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
        });
    });

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
            if (hasBundle) {
                promoMessage.textContent = "Promo codes are not available with bundle purchases.";
                promoMessage.style.color = 'red';
            } else {
                promoMessage.textContent = '';
            }
        }
    }

    function getSubtotal() {
        let subtotal = 0;
        cart.forEach(item => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            subtotal += price * quantity;
        });
        return subtotal;
    }

    function updateTotals() {
        const subtotal = getSubtotal();
        let hasBundle = cart.some(item => item.fromBundle);
        const taxes = subtotal * TAX_RATE;
        const finalTotal = subtotal + taxes + SHIPPING_COST - discountAmount;
        document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('taxes').textContent = `$${taxes.toFixed(2)}`;
        document.getElementById('shipping').textContent = `$${SHIPPING_COST.toFixed(2)}`;
        document.getElementById('total').textContent = `$${finalTotal.toFixed(2)}`;
        const promoLine = document.getElementById('promo-line');
        const discountEl = document.getElementById('discount-amount');
        if (discountAmount > 0) {
            if (promoLine) promoLine.style.display = 'block';
            if (discountEl) discountEl.textContent = `-$${discountAmount.toFixed(2)}`;
        } else {
            if (promoLine) promoLine.style.display = 'none';
        }
    }

    document.getElementById('copy-suggested')?.addEventListener('click', () => {
        const code = document.getElementById('suggested-code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            showErrorPopup('Code copied successfully: ' + code);
        });
    });

    document.getElementById('apply-promo')?.addEventListener('click', () => {
        const input = document.getElementById('promo-input').value.trim().toUpperCase();
        const promoMessage = document.getElementById('promo-message');
        const hasBundle = cart.some(item => item.fromBundle);
        const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (hasBundle) {
            promoMessage.textContent = "Promo codes cannot be used with bundles.";
            promoMessage.style.color = 'red';
            return;
        }
        if (!input) {
            promoMessage.textContent = "Please enter a code.";
            promoMessage.style.color = 'red';
            return;
        }
        const promo = promos.find(p => p.code.toUpperCase() === input);
        if (promo && promo.items === totalQuantity) {
            appliedPromo = promo;
            const subtotal = getSubtotal();
            discountAmount = subtotal * (promo.percent / 100);
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