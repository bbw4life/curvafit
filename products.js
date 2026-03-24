document.addEventListener('DOMContentLoaded', () => {

  // ====================== CJ DROPSHIPPING DATA LOADING ======================
  const productSection = document.querySelector('.product-section');
  const currentProductId = productSection ? (productSection.dataset.productId || 'resistance-bands') : 'resistance-bands';

  fetch('/products.data.json')
    .then(response => response.json())
    .then(allProducts => {
      const product = allProducts.find(p => p.id === currentProductId);
      if (!product) {
        console.error('Produit non trouvé dans /products.data.json :', currentProductId);
        return;
      }

      const mainTitle = document.querySelector('.paul-main-title');
      if (mainTitle) mainTitle.textContent = product.title;

      const compareEl = document.querySelector('.compare-price');
      const currentEl = document.querySelector('.current-price');
      if (compareEl) compareEl.textContent = '$' + Number(product.compare_price || 0).toFixed(2);
      if (currentEl) currentEl.textContent = '$' + Number(product.price || 0).toFixed(2);

      const sizeSelect = document.getElementById('size-select');
      if (sizeSelect && product.sizes && Array.isArray(product.sizes)) {
        sizeSelect.innerHTML = product.sizes.map(size => `<option value="${size}">${size}</option>`).join('');
      }

      const colorContainer = document.querySelector('.color-swatches');
      if (colorContainer && product.colors && Array.isArray(product.colors)) {
        colorContainer.innerHTML = '';
        product.colors.forEach((col, index) => {
          const sw = document.createElement('div');
          sw.className = 'swatch';
          sw.style.backgroundColor = col.hex;
          sw.dataset.color = col.name;
          sw.dataset.image = col.image;
          sw.dataset.variantId = col.variant_id;
          if (index === 0) sw.classList.add('active');
          colorContainer.appendChild(sw);
        });

        if (product.colors[0] && product.colors[0].image) {
          updateMainImageForColor(product.colors[0].image);
        }

        setupColorListeners();
      }

      calculateDiscount();
    })
    .catch(err => console.error('Erreur chargement /products.data.json', err));

  // ====================== HELPERS CJ ======================
  function setupColorListeners() {
    document.querySelectorAll('.swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const imageUrl = swatch.dataset.image;
        if (imageUrl) updateMainImageForColor(imageUrl);
      });
    });
  }

  function updateMainImageForColor(url) {
    const activeMainImg = document.querySelector('.main-image.active img');
    if (activeMainImg) activeMainImg.src = url;
  }

  function calculateDiscount() {
    const comparePriceEl = document.querySelector('.compare-price');
    const currentPriceEl = document.querySelector('.current-price');
    const discountBadgeEl = document.querySelector('.product-discount-badge');
    if (comparePriceEl && currentPriceEl && discountBadgeEl) {
      const comparePrice = parseFloat(comparePriceEl.textContent.replace('$', '')) || 0;
      const currentPrice = parseFloat(currentPriceEl.textContent.replace('$', '')) || 0;
      if (comparePrice > currentPrice) {
        const discount = Math.round(((comparePrice - currentPrice) / comparePrice) * 100);
        discountBadgeEl.textContent = `-${discount}%`;
        discountBadgeEl.classList.add('active');
      } else {
        discountBadgeEl.classList.remove('active');
      }
    }
  }

  // ====================== TON CODE ORIGINAL (100% conservé) ======================
  const thumbnails = document.querySelectorAll('.thumbnail-item');
  const mainImages = document.querySelectorAll('.main-image');
  const prevArrow = document.querySelector('.slider-arrow.prev');
  const nextArrow = document.querySelector('.slider-arrow.next');
  let currentIndex = 0;

  function updateMainImage(index) {
    mainImages.forEach((img, i) => img.classList.toggle('active', i === index));
    thumbnails.forEach((thumb, i) => thumb.classList.toggle('active', i === index));
    currentIndex = index;
    thumbnails[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  thumbnails.forEach((thumb, i) => {
    thumb.addEventListener('click', () => updateMainImage(i));
  });

  prevArrow.addEventListener('click', () => {
    let newIndex = currentIndex - 1;
    if (newIndex < 0) newIndex = mainImages.length - 1;
    updateMainImage(newIndex);
  });

  nextArrow.addEventListener('click', () => {
    let newIndex = currentIndex + 1;
    if (newIndex >= mainImages.length) newIndex = 0;
    updateMainImage(newIndex);
  });

  let startX = 0;
  const slider = document.querySelector('.main-image-slider');
  slider.addEventListener('touchstart', e => startX = e.touches[0].clientX);
  slider.addEventListener('touchend', e => {
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? nextArrow.click() : prevArrow.click();
    }
  });

  const qtyMinus = document.querySelector('.quantity .qty-minus');
  const qtyPlus = document.querySelector('.quantity .qty-plus');
  const qtyInput = document.querySelector('.quantity input');
  if (qtyMinus && qtyPlus && qtyInput) {
    qtyMinus.addEventListener('click', () => { if (qtyInput.value > 1) qtyInput.value--; });
    qtyPlus.addEventListener('click', () => { qtyInput.value++; });
  }

  const addToCartBtn = document.querySelector('.product-content .add-to-cart');
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', (e) => {
      const quantity = parseInt(qtyInput ? qtyInput.value : 1);
      addToCart(e);
    });
  }

  const paulContainer = document.getElementById('sanaica-banner-paul');
  if (paulContainer) {
    const videoUrl = '';
    const video = paulContainer.querySelector('.sanaica-banner-paul-video');
    const soundBtn = paulContainer.querySelector('.sanaica-video-sound-toggle');
    const videoWrapper = paulContainer.querySelector('.sanaica-banner-paul-video-wrapper');
    if (videoUrl) {
      video.src = videoUrl;
      videoWrapper.style.display = 'block';
      document.querySelectorAll('.sanaica-banner-paul-image').forEach(img => img.style.display = 'none');
    } else {
      videoWrapper.style.display = 'none';
      paulContainer.classList.add('image-mode');
    }
    if (video && soundBtn && videoUrl) {
      soundBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        soundBtn.classList.toggle('muted', video.muted);
      });
    }
    const slides = paulContainer.querySelectorAll('.sanaica-banner-paul-slide');
    const indicators = paulContainer.querySelectorAll('.sanaica-banner-paul-indicator');
    if (slides.length <= 1) return;
    const intervalTime = 5 * 1000;
    let currentSlide = 0;
    let slideTimer;
    function showSlide(index) {
      slides.forEach((s, i) => s.classList.toggle('active', i === index));
      indicators.forEach((ind, i) => ind.classList.toggle('active', i === index));
      currentSlide = index;
    }
    function nextSlide() { showSlide((currentSlide + 1) % slides.length); }
    showSlide(0);
    slideTimer = setInterval(nextSlide, intervalTime);
    indicators.forEach((ind, i) => {
      ind.addEventListener('click', () => {
        clearInterval(slideTimer);
        showSlide(i);
        slideTimer = setInterval(nextSlide, intervalTime);
      });
    });
    paulContainer.addEventListener('mouseenter', () => clearInterval(slideTimer));
    paulContainer.addEventListener('mouseleave', () => slideTimer = setInterval(nextSlide, intervalTime));
  }

  function redirectToReviews(app) {}

  // Stories
  const container = document.getElementById('paul-story-container-block1');
  const popup = document.getElementById('paul-story-popup-block1');
  if (popup && container) {
    const overlay = document.getElementById('paul-story-overlay-block1');
    const items = container.querySelectorAll('.paul_story_item');
    const sliderEl = popup.querySelector('.paul_story_slider');
    const videos = popup.querySelectorAll('.paul_story_fullvideo');
    const closeBtn = popup.querySelector('.paul_story_popup__close');
    let current = 0;

    const showVideo = (index) => {
      current = index;
      videos.forEach((v, i) => {
        if (i === current) {
          v.classList.add('active');
          v.play().catch(() => {});
        } else {
          v.classList.remove('active');
          v.pause();
          v.currentTime = 0;
        }
      });
    };

    const openPopup = (index) => {
      if (popup.parentElement !== document.body) document.body.appendChild(popup);
      if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
      showVideo(index);
      overlay.style.display = 'block';
      setTimeout(() => overlay.classList.add('active'), 40);
      popup.classList.add('open');
    };

    const closePopup = () => {
      popup.classList.remove('open');
      overlay.classList.remove('active');
      setTimeout(() => { overlay.style.display = 'none'; }, 300);
      videos.forEach(v => { v.classList.remove('active'); v.pause(); v.currentTime = 0; });
    };

    const next = () => { if (current < videos.length - 1) showVideo(current + 1); };
    const prev = () => { if (current > 0) showVideo(current - 1); };

    items.forEach((item, i) => {
      item.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openPopup(i); });
    });

    if (closeBtn) closeBtn.addEventListener('click', closePopup);
    if (overlay) overlay.addEventListener('click', closePopup);

    document.addEventListener('click', (e) => {
      if (popup.classList.contains('open') && !popup.querySelector('.paul_story_popup__content')?.contains(e.target)) {
        closePopup();
      }
    });

    popup.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    popup.addEventListener('touchend', e => {
      const endX = e.changedTouches[0].clientX;
      const diff = startX - endX;
      if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    });

    if (sliderEl) {
      sliderEl.addEventListener('click', (e) => {
        if (e.target.closest('video') || e.target.closest('.paul_story_popup__close')) return;
        const rect = sliderEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        x < rect.width / 2 ? prev() : next();
      });
    }

    document.addEventListener('keydown', e => {
      if (!popup.classList.contains('open')) return;
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') closePopup();
    });
  }

  // Size Chart
  const wrapper = document.getElementById('size-chart-paul-guide-wrapper-1');
  if (wrapper) {
    const toggle = wrapper.querySelector('.size-chart-paul-guide-toggle');
    const modal = document.getElementById('size-chart-paul-guide-modal-1');
    const overlay = document.getElementById('size-chart-paul-guide-overlay-1');
    const closeBtn = modal.querySelector('.modal-paul-guide-close');
    const sideText = modal.querySelector('.modal-paul-guide-side-text');

    if (modal && modal.parentElement !== document.body) document.body.appendChild(modal);
    if (overlay && overlay.parentElement !== document.body) document.body.appendChild(overlay);

    if (modal) { modal.style.position = 'fixed'; modal.style.inset = '0'; modal.style.margin = '0'; modal.style.transform = 'none'; }
    if (overlay) { overlay.style.position = 'fixed'; overlay.style.inset = '0'; }

    function truncateIfNeeded() {
      if (!sideText) return;
      const img = modal.querySelector('.modal-paul-guide-image img');
      if (!img || !img.complete) { if (img) img.addEventListener('load', truncateIfNeeded, { once: true }); return; }
      const imgHeight = img.getBoundingClientRect().height;
      const textHeight = sideText.scrollHeight;
      if (textHeight > imgHeight + 24) {
        sideText.classList.add('truncated');
        sideText.style.maxHeight = `${imgHeight}px`;
      } else {
        sideText.classList.remove('truncated');
        sideText.style.maxHeight = '';
      }
    }

    toggle.addEventListener('click', () => {
      modal.style.display = 'block';
      overlay.style.display = 'block';
      setTimeout(() => {
        modal.classList.add('active');
        overlay.classList.add('active');
        setTimeout(truncateIfNeeded, 100);
      }, 40);
      toggle.classList.add('active');
    });

    sideText?.addEventListener('click', (e) => {
      if (sideText.classList.contains('truncated')) {
        sideText.classList.remove('truncated'); sideText.classList.add('expanded'); sideText.style.maxHeight = '';
      } else if (sideText.classList.contains('expanded')) {
        sideText.classList.remove('expanded'); truncateIfNeeded();
      }
    });

    const hideModal = () => {
      modal.classList.remove('active');
      overlay.classList.remove('active');
      toggle.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
        overlay.style.display = 'none';
        if (sideText) sideText.classList.remove('expanded', 'truncated'); sideText.style.maxHeight = '';
      }, 300);
    };

    closeBtn.addEventListener('click', hideModal);
    overlay.addEventListener('click', hideModal);
    window.addEventListener('resize', truncateIfNeeded);
  }

  // Live Viewers
  function updateLiveViewers() {
    const viewers = Math.floor(Math.random() * 100) + 1;
    const liveCount = document.getElementById("live-count-example");
    if (liveCount) liveCount.innerText = viewers;
  }
  const updateFrequency = 5 * 1000;
  setInterval(updateLiveViewers, updateFrequency);
  updateLiveViewers();

  // ====================== TESTIMONIALS SLIDER (mobile auto) ======================
  (function() {
    var cards = document.querySelectorAll('.pp-testimonial-card');
    var dots  = document.querySelectorAll('.pp-testimonials-dot');
    if (!cards.length) return;

    var current = 0;
    var timer;

    function showCard(index) {
      cards.forEach(function(c) { c.classList.remove('pp-t-active'); });
      dots.forEach(function(d)  { d.classList.remove('active'); });
      cards[index].classList.add('pp-t-active');
      if (dots[index]) dots[index].classList.add('active');
      current = index;
    }

    function startAuto() {
      clearInterval(timer);
      timer = setInterval(function() {
        showCard((current + 1) % cards.length);
      }, 4000);
    }

    showCard(0);
    startAuto();

    dots.forEach(function(dot, i) {
      dot.addEventListener('click', function() {
        showCard(i);
        startAuto();
      });
    });
  })();

});


// ====================== HORS DOMContentLoaded ======================

const writeButton = document.getElementById('write-review');
const reviewForm = document.getElementById('review-form');
const reviewsList = document.querySelector('.reviews-list');
const totalReviewsSpan = document.getElementById('total-reviews');
const readMoreBtn = document.getElementById('read-more');

function showErrorPopup(message, isSuccess = false) {
    const popup = document.getElementById('custom-popup');
    const icon = document.getElementById('popup-icon');
    const title = document.getElementById('popup-title');
    const msg = document.getElementById('popup-message');
    const closeBtn = document.getElementById('popup-close');

    if (isSuccess) {
        popup.classList.add('success');
        popup.classList.remove('error');
        icon.textContent = '🎉';
        title.textContent = 'Review Submitted Successfully!';
        msg.innerHTML = 'Thank you so much! ❤️<br>Your review is now live and visible to everyone.<br>It\'s already helping other customers choose with confidence!';
    } else {
        popup.classList.add('error');
        popup.classList.remove('success');
        icon.textContent = '⚠️';
        title.textContent = 'Oops!';
        msg.textContent = message;
    }

    popup.classList.add('show');
    closeBtn.onclick = () => popup.classList.remove('show');
    setTimeout(() => {
        if (popup.classList.contains('show')) popup.classList.remove('show');
    }, 8000);
}

let counts = {1: 0, 2: 0, 3: 2, 4: 7, 5: 64};
let total = 73;

function updateSummary() {
    totalReviewsSpan.textContent = total;
    for (let i = 1; i <= 5; i++) {
        const percentage = (counts[i] / total) * 100;
        document.getElementById(`bar-${i}`).style.width = `${percentage}%`;
        document.getElementById(`count-${i}`).textContent = counts[i];
    }
}

const hiddenReviews = document.querySelectorAll('.review-card.hidden');
let showingAll = false;

readMoreBtn.addEventListener('click', () => {
    if (!showingAll) {
        hiddenReviews.forEach(review => review.classList.remove('hidden'));
        readMoreBtn.textContent = 'Close Reviews';
        showingAll = true;
    } else {
        hiddenReviews.forEach(review => review.classList.add('hidden'));
        readMoreBtn.textContent = 'Read more reviews';
        showingAll = false;
    }
});

writeButton.addEventListener('click', () => {
    reviewForm.style.display = 'block';
    writeButton.style.display = 'none';
});

const form = reviewForm.querySelector('form');

// ====================== COMPRESSION IMAGE ======================
// MAX 200px / qualité 0.5 — identique à story-form dans script.js
// 3 images × ~10 000 chars = ~30 000 chars total, bien sous la limite 50 000 de Google Sheets

async function compressImageForSheet(file) {
    return new Promise((resolve) => {
        const MAX = 200;
        const QUALITY = 0.5;
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else       { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }

            const canvas = document.createElement('canvas');
            canvas.width  = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);

            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', QUALITY));
        };

        img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
        img.src = url;
    });
}

// ====================== REVIEW AVEC IMAGES ======================

function addOptimisticReview(name, rating, title, text, imagesBase64 = []) {
    const newReview = document.createElement('div');
    newReview.className = 'review-card dynamic-review';
    const avatarLetter = name.charAt(0).toUpperCase();
    const stars = '★'.repeat(rating);
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${now.toLocaleString('en-US', { month: 'short' })}-${now.getDate().toString().padStart(2, '0')}`;

    const imagesHTML = imagesBase64.map(b64 =>
        `<img src="${b64}" alt="Review photo">`
    ).join('');
    newReview.innerHTML = `
        <div class="avatar">${avatarLetter}</div>
        <h4>${name}</h4>
        <div class="stars">${stars}</div>
        <span class="date">${dateStr}</span>
        <h5>${title}</h5>
        <p>${text}</p>
        <div class="review-images">${imagesHTML}</div>
        <div class="social-icon"></div>
    `;
    reviewsList.appendChild(newReview);
}

async function loadDynamicReviews() {
    if (!window.currentProductId) return;
    document.querySelectorAll('.review-card.dynamic-review').forEach(el => el.remove());
    try {
        const res = await fetch('/.netlify/functions/save-reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get-reviews', productId: window.currentProductId })
        });
        const data = await res.json();
        if (data.success && data.reviews) {
            data.reviews.forEach(review => {
                const newReview = document.createElement('div');
                newReview.className = 'review-card dynamic-review';
                const avatarLetter = review.fullName.charAt(0).toUpperCase();
                const stars = '★'.repeat(review.rating);
                const imagesHTML = (review.images || []).map(url =>
                  `<img src="${url}" alt="Review photo">`
              ).join('');
                newReview.innerHTML = `
                    <div class="avatar">${avatarLetter}</div>
                    <h4>${review.fullName}</h4>
                    <div class="stars">${stars}</div>
                    <span class="date">${review.date}</span>
                    <h5>${review.title}</h5>
                    <p>${review.text}</p>
                    <div class="review-images">${imagesHTML}</div>
                    <div class="social-icon"></div>
                `;
                reviewsList.appendChild(newReview);
            });
        }
    } catch (e) {
        console.error("Error loading reviews:", e);
    }
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('review-name').value.trim();
    const email = document.getElementById('review-email').value.trim();
    const rating = parseInt(document.getElementById('review-rating').value);
    const title = document.getElementById('review-title').value.trim();
    const text = document.getElementById('review-text').value.trim();
    const imageInput = document.getElementById('review-images');

    if (!name || !email || !rating || !title || !text) {
        showErrorPopup("Please fill in all fields");
        return;
    }

    // Compression agressive : MAX 200px / qualité 0.5 — identique à story-form
    const imagesBase64 = [];
    if (imageInput && imageInput.files.length > 0) {
        const files = Array.from(imageInput.files).slice(0, 3);
        for (const file of files) {
            const b64 = await compressImageForSheet(file);
            if (b64) imagesBase64.push(b64);
        }
    }

    const productId = window.currentProductId || 'unknown';
    addOptimisticReview(name, rating, title, text, imagesBase64);
    form.reset();
    const previewContainer = document.getElementById('review-images-preview');
    if (previewContainer) previewContainer.innerHTML = '';
    reviewForm.style.display = 'none';
    writeButton.style.display = 'block';

    try {
        const res = await fetch('/.netlify/functions/save-reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save-review',
                fullName: name,
                email: email,
                title: title,
                rating: rating,
                text: text,
                productId: productId,
                images: imagesBase64
            })
        });
        const data = await res.json();
        if (data.success) {
            showErrorPopup("", true);
            loadDynamicReviews();
        } else {
            showErrorPopup("Error: " + (data.error || "Unknown"));
        }
    } catch (err) {
        console.error("❌ Fetch review error:", err);
        showErrorPopup("", true);
        setTimeout(loadDynamicReviews, 1500);
    }
});

// ====================== IMAGE PREVIEW ======================
document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('review-images');
    const previewContainer = document.getElementById('review-images-preview');
    if (imageInput && previewContainer) {
        imageInput.addEventListener('change', () => {
            previewContainer.innerHTML = '';
            Array.from(imageInput.files).slice(0, 3).forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const img = document.createElement('img');
                    img.src = ev.target.result;
                    img.style.cssText = 'width:70px;height:70px;object-fit:cover;border-radius:8px;border:2px solid #e0e0e0;margin:4px;';
                    previewContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        });
    }
});

updateSummary();

// ── Scroll reveal ──
(function() {
    var newElements = document.querySelectorAll(
        '.pp-why-card, .pp-testimonial-card, .pp-ba-col, .pp-guarantee-item, .pp-benefits-block, .pp-urgency-bar, .pp-trust-strip'
    );
    if (!newElements.length) return;
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0) scale(1)';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08 });
    newElements.forEach(function(el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(22px) scale(0.98)';
        el.style.transition = 'opacity 0.55s cubic-bezier(0.4,0,0.2,1), transform 0.55s cubic-bezier(0.4,0,0.2,1)';
        observer.observe(el);
    });
    document.querySelectorAll('.pp-why-card').forEach(function(el, i) {
        el.style.transitionDelay = (i * 0.10) + 's';
    });
    document.querySelectorAll('.pp-testimonial-card').forEach(function(el, i) {
        el.style.transitionDelay = (i * 0.12) + 's';
    });
})();

// ── Urgency bar ──
(function() {
    var urgencyBar = document.querySelector('.pp-urgency-bar strong');
    if (!urgencyBar) return;
    var STORAGE_KEY = 'pp_urgency_data';
    var MIN_COUNT = 35;
    var MAX_COUNT = 74;
    var MS_24H = 24 * 60 * 60 * 1000;
    function getRandomCount() {
        return Math.floor(Math.random() * (MAX_COUNT - MIN_COUNT + 1)) + MIN_COUNT;
    }
    function loadOrGenerate() {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            try {
                var data = JSON.parse(raw);
                if (Date.now() - data.timestamp < MS_24H) return data.count;
            } catch(e) {}
        }
        var newCount = getRandomCount();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: newCount, timestamp: Date.now() }));
        return newCount;
    }
    var count = loadOrGenerate();
    urgencyBar.textContent = count + ' people';
    var raw = localStorage.getItem(STORAGE_KEY);
    var savedTimestamp = raw ? JSON.parse(raw).timestamp : Date.now();
    var msUntilNext = MS_24H - (Date.now() - savedTimestamp);
    setTimeout(function() {
        var newCount = getRandomCount();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: newCount, timestamp: Date.now() }));
        urgencyBar.textContent = newCount + ' people';
    }, msUntilNext);
})();

(function() {
    var imgs1 = [
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/images_2.jpg?v=1774309964',
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/images_17.jpg?v=1774309965',
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/images_6.jpg?v=1774309965',
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/raul_3.jpg?v=1774310072',
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/raul_2.jpg?v=1774310072',
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/raul9.jpg?v=1774310071',
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/images_1.jpg?v=1774309964',
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/raul_6.webp?v=1774310071',
    ];
    var imgs2 = [
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/raul_4.jpg?v=1774310071',
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/images_4.jpg?v=1774309965',
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/nadine_4.jpg?v=1774310365',
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/nadine_2.jpg?v=1774310364',
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/nadine_1.jpg?v=1774310364',
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/nadine_3.jpg?v=1774310364',
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/images_2.jpg?v=1774309964',
        'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/images_17.jpg?v=1774309965',
    ];

    function buildRow(id, srcs) {
        var track = document.getElementById(id);
        if (!track) return;
        var all = srcs.concat(srcs).concat(srcs).concat(srcs);
        all.forEach(function(src) {
            var card = document.createElement('div');
            card.className = 'miq-card';
            var img = document.createElement('img');
            img.src = src;
            img.alt = '';
            img.loading = 'lazy';
            card.appendChild(img);
            track.appendChild(card);
        });
    }

    buildRow('miq-row1', imgs1);
    buildRow('miq-row2', imgs2);
})();

// ── Weight Loss bars animation ──
(function initWLBars() {
    var bars = document.querySelectorAll('.wl-bar');
    if (!bars.length) return;

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });

    bars.forEach(function(bar) { observer.observe(bar); });
})();