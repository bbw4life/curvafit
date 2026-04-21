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


});
/* ── END PRODUCT 3 JS ── */












/* ═══════════════════════════════════════════════════════════
   JUMP ROPE GALLERY + QUIZ — JavaScript
   Ajouter dans products.js à la fin du bloc Product 3
   ou dans un script séparé après le DOM
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Wait for DOM ── */
  function jrgqInit() {
    const section = document.getElementById('jrgq-section');
    if (!section) return;

    /* ════════════════════════════════
       1. PARTICLES
    ════════════════════════════════ */
    const particlesContainer = document.getElementById('jrgq-particles');
    if (particlesContainer) {
      const colors = [
        'rgba(192,56,94,0.7)',
        'rgba(201,150,62,0.6)',
        'rgba(123,63,110,0.6)',
        'rgba(232,96,126,0.5)',
        'rgba(240,192,96,0.5)',
      ];
      for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'jrgq-ptcl';
        const size = Math.random() * 4 + 2;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left  = Math.random() * 100;
        const delay = Math.random() * 12;
        const dur   = Math.random() * 8 + 6;
        const px    = (Math.random() - 0.5) * 80;
        p.style.cssText = [
          `width:${size}px`,
          `height:${size}px`,
          `background:${color}`,
          `left:${left}%`,
          `bottom:${Math.random() * 20}%`,
          `animation-duration:${dur}s`,
          `animation-delay:${delay}s`,
          `--px:${px}px`,
          `border-radius:50%`,
        ].join(';');
        particlesContainer.appendChild(p);
      }
    }

    /* ════════════════════════════════
       2. QUIZ STATE
    ════════════════════════════════ */
    const quizAnswers = {};  // { level, goal, time, life }
    const totalSteps  = 4;
    let   currentStep = 1;

    /* ── DOM refs ── */
    const progressFill  = document.getElementById('jrgq-progress-fill');
    const progressLabel = document.getElementById('jrgq-progress-label');
    const retakeBtn     = document.getElementById('jrgq-retake');

    /* ── Update progress bar ── */
    function updateProgress(step) {
      const pct = step > totalSteps
        ? 100
        : Math.round(((step - 1) / totalSteps) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressLabel) {
        progressLabel.textContent = step > totalSteps
          ? 'Your plan is ready!'
          : `Question ${step} of ${totalSteps}`;
      }
    }

    /* ── Show step ── */
    function showStep(stepNum) {
      const all = document.querySelectorAll('.jrgq-step');
      all.forEach(function (el) {
        if (el.classList.contains('active')) {
          el.classList.add('leaving');
          el.classList.remove('active');
          setTimeout(function () { el.classList.remove('leaving'); }, 300);
        }
      });

      const target = stepNum === 'result'
        ? document.getElementById('jrgq-result')
        : document.getElementById('jrgq-step-' + stepNum);

      if (!target) return;

      setTimeout(function () {
        target.classList.add('active');
        updateProgress(stepNum === 'result' ? totalSteps + 1 : stepNum);
        // Smooth scroll to quiz header
        const quizHeader = document.querySelector('.jrgq-quiz-header');
        if (quizHeader) {
          quizHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 60);
    }

    /* ── Handle option click ── */
    function handleOptionClick(btn) {
      const step = parseInt(btn.dataset.step);
      const key  = btn.dataset.key;
      const val  = btn.dataset.val;

      /* Deselect siblings */
      const siblings = document.querySelectorAll(
        '#jrgq-step-' + step + ' .jrgq-opt'
      );
      siblings.forEach(function (s) { s.classList.remove('selected'); });

      /* Select this */
      btn.classList.add('selected');
      quizAnswers[key] = val;

      /* Auto-advance after short delay */
      setTimeout(function () {
        if (step < totalSteps) {
          currentStep = step + 1;
          showStep(currentStep);
        } else {
          showResult();
        }
      }, 380);
    }

    /* Attach listeners to all option buttons */
    document.querySelectorAll('.jrgq-opt').forEach(function (btn) {
      btn.addEventListener('click', function () { handleOptionClick(this); });
    });

    /* ════════════════════════════════
       3. RESULT ENGINE
    ════════════════════════════════ */

    /* Calorie calculation (MET 12.3 for jump rope, 65kg baseline) */
    function calcCal(minutes) {
      const kg  = 65;
      const met = 12.3;
      return Math.round((met * 3.5 * kg / 200) * parseInt(minutes));
    }

    /* Jump target based on time */
    function calcJumps(minutes) {
      const perMin = { '5':350, '10':650, '20':1200, '30':1800 };
      return perMin[minutes] || 1000;
    }

    /* Monthly loss estimate (1 lb = 3500 cal, daily sessions) */
    function calcLoss(cal) {
      const monthly = cal * 30;
      return (monthly / 7700).toFixed(1); // kg
    }

    /* Profile label + title */
    const profiles = {
      beginner: {
        label: '🌱 Beginner Burner',
        title: 'Your journey starts NOW!',
        sub:   'Perfect. The Smart Jump Rope counts every rep so you never lose track — even at 50 jumps a day.',
      },
      casual: {
        label: '🔥 Casual Transformer',
        title: 'You\'re closer than you think.',
        sub:   'Women with your profile average −3.5 kg in their first 30 days. Your rope is waiting.',
      },
      active: {
        label: '⚡ Active Achiever',
        title: 'Level up your cardio game.',
        sub:   'Add jump rope to your routine and double your calorie burn per hour. No extra time needed.',
      },
      athlete: {
        label: '🏅 Elite Performer',
        title: 'Push your limits further.',
        sub:   'Your aerobic base will supercharge jump rope results. Expect 800+ cal/hr at peak intensity.',
      },
    };

    /* Plan list by goal */
    const planItems = {
      fat: [
        { icon: 'fas fa-check', text: 'Morning session (fasted) — maximum fat oxidation' },
        { icon: 'fas fa-check', text: 'Alternate speed intervals every 30 seconds' },
        { icon: 'fas fa-check', text: 'Track calories live on the digital display' },
        { icon: 'fas fa-check', text: 'Aim for 500+ jumps per session by Week 2' },
        { icon: 'fas fa-check', text: 'Weekly check-in — compare your counter numbers' },
      ],
      tone: [
        { icon: 'fas fa-check', text: 'Jump rope + 10 squats combo every 2 minutes' },
        { icon: 'fas fa-check', text: 'Steady rhythm for 5 min, sprint 30 sec, repeat' },
        { icon: 'fas fa-check', text: 'Focus on landing softly — core engagement key' },
        { icon: 'fas fa-check', text: 'Build to 1,000 continuous jumps by Week 3' },
        { icon: 'fas fa-check', text: 'Rest 1 day per week — let muscles recover & grow' },
      ],
      health: [
        { icon: 'fas fa-check', text: 'Start slow: 3 sets of 50 jumps, grow weekly' },
        { icon: 'fas fa-check', text: 'Jump at the same time each day — build the habit' },
        { icon: 'fas fa-check', text: 'Use the counter as a daily step goal substitute' },
        { icon: 'fas fa-check', text: 'Pair with 8 glasses of water — hydration amplifies results' },
        { icon: 'fas fa-check', text: 'Track your mood & energy after each session' },
      ],
    };

    /* Fix for typo in plan items */
    if (planItems.tone && planItems.tone[1]) {
      planItems.tone[1] = { icon: 'fas fa-check', text: 'Steady rhythm for 5 min, sprint 30 sec, repeat' };
    }

    /* Urgency stock number */
    function getStockNum() {
      const stored = sessionStorage.getItem('jrgq_stock');
      if (stored) return stored;
      const n = Math.floor(Math.random() * 6) + 5; // 5–10
      sessionStorage.setItem('jrgq_stock', n);
      return n;
    }

    /* Animated counter */
    function animateNum(el, target, suffix, duration) {
      let start = 0;
      const step = target / (duration / 16);
      const timer = setInterval(function () {
        start = Math.min(start + step, target);
        el.textContent = Math.floor(start).toLocaleString() + (suffix || '');
        if (start >= target) clearInterval(timer);
      }, 16);
    }

    /* Animated bar */
    function animateBar(el, pct, delay) {
      setTimeout(function () {
        el.style.transition = 'width 1.4s cubic-bezier(0.22,1,0.36,1)';
        el.style.width = pct + '%';
      }, delay || 300);
    }

    /* ── SHOW RESULT ── */
    function showResult() {
      const level = quizAnswers.level || 'active';
      const goal  = quizAnswers.goal  || 'fat';
      const time  = quizAnswers.time  || '20';

      const cal    = calcCal(time);
      const jumps  = calcJumps(time);
      const lossKg = calcLoss(cal);

      const profile = profiles[level];
      const plan    = planItems[goal] || planItems.fat;

      /* Inject profile badge + text */
      const badgeEl    = document.getElementById('jrgq-profile-badge');
      const titleEl    = document.getElementById('jrgq-result-title');
      const subtitleEl = document.getElementById('jrgq-result-subtitle');
      if (badgeEl)    badgeEl.textContent    = profile.label;
      if (titleEl)    titleEl.textContent    = profile.title;
      if (subtitleEl) subtitleEl.textContent = profile.sub;

      /* Inject stats (will animate) */
      const calEl   = document.getElementById('jrgq-res-cal');
      const jumpsEl = document.getElementById('jrgq-res-jumps');
      const lossEl  = document.getElementById('jrgq-res-loss');

      /* Inject plan list */
      const planListEl = document.getElementById('jrgq-plan-list');
      if (planListEl) {
        planListEl.innerHTML = '';
        plan.forEach(function (item) {
          const li = document.createElement('li');
          li.innerHTML = '<i class="' + item.icon + '"></i><span>' + item.text + '</span>';
          planListEl.appendChild(li);
        });
      }

      /* Stock count */
      const stockEl = document.getElementById('jrgq-stock-count');
      if (stockEl) stockEl.textContent = getStockNum();

      /* Show the result step */
      showStep('result');

      /* Trigger animations after DOM paint */
      setTimeout(function () {
        /* Count-up stats */
        if (calEl)   animateNum(calEl,   cal,   ' cal', 1400);
        if (jumpsEl) animateNum(jumpsEl, jumps, '',     1200);
        if (lossEl) {
          // Animate decimal
          lossEl.textContent = '0.0 kg';
          let v = 0;
          const target = parseFloat(lossKg);
          const steps  = 60;
          const inc    = target / steps;
          let   i      = 0;
          const t = setInterval(function () {
            v += inc;
            i++;
            lossEl.textContent = Math.min(v, target).toFixed(1) + ' kg';
            if (i >= steps) { lossEl.textContent = target + ' kg'; clearInterval(t); }
          }, 22);
        }

        /* Animate bars */
        const calBar   = document.getElementById('jrgq-res-cal-bar');
        const jumpsBar = document.getElementById('jrgq-res-jumps-bar');
        const lossBar  = document.getElementById('jrgq-res-loss-bar');
        const calPct   = Math.min(Math.round((cal / 450) * 100), 97);
        const jPct     = Math.min(Math.round((jumps / 2000) * 100), 97);
        const lPct     = Math.min(Math.round((parseFloat(lossKg) / 5) * 100), 97);
        if (calBar)   animateBar(calBar,   calPct, 400);
        if (jumpsBar) animateBar(jumpsBar, jPct,   600);
        if (lossBar)  animateBar(lossBar,  lPct,   800);

        /* Confetti burst */
        spawnConfetti();

      }, 180);
    }

    /* ════════════════════════════════
       4. CONFETTI
    ════════════════════════════════ */
    function spawnConfetti() {
      const wrap = document.getElementById('jrgq-confetti');
      if (!wrap) return;
      wrap.innerHTML = '';

      const colors = ['#c0385e','#f0c060','#7b3f6e','#e8607e','#22c55e','#f97316','#fff'];
      for (let i = 0; i < 55; i++) {
        const c   = document.createElement('div');
        c.className = 'jrgq-confetti-piece';
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left  = Math.random() * 100;
        const delay = Math.random() * 0.8;
        const dur   = Math.random() * 0.8 + 1.0;
        const size  = Math.random() * 8 + 5;
        const rot   = Math.random() * 360;
        c.style.cssText = [
          `background:${color}`,
          `left:${left}%`,
          `width:${size}px`,
          `height:${size * (Math.random() > 0.5 ? 1 : 0.4)}px`,
          `animation-delay:${delay}s`,
          `animation-duration:${dur}s`,
          `transform:rotate(${rot}deg)`,
          `border-radius:${Math.random() > 0.5 ? '50%' : '2px'}`,
        ].join(';');
        wrap.appendChild(c);
      }

      /* Clean up */
      setTimeout(function () { wrap.innerHTML = ''; }, 3000);
    }

    /* ════════════════════════════════
       5. RETAKE
    ════════════════════════════════ */
    if (retakeBtn) {
      retakeBtn.addEventListener('click', function () {
        /* Reset answers */
        Object.keys(quizAnswers).forEach(function (k) { delete quizAnswers[k]; });

        /* Deselect all options */
        document.querySelectorAll('.jrgq-opt').forEach(function (b) {
          b.classList.remove('selected');
        });

        currentStep = 1;
        showStep(1);
        updateProgress(1);
      });
    }

    /* ════════════════════════════════
       6. GALLERY — Intersection Observer
       Reveal gallery items on scroll
    ════════════════════════════════ */
    const galItems = document.querySelectorAll('.jrgq-gal-item');
    if ('IntersectionObserver' in window && galItems.length) {
      const galObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.style.opacity = '1';
            e.target.style.transform = 'translateY(0) scale(1)';
            galObs.unobserve(e.target);
          }
        });
      }, { threshold: 0.12 });

      galItems.forEach(function (item, idx) {
        item.style.opacity = '0';
        item.style.transform = 'translateY(30px) scale(0.95)';
        item.style.transition = 'opacity 0.65s ease ' + (idx * 0.08) + 's, transform 0.65s cubic-bezier(0.34,1.2,0.64,1) ' + (idx * 0.08) + 's';
        galObs.observe(item);
      });
    }

    /* ════════════════════════════════
       7. QUIZ — Intersection Observer
       Animate quiz in when scrolled to
    ════════════════════════════════ */
    const quizBlock = document.querySelector('.jrgq-quiz-block');
    if ('IntersectionObserver' in window && quizBlock) {
      const quizObs = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          quizBlock.style.opacity = '1';
          quizBlock.style.transform = 'translateY(0)';
          quizObs.disconnect();
        }
      }, { threshold: 0.10 });

      quizBlock.style.opacity = '0';
      quizBlock.style.transform = 'translateY(40px)';
      quizBlock.style.transition = 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.34,1.2,0.64,1)';
      quizObs.observe(quizBlock);
    }

    /* ════════════════════════════════
       8. GALLERY STATS STRIP — count-up
    ════════════════════════════════ */
    const statsStrip = document.querySelector('.jrgq-gallery-stats-strip');
    if ('IntersectionObserver' in window && statsStrip) {
      const stripObs = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          /* Animate the numbers once */
          const nums = statsStrip.querySelectorAll('.jrgq-gstat-num');
          const targets = [12400, 4.7, 4.2, 30];
          const suffixes = ['+', ' / 5', ' kg', ' days'];
          nums.forEach(function (el, i) {
            if (i === 1) {
              /* 4.7 decimal */
              let v = 0;
              const step = targets[i] / 60;
              const t = setInterval(function () {
                v = Math.min(v + step, targets[i]);
                el.textContent = v.toFixed(1) + suffixes[i];
                if (v >= targets[i]) { el.textContent = targets[i] + suffixes[i]; clearInterval(t); }
              }, 18);
            } else if (i === 2) {
              let v = 0;
              const step = targets[i] / 60;
              const t = setInterval(function () {
                v = Math.min(v + step, targets[i]);
                el.textContent = '−' + v.toFixed(1) + suffixes[i];
                if (v >= targets[i]) { el.textContent = '−' + targets[i] + suffixes[i]; clearInterval(t); }
              }, 18);
            } else {
              animateNum(el, targets[i], suffixes[i], 1400);
            }
          });
          stripObs.disconnect();
        }
      }, { threshold: 0.3 });
      stripObs.observe(statsStrip);
    }

    /* ════════════════════════════════
       9. URGENCY STOCK COUNTDOWN
       (subtle live ticking down)
    ════════════════════════════════ */
    const stockEl = document.getElementById('jrgq-stock-count');
    if (stockEl) {
      let stock = parseInt(getStockNum());
      /* Randomly drop by 1 every 2–5 min */
      function maybeDropStock() {
        if (stock > 3 && Math.random() > 0.5) {
          stock--;
          sessionStorage.setItem('jrgq_stock', stock);
          stockEl.textContent = stock;
          /* Flash animation */
          stockEl.style.color = '#f97316';
          setTimeout(function () { stockEl.style.color = ''; }, 600);
        }
        /* Schedule next check: 2–5 minutes */
        const next = (Math.random() * 180 + 120) * 1000;
        setTimeout(maybeDropStock, next);
      }
      setTimeout(maybeDropStock, (Math.random() * 120 + 60) * 1000);
    }

    /* ── Initial progress state ── */
    updateProgress(1);
  }

  /* ── Boot ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', jrgqInit);
  } else {
    jrgqInit();
  }

})();

