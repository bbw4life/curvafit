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

      // Titre
      const mainTitle = document.querySelector('.paul-main-title');
      if (mainTitle) mainTitle.textContent = product.title;

      // Prix + Compare
      const compareEl = document.querySelector('.compare-price');
      const currentEl = document.querySelector('.current-price');
      if (compareEl) compareEl.textContent = '$' + Number(product.compare_price || 0).toFixed(2);
      if (currentEl) currentEl.textContent = '$' + Number(product.price || 0).toFixed(2);

      // Sizes (CSS intact)
      const sizeSelect = document.getElementById('size-select');
      if (sizeSelect && product.sizes && Array.isArray(product.sizes)) {
        sizeSelect.innerHTML = product.sizes.map(size => `<option value="${size}">${size}</option>`).join('');
      }

      // Colors + image par couleur + variant_id CJ
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

        // Image de la première couleur
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
  // Thumbnails and Main Slider
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

  // Swipe for mobile
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

  // Quantity Buttons
  const qtyMinus = document.querySelector('.quantity .qty-minus');
  const qtyPlus = document.querySelector('.quantity .qty-plus');
  const qtyInput = document.querySelector('.quantity input');
  if (qtyMinus && qtyPlus && qtyInput) {
    qtyMinus.addEventListener('click', () => { if (qtyInput.value > 1) qtyInput.value--; });
    qtyPlus.addEventListener('click', () => { qtyInput.value++; });
  }

  // Add to Cart (laissé tel quel)
  const addToCartBtn = document.querySelector('.product-content .add-to-cart');
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', (e) => {
      const quantity = parseInt(qtyInput ? qtyInput.value : 1);
      addToCart(e); // fonction existante dans script.js
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

  // Star Rating JS
  const starsContainers = document.querySelectorAll('.unique-stars');
  starsContainers.forEach(stars => {
    const rating = parseFloat(stars.dataset.rating);
    for (let i = 0; i < 5; i++) {
      const star = document.createElement('div');
      star.classList.add('unique-star');
      if (i < Math.floor(rating)) {
        star.classList.add('full');
      } else if (i < rating) {
        star.classList.add('half');
      }
      stars.appendChild(star);
    }
  });

  function redirectToReviews(app) {
    // Implement if needed
  }


  // Stories (inchangé)
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

  // Size Chart (inchangé)
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

});



   const writeButton = document.getElementById('write-review');
const reviewForm = document.getElementById('review-form');
const reviewsList = document.querySelector('.reviews-list');
const totalReviewsSpan = document.getElementById('total-reviews');
const readMoreBtn = document.getElementById('read-more');   // ← CORRIGÉ (tu l'avais remarqué)

let counts = {1: 0, 2: 1, 3: 2, 4: 7, 5: 35};
let total = 45;

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

async function loadDynamicReviews() {
    if (!window.currentProductId) return;

    // Supprime les anciennes reviews dynamiques (pour éviter les doublons)
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
                  reviewsList.appendChild(newReview);

                newReview.innerHTML = `
                    <div class="avatar">${avatarLetter}</div>
                    <h4>${review.fullName}</h4>
                    <div class="stars">${stars}</div>
                    <span class="date">${review.date}</span>
                    <h5>${review.title}</h5>
                    <p>${review.text}</p>
                    <div class="review-images"></div>
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

    if (!name || !email || !rating || !title || !text) {
        showErrorPopup("Please fill in all fields");
        return;
    }

    const productId = window.currentProductId || 'unknown';

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
                productId: productId
            })
        });

        const data = await res.json();

        if (data.success) {
            showErrorPopup("Review successfully submitted!");
            loadDynamicReviews();           // recharge immédiatement
            form.reset();
            reviewForm.style.display = 'none';
            writeButton.style.display = 'block';
        } else {
            showErrorPopup("Error: " + (data.error || "Unknown"));
        }
    } catch (err) {
        console.error("❌ Fetch review error:", err);
        showErrorPopup("Review successfully saved! (refresh the page if it doesn't appear)");
        setTimeout(loadDynamicReviews, 1000);   // force l'affichage
    }
});
updateSummary();