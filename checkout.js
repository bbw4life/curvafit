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
        if (!valid) alert('Please fill all required fields.');
        return valid;
    }
    function getShippingData() {
        return {
            fullName: document.getElementById('full-name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            country: document.getElementById('country').value.trim(),
            city: document.getElementById('city').value.trim(),
            state: document.getElementById('state').value.trim(),
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



    /* ===========================
   COUNTRY / CITY AUTO SYSTEM
=========================== */

const countrySelect = document.getElementById('country');
const citySelect = document.getElementById('city');
const phoneCodeInput = document.getElementById('phone-code');
const postalInput = document.getElementById('postal-code');

/* Load Countries */
async function loadCountries() {
    try {
        const res = await fetch('https://restcountries.com/v3.1/all');
        const data = await res.json();

        const countries = data.sort((a, b) =>
            a.name.common.localeCompare(b.name.common)
        );

        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country.name.common;
            option.textContent = country.name.common;
            option.dataset.code = country.idd?.root
                ? country.idd.root + (country.idd.suffixes?.[0] || '')
                : '';
            countrySelect.appendChild(option);
        });

    } catch (err) {
        console.error("Country load error", err);
    }
}

/* When country selected */
countrySelect.addEventListener('change', async function () {
    const selectedOption = this.options[this.selectedIndex];

    // Phone code
    phoneCodeInput.value = selectedOption.dataset.code || '';

    // Reset cities
    citySelect.innerHTML = '<option value="">Loading cities...</option>';

    try {
        const res = await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country: this.value })
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

    } catch (err) {
        console.error("City load error", err);
        citySelect.innerHTML = '<option value="">No cities found</option>';
    }
});

/* When city selected */
citySelect.addEventListener('change', async function () {
    postalInput.value = "Auto-detected";
});

/* Init */
loadCountries();



});