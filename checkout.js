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

    const TAX_RATE = 0.1;
    const SHIPPING_COST = 10.00;

    const countrySearch = document.getElementById('country-search');
    const countrySelect = document.getElementById('country');
    const phoneCodeSelect = document.getElementById('phone-code');
    const stateSelect = document.getElementById('state');
    const citySelect = document.getElementById('city');
    const postalCodeInput = document.getElementById('postal-code');

    let allCountries = [];
    let allPhoneCodes = [];

    function renderCart() {
        if (!cart.length) {
            cartItemsContainer.innerHTML = "<p>Your cart is empty.</p>";
            return;
        }

        cartItemsContainer.innerHTML = '';
        let subtotal = 0;

        cart.forEach(item => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('item');

            const img = document.createElement('img');
            img.src = item.image || '';
            img.alt = item.title || 'Product';
            img.loading = "lazy";

            const info = document.createElement('div');
            info.innerHTML = `
                <h3>${item.title || ''}</h3>
                <p>Price: $${price.toFixed(2)}</p>
                <p>Quantity: ${quantity}</p>
                <p>Size: ${item.size || 'N/A'}</p>
                <p>Color: ${item.color || 'N/A'}</p>
                <p>Total: $${(price * quantity).toFixed(2)}</p>
            `;

            itemDiv.appendChild(img);
            itemDiv.appendChild(info);
            cartItemsContainer.appendChild(itemDiv);

            subtotal += price * quantity;
        });

        const taxes = subtotal * TAX_RATE;
        const total = subtotal + taxes + SHIPPING_COST;

        subtotalElement.textContent = `$${subtotal.toFixed(2)}`;
        taxesElement.textContent = `$${taxes.toFixed(2)}`;
        shippingElement.textContent = `$${SHIPPING_COST.toFixed(2)}`;
        totalElement.textContent = `$${total.toFixed(2)}`;
    }

    renderCart();

    paymentOptions.forEach(option => {
        option.addEventListener('change', () => {
            payButton.textContent =
                option.value === 'stripe'
                    ? 'Pay with Card'
                    : 'Pay with PayPal';
        });
    });

    // Populate countries and phone codes
    fetch('https://restcountries.com/v3.1/all')
        .then(res => res.json())
        .then(data => {
            allCountries = data.sort((a, b) => a.name.common.localeCompare(b.name.common));

            countrySelect.innerHTML = '<option value="">Select country</option>';
            phoneCodeSelect.innerHTML = '';

            allCountries.forEach(country => {
                const opt = document.createElement('option');
                opt.value = country.name.common;
                opt.textContent = country.name.common;
                countrySelect.appendChild(opt.cloneNode(true));

                const code = country.idd.root + (country.idd.suffixes ? country.idd.suffixes[0] : '');
                if (code) {
                    const phoneOpt = document.createElement('option');
                    phoneOpt.value = code;
                    phoneOpt.textContent = `${country.name.common} (${code})`;
                    phoneCodeSelect.appendChild(phoneOpt);
                }
            });

            // Store all country options excluding the first
            allCountryOptions = Array.from(countrySelect.options).slice(1);
        });

    let allCountryOptions = [];

    // Country search filter
    countrySearch.addEventListener('input', () => {
        const filter = countrySearch.value.toLowerCase();
        countrySelect.innerHTML = '<option value="">Select country</option>';
        allCountryOptions
            .filter(opt => opt.text.toLowerCase().includes(filter))
            .forEach(opt => countrySelect.appendChild(opt.cloneNode(true)));
    });

    // On country change
    countrySelect.addEventListener('change', () => {
        const selectedCountry = countrySelect.value;
        if (selectedCountry) {
            // Set phone code
            const matchingOpt = Array.from(phoneCodeSelect.options).find(opt => opt.text.startsWith(selectedCountry + ' ('));
            if (matchingOpt) {
                phoneCodeSelect.value = matchingOpt.value;
            }

            // Populate states
            fetch('https://countriesnow.space/api/v0.1/countries/states', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ country: selectedCountry })
            })
            .then(res => res.json())
            .then(data => {
                stateSelect.innerHTML = '<option value="">Select State / Department</option>';
                if (data.data && data.data.states) {
                    data.data.states.forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s.name;
                        opt.textContent = s.name;
                        stateSelect.appendChild(opt);
                    });
                }
                citySelect.innerHTML = '<option value="">Select City</option>';
                postalCodeInput.value = '';
            })
            .catch(error => console.error('Error fetching states:', error));
        } else {
            stateSelect.innerHTML = '<option value="">Select State / Department</option>';
            citySelect.innerHTML = '<option value="">Select City</option>';
            postalCodeInput.value = '';
        }
    });

    // On state change
    stateSelect.addEventListener('change', () => {
        const selectedState = stateSelect.value;
        const selectedCountry = countrySelect.value;
        if (selectedState && selectedCountry) {
            // Populate cities
            fetch('https://countriesnow.space/api/v0.1/countries/state/cities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ country: selectedCountry, state: selectedState })
            })
            .then(res => res.json())
            .then(data => {
                citySelect.innerHTML = '<option value="">Select City</option>';
                if (data.data) {
                    data.data.forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c;
                        opt.textContent = c;
                        citySelect.appendChild(opt);
                    });
                }
                postalCodeInput.value = '';
            })
            .catch(error => console.error('Error fetching cities:', error));
        } else {
            citySelect.innerHTML = '<option value="">Select City</option>';
            postalCodeInput.value = '';
        }
    });

    // On city change, auto-fill postal code
    citySelect.addEventListener('change', () => {
        const selectedCity = citySelect.value;
        const selectedCountry = countrySelect.value;
        if (selectedCity && selectedCountry) {
            // Fetch postal code using Nominatim
            fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(selectedCity)}, ${encodeURIComponent(selectedCountry)}&format=json&limit=1&addressdetails=1`)
                .then(res => res.json())
                .then(data => {
                    if (data && data[0] && data[0].address && data[0].address.postcode) {
                        postalCodeInput.value = data[0].address.postcode;
                    } else {
                        postalCodeInput.value = ''; // Or alert no postcode found
                    }
                })
                .catch(error => console.error('Error fetching postcode:', error));
        }
    });

    function validateForm() {
        const inputs = shippingForm.querySelectorAll('input, textarea, select');
        let valid = true;
        inputs.forEach(input => {
            if (input.tagName === 'SELECT') {
                if (!input.value || input.value === '') {
                    valid = false;
                    input.style.borderColor = 'red';
                } else {
                    input.style.borderColor = '#ccc';
                }
            } else if (!input.value.trim()) {
                valid = false;
                input.style.borderColor = 'red';
            } else {
                input.style.borderColor = '#ccc';
            }
        });
        if (!valid) alert('Please fill all required fields.');
        return valid;
    }

    function getShippingData() {
        return {
            fullName: document.getElementById('full-name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone-code').value + document.getElementById('phone-number').value.trim(),
            country: document.getElementById('country').value,
            city: document.getElementById('city').value,
            state: document.getElementById('state').value,
            postalCode: document.getElementById('postal-code').value.trim(),
            address: document.getElementById('address').value.trim()
        };
    }

    payButton.addEventListener('click', async () => {
        if (!validateForm()) return;
        if (!cart.length) return alert('Your cart is empty.');

        payButton.disabled = true;
        payButton.textContent = "Processing...";

        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
        const shippingData = getShippingData();

        try {
            let response;
            let data;

            if (paymentMethod === 'stripe') {
                response = await fetch('/.netlify/functions/create-stripe-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cart, shipping: shippingData })
                });
                data = await response.json();
                if (!response.ok || !data.sessionId) throw new Error(data.error || 'Stripe session failed');

                const stripe = Stripe(window.STRIPE_PUBLIC_KEY);
                localStorage.setItem("pendingOrder", "stripe");
                await stripe.redirectToCheckout({ sessionId: data.sessionId });
            } else {
                response = await fetch('/.netlify/functions/paypal-create-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cart, shipping: shippingData })
                });
                data = await response.json();
                if (!response.ok || !data.orderId) throw new Error(data.error || 'PayPal order failed');

                localStorage.setItem("pendingOrder", "paypal");
                window.location.href = `https://www.sandbox.paypal.com/checkoutnow?token=${data.orderId}`;
            }
        } catch (error) {
            alert("Payment error: " + error.message);
            payButton.disabled = false;
            payButton.textContent = "Pay Now";
        }
    });

    const refundLink = document.getElementById('refund-policy-link');
    const shippingLink = document.getElementById('shipping-policy-link');
    const refundModal = document.getElementById('refund-modal');
    const shippingModal = document.getElementById('shipping-modal');
    const closes = document.querySelectorAll('.close');

    refundLink.addEventListener('click', (e) => { e.preventDefault(); refundModal.style.display = 'flex'; });
    shippingLink.addEventListener('click', (e) => { e.preventDefault(); shippingModal.style.display = 'flex'; });

    closes.forEach(close => close.addEventListener('click', () => {
        refundModal.style.display = 'none';
        shippingModal.style.display = 'none';
    }));

    window.addEventListener('click', (e) => {
        if (e.target === refundModal) refundModal.style.display = 'none';
        if (e.target === shippingModal) shippingModal.style.display = 'none';
    });
});