// script.js
document.addEventListener('DOMContentLoaded', () => {
    // Add data-scroll-reveal to sections if not already
    document.querySelectorAll('section').forEach(sec => {
        if (!sec.hasAttribute('data-scroll-reveal')) {
            sec.setAttribute('data-scroll-reveal', '');
        }
    });
    // Hamburger Menu
    const hamburger = document.querySelector('.hamburger-menu');
    const nav = document.querySelector('.main-nav');
    if (hamburger && nav) {
        hamburger.addEventListener('click', () => {
            nav.classList.toggle('active');
        });
    }
    // Search Bar Toggle (full-screen like Shopify)
    const searchIcon = document.querySelector('.search-icon');
    const searchBar = document.querySelector('.search-bar');
    const searchInput = searchBar.querySelector('input');
    const submitSearch = searchBar.querySelector('.submit-search');
    const headerContainer = document.querySelector('.header-container');
    if (searchIcon && searchBar) {
        searchIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            searchBar.classList.toggle('active');
            headerContainer.classList.toggle('search-active'); // Hide other elements
            if (searchBar.classList.contains('active')) {
                searchInput.focus();
            } else {
                searchInput.blur();
            }
        });
        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!searchBar.contains(e.target) && !searchIcon.contains(e.target)) {
                searchBar.classList.remove('active');
                headerContainer.classList.remove('search-active');
            }
        });
        submitSearch.addEventListener('click', () => {
            const query = searchInput.value;
            if (query) {
                alert(`Searching for: ${query}`); // Replace with actual search logic
            }
        });
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value;
                if (query) {
                    alert(`Searching for: ${query}`); // Replace with actual search logic
                }
            }
        });
    }
    // Smooth Scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
    // Parallax Effect for all parallax elements
    window.addEventListener('scroll', () => {
        const parallaxes = document.querySelectorAll('.parallax-background');
        parallaxes.forEach(parallax => {
            let scrollPosition = window.pageYOffset;
            parallax.style.transform = `translateY(${scrollPosition * 0.5}px)`;
        });
    });
    // Scroll Reveal Animations
    const revealElements = document.querySelectorAll('[data-scroll-reveal]');
    const revealOnScroll = () => {
        revealElements.forEach(el => {
            const elTop = el.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            if (elTop < windowHeight - 100) {
                el.classList.add('revealed');
            }
        });
    };
    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll(); // Initial call
    // Counter Animations
    const counters = document.querySelectorAll('.counter');
    counters.forEach(counter => {
        const updateCount = () => {
            const target = +counter.getAttribute('data-target');
            const count = +counter.innerText;
            const increment = target / 200;
            if (count < target) {
                counter.innerText = Math.ceil(count + increment);
                setTimeout(updateCount, 10);
            } else {
                counter.innerText = target;
            }
        };
        // Trigger when in view
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                updateCount();
            }
        });
        observer.observe(counter);
    });
    // Testimonial Carousel (made infinite and proper)
    const carousel = document.querySelector('.testimonial-carousel');
    if (carousel) {
        let slides = Array.from(carousel.children);
        const gap = parseInt(getComputedStyle(carousel).gap) || 0;
        let slideWidth = slides[0].offsetWidth + gap;
        let index = 0;
        // Clone first and last for infinite scroll
        const firstClone = slides[0].cloneNode(true);
        const lastClone = slides[slides.length - 1].cloneNode(true);
        carousel.appendChild(firstClone);
        carousel.prepend(lastClone);
        slides = Array.from(carousel.children); // Update slides array
        // Initial position
        carousel.style.transform = `translateX(-${slideWidth}px)`;
        const moveCarousel = () => {
            index++;
            carousel.style.transition = 'transform 0.5s ease';
            carousel.style.transform = `translateX(-${(index + 1) * slideWidth}px)`;
        };
        // Reset on transition end for infinite
        carousel.addEventListener('transitionend', () => {
            if (index >= slides.length - 2) { // -2 because of clones
                index = 0;
                carousel.style.transition = 'none';
                carousel.style.transform = `translateX(-${slideWidth}px)`;
            }
        });
        // Recalculate on resize
        window.addEventListener('resize', () => {
            slideWidth = carousel.querySelector('.testimonial').offsetWidth + gap;
            carousel.style.transition = 'none';
            carousel.style.transform = `translateX(-${(index + 1) * slideWidth}px)`;
        });
        setInterval(moveCarousel, 3000);
    }
    // Audio Player Functionality
    const audioPlayer = document.getElementById('audio-player');
    const audio = document.getElementById('audio-element');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn && audio) {
        playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Empêche le drag quand on clique sur le bouton
            if (audio.paused) {
                audio.play();
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            } else {
                audio.pause();
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
            }
        });
    }
    // Drag Functionality
    if (audioPlayer) {
        let isDragging = false;
        let offsetX, offsetY;
        audioPlayer.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - audioPlayer.getBoundingClientRect().left;
            offsetY = e.clientY - audioPlayer.getBoundingClientRect().top;
            audioPlayer.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                audioPlayer.style.left = `${e.clientX - offsetX}px`;
                audioPlayer.style.bottom = 'auto'; // Permet le déplacement libre
                audioPlayer.style.top = `${e.clientY - offsetY}px`;
            }
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
            audioPlayer.style.cursor = 'move';
        });
    }
    // Progress Evolution Tabs
    const tabButtons = document.querySelectorAll('.tab-button');
    const evolutionContent = document.querySelector('#evolution-content');
    const progressDescription = document.querySelector('#progress-description');
    const addProgressButton = document.querySelector('#add-progress');
    const progressDateInput = document.querySelector('#progress-date');
    const progressValueInput = document.querySelector('#progress-value');
    let chartInstance = null;
    // Load stored data from localStorage (array of {date: 'YYYY-MM-DD', value: number})
    let userProgress = JSON.parse(localStorage.getItem('userProgress')) || [];
    // Function to save data
    function saveProgress() {
        localStorage.setItem('userProgress', JSON.stringify(userProgress));
    }
    // Add data button handler
    if (addProgressButton) {
        addProgressButton.addEventListener('click', () => {
            const date = progressDateInput.value;
            const value = parseFloat(progressValueInput.value);
            if (date && !isNaN(value)) {
                userProgress.push({ date, value });
                userProgress.sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date
                saveProgress();
                alert('Data added! Switch tabs to see updated chart.');
                // Refresh current tab
                const activeTab = document.querySelector('.tab-button.active').dataset.tab;
                updateChart(activeTab);
            } else {
                alert('Please enter a valid date and value.');
            }
        });
    }

    const productCards = document.querySelectorAll('.product-card');
    productCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transition = 'transform 0.3s ease';
        });
    });

    
    function aggregateData(tab) {
        if (userProgress.length === 0) {
            // Fallback mock data if no user data
            if (tab === 'daily') {
                return {
                    labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
                    data: [65, 68, 70, 72, 75, 78, 80],
                    description: 'Your daily progress shows a steady increase in performance. Add your own data for real tracking!'
                };
            } else if (tab === 'weekly') {
                return {
                    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                    data: [70, 75, 80, 85],
                    description: 'On a weekly basis, you\'ve gained an average of 5 points per week. Add your own data!'
                };
            } else if (tab === 'monthly') {
                return {
                    labels: ['Month 1', 'Month 2', 'Month 3'],
                    data: [75, 85, 95],
                    description: 'Your monthly evolution demonstrates significant transformation over time. Add your own data!'
                };
            }
        }
        // Aggregate real user data
        const aggregated = {};
        userProgress.forEach(entry => {
            const date = new Date(entry.date);
            let key;
            if (tab === 'daily') {
                key = entry.date; // YYYY-MM-DD
            } else if (tab === 'weekly') {
                const week = Math.floor(date.getDate() / 7) + 1;
                key = `Week ${week} (${date.getFullYear()}-${date.getMonth() + 1})`;
            } else if (tab === 'monthly') {
                key = `Month ${date.getMonth() + 1} (${date.getFullYear()})`;
            }
            if (!aggregated[key]) aggregated[key] = [];
            aggregated[key].push(entry.value);
        });
        const labels = Object.keys(aggregated);
        const data = labels.map(key => {
            const values = aggregated[key];
            return values.reduce((sum, val) => sum + val, 0) / values.length; // Average per period
        });
        const description = userProgress.length > 0
            ? `Your ${tab} progress based on your entered data. Keep adding to track accurately!`
            : 'No data yet—add some above to see your real progress.';
        return { labels, data, description };
    }
    function updateChart(tab) {
        const { labels, data, description } = aggregateData(tab);
        progressDescription.innerText = description;
        if (chartInstance) {
            chartInstance.destroy();
        }
        const ctx = document.getElementById('progress-chart').getContext('2d');
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Progress (e.g., Weight or Points)',
                    data: data,
                    borderColor: '#e91e63',
                    backgroundColor: 'rgba(233, 30, 99, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: false
                    }
                },
                plugins: {
                    legend: {
                        display: true
                    }
                }
            }
        });
    }
    if (tabButtons && evolutionContent) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                const tab = button.dataset.tab;
                updateChart(tab);
            });
        });
        // Load default tab (Daily)
        tabButtons[0].click();
    }
    // Accordion
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            item.classList.toggle('active');
        });
    });
    // Video Play Overlay
    const playOverlay = document.querySelector('.play-overlay');
    if (playOverlay) {
        playOverlay.addEventListener('click', () => {
            // Replace with actual video play logic, e.g., embed YouTube
            alert('Video playback started');
        });
    }
    // Form Submissions (Newsletter)
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Subscribed!');
        });
    });
    // Initialize Progress Curve Chart
    const ctx = document.getElementById('progress-curve');
    if (ctx) {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8', 'Week 9', 'Week 10', 'Week 11', 'Week 12'],
                datasets: [
                    {
                        label: 'Average Weight Loss (lbs)',
                        data: [2, 4, 6, 8, 10, 12, 13, 14, 15, 16, 17, 18],
                        borderColor: '#e91e63',
                        backgroundColor: 'rgba(233, 30, 99, 0.2)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Average Confidence Score (1-10)',
                        data: [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5],
                        borderColor: '#673ab7',
                        backgroundColor: 'rgba(103, 58, 183, 0.2)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: true
                    }
                }
            }
        });
    }

    // New E-commerce Functionality
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];

    const cartDrawer = document.querySelector('.cart-drawer');
    const wishlistModal = document.querySelector('.wishlist-modal');
    const overlay = document.querySelector('.overlay');
    const cartItemsContainer = document.querySelector('.cart-items');
    const wishlistItemsContainer = document.querySelector('.wishlist-items');
    const subtotalElement = document.querySelector('.subtotal');
    const cartBadge = document.querySelector('.cart-badge');
    const wishlistBadge = document.querySelector('.wishlist-badge');
    const cartIcon = document.querySelector('.cart-icon');
    const wishlistIcon = document.querySelector('.wishlist-icon');

    // LocalStorage Management
    function saveCart() {
        localStorage.setItem('cart', JSON.stringify(cart));
    }

    function saveWishlist() {
        localStorage.setItem('wishlist', JSON.stringify(wishlist));
    }

    // Update Badges
    function updateBadges() {
        const cartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartBadge.textContent = cartQuantity;
        cartBadge.classList.toggle('active', cartQuantity > 0);

        const wishlistCount = wishlist.length;
        wishlistBadge.textContent = wishlistCount;
        wishlistBadge.classList.toggle('active', wishlistCount > 0);
    }

    // Render Cart
    function renderCart() {
        cartItemsContainer.innerHTML = '';
        cart.forEach(item => {
            const cartItem = document.createElement('div');
            cartItem.classList.add('cart-item');
            cartItem.dataset.id = item.id;
            cartItem.innerHTML = `
                <img src="${item.image}" alt="${item.title}">
                <h4>${item.title}</h4>
                <p>$${parseFloat(item.price).toFixed(2)}</p>
                <div class="quantity">
                    <button class="qty-minus">-</button>
                    <span>${item.quantity}</span>
                    <button class="qty-plus">+</button>
                </div>
                <button class="remove-item">Remove</button>
            `;
            cartItemsContainer.appendChild(cartItem);
        });

        // Add event listeners for quantity and remove
        cartItemsContainer.querySelectorAll('.qty-plus').forEach(btn => {
            btn.addEventListener('click', handleQuantityChange);
        });
        cartItemsContainer.querySelectorAll('.qty-minus').forEach(btn => {
            btn.addEventListener('click', handleQuantityChange);
        });
        cartItemsContainer.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', removeFromCart);
        });

        updateSubtotal();
    }

    // Handle Quantity Change
    function handleQuantityChange(e) {
        const btn = e.target;
        const itemElement = btn.closest('.cart-item');
        const id = itemElement.dataset.id;
        const item = cart.find(i => i.id === id);
        if (item) {
            if (btn.classList.contains('qty-plus')) {
                item.quantity++;
            } else if (btn.classList.contains('qty-minus') && item.quantity > 1) {
                item.quantity--;
            } else if (btn.classList.contains('qty-minus') && item.quantity === 1) {
                removeFromCart(e);
                return;
            }
            itemElement.querySelector('.quantity span').textContent = item.quantity;
            saveCart();
            updateSubtotal();
            updateBadges();
        }
    }

    // Remove from Cart
    function removeFromCart(e) {
        const itemElement = e.target.closest('.cart-item');
        const id = itemElement.dataset.id;
        cart = cart.filter(i => i.id !== id);
        itemElement.remove();
        saveCart();
        updateSubtotal();
        updateBadges();
    }

    // Update Subtotal
    function updateSubtotal() {
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        subtotalElement.textContent = `Subtotal: $${subtotal.toFixed(2)}`;
    }

    // Add to Cart
    function addToCart(e) {
        e.stopPropagation(); // Prevent navigating to product page
        const productCard = e.target.closest('.product-card');
        const id = productCard.dataset.id;
        const title = productCard.dataset.title;
        const price = parseFloat(productCard.dataset.price);
        const image = productCard.dataset.image;

        let item = cart.find(i => i.id === id);
        if (item) {
            item.quantity++;
        } else {
            cart.push({ id, title, price, image, quantity: 1 });
        }
        saveCart();
        updateBadges();
        cartIcon.classList.add('added');
        setTimeout(() => cartIcon.classList.remove('added'), 500);
    }

    // Render Wishlist
    function renderWishlist() {
        wishlistItemsContainer.innerHTML = '';
        wishlist.forEach(item => {
            const wishlistItem = document.createElement('div');
            wishlistItem.classList.add('wishlist-item');
            wishlistItem.dataset.id = item.id;
            wishlistItem.innerHTML = `
                <img src="${item.image}" alt="${item.title}">
                <h4>${item.title}</h4>
                <p>$${parseFloat(item.price).toFixed(2)}</p>
                <button class="remove-wishlist">Remove</button>
            `;
            wishlistItemsContainer.appendChild(wishlistItem);
        });

        // Add remove listeners
        wishlistItemsContainer.querySelectorAll('.remove-wishlist').forEach(btn => {
            btn.addEventListener('click', removeFromWishlist);
        });
    }

    // Toggle Wishlist
    function toggleWishlist(e) {
        const icon = e.target;
        const productCard = icon.closest('.product-card');
        const id = productCard.dataset.id;
        const title = productCard.dataset.title;
        const price = parseFloat(productCard.dataset.price);
        const image = productCard.dataset.image;

        const index = wishlist.findIndex(i => i.id === id);
        if (index !== -1) {
            wishlist.splice(index, 1);
            icon.classList.remove('fas', 'active');
            icon.classList.add('far');
        } else {
            wishlist.push({ id, title, price, image });
            icon.classList.remove('far');
            icon.classList.add('fas', 'active');
        }
        saveWishlist();
        updateBadges();
    }

    // Remove from Wishlist
    function removeFromWishlist(e) {
        const itemElement = e.target.closest('.wishlist-item');
        const id = itemElement.dataset.id;
        wishlist = wishlist.filter(i => i.id !== id);
        itemElement.remove();
        saveWishlist();
        updateBadges();

        // Update icon in product card if visible
        const productIcon = document.querySelector(`.product-card[data-id="${id}"] .wishlist-toggle`);
        if (productIcon) {
            productIcon.classList.remove('fas', 'active');
            productIcon.classList.add('far');
        }
    }

    // Add All to Cart from Wishlist
    function addAllToCart() {
        wishlist.forEach(wishItem => {
            let cartItem = cart.find(i => i.id === wishItem.id);
            if (cartItem) {
                cartItem.quantity++;
            } else {
                cart.push({ ...wishItem, quantity: 1 });
            }
        });
        saveCart();
        updateBadges();
        closeWishlistModal();
    }

    // Open/Close Cart Drawer
    function openCartDrawer() {
        renderCart();
        cartDrawer.classList.add('active');
        overlay.classList.add('active');
    }

    function closeCartDrawer() {
        cartDrawer.classList.remove('active');
        overlay.classList.remove('active');
    }

    // Open/Close Wishlist Modal
    function openWishlistModal() {
        renderWishlist();
        wishlistModal.classList.add('active');
        overlay.classList.add('active');
    }

    function closeWishlistModal() {
        wishlistModal.classList.remove('active');
        overlay.classList.remove('active');
    }

    // Clear Cart
    function clearCart() {
        cart = [];
        saveCart();
        renderCart();
        updateBadges();
    }

    // Checkout
    function checkout() {
        localStorage.setItem('checkoutCart', JSON.stringify(cart));
        window.location.href = 'checkout.html';
    }

    // Initialize
    updateBadges();

    // Event Listeners
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.addEventListener('click', addToCart);
    });

    document.querySelectorAll('.wishlist-toggle').forEach(icon => {
        const id = icon.closest('.product-card').dataset.id;
        if (wishlist.some(i => i.id === id)) {
            icon.classList.remove('far');
            icon.classList.add('fas', 'active');
        }
        icon.addEventListener('click', toggleWishlist);
    });

    cartIcon.addEventListener('click', openCartDrawer);
    wishlistIcon.addEventListener('click', openWishlistModal);
    overlay.addEventListener('click', () => {
        closeCartDrawer();
        closeWishlistModal();
    });
    document.querySelector('.close-drawer').addEventListener('click', closeCartDrawer);
    document.querySelector('.close-modal').addEventListener('click', closeWishlistModal);
    document.querySelector('.clear-cart').addEventListener('click', clearCart);
    document.querySelector('.checkout').addEventListener('click', checkout);
    document.querySelector('.add-all-to-cart').addEventListener('click', addAllToCart);
});