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

      // ====================== URGENCY BAR — DYNAMIQUE PAR PRODUIT ======================
      // On initialise l'urgency bar avec les données réelles du produit depuis products.data.json
      // puis on charge les reviews dynamiques depuis le serveur pour compléter le total
      initDynamicUrgencyBar(product, currentProductId);
    })
    .catch(err => console.error('Erreur chargement /products.data.json', err));
    // Déplace le modal dans le body pour que position:fixed fonctionne
  const overlay = document.getElementById('review-modal-overlay');
  if (overlay && overlay.parentElement !== document.body) {
      document.body.appendChild(overlay);
  }

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

  // ====================== DYNAMIC URGENCY BAR ======================
  // Logique complète :
  // 1. Lit reviews_count depuis products.data.json (valeur de base pour ce produit)
  // 2. Appelle save-reviews pour obtenir le nombre réel de reviews clients pour ce produit
  // 3. Fusionne les deux (base + reviews clients)
  // 4. Calcule la distribution par étoiles à partir des reviews clients réels
  // 5. Met à jour les barres de notation et le total
  // 6. Expose window.__reviewCounts pour mise à jour en temps réel après soumission

  function initDynamicUrgencyBar(product, productId) {
    // ── Compteurs de base issus de products.data.json ──
    // Le JSON fournit reviews_count total et rating moyen
    // On déduit la distribution des étoiles à partir du rating moyen
    const baseTotal = parseInt(product.reviews_count) || 0;
    const baseRating = parseFloat(product.rating) || 4.7;

    // Distribution de base calculée depuis le rating et le total
    // On utilise une distribution réaliste pondérée par le rating moyen
    function estimateBaseDistribution(total, avgRating) {
      // Calcule une distribution réaliste basée sur le rating moyen
      let dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      if (total === 0) return dist;

      // Algorithme de distribution pondérée :
      // Si rating proche de 5 → beaucoup de 5 étoiles
      // Si rating proche de 4 → mix 5 et 4 étoiles
      const r = Math.max(1, Math.min(5, avgRating));

      // Poids relatifs selon le rating moyen
      const weights = {
        5: Math.pow(Math.max(0, r - 4), 2) * 100 + Math.max(0, (r - 3) * 20),
        4: Math.max(0, (r - 3) * 15 - Math.pow(Math.max(0, r - 4.5), 2) * 50),
        3: Math.max(0, 10 - Math.abs(r - 3) * 8),
        2: Math.max(0, 5 - (r - 2) * 4),
        1: Math.max(0, 3 - (r - 1) * 2)
      };

      const totalWeight = Object.values(weights).reduce((s, v) => s + v, 0) || 1;
      let assigned = 0;
      const stars = [5, 4, 3, 2, 1];

      stars.forEach((star, idx) => {
        if (idx === stars.length - 1) {
          // Dernier : prend le reste pour éviter les erreurs d'arrondi
          dist[star] = Math.max(0, total - assigned);
        } else {
          dist[star] = Math.round((weights[star] / totalWeight) * total);
          assigned += dist[star];
        }
      });

      return dist;
    }

    // Distribution de base depuis products.data.json
    let counts = estimateBaseDistribution(baseTotal, baseRating);
    let total = baseTotal;

    // Applique la distribution de base aux barres HTML
    applyReviewCounts(counts, total);

    // ── Chargement des reviews clients réels depuis le serveur ──
    loadRealReviewCounts(productId, counts, total, baseTotal);
  }

  // Charge les reviews réels depuis l'API save-reviews
  async function loadRealReviewCounts(productId, baseCounts, baseTotal, jsonTotal) {
    try {
      const res = await fetch('/.netlify/functions/save-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-reviews', productId: productId })
      });
      const data = await res.json();

      if (!data.success || !data.reviews) return;

      // Compte les reviews clients par étoile pour ce produit spécifique
      const clientCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      data.reviews.forEach(review => {
        const star = parseInt(review.rating);
        if (star >= 1 && star <= 5) {
          clientCounts[star]++;
        }
      });

      const clientTotal = data.reviews.length;

      // Fusionne : base JSON + reviews clients réels
      // La base JSON représente déjà les reviews existants au moment de la config
      // On additionne par-dessus les nouveaux reviews clients
      const mergedCounts = {
        5: baseCounts[5] + clientCounts[5],
        4: baseCounts[4] + clientCounts[4],
        3: baseCounts[3] + clientCounts[3],
        2: baseCounts[2] + clientCounts[2],
        1: baseCounts[1] + clientCounts[1]
      };
      const mergedTotal = baseTotal + clientTotal;

      // Stocke les counts dans window pour mise à jour en temps réel
      window.__reviewCounts = mergedCounts;
      window.__reviewTotal = mergedTotal;
      window.__reviewBaseCounts = baseCounts;
      window.__reviewBaseTotal = baseTotal;
      window.__reviewProductId = productId;

      // Applique les counts fusionnés
      applyReviewCounts(mergedCounts, mergedTotal);

    } catch (err) {
      console.warn('[Reviews] Erreur chargement reviews réels:', err);
      // En cas d'erreur, garde la distribution de base depuis products.data.json
    }
  }

  function applyReviewCounts(counts, total) {
    const totalReviewsSpan = document.getElementById('total-reviews');
    if (totalReviewsSpan) totalReviewsSpan.textContent = total;

    // ── Sync du bloc .unique-reviews (header stars) ──
    const uniqueReviewsEl = document.querySelector('.unique-reviews');
    if (uniqueReviewsEl) uniqueReviewsEl.textContent = total + ' reviews';

    for (let i = 1; i <= 5; i++) {
      const barEl   = document.getElementById('bar-' + i);
      const countEl = document.getElementById('count-' + i);
      if (barEl) {
        const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
        barEl.style.width = pct + '%';
      }
      if (countEl) countEl.textContent = counts[i];
    }

    // Met aussi à jour l'en-tête des reviews
    const avgRatingHeader = document.querySelector('.average-rating');
    if (avgRatingHeader) {
      const totalEl = avgRatingHeader.querySelector('#total-reviews');
      if (totalEl) totalEl.textContent = total;
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

  if (prevArrow) {
    prevArrow.addEventListener('click', () => {
      let newIndex = currentIndex - 1;
      if (newIndex < 0) newIndex = mainImages.length - 1;
      updateMainImage(newIndex);
    });
  }

  if (nextArrow) {
    nextArrow.addEventListener('click', () => {
      let newIndex = currentIndex + 1;
      if (newIndex >= mainImages.length) newIndex = 0;
      updateMainImage(newIndex);
    });
  }

  let startX = 0;
  const slider = document.querySelector('.main-image-slider');
  if (slider) {
    slider.addEventListener('touchstart', e => startX = e.touches[0].clientX);
    slider.addEventListener('touchend', e => {
      const endX = e.changedTouches[0].clientX;
      const diff = startX - endX;
      if (Math.abs(diff) > 50) {
        diff > 0 ? nextArrow && nextArrow.click() : prevArrow && prevArrow.click();
      }
    });
  }

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

// ====================== GESTION DYNAMIQUE DES COUNTS DE REVIEWS ======================
// Ces counts sont mis à jour depuis products.data.json + reviews clients réels
// Ils sont initialisés par initDynamicUrgencyBar() dans le DOMContentLoaded

// Fonction publique pour mettre à jour les counts après soumission d'un review
// Appelée automatiquement après chaque soumission réussie
function updateReviewCountsAfterSubmission(newRating) {
    // Récupère les counts actuels stockés par initDynamicUrgencyBar
    const counts = window.__reviewCounts || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const total  = (window.__reviewTotal || 0);
    const star   = parseInt(newRating);

    // Incrémente le bon compteur d'étoiles
    if (star >= 1 && star <= 5) {
        counts[star] = (counts[star] || 0) + 1;
    }
    const newTotal = total + 1;

    // Sauvegarde les nouveaux counts dans window
    window.__reviewCounts = counts;
    window.__reviewTotal  = newTotal;

    // Met à jour l'affichage HTML en temps réel
    const totalReviewsSpan = document.getElementById('total-reviews');
    if (totalReviewsSpan) totalReviewsSpan.textContent = newTotal;
    // ── Sync du bloc .unique-reviews (header stars) ──
    const uniqueReviewsEl = document.querySelector('.unique-reviews');
    if (uniqueReviewsEl) uniqueReviewsEl.textContent = newTotal + ' reviews';

    for (let i = 1; i <= 5; i++) {
        const barEl   = document.getElementById('bar-' + i);
        const countEl = document.getElementById('count-' + i);
        if (barEl) {
            const pct = newTotal > 0 ? Math.round(((counts[i] || 0) / newTotal) * 100) : 0;
            barEl.style.width = pct + '%';
        }
        if (countEl) countEl.textContent = counts[i] || 0;
    }

    console.log('[Reviews] Counts mis à jour après soumission — Total:', newTotal, '| Star', star, ':', counts[star]);
}

// Exposer la fonction globalement pour que le form submit puisse l'appeler
window.updateReviewCountsAfterSubmission = updateReviewCountsAfterSubmission;

// ====================== READ MORE ======================
const hiddenReviews = document.querySelectorAll('.review-card.hidden');
let showingAll = false;

if (readMoreBtn) {
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
}

if (writeButton) {
    writeButton.addEventListener('click', () => {
        document.getElementById('review-modal-overlay').classList.add('open');
        document.body.style.overflow = 'hidden';
    });
}

const writeReviewBottom = document.querySelector('.write-review-bottom');
if (writeReviewBottom) {
    writeReviewBottom.addEventListener('click', () => {
        document.getElementById('review-modal-overlay').classList.add('open');
        document.body.style.overflow = 'hidden';
    });
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('review-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
});

function closeModal() {
    const overlay = document.getElementById('review-modal-overlay');
    overlay.style.animation = 'overlayIn 0.18s ease reverse';
    setTimeout(() => {
        overlay.classList.remove('open');
        overlay.style.animation = '';
        document.body.style.overflow = '';
        document.getElementById('modal-form-wrap').style.display = '';
        document.getElementById('modal-success').style.display = '';
        document.getElementById('modal-review-form').reset();
        const btn = document.getElementById('modal-submit');
        btn.disabled = false;
        btn.querySelector('.btn-label').style.opacity = '1';
        btn.querySelector('.btn-spinner').style.display = 'none';
    }, 180);
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
});

const form = document.getElementById('modal-review-form');

// ====================== COMPRESSION IMAGE ======================
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
    if (reviewsList) reviewsList.appendChild(newReview);
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
                if (reviewsList) reviewsList.appendChild(newReview);
            });
        }
    } catch (e) {
        console.error("Error loading reviews:", e);
    }
}

if (form) {
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

        const imagesBase64 = [];
        if (imageInput && imageInput.files.length > 0) {
            const files = Array.from(imageInput.files).slice(0, 3);
            for (const file of files) {
                const b64 = await compressImageForSheet(file);
                if (b64) imagesBase64.push(b64);
            }
        }

        const productId = window.currentProductId || 'unknown';

        // ── Mise à jour OPTIMISTE des counts avant même la réponse serveur ──
        // Cela garantit un affichage immédiat en temps réel
        updateReviewCountsAfterSubmission(rating);

        // Sauvegarde la position de scroll avant reset
        const scrollPositionBeforeSubmit = window.scrollY;


        // Spinner → success
        const btn = document.getElementById('modal-submit');
        btn.disabled = true;
        btn.querySelector('.btn-label').style.opacity = '0';
        btn.querySelector('.btn-spinner').style.display = 'block';

        await new Promise(resolve => setTimeout(resolve, 1400));

        document.getElementById('modal-form-wrap').style.display = 'none';
        const successEl = document.getElementById('modal-success');
        successEl.style.display = 'flex';
        setTimeout(closeModal, 2400);

        addOptimisticReview(name, rating, title, text, imagesBase64);
        form.reset();
        const previewContainer = document.getElementById('review-images-preview');
        if (previewContainer) previewContainer.innerHTML = '';
        if (reviewForm) reviewForm.style.display = 'none';
        if (writeButton) writeButton.style.display = 'block';

        // Restaure la position de scroll (empêche le saut vers le bas)
        requestAnimationFrame(() => {
            window.scrollTo({ top: scrollPositionBeforeSubmit, behavior: 'instant' });
        });

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
                // Recharge les reviews dynamiques depuis le serveur
                // (les counts ont déjà été mis à jour de façon optimiste)
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
}

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

// ── Urgency bar — REMPLACÉ PAR LE SYSTÈME DYNAMIQUE ──
// L'urgency bar est maintenant gérée par initDynamicUrgencyBar() dans DOMContentLoaded
// Elle affiche le nombre EXACT de reviews du produit courant depuis products.data.json
// et se met à jour en temps réel après chaque soumission client via updateReviewCountsAfterSubmission()
//
// ANCIEN CODE SUPPRIMÉ :
// (function() {
//     var urgencyBar = document.querySelector('.pp-urgency-bar strong');
//     ... random entre 35 et 74 ... stocké en localStorage pendant 24h ...
// })();
// ↑ Ce code est supprimé car il était identique pour tous les produits
//   et ne reflétait pas le vrai nombre de reviews

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



/* ================================================================
   PRODUCT 2 — SPECIFIC JS
   Animated results bars + scroll reveals
================================================================ */
document.addEventListener('DOMContentLoaded', function () {

  /* ── 1. Animate result bars on scroll ── */
  var resultBars = document.querySelectorAll('.wt-result-bar-fill');
  if (resultBars.length) {
    var barObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          barObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    resultBars.forEach(function(bar) { barObserver.observe(bar); });
  }

  /* ── 2. Scroll reveal for new product-2 blocks ── */
  var p2Blocks = document.querySelectorAll(
    '.wt-transform-block, .wt-science-block, ' +
    '.wt-howtowear, .wt-results-block, .wt-material-block, ' +
    '.wt-guarantee-banner, .p2-why-card, ' +
    '.p2-testimonial-card, .p2-compare-table'
  );

  if (p2Blocks.length) {
    var p2Observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0) scale(1)';
          p2Observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    p2Blocks.forEach(function(el, i) {
      el.style.opacity      = '0';
      el.style.transform    = 'translateY(22px) scale(0.98)';
      el.style.transition   = 'opacity 0.55s cubic-bezier(0.4,0,0.2,1) ' + (i * 0.06) + 's, transform 0.55s cubic-bezier(0.4,0,0.2,1) ' + (i * 0.06) + 's';
      p2Observer.observe(el);
    });
  }

  /* ── 3. Comparison table row hover ── */
  var tableRows = document.querySelectorAll('.p2-compare-table tbody tr');
  tableRows.forEach(function(row) {
    row.addEventListener('mouseenter', function() {
      this.style.background = 'rgba(184,48,88,0.06)';
    });
    row.addEventListener('mouseleave', function() {
      this.style.background = '';
    });
  });

  /* ── 4. Why cards stagger delay ── */
  var whyCards = document.querySelectorAll('.p2-why-card');
  whyCards.forEach(function(card, i) {
    card.style.animationDelay = (i * 0.12) + 's';
  });

});

/* ── 5. Testimonials mobile auto-slider ── */
(function () {
  var track = document.querySelector('.p2-testimonials-track');
  var dots  = document.querySelectorAll('.p2-testimonials-dot');
  if (!track || !dots.length) return;

  var current = 0;
  var total   = dots.length;
  var timer   = null;

  function goTo(index) {
    current = (index + total) % total;
    if (window.innerWidth <= 768) {
      track.style.transform = 'translateX(-' + (current * 100) + '%)';
    }
    dots.forEach(function (d, i) {
      d.classList.toggle('active', i === current);
    });
  }

  function startAuto() {
    clearInterval(timer);
    timer = setInterval(function () { goTo(current + 1); }, 5000);
  }

  dots.forEach(function (dot) {
    dot.addEventListener('click', function () {
      goTo(parseInt(this.dataset.index, 10));
      startAuto();
    });
  });

  /* Réinitialiser si redimensionnement */
  window.addEventListener('resize', function () {
    if (window.innerWidth > 768) {
      track.style.transform = '';
    } else {
      goTo(current);
    }
  });

  startAuto();
})();

(function() {
  'use strict';

  /* ── Scroll-reveal ── */
  const revealEls = document.querySelectorAll('.wt-ba-animate');
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          e.target.style.transitionDelay = (i * 0.12) + 's';
          e.target.classList.add('is-visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: .12 });
    revealEls.forEach(el => obs.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  /* ── Animated metric bars ── */
  const bars = document.querySelectorAll('.wt-ba-metric-bar, .wt-ba-score-fill');
  const barObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const el = e.target;
        const target = el.style.getPropertyValue('--ba-bar-w') || el.style.getPropertyValue('--wt-score-w');
        if (target) {
          setTimeout(() => { el.style.width = target; }, 250);
        } else {
          /* score fills — read CSS variable */
          const computed = getComputedStyle(el).getPropertyValue('--wt-score-w').trim();
          if (computed) setTimeout(() => { el.style.width = computed; }, 350);
        }
        barObs.unobserve(el);
      }
    });
  }, { threshold: .20 });
  bars.forEach(b => barObs.observe(b));

  /* ── Animated counter ── */
  function animateCount(el, target, suffix, duration) {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      el.textContent = Math.floor(start).toLocaleString() + suffix;
      if (start >= target) clearInterval(timer);
    }, 16);
  }

  const counterEl = document.getElementById('ba-count-1');
  if (counterEl) {
    const cObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          animateCount(counterEl, 12000, '+', 1800);
          cObs.unobserve(e.target);
        }
      });
    }, { threshold: .3 });
    cObs.observe(counterEl);
  }
})();


// Profile selector
document.querySelectorAll('.p2-profile-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const idx = btn.dataset.profile;
    document.querySelectorAll('.p2-profile-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.p2-profile-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('p2-panel-' + idx).classList.add('active');
  });
});



/* ═══════════════════════════════════════
   TRACKER + PROOF WALL
═══════════════════════════════════════ */
(function(){
  const profiles=[
    {range:[60,74],label:'60–74 cm',clients:[
      {name:'Julie M.',loc:'Size S · France',res:'−3 cm in 2 weeks',q:'"Immediate result, incredible under my office clothes."'},
      {name:'Léa T.',loc:'Size S · Belgium',res:'−4 cm in 3 weeks',q:'"I wear it 8h a day, zero discomfort."'},
      {name:'Nina B.',loc:'Size M · Canada',res:'Hourglass figure from Day 1',q:'"My dresses fit me so much better now."'}
    ],d1:2,w2:3,m1:5},
    {range:[75,89],label:'75–89 cm',clients:[
      {name:'Clara V.',loc:'Size M · France',res:'−5 cm in 4 weeks',q:'"My back has not hurt since the very first week."'},
      {name:'Sofia D.',loc:'Size L · Spain',res:'−4 cm in 3 weeks',q:'"Invisible under my work outfits, perfect."'},
      {name:'Elena P.',loc:'Size L · Italy',res:'Posture corrected in 7 days',q:'"I automatically stand straighter now."'}
    ],d1:2,w2:4,m1:6},
    {range:[90,104],label:'90–104 cm',clients:[
      {name:'Maria L.',loc:'Size XXL · Dominican Rep.',res:'−6 cm in 3 weeks',q:'"My back pain disappeared within a week."'},
      {name:'Sophia R.',loc:'Size L · United States',res:'Instant hourglass figure',q:'"My coworkers asked if I had lost weight."'},
      {name:'Amara K.',loc:'Size 3XL · France',res:'−5 cm postpartum',q:'"My doctor approved it, incredible result."'}
    ],d1:2,w2:4,m1:7},
    {range:[105,119],label:'105–119 cm',clients:[
      {name:'Valentina M.',loc:'Size 4XL · Mexico',res:'−7 cm in 4 weeks',q:'"Finally a product that takes my body shape into account."'},
      {name:'Carolina B.',loc:'Size XXL · Colombia',res:'−5 cm in 3 weeks',q:'"Comfortable for 8h straight, no rolling or slipping."'},
      {name:'Jennifer A.',loc:'Size 3XL · USA',res:'−8 cm in 5 weeks',q:'"The neoprene sweat is real, and so are the results."'}
    ],d1:2,w2:5,m1:8},
    {range:[120,150],label:'120–150 cm',clients:[
      {name:'Natalia V.',loc:'Size 6XL · Brazil',res:'−8 cm in 30 days',q:'"I never thought I\'d find my size. My confidence is back."'},
      {name:'Diana Z.',loc:'Size 5XL · Argentina',res:'−6 cm in 4 weeks',q:'"The double velcro holds perfectly all day long."'},
      {name:'Rosa M.',loc:'Size 6XL · Peru',res:'Back pain gone by Day 4',q:'"I cried with joy seeing my waist change."'}
    ],d1:3,w2:5,m1:9}
  ];

  function getProfile(w){
    return profiles.find(p=>w>=p.range[0]&&w<=p.range[1])||profiles[2];
  }

  function hoursFactor(h){
    return parseFloat((0.7+(h-4)*0.05).toFixed(2));
  }

  function round1(n){ return Math.round(n*10)/10; }

  function updateTracker(){
    const waistEl=document.getElementById('wt-waist');
    const hoursEl=document.getElementById('wt-hours');
    if(!waistEl||!hoursEl) return;

    const w=parseInt(waistEl.value);
    const h=parseInt(hoursEl.value);
    document.getElementById('wt-waist-val').textContent=w;
    document.getElementById('wt-hours-val').textContent=h;

    const p=getProfile(w);
    const f=hoursFactor(h);
    const d1=round1(p.d1*f);
    const w1=round1((p.d1+(p.w2-p.d1)*0.4)*f);
    const w2=round1(p.w2*f);
    const w4=round1((p.w2+(p.m1-p.w2)*0.6)*f);
    const m1=round1(p.m1*f);

    document.getElementById('res-day1').textContent='−'+d1+' cm';
    document.getElementById('res-week2').textContent='−'+w2+' cm';
    document.getElementById('res-month1').textContent='−'+m1+' cm';
    document.getElementById('tl-0').textContent='−'+d1+' cm';
    document.getElementById('tl-1').textContent='−'+w1+' cm';
    document.getElementById('tl-2').textContent='−'+w2+' cm';
    document.getElementById('tl-3').textContent='−'+w4+' cm';
    document.getElementById('tl-4').textContent='−'+m1+' cm';

    const sub=document.getElementById('wall-sub');
    if(sub) sub.textContent='Customers with '+p.label+' waist size · verified results';

    const names=[document.getElementById('c1-name'),document.getElementById('c2-name'),document.getElementById('c3-name')];
    const locs=[document.getElementById('c1-loc'),document.getElementById('c2-loc'),document.getElementById('c3-loc')];
    const ress=[document.getElementById('c1-res'),document.getElementById('c2-res'),document.getElementById('c3-res')];
    const qs=[document.getElementById('c1-q'),document.getElementById('c2-q'),document.getElementById('c3-q')];

    p.clients.forEach((c,i)=>{
      if(names[i]) names[i].textContent=c.name;
      if(locs[i])  locs[i].textContent=c.loc;
      if(ress[i])  ress[i].textContent=c.res;
      if(qs[i])    qs[i].textContent=c.q;
    });
  }

  const waistInput=document.getElementById('wt-waist');
  const hoursInput=document.getElementById('wt-hours');
  if(waistInput) waistInput.addEventListener('input',updateTracker);
  if(hoursInput) hoursInput.addEventListener('input',updateTracker);
  updateTracker();
})();



/* ================================================================
   PRODUCT 3 — SMART JUMP ROPE
   Add this entire block at the END of products.js
================================================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* ── Only run on product3 page ── */
  var productSection = document.querySelector('.jr-product-section');
  if (!productSection) return;

  /* ══════════════════════════════════════════
     1. LIVE VIEWERS
  ══════════════════════════════════════════ */
  function updateLiveViewers() {
    var count = Math.floor(Math.random() * 120) + 80;
    var el = document.getElementById('live-count-example');
    if (el) el.textContent = count;
  }
  setInterval(updateLiveViewers, 5000);
  updateLiveViewers();

  /* ══════════════════════════════════════════
     2. STATS COUNTERS — animated count-up
  ══════════════════════════════════════════ */
  var statsTargets = {
    'jr-counter-reps': 1000,
    'jr-counter-cal':  400,
    'jr-counter-min':  30,
    'jr-counter-fat':  300
  };

  function animateCounter(el, target, duration) {
    var start = 0;
    var increment = target / (duration / 16);
    var timer = setInterval(function () {
      start += increment;
      if (start >= target) {
        el.textContent = target.toLocaleString();
        clearInterval(timer);
      } else {
        el.textContent = Math.floor(start).toLocaleString();
        el.style.animation = 'jr-count-tick 0.2s ease';
        setTimeout(function () { el.style.animation = ''; }, 200);
      }
    }, 16);
  }

  var statsObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var block = entry.target;

        /* Animate counters */
        Object.keys(statsTargets).forEach(function (id) {
          var el = document.getElementById(id);
          if (el) animateCounter(el, statsTargets[id], 1600);
        });

        /* Animate bars */
        block.querySelectorAll('.jr-stat-bar').forEach(function (bar) {
          bar.style.width = bar.style.getPropertyValue('--jr-bar-w') ||
            bar.getAttribute('style').match(/--jr-bar-w:\s*([^;]+)/)?.[1] || '0%';
          setTimeout(function () { bar.style.width = bar.style.cssText.match(/--jr-bar-w:\s*([^;]+)/)?.[1]; }, 50);
        });

        statsObserver.unobserve(block);
      }
    });
  }, { threshold: 0.3 });

  var statsBlock = document.querySelector('.jr-stats-block');
  if (statsBlock) statsObserver.observe(statsBlock);

  /* ══════════════════════════════════════════
     3. STAT BARS — separate observer for CSS var
  ══════════════════════════════════════════ */
  var barObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('jr-bar-animated');
        barObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.jr-stat-bar').forEach(function (bar) {
    /* Set initial width via CSS var */
    var pct = getComputedStyle(bar).getPropertyValue('--jr-bar-w').trim();
    if (!pct) {
      /* fallback: read inline style */
      var m = bar.getAttribute('style') ? bar.getAttribute('style').match(/--jr-bar-w\s*:\s*([^;]+)/) : null;
      pct = m ? m[1].trim() : '0%';
    }
    bar.style.setProperty('--jr-bar-w', pct);
    bar.style.width = '0%';

    var obs = new IntersectionObserver(function (entries2) {
      if (entries2[0].isIntersecting) {
        bar.style.width = pct;
        obs.unobserve(bar);
      }
    }, { threshold: 0.3 });
    obs.observe(bar);
  });

  /* ══════════════════════════════════════════
     4. COMPARE BARS animation
  ══════════════════════════════════════════ */
  document.querySelectorAll('.jr-compare-bar').forEach(function (bar) {
    var pct = bar.style.getPropertyValue('--jr-compare-w') || '0%';
    var m = bar.getAttribute('style') ? bar.getAttribute('style').match(/--jr-compare-w\s*:\s*([^;]+)/) : null;
    if (m) pct = m[1].trim();

    bar.style.width = '0%';

    var obs = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        setTimeout(function () { bar.style.width = pct; }, 150);
        obs.unobserve(bar);
      }
    }, { threshold: 0.2 });
    obs.observe(bar);
  });

  /* ══════════════════════════════════════════
     5. SCROLL REVEAL for product3 unique blocks
  ══════════════════════════════════════════ */
  var jr3Blocks = document.querySelectorAll(
    '.jr-stats-block, .jr-challenge-block, ' +
    '.jr-why-card, .jr-testimonial-card, .jr-compare-row'
  );

  if (jr3Blocks.length) {
    var revObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0) scale(1)';
          revObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    jr3Blocks.forEach(function (el, i) {
      el.style.opacity   = '0';
      el.style.transform = 'translateY(22px) scale(0.98)';
      el.style.transition = 'opacity 0.55s cubic-bezier(0.4,0,0.2,1) ' + (i * 0.06) + 's, transform 0.55s cubic-bezier(0.4,0,0.2,1) ' + (i * 0.06) + 's';
      revObserver.observe(el);
    });
  }

  /* ══════════════════════════════════════════
     7. DYNAMIC URGENCY BAR — review counts from JSON
  ══════════════════════════════════════════ */
  (function initDynamicUrgencyBarP3() {
    var productId = 'Pdg-Francenel-product3';

    function waitForProducts(cb) {
      if (window.__allProducts && window.__allProducts.length > 0) {
        cb(window.__allProducts);
      } else {
        var tries = 0;
        var wait = setInterval(function () {
          tries++;
          if (window.__allProducts && window.__allProducts.length > 0) {
            clearInterval(wait);
            cb(window.__allProducts);
          } else if (tries > 60) {
            clearInterval(wait);
          }
        }, 100);
      }
    }

    waitForProducts(function (products) {
      var product = products.find(function (p) { return p.id === productId; });
      if (!product) return;

      var baseTotal  = parseInt(product.reviews_count) || 73;
      var baseRating = parseFloat(product.rating) || 4.7;

      function estimateDistribution(total, rating) {
        var dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        if (!total) return dist;
        var r = Math.max(1, Math.min(5, rating));
        var w5 = Math.pow(Math.max(0, r - 4), 2) * 100 + Math.max(0, (r - 3) * 20);
        var w4 = Math.max(0, (r - 3) * 15 - Math.pow(Math.max(0, r - 4.5), 2) * 50);
        var w3 = Math.max(0, 10 - Math.abs(r - 3) * 8);
        var w2 = Math.max(0, 5 - (r - 2) * 4);
        var w1 = Math.max(0, 3 - (r - 1) * 2);
        var wt = w5 + w4 + w3 + w2 + w1 || 1;
        var assigned = 0;
        [[5,w5],[4,w4],[3,w3],[2,w2]].forEach(function (pair) {
          dist[pair[0]] = Math.round((pair[1] / wt) * total);
          assigned += dist[pair[0]];
        });
        dist[1] = Math.max(0, total - assigned);
        return dist;
      }

      var counts = estimateDistribution(baseTotal, baseRating);
      applyReviewCountsP3(counts, baseTotal);

      /* Load real reviews */
      fetch('/.netlify/functions/save-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-reviews', productId: productId })
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (!data.success || !data.reviews) return;
        var clientCounts = { 1:0, 2:0, 3:0, 4:0, 5:0 };
        data.reviews.forEach(function (rev) {
          var s = parseInt(rev.rating);
          if (s >= 1 && s <= 5) clientCounts[s]++;
        });
        var clientTotal = data.reviews.length;
        var merged = {
          5: counts[5] + clientCounts[5],
          4: counts[4] + clientCounts[4],
          3: counts[3] + clientCounts[3],
          2: counts[2] + clientCounts[2],
          1: counts[1] + clientCounts[1]
        };
        var mergedTotal = baseTotal + clientTotal;
        window.__reviewCounts = merged;
        window.__reviewTotal  = mergedTotal;
        applyReviewCountsP3(merged, mergedTotal);
      }).catch(function () {});
    });

    function applyReviewCountsP3(counts, total) {
      var el = document.getElementById('total-reviews');
      if (el) el.textContent = total;
      var uniq = document.querySelector('.unique-reviews');
      if (uniq) uniq.textContent = total + ' reviews';
      for (var i = 1; i <= 5; i++) {
        var barEl   = document.getElementById('bar-' + i);
        var countEl = document.getElementById('count-' + i);
        if (barEl) barEl.style.width = (total > 0 ? Math.round((counts[i] / total) * 100) : 0) + '%';
        if (countEl) countEl.textContent = counts[i];
      }
    }
  })();


  (function(){
  const sw = document.getElementById('jr-slider-w');
  const sd = document.getElementById('jr-slider-d');
  if(!sw || !sd) return;

  const foods = [
    'more than half a pizza',
    'more than a cheeseburger',
    'more than a large latte',
    'more than a candy bar',
    'more than 2 glasses of wine'
  ];

  function calcCal(met, kg, min){
    return Math.round((met * 3.5 * kg / 200) * min);
  }

  function updateSliderBg(el, min, max, val){
    const pct = Math.round((val - min) / (max - min) * 100);
    el.style.background =
      'linear-gradient(90deg,rgba(192,56,94,0.8) ' + pct +
      '%,rgba(255,255,255,0.12) ' + pct + '%)';
  }

  function update(){
    const kg  = parseInt(sw.value);
    const min = parseInt(sd.value);

    updateSliderBg(sw, 45, 120, kg);
    updateSliderBg(sd, 5, 60, min);

    document.getElementById('jr-wv').innerHTML = kg + ' <span>kg</span>';
    document.getElementById('jr-dv').innerHTML = min + ' <span>min</span>';

    const rope = calcCal(12.3, kg, min);
    const run  = calcCal(9.8,  kg, min);
    const bike = calcCal(7.5,  kg, min);
    const walk = calcCal(3.8,  kg, min);

    document.getElementById('jr-hero-cal').innerHTML = rope + ' <em>cal</em>';
    document.getElementById('jr-badge-mult').textContent =
      Math.round(rope / walk) + '\u00d7';

    const fi = Math.min(Math.floor(rope / 150), foods.length - 1);
    document.getElementById('jr-hero-sub').textContent =
      'in ' + min + ' min \u2014 that\u2019s ' + foods[fi];

    document.getElementById('jv-rope').textContent = rope + ' cal';
    document.getElementById('jv-run').textContent  = run  + ' cal';
    document.getElementById('jv-bike').textContent = bike + ' cal';
    document.getElementById('jv-walk').textContent = walk + ' cal';

    document.getElementById('jb-rope').style.width = '100%';
    document.getElementById('jb-run').style.width  =
      Math.round(run  / rope * 100) + '%';
    document.getElementById('jb-bike').style.width =
      Math.round(bike / rope * 100) + '%';
    document.getElementById('jb-walk').style.width =
      Math.round(walk / rope * 100) + '%';

    document.getElementById('jr-stat-sess').textContent =
      Math.round(3500 / rope);
    document.getElementById('jr-stat-week').textContent =
      (rope * 7).toLocaleString();
    document.getElementById('jr-stat-month').textContent =
      ((rope * 30) / 7700).toFixed(1) + ' kg';
  }

  sw.addEventListener('input', update);
  sd.addEventListener('input', update);
  update();
})();







(function(){

  /* ── Data ── */
  var QUESTIONS = 4;
  var answers = {};
  var current = 0;

  /* Personalized result data matrix
     [goal][level][time] → { title, desc, cal, weeks, min, proofStrong, proofSub }
  */
  var RESULTS = {
    burnfat: {
      beginner:  { cal:220, weeks:8,  min:10, title:'The <em>Gentle Burn</em> Starter Plan',    desc:'Perfect for beginners. Starting with just 10 minutes a day, your Smart Jump Rope will burn <strong style="color:var(--rose-light);">220 calories per session</strong> — and you\'ll be doing 500 consecutive jumps within 2 weeks.' },
      casual:    { cal:300, weeks:7,  min:15, title:'The <em>Morning Melt</em> Routine',         desc:'15 minutes every morning before work. Your rope will burn <strong style="color:var(--rose-light);">300 calories per session</strong> — that\'s a full dessert gone before breakfast ends.' },
      active:    { cal:380, weeks:6,  min:20, title:'The <em>Fat-Burn Sprint</em> Protocol',     desc:'20 minutes of structured intervals. You\'ll hit <strong style="color:var(--rose-light);">380 calories per session</strong> and see visible waist reduction in just 3–4 weeks.' },
      athlete:   { cal:520, weeks:4,  min:30, title:'The <em>High-Intensity Shred</em> Plan',   desc:'30-minute HIIT sessions with the rope. You\'ll burn <strong style="color:var(--rose-light);">520+ calories per session</strong> — equivalent to a 5km run but in half the time.' }
    },
    tone: {
      beginner:  { cal:200, weeks:10, min:10, title:'The <em>Gentle Sculpt</em> Foundation',    desc:'Start light, build strong. 10 minutes a day to awaken your muscles and begin shaping your silhouette with <strong style="color:var(--rose-light);">200 calories burned daily</strong>.' },
      casual:    { cal:270, weeks:8,  min:15, title:'The <em>Daily Sculpt</em> Routine',         desc:'15 consistent minutes per day. Your rope builds coordination and leanness simultaneously — burning <strong style="color:var(--rose-light);">270 calories</strong> while sculpting your legs and core.' },
      active:    { cal:360, weeks:6,  min:20, title:'The <em>Lean &amp; Defined</em> Program',  desc:'Combine 20-minute rope sessions with bodyweight training for the ultimate lean body. Burns <strong style="color:var(--rose-light);">360 calories</strong> and tones every muscle group.' },
      athlete:   { cal:480, weeks:5,  min:30, title:'The <em>Athletic Physique</em> Protocol',  desc:'Advanced 30-minute routines including double-unders and alternating footwork. <strong style="color:var(--rose-light);">480 calories</strong> burned with serious muscle definition results.' }
    },
    cardio: {
      beginner:  { cal:190, weeks:8,  min:8,  title:'The <em>Heart Starter</em> Plan',           desc:'Start with short 8-minute sessions and build week by week. Your jump rope will transform your cardiovascular system — burning <strong style="color:var(--rose-light);">190 calories</strong> and improving stamina fast.' },
      casual:    { cal:260, weeks:7,  min:12, title:'The <em>Cardio Boost</em> Routine',          desc:'12 minutes of steady rhythm jumping. Your heart rate rises, your stamina grows, and you burn <strong style="color:var(--rose-light);">260 calories</strong> in a session shorter than most TV ads.' },
      active:    { cal:340, weeks:5,  min:20, title:'The <em>Endurance Builder</em> Protocol',   desc:'20-minute progressive sessions that make your cardio engine unstoppable. Burns <strong style="color:var(--rose-light);">340 calories</strong> and you\'ll feel the difference in just 2 weeks.' },
      athlete:   { cal:500, weeks:4,  min:35, title:'The <em>Peak Performance</em> Plan',        desc:'35-minute advanced cardio circuits with the rope as anchor exercise. <strong style="color:var(--rose-light);">500 calories</strong> per session and elite cardiovascular conditioning.' }
    },
    fun: {
      beginner:  { cal:210, weeks:6,  min:10, title:'The <em>Challenge Starter</em> Pack',       desc:'Set daily jump goals on the digital display and beat them every week. 10 minutes of fun burns <strong style="color:var(--rose-light);">210 calories</strong> and you\'ll be hooked after day 3.' },
      casual:    { cal:280, weeks:5,  min:15, title:'The <em>Personal Best</em> Tracker',        desc:'15 minutes of daily record-breaking. Your Smart Rope counter becomes your scoreboard — burning <strong style="color:var(--rose-light);">280 calories</strong> while you chase your own best times.' },
      active:    { cal:390, weeks:4,  min:20, title:'The <em>Champion Habit</em> Routine',       desc:'20-minute sessions with personal record tracking. Your digital counter becomes addictive — <strong style="color:var(--rose-light);">390 calories</strong> burned while you chase 10,000-jump milestones.' },
      athlete:   { cal:540, weeks:3,  min:40, title:'The <em>Elite Jump</em> Challenger Plan',  desc:'40-minute competition-style sessions targeting speed and volume records. The counter makes every session a game — <strong style="color:var(--rose-light);">540+ calories</strong> burned per round.' }
    }
  };

  var PROOF = {
    burnfat: { strong: '187 women with your fat-loss goal use this exact plan', sub: 'Average result: −5.8 kg in 7 weeks · 4.9★ satisfaction' },
    tone:    { strong: '134 women focused on toning are using this plan now',  sub: 'Average result: −2 sizes in 6 weeks · 4.8★ satisfaction' },
    cardio:  { strong: '96 women improving their cardio follow this exact plan', sub: 'Average result: −28% resting heart rate · 4.9★ satisfaction' },
    fun:     { strong: '112 women tracking records are using this plan daily', sub: 'Average personal best: 4,200 jumps in 30 min · 5.0★ satisfaction' }
  };

  /* ── DOM refs ── */
  var bar       = document.getElementById('jrq-bar');
  var progressL = document.getElementById('jrq-progress-label');
  var btnNext   = document.getElementById('jrq-btn-next');
  var btnLabel  = document.getElementById('jrq-btn-label');
  var navHint   = document.getElementById('jrq-nav-hint');
  var resultEl  = document.getElementById('jrq-result');
  var navEl     = document.getElementById('jrq-nav');

  /* ── Option click handler ── */
  document.querySelectorAll('.jrq-option').forEach(function(opt){
    opt.addEventListener('click', function(){
      var q = parseInt(opt.dataset.q);
      var v = opt.dataset.v;

      /* Deselect siblings */
      opt.closest('.jrq-options').querySelectorAll('.jrq-option').forEach(function(o){
        o.classList.remove('selected');
      });
      opt.classList.add('selected');
      answers[q] = v;

      /* Enable next button */
      btnNext.disabled = false;
      btnNext.classList.add('enabled');
      navHint.textContent = 'Great choice!';
    });
  });

  /* ── Next button ── */
  btnNext.addEventListener('click', function(){
    if(current < QUESTIONS - 1){
      advanceQuestion();
    } else {
      showResult();
    }
  });

  function advanceQuestion(){
    /* Hide current */
    document.getElementById('jrq-q' + current).classList.remove('active');
    /* Mark dot done */
    document.getElementById('jrq-dot-' + current).classList.remove('active');
    document.getElementById('jrq-dot-' + current).classList.add('done');

    current++;

    /* Activate next */
    document.getElementById('jrq-q' + current).classList.add('active');
    document.getElementById('jrq-dot-' + current).classList.add('active');

    /* Update progress */
    var pct = Math.round((current / QUESTIONS) * 100);
    bar.style.width = pct + '%';
    progressL.textContent = 'Question ' + (current + 1) + ' of ' + QUESTIONS;

    /* Disable next until answer selected */
    btnNext.disabled = true;
    btnNext.classList.remove('enabled');
    navHint.textContent = 'Select an answer to continue';

    /* Change button label on last Q */
    if(current === QUESTIONS - 1){
      btnLabel.textContent = 'See my results';
    }
  }

  function showResult(){
    /* Build personalized result */
    var goal  = answers[0] || 'burnfat';
    var level = answers[1] || 'casual';
    var time  = answers[2] || '15min';

    /* Time → level mapping for results */
    var levelMap = { '5min':'beginner', '15min':'casual', '30min':'active', '45min':'athlete' };
    var timeLevel = levelMap[time] || 'casual';

    /* Pick result data — combine goal + fitness level */
    var data = (RESULTS[goal] && RESULTS[goal][level]) ? RESULTS[goal][level] : RESULTS['burnfat']['casual'];

    /* Adjust minutesbased on time commitment */
    var minMap = { '5min':5, '15min':15, '30min':25, '45min':40 };
    var chosenMin = minMap[time] || 15;

    /* Recalculate cal based on chosen minutes (MET 12.3, 65kg avg) */
    var calAdjusted = Math.round(12.3 * 3.5 * 65 / 200 * chosenMin);

    /* Proof text */
    var proof = PROOF[goal] || PROOF['burnfat'];

    /* Inject result */
    document.getElementById('jrq-result-title').innerHTML = data.title;
    document.getElementById('jrq-result-desc').innerHTML = data.desc;
    document.getElementById('jrq-rc-cal').textContent = calAdjusted;
    document.getElementById('jrq-rc-weeks').textContent = data.weeks;
    document.getElementById('jrq-rc-min').textContent = chosenMin;
    document.getElementById('jrq-proof-strong').textContent = proof.strong;
    document.getElementById('jrq-proof-sub').textContent = proof.sub;

    /* Goal-specific urgency */
    var urgencyMap = {
      burnfat: 'Only <strong>9 units</strong> left at this price — fat-loss plan fills fastest',
      tone:    'Only <strong>14 units</strong> left — toning plan is in high demand right now',
      cardio:  'Only <strong>11 units</strong> left — cardio seekers are ordering quickly today',
      fun:     'Only <strong>7 units</strong> left — challenge trackers are grabbing their rope now'
    };
    document.getElementById('jrq-urgency-text').innerHTML = urgencyMap[goal] || urgencyMap['burnfat'];

    /* Mark final dot done */
    document.getElementById('jrq-dot-' + current).classList.remove('active');
    document.getElementById('jrq-dot-' + current).classList.add('done');
    bar.style.width = '100%';

    /* Hide quiz body + nav, show result */
    document.querySelector('.jrq-quiz-body').style.display = 'none';
    navEl.style.display = 'none';
    progressL.textContent = 'Your plan is ready!';

    resultEl.classList.add('active');

    /* Smooth scroll to result */
    setTimeout(function(){
      document.getElementById('jrq-quiz-card').scrollIntoView({ behavior:'smooth', block:'center' });
    }, 100);
  }

  /* ── Restart ── */
  document.getElementById('jrq-restart-btn').addEventListener('click', function(){
    answers = {};
    current = 0;

    /* Reset questions */
    document.querySelectorAll('.jrq-question-slide').forEach(function(el, i){
      el.classList.toggle('active', i === 0);
    });

    /* Reset dots */
    for(var i = 0; i < QUESTIONS; i++){
      var dot = document.getElementById('jrq-dot-' + i);
      dot.classList.remove('active','done');
      if(i === 0) dot.classList.add('active');
    }

    /* Reset options */
    document.querySelectorAll('.jrq-option').forEach(function(o){ o.classList.remove('selected'); });

    /* Reset UI */
    bar.style.width = '0%';
    progressL.textContent = 'Question 1 of 4';
    btnNext.disabled = true;
    btnNext.classList.remove('enabled');
    btnLabel.textContent = 'Next';
    navHint.textContent = 'Select an answer to continue';

    document.querySelector('.jrq-quiz-body').style.display = '';
    navEl.style.display = '';
    resultEl.classList.remove('active');
  });

})();

});
/* ── END PRODUCT 3 JS ── */

