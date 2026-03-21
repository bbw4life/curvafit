document.addEventListener('DOMContentLoaded', () => {
  function upgradeShopifyImageUrl(url) {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('cdn.shopify.com')) return url; // securite : Shopify CDN seulement
    if (url.startsWith('data:') || url.includes('_master.')) return url;
    // Remplace uniquement si une variante de taille Shopify connue est presente
    return url.replace(
      /_(pico|icon|thumb|small|compact|medium|large|grande|original|1024x1024|2048x2048|\d+x\d+|\d+x|x\d+)(\.(?:jpg|jpeg|png|webp|gif))(\?|$)/gi,
      '_master$2$3'
    );
  }
 
  // ====================== IMAGES NETTES (ANTI-FLOU GLOBAL) ======================
  (function injectSharpImageStyles() {
    const style = document.createElement('style');
    style.id = 'sharp-images-style';
    style.textContent = `
      img,
      .main-image img,
      .thumbnail-item img,
      .mini-media-image,
      .product-card img,
      .wishlist-img,
      .cart-item img,
      .order-item-image,
      .paul-banner-image,
      .francenel-milliadaire-banner-image,
      .hero-slide,
      .paul-banner-slide img,
      .mini-media-slider img,
      .variant-preview img,
      .review-item img,
      .hero-thumb img,
      [class*="banner"] img,
      [class*="slider"] img,
      [class*="product"] img {
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
        -ms-interpolation-mode: nearest-neighbor;
        filter: none !important;
        -webkit-filter: none !important;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        transform: translateZ(0);
        -webkit-transform: translateZ(0);
        will-change: transform;
        max-width: 100%;
        height: auto;
      }
 
      img {
        image-rendering: auto;
        -webkit-font-smoothing: antialiased;
      }
 
      /* Supprime tout blur appliqué via filter ou backdrop-filter sur les images */
      img[style*="blur"],
      img[class*="blur"] {
        filter: none !important;
        -webkit-filter: none !important;
      }
 
      /* Force la qualité haute résolution sur les écrans Retina / HiDPI */
      @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
        img {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: auto;
        }
      }
    `;
    document.head.appendChild(style);
  })();
  // ====================== FIN IMAGES NETTES ======================
 
  let products = [];
 
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
 
  // ====================== GET PRODUCT URL ======================
  function getProductUrl(id) {
    if (!products || !Array.isArray(products) || products.length === 0) { console.warn("Products pas encore chargés → fallback shop.html"); return 'shop.html'; }
    const productIndex = products.findIndex(p => String(p.id) === String(id));
    if (productIndex === -1) { console.warn(`Produit ID ${id} non trouvé dans products.data.json`); return 'shop.html'; }
    const currentPath = window.location.pathname;
    const isInsideProductsFolder = currentPath.includes('/products/') || /product\d+\.html$/.test(currentPath);
    return isInsideProductsFolder ? `product${productIndex + 1}.html` : `products/product${productIndex + 1}.html`;
  }
 
  // ====================== PRODUCT MEDIA ======================
  function populateMainProductMedia(media) {
    const thumbsContainer = document.getElementById('product-thumbnails');
    const mainSlider = document.getElementById('main-image-slider');
    if (!thumbsContainer || !mainSlider) return;
    thumbsContainer.innerHTML = '';
    mainSlider.querySelectorAll('.main-image').forEach(el => el.remove());
    media.forEach((src, index) => {
      const thumb = document.createElement('div');
      thumb.className = `thumbnail-item ${index === 0 ? 'active' : ''}`;
      const sharpSrc = upgradeShopifyImageUrl(src);
      thumb.innerHTML = `<img src="${sharpSrc}" alt="Thumbnail ${index+1}" loading="lazy">`;
      thumb.addEventListener('click', () => changeMainImage(index));
      thumbsContainer.appendChild(thumb);
      const mainDiv = document.createElement('div');
      mainDiv.className = `main-image ${index === 0 ? 'active' : ''}`;
      mainDiv.dataset.originalSrc = sharpSrc;
      mainDiv.innerHTML = `<img src="${sharpSrc}" alt="Main Image" loading="lazy">`;
      mainSlider.insertBefore(mainDiv, mainSlider.querySelector('.slider-arrow.next'));
    });
    mainSlider.querySelector('.prev').onclick = () => changeMainImage('prev');
    mainSlider.querySelector('.next').onclick = () => changeMainImage('next');
  }
 
  let currentMainIndex = 0;
  function changeMainImage(dir) {
    const images = document.querySelectorAll('#main-image-slider .main-image');
    const thumbs = document.querySelectorAll('#product-thumbnails .thumbnail-item');
    if (!images.length) return;
    images[currentMainIndex].classList.remove('active');
    thumbs[currentMainIndex].classList.remove('active');
    if (dir === 'prev') currentMainIndex = (currentMainIndex - 1 + images.length) % images.length;
    else if (dir === 'next') currentMainIndex = (currentMainIndex + 1) % images.length;
    else currentMainIndex = dir;
    images[currentMainIndex].classList.add('active');
    thumbs[currentMainIndex].classList.add('active');
    const thumbsContainer = document.getElementById('product-thumbnails');
    const activeThumb = thumbs[currentMainIndex];
    const isHorizontal = thumbsContainer.scrollWidth > thumbsContainer.clientWidth;
    if (isHorizontal) {
      thumbsContainer.scrollTo({ left: activeThumb.offsetLeft - (thumbsContainer.clientWidth / 2) + (activeThumb.clientWidth / 2), behavior: 'smooth' });
    } else {
      thumbsContainer.scrollTo({ top: activeThumb.offsetTop - (thumbsContainer.clientHeight / 2) + (activeThumb.clientHeight / 2), behavior: 'smooth' });
    }
    const activeContainer = images[currentMainIndex];
    const activeImg = activeContainer.querySelector('img');
    if (activeImg && activeContainer.dataset.originalSrc) activeImg.src = activeContainer.dataset.originalSrc;
  }
 
  function populateMiniSlider(slider, media) {
    if (!slider || !media) return;
    slider.innerHTML = '';
    media.forEach((src, i) => {
      const img = document.createElement('img');
      img.src = upgradeShopifyImageUrl(src);
      img.className = `mini-media-image ${i === 0 ? 'active' : ''}`;
      img.loading = 'lazy';
      slider.appendChild(img);
    });
    const prev = document.createElement('div');
    prev.className = 'mini-media-slider-prev';
    const next = document.createElement('div');
    next.className = 'mini-media-slider-next';
    prev.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); slideMini(slider, 'prev'); });
    next.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); slideMini(slider, 'next'); });
    slider.appendChild(prev);
    slider.appendChild(next);
  }
 
  function slideMini(slider, direction) {
    const images = slider.querySelectorAll('.mini-media-image');
    if (!images.length) return;
    let active = slider.querySelector('.mini-media-image.active');
    let index = Array.from(images).indexOf(active);
    images[index].classList.remove('active');
    if (direction === 'prev') index = (index - 1 + images.length) % images.length;
    else index = (index + 1) % images.length;
    images[index].classList.add('active');
  }
 
  // ====================== FETCH PRODUCTS ======================
  fetch('/products.data.json')
    .then(response => response.json())
    .then(data => {
      products = data;
      window.__allProducts = data; // expose globalement pour order history click
      const settings = products.find(p => p.type === "settings") || {};
      const enableMediaZoom = (settings.enable_media_zoom || "no").toLowerCase() === "yes";
 
      // ====================== NOUVEAU : SOCIAL LINKS ======================
      const socialLinks = settings.social_links || {};
      const socialMap = {
        'fa-facebook-f':  socialLinks.facebook,
        'fa-instagram':   socialLinks.instagram,
        'fa-tiktok':      socialLinks.tiktok,
        'fa-pinterest-p': socialLinks.pinterest,
        'fa-youtube':     socialLinks.youtube,
        'fa-whatsapp':    socialLinks.whatsapp,
        'fa-x-twitter':   socialLinks.twitter
      };
      document.querySelectorAll('.footer-social a').forEach(a => {
  const icon = a.querySelector('i');
  if (!icon) return;
  for (const [cls, url] of Object.entries(socialMap)) {
    if (url && icon.classList.contains(cls)) {
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      break;
    }
  }
});

// ====================== PROGRAM PRICES ======================
const programs = settings.programs || {};
const programMap = {
  beginner:     programs.beginner    || { price: 99,  label: 'Start Soft Start' },
  intermediate: programs.intermediate|| { price: 149, label: 'Start Deeper Refiner' },
  maintenance:  programs.maintenance || { price: 79,  label: 'Start Forever Fit' }
};

// Prix dans les cartes programs
document.querySelectorAll('.program-card').forEach(card => {
  const tier = card.id.replace('program-', ''); // "beginner", "intermediate", "maintenance"
  const prog = programMap[tier];
  if (!prog) return;

  const priceEl = card.querySelector('.prog-price');
  if (priceEl) priceEl.textContent = `$${prog.price}`;

  const ctaEl = card.querySelector('.prog-cta');
  if (ctaEl) ctaEl.textContent = `${prog.label} →`;
});


// Prix dans le tableau comparatif
const priceRow = document.querySelector('.comparison-table-section .price-row');
if (priceRow) {
  const cells = priceRow.querySelectorAll('td');
  if (cells[1]) cells[1].textContent = `$${programMap.beginner.price}`;
  if (cells[2]) cells[2].textContent = `$${programMap.intermediate.price}`;
  if (cells[3]) cells[3].textContent = `$${programMap.maintenance.price}`;
}

// Prix dans le final CTA
const finalBtns = document.querySelectorAll('.final-cta-btn');
finalBtns.forEach(btn => {
  if (btn.classList.contains('final-cta-btn--beginner'))
    btn.textContent = `🌱 Start Beginner — $${programMap.beginner.price}`;
  else if (btn.classList.contains('final-cta-btn--featured'))
    btn.textContent = `🔥 Start Intermediate — $${programMap.intermediate.price}`;
  else if (btn.classList.contains('final-cta-btn--maintenance'))
    btn.textContent = `🌟 Start Maintenance — $${programMap.maintenance.price}`;
});

// ====================== SOCIAL CHANNELS SECTION ======================
const iconClassMap = {
  'fa-instagram':   socialLinks.instagram,
  'fa-facebook-f':  socialLinks.facebook,
  'fa-tiktok':      socialLinks.tiktok,
  'fa-whatsapp':    socialLinks.whatsapp,
  'fa-youtube':     socialLinks.youtube,
  'fa-pinterest-p': socialLinks.pinterest,
  'fa-x-twitter':   socialLinks.twitter
};

document.querySelectorAll('.social-channel-card').forEach(card => {
  const icon = card.querySelector('i');
  if (!icon) return;
  for (const [cls, url] of Object.entries(iconClassMap)) {
    if (url && icon.classList.contains(cls)) {
      card.href = url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      break;
    }
  }
});

// Fallback : si les icônes sont directement sur le <a> (pas dans un <i>)
document.querySelectorAll('.footer-social a').forEach(a => {
  if (a.href && a.href !== window.location.href && a.href !== '#') return;
  for (const [cls, url] of Object.entries(socialMap)) {
    if (url && a.classList.contains(cls)) {
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      break;
    }
  }
});
      // ====================== FIN SOCIAL LINKS ======================
 
      // Comparison table
      const comparisonTable = document.querySelector('.comparison-table tbody');
      if (comparisonTable) {
        const rows = comparisonTable.querySelectorAll('tr');
        rows.forEach((row, index) => {
          const product = products[index];
          if (product) {
            const titleCell = row.querySelector('td:nth-child(1)');
            if (titleCell) titleCell.textContent = product.title;
            const priceCell = row.querySelector('td:nth-child(2)');
            if (priceCell) priceCell.textContent = `$${product.price.toFixed(2)}`;
          }
        });
      }
 
      // ====================== PRODUCT CARDS ======================
      document.querySelectorAll('.product-card').forEach(card => {
        const id = card.dataset.id;
        const product = products.find(p => p.id === id);
        if (product) {
          card.querySelector('h3').textContent = product.title;
          card.querySelector('.current-price').textContent = `$${product.price.toFixed(2)}`;
          card.querySelector('.compare-price').textContent = `$${product.compare_price.toFixed(2)}`;
          card.querySelector('p').textContent = product.description;
          const img = card.querySelector('img');
          if (img) { img.src = upgradeShopifyImageUrl(product.image); img.alt = product.title; }
          card.dataset.title = product.title;
          card.dataset.price = product.price;
          card.dataset.comparePrice = product.compare_price;
          const badge = card.querySelector('.discount-badge');
          if (product.compare_price > product.price) {
            const discountPercent = Math.round(((product.compare_price - product.price) / product.compare_price) * 100);
            badge.textContent = `-${discountPercent}%`;
            badge.classList.add('active');
          }
        }
      });
 
      // Mini product slider
      document.querySelectorAll('#mini-product-slider .product-item').forEach(item => {
        const id = item.querySelector('.mini-wishlist-icon')?.dataset.id;
        const product = products.find(p => p.id === id);
        if (product) {
          const currentPriceEl = item.querySelector('.current-price');
          const comparePriceEl = item.querySelector('.compare-price');
          const discountBadge = item.querySelector('.mini-discount-badge');
          if (currentPriceEl) currentPriceEl.textContent = `$${product.price.toFixed(2)}`;
          if (comparePriceEl) comparePriceEl.textContent = `$${product.compare_price.toFixed(2)}`;
          if (discountBadge && product.compare_price > product.price) {
            const discountPercent = Math.round(((product.compare_price - product.price) / product.compare_price) * 100);
            discountBadge.textContent = `${discountPercent}% OFF`;
            discountBadge.style.display = 'block';
          } else if (discountBadge) {
            discountBadge.style.display = 'none';
          }
        }
      });
 
      // ====================== PAGE PRODUIT ======================
      const productSection = document.querySelector('.product-section');
      if (productSection) {
        const pid = productSection.dataset.productId;
        window.currentProductId = pid;
        console.log("✅ Product ID chargé pour les reviews :", window.currentProductId);
        if (typeof loadDynamicReviews === 'function') loadDynamicReviews();
        const prod = products.find(p => p.id === pid);
 
        // ====================== RATING & REVIEWS COUNT ======================
        if (prod) {
          const rating = prod.rating || 4.8;
          const reviewsCount = prod.reviews_count || 0;
 
          const ratingEl = document.querySelector('.unique-stars');
          const ratingTextEl = document.querySelector('.unique-rating-text');
          const reviewsCountEl = document.querySelector('.unique-reviews');
 
          if (ratingEl) {
            ratingEl.dataset.rating = rating;
            ratingEl.innerHTML = '';
            for (let i = 0; i < 5; i++) {
              const star = document.createElement('span');
              star.classList.add('unique-star');
              if (i + 1 <= Math.floor(rating)) {
                star.classList.add('full');
              } else if (i < rating && i + 1 > rating) {
                star.classList.add('half');
              }
              ratingEl.appendChild(star);
            }
          }
          if (ratingTextEl) ratingTextEl.textContent = rating.toFixed(1) + ' / 5';
          if (reviewsCountEl) reviewsCountEl.textContent = reviewsCount + ' reviews';
 
          const scrollToReviews = () => {
            const reviewsSection = document.getElementById('reviews-section');
            if (reviewsSection) reviewsSection.scrollIntoView({ behavior: 'smooth' });
          };
          if (ratingEl) ratingEl.style.cursor = 'pointer';
          if (ratingEl) ratingEl.addEventListener('click', scrollToReviews);
          if (ratingTextEl) ratingTextEl.style.cursor = 'pointer';
          if (ratingTextEl) ratingTextEl.addEventListener('click', scrollToReviews);
          if (reviewsCountEl) reviewsCountEl.style.cursor = 'pointer';
          if (reviewsCountEl) reviewsCountEl.addEventListener('click', scrollToReviews);
        }
        // ====================== FIN RATING & REVIEWS COUNT ======================
 
        if (prod && prod.media) {
          populateMainProductMedia(prod.media);
          const colorContainer = document.querySelector('.color-swatches');
          if (colorContainer && prod.colors && prod.colors.length) {
            colorContainer.innerHTML = '';
            prod.colors.forEach((color) => {
              const swatch = document.createElement('div');
              swatch.className = 'swatch';
              swatch.style.backgroundColor = color.hex;
              swatch.dataset.color = color.name;
              swatch.addEventListener('click', () => {
                colorContainer.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                updateProductPrice();
              });
              colorContainer.appendChild(swatch);
            });
            colorContainer.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
          } else if (colorContainer) {
            colorContainer.style.display = 'none';
          }
 
          const sizeSelect = document.getElementById('size-select');
          if (sizeSelect && prod.sizes && prod.sizes.length > 0) {
            sizeSelect.innerHTML = '';
            const defaultOpt = document.createElement('option');
            defaultOpt.value = ""; defaultOpt.textContent = "Select Size";
            sizeSelect.appendChild(defaultOpt);
            prod.sizes.forEach(size => {
              const opt = document.createElement('option');
              opt.value = size; opt.textContent = size;
              sizeSelect.appendChild(opt);
            });
          } else if (sizeSelect) {
            sizeSelect.style.display = 'none';
            const sizeLabel = document.querySelector('label[for="size-select"]');
            if (sizeLabel) sizeLabel.style.display = 'none';
          }
 
          function getVariantPrice(product, color, size) {
            if (!color || !size) return product.price;
            const variant = product.variants.find(v => v.color === color && v.size === size);
            return variant ? variant.price : product.price;
          }
          function getVariantComparePrice(product, color, size) {
            const varPrice = getVariantPrice(product, color, size);
            const ratio = product.compare_price / product.price;
            return varPrice * ratio;
          }
          function updateProductPrice() {
            const activeSwatch = document.querySelector('.swatch.active');
            let selectedColor = activeSwatch ? activeSwatch.dataset.color : null;
            let selectedSize = sizeSelect ? sizeSelect.value : null;
            if (selectedSize === "") selectedSize = null;
            const currentPrice = getVariantPrice(prod, selectedColor, selectedSize);
            const currentCompare = getVariantComparePrice(prod, selectedColor, selectedSize);
            const currentPriceEl = document.querySelector('.current-price');
            if (currentPriceEl) currentPriceEl.textContent = `$${currentPrice.toFixed(2)}`;
            const comparePriceEl = document.querySelector('.compare-price');
            if (comparePriceEl) comparePriceEl.textContent = `$${currentCompare.toFixed(2)}`;
            const badge = document.querySelector('.discount-badge');
            if (badge) {
              if (currentCompare > currentPrice) {
                const discountPercent = Math.round(((currentCompare - currentPrice) / currentCompare) * 100);
                badge.textContent = `-${discountPercent}%`;
                badge.classList.add('active');
              } else {
                badge.classList.remove('active');
              }
            }
            if (selectedColor) {
              const colorObj = prod.colors.find(c => c.name === selectedColor);
              if (colorObj && colorObj.image) {
                const mainImg = document.querySelector('#main-image-slider .main-image.active img');
                if (mainImg) mainImg.src = colorObj.image;
              }
            }
          }
          if (sizeSelect) sizeSelect.addEventListener('change', updateProductPrice);
          updateProductPrice();
        }
 
        // Media zoom
        if (enableMediaZoom) {
          const mainSlider = document.getElementById('main-image-slider');
          const mainImages = mainSlider ? mainSlider.querySelectorAll('.main-image') : [];
          const modal = document.getElementById('media-zoom-modal');
          const modalImg = document.getElementById('modal-zoom-image');
          const modalContainer = document.querySelector('.modal-zoom-container');
          const closeBtn = modal ? modal.querySelector('.modal-close') : null;
          const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
          let scale = 1, translateX = 0, translateY = 0, isDraggingZoom = false;
          let lastTouchX = 0, lastTouchY = 0, maxTranslateX = 0, maxTranslateY = 0;
          function updateTransform(smooth = true) {
            modalImg.style.transition = smooth ? 'transform 0.25s ease' : 'none';
            modalImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
          }
          function calculateBounds() {
            if (!modalImg.naturalWidth || !modalContainer) return;
            const contW = modalContainer.clientWidth, contH = modalContainer.clientHeight;
            const fitScale = Math.min(contW / modalImg.naturalWidth, contH / modalImg.naturalHeight);
            maxTranslateX = Math.max(0, (modalImg.naturalWidth * fitScale * scale - contW) / 2);
            maxTranslateY = Math.max(0, (modalImg.naturalHeight * fitScale * scale - contH) / 2);
          }
          function clampTranslate() {
            translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX));
            translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY));
          }
          mainImages.forEach(container => {
            const img = container.querySelector('img');
            if (!img) return;
            if (!isTouchDevice) {
              container.addEventListener('mousemove', (e) => {
                const rect = container.getBoundingClientRect();
                img.style.transformOrigin = `${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`;
              });
              container.addEventListener('mouseleave', () => { img.style.transformOrigin = 'center center'; });
            }
            if (isTouchDevice) {
              container.style.cursor = 'pointer';
              container.addEventListener('click', (e) => {
                e.stopImmediatePropagation();
                modalImg.src = img.src;
                modal.classList.add('active');
                scale = 1; translateX = 0; translateY = 0;
                updateTransform(false);
                if (modalImg.complete) calculateBounds();
                else modalImg.onload = calculateBounds;
              });
            }
          });
          if (closeBtn && modal) {
            const closeModal = () => {
              modal.classList.remove('active');
              scale = 1; translateX = 0; translateY = 0;
              modalImg.style.transform = '';
            };
            closeBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
            modalImg.addEventListener('click', () => {
              if (scale > 1) { scale = 1; translateX = 0; translateY = 0; }
              else { scale = 2.5; }
              calculateBounds(); clampTranslate(); updateTransform(true);
            });
            modalImg.addEventListener('touchstart', (e) => {
              if (e.touches.length > 1 || scale <= 1) return;
              isDraggingZoom = true;
              lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY;
              modalImg.style.transition = 'none';
              e.preventDefault();
            });
            modalImg.addEventListener('touchmove', (e) => {
              if (!isDraggingZoom || e.touches.length > 1) return;
              translateX += e.touches[0].clientX - lastTouchX;
              translateY += e.touches[0].clientY - lastTouchY;
              lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY;
              clampTranslate(); updateTransform(false);
              e.preventDefault();
            });
            modalImg.addEventListener('touchend', () => { isDraggingZoom = false; });
          }
        }
 
        // Delivery dates
        if (prod) {
          const baseStartStr = prod.start_date, baseEndStr = prod.end_date;
          if (!baseStartStr || !baseEndStr) { showTextDelivery(); return; }
          const baseStart = new Date(baseStartStr + "T00:00:00");
          const baseEnd   = new Date(baseEndStr   + "T00:00:00");
          if (isNaN(baseStart.getTime()) || isNaN(baseEnd.getTime())) { showTextDelivery(); return; }
          const today = new Date(); today.setHours(0,0,0,0);
          const cycleDays = Math.max(1, Math.ceil((baseStart - today) / 86400000)) + Math.max(1, Math.ceil((baseEnd - baseStart) / 86400000));
          let currentStart = new Date(baseStart), currentEnd = new Date(baseEnd);
          while (currentEnd < today) {
            currentStart.setDate(currentStart.getDate() + cycleDays);
            currentEnd.setDate(currentEnd.getDate() + cycleDays);
          }
          if (currentEnd <= today) {
            currentStart.setDate(currentStart.getDate() + cycleDays);
            currentEnd.setDate(currentEnd.getDate() + cycleDays);
          }
          function formatDate(date) {
            return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getFullYear()).slice(-2)}`;
          }
          const startEl = document.getElementById("start-date"), endEl = document.getElementById("end-date");
          if (startEl && endEl) { startEl.innerText = formatDate(currentStart); endEl.innerText = formatDate(currentEnd); }
          showTextDelivery();
          function showTextDelivery() {
            const textEl = document.getElementById("delivery-text");
            if (textEl) textEl.style.visibility = "visible";
          }
        }
      }
 
      // Mini media sliders
      document.querySelectorAll('.mini-media-slider').forEach(slider => {
        const item = slider.closest('.product-item');
        if (item) {
          const pid = item.dataset.productId;
          const prod = products.find(p => p.id === pid);
          if (prod && prod.media) populateMiniSlider(slider, prod.media);
        }
      });
 
      // Bundle
      const bundleContainer = document.querySelector('.bundle-save-container');
      if (bundleContainer) {
        const productSection = document.querySelector('.product-section');
        const productId = productSection.dataset.productId;
        const product = products.find(p => p.id === productId);
        if (product) {
          function getVariantPrice(product, color, size) {
            if (!color || !size) return product.price;
            const variant = product.variants.find(v => v.color === color && v.size === size);
            return variant ? variant.price : product.price;
          }
          function getVariantComparePrice(product, color, size) {
            return getVariantPrice(product, color, size) * (product.compare_price / product.price);
          }
          const hasSizes = product.sizes && product.sizes.length > 0;
          const hasColors = product.colors && product.colors.length > 0;
          const uniqueSizes = hasSizes ? product.sizes : [];
          const uniqueColors = hasColors ? product.colors.map(c => c.name) : [];
 
          function createSelect(options, labelText, placeholder = "Select...") {
            if (!options || options.length === 0) return null;
            const wrapper = document.createElement("div");
            const label = document.createElement("label"); label.textContent = labelText;
            wrapper.appendChild(label);
            const select = document.createElement("select"); select.required = true;
            const defaultOption = document.createElement("option"); defaultOption.value = ""; defaultOption.textContent = placeholder;
            select.appendChild(defaultOption);
            options.forEach(value => {
              const opt = document.createElement('option'); opt.value = value; opt.textContent = value;
              select.appendChild(opt);
            });
            wrapper.appendChild(select);
            return wrapper;
          }
 
          function populateSelectors(container) {
            if (container.dataset.populated) return;
            container.dataset.populated = "true";
            container.querySelectorAll(".variant-selectors").forEach(div => {
              div.innerHTML = "";
              if (hasColors) {
                const colorSelect = createSelect(uniqueColors, "Color");
                if (colorSelect) {
                  div.appendChild(colorSelect);
                  colorSelect.querySelector('select').addEventListener('change', (e) => {
                    const colorObj = product.colors.find(c => c.name === e.target.value);
                    if (colorObj) {
                      const previewImg = div.closest('.variant-row').querySelector('.variant-preview img');
                      if (previewImg) previewImg.src = colorObj.image;
                    }
                    calculateBundlePrice(container.closest('.bundle-option').dataset.bundle);
                  });
                }
              }
              if (hasSizes) {
                const sizeSelect = createSelect(uniqueSizes, "Size");
                if (sizeSelect) {
                  div.appendChild(sizeSelect);
                  sizeSelect.querySelector('select').addEventListener('change', () => {
                    calculateBundlePrice(container.closest('.bundle-option').dataset.bundle);
                  });
                }
              }
              if (!hasColors && !hasSizes) div.innerHTML = '<p style="color:#555;font-size:13px;margin:8px 0;">No options available</p>';
            });
            container.querySelectorAll('.variant-preview img').forEach(img => { img.src = product.image; });
          }
 
          function getSelectedValues(selectorsContainer) {
            const values = {};
            selectorsContainer.querySelectorAll("select").forEach(select => {
              const label = select.parentElement.querySelector("label")?.textContent.toLowerCase() || "";
              if (select.value !== "") {
                if (label.includes("color")) values.color = select.value;
                else if (label.includes("size")) values.size = select.value;
              }
            });
            return values;
          }
 
          function calculateBundlePrice(type) {
            const option = document.querySelector(`.bundle-option[data-bundle="${type}"]`);
            if (!option) return;
            let totalPrice = 0, totalCompare = 0;
            const ratio = product.compare_price / product.price;
            const discount = (type === "single" ? (product.single_discount||0) : type === "duo" ? (product.duo_discount||0) : (product.trio_discount||0)) / 100;
            option.querySelectorAll(".variant-selectors").forEach(sel => {
              const { color = null, size = null } = getSelectedValues(sel);
              const varPrice = getVariantPrice(product, color, size);
              totalPrice += varPrice; totalCompare += varPrice * ratio;
            });
            const priceEl = document.getElementById(`${type}-price`);
            if (priceEl) priceEl.textContent = `$${(totalPrice * (1 - discount)).toFixed(2)}`;
            const originalEl = document.getElementById(`${type}-original-price`);
            if (originalEl) originalEl.textContent = `$${(totalCompare * (1 - discount)).toFixed(2)}`;
          }
 
          function updateBundlePrices(product) {
            const dSingle = (product.single_discount||0)/100, dDuo = (product.duo_discount||0)/100, dTrio = (product.trio_discount||0)/100;
            const ratio = product.compare_price / product.price;
            document.getElementById("single-price").textContent = `$${(product.price*(1-dSingle)).toFixed(2)}`;
            document.getElementById("single-original-price").textContent = `$${(product.price*ratio*(1-dSingle)).toFixed(2)}`;
            document.getElementById("duo-price").textContent = `$${(product.price*2*(1-dDuo)).toFixed(2)}`;
            document.getElementById("duo-original-price").textContent = `$${(product.price*ratio*2*(1-dDuo)).toFixed(2)}`;
            document.getElementById("trio-price").textContent = `$${(product.price*3*(1-dTrio)).toFixed(2)}`;
            document.getElementById("trio-original-price").textContent = `$${(product.price*ratio*3*(1-dTrio)).toFixed(2)}`;
          }
 
          function addBundleToCart(items) {
            items.forEach(item => {
              let cartItem = cart.find(i => i.id === item.id && i.size === item.size && i.color === item.color);
              if (cartItem) cartItem.quantity += item.quantity;
              else cart.push(item);
            });
            saveCart(); updateCartQuantityInSheet(); updateBadges(); renderCart(); checkout();
          }
 
          document.querySelectorAll('.bundle-option label').forEach(label => { label.addEventListener('click', e => e.preventDefault()); });
 
          document.querySelectorAll(".bundle-option").forEach(option => {
            option.addEventListener("click", function(e) {
              if (e.target.closest(".bundle-selection")) return;
              const radio = this.querySelector("input[type='radio']");
              const wasChecked = radio.checked;
              document.querySelectorAll(".bundle-option").forEach(el => {
                el.classList.remove("active");
                const sel = el.querySelector(".bundle-selection");
                if (sel) sel.style.display = "none";
                el.querySelector("input[type='radio']").checked = false;
              });
              if (!wasChecked) {
                radio.checked = true; this.classList.add("active");
                const selection = this.querySelector(".bundle-selection");
                if (selection) { selection.style.display = "block"; populateSelectors(selection); calculateBundlePrice(this.dataset.bundle); }
              }
            });
          });
 
          document.querySelectorAll(".bundle-add-btn").forEach(btn => {
            btn.addEventListener("click", function() {
              const container = this.closest(".bundle-selection");
              const type = container.closest(".bundle-option").dataset.bundle;
              const items = [];
              let itemImage = product.image;
              const discount = (type === "single" ? (product.single_discount||0) : type === "duo" ? (product.duo_discount||0) : (product.trio_discount||0)) / 100;
              const ratio = product.compare_price / product.price;
              if (type === "single") {
                if (!hasColors && !hasSizes) {
                  const variant = product.variants ? product.variants[0] : null;
                  items.push({ id: product.id, title: product.title, price: product.price*(1-discount), compare_price: product.price*ratio, image: itemImage, size: null, color: null, quantity: 1, fromBundle: true, cj_product_id: product.cj_id, cj_variant_id: variant ? variant.vid : null });
                } else {
                  const { color: selectedColor = null, size: selectedSize = null } = getSelectedValues(container);
                  if ((hasColors && !selectedColor) || (hasSizes && !selectedSize)) { showErrorPopup("Please complete your selection."); return; }
                  if (selectedColor) { const colorObj = product.colors.find(c => c.name === selectedColor); if (colorObj) itemImage = colorObj.image; }
                  const varPrice = getVariantPrice(product, selectedColor, selectedSize);
                  const variant = product.variants.find(v => v.color === selectedColor && v.size === selectedSize);
                  items.push({ id: product.id, title: product.title, price: varPrice*(1-discount), compare_price: varPrice*ratio, image: itemImage, size: selectedSize, color: selectedColor, quantity: 1, fromBundle: true, cj_product_id: product.cj_id, cj_variant_id: variant ? variant.vid : null });
                }
              } else {
                const count = type === "duo" ? 2 : 3;
                let valid = true;
                for (let i = 1; i <= count; i++) {
                  const pair = container.querySelector(`.variant-pair[data-index="${i}"]`);
                  if (!pair) continue;
                  let pairImage = product.image;
                  if (!hasColors && !hasSizes) {
                    const variant = product.variants ? product.variants[0] : null;
                    items.push({ id: product.id, title: product.title, price: product.price*(1-discount), compare_price: product.price*ratio, image: pairImage, size: null, color: null, quantity: 1, fromBundle: true, cj_product_id: product.cj_id, cj_variant_id: variant ? variant.vid : null });
                    continue;
                  }
                  const { color: selectedColor = null, size: selectedSize = null } = getSelectedValues(pair);
                  if ((hasColors && !selectedColor) || (hasSizes && !selectedSize)) { valid = false; showErrorPopup(`Item ${i}: Please complete selection.`); break; }
                  if (selectedColor) { const colorObj = product.colors.find(c => c.name === selectedColor); if (colorObj) pairImage = colorObj.image; }
                  const varPrice = getVariantPrice(product, selectedColor, selectedSize);
                  const variant = product.variants.find(v => v.color === selectedColor && v.size === selectedSize);
                  items.push({ id: product.id, title: product.title, price: varPrice*(1-discount), compare_price: varPrice*ratio, image: pairImage, size: selectedSize, color: selectedColor, quantity: 1, fromBundle: true, cj_product_id: product.cj_id, cj_variant_id: variant ? variant.vid : null });
                }
                if (!valid) return;
              }
              if (items.length > 0) addBundleToCart(items);
            });
          });
 
          updateBundlePrices(product);
          const singleDesc = document.querySelector('.single-description');
          const duoDesc = document.querySelector('.duo-description');
          const trioDesc = document.querySelector('.trio-description');
          if (singleDesc) singleDesc.textContent = product.single_discount > 0 ? `Save ${product.single_discount}%` : 'Standard Price';
          if (duoDesc) duoDesc.textContent = `Save ${product.duo_discount || 0}%`;
          if (trioDesc) trioDesc.textContent = `Save ${product.trio_discount || 0}%`;
        }
      }
 
      setTimeout(() => {
        document.querySelectorAll('.color-swatches .swatch').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('#main-image-slider .main-image').forEach(container => {
          const img = container.querySelector('img');
          if (img && container.dataset.originalSrc) img.src = container.dataset.originalSrc;
        });
        if (typeof updateProductPrice === 'function') updateProductPrice();
      }, 300);
 
      window.getProductUrl = getProductUrl;
    })
    .catch(error => console.error('Erreur de chargement des produits:', error));
 
  // ====================== SCROLL REVEAL ======================
  document.querySelectorAll('section').forEach(sec => { if (!sec.hasAttribute('data-scroll-reveal')) sec.setAttribute('data-scroll-reveal', ''); });
 
  // ====================== HAMBURGER ======================
  const hamburger = document.querySelector('.hamburger-menu');
  const nav = document.querySelector('.main-nav');
  if (hamburger && nav) {
  hamburger.addEventListener('click', () => {
    nav.classList.toggle('active');
    const isOpen = nav.classList.contains('active');
    const icon = hamburger.querySelector('i');
    if (icon) {
      icon.classList.toggle('fi-rr-menu-burger', !isOpen);
      icon.classList.toggle('fi-rr-cross', isOpen);
    }
  });

  // Fermer en cliquant ailleurs sur mobile
  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !nav.contains(e.target)) {
      nav.classList.remove('active');
      const icon = hamburger.querySelector('i');
      if (icon) {
        icon.classList.add('fi-rr-menu-burger');
        icon.classList.remove('fi-rr-cross');
      }
    }
  });
}
 
  // ====================== SEARCH ======================
  const searchIcon = document.querySelector('.search-icon');
  const searchBar = document.querySelector('.search-bar');
  const searchInput = searchBar?.querySelector('input');
  const submitSearch = searchBar?.querySelector('.submit-search');
  const headerContainer = document.querySelector('.header-container');
  if (searchIcon && searchBar) {
    searchIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      searchBar.classList.toggle('active');
      headerContainer.classList.toggle('search-active');
      if (searchBar.classList.contains('active')) searchInput.focus(); else searchInput.blur();
    });
    document.addEventListener('click', (e) => {
      if (!searchBar.contains(e.target) && !searchIcon.contains(e.target)) {
        searchBar.classList.remove('active'); headerContainer.classList.remove('search-active');
      }
    });
    submitSearch.addEventListener('click', () => { const query = searchInput.value; if (query) showErrorPopup(`Searching for: ${query}`); });
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { const query = searchInput.value; if (query) showErrorPopup(`Searching for: ${query}`); } });
  }
 
  // ====================== SMOOTH SCROLL ======================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
 
  // ====================== PARALLAX ======================
  const parallaxes = document.querySelectorAll('.parallax-background');
  window.addEventListener('scroll', () => {
    const scrollPosition = window.pageYOffset;
    parallaxes.forEach(parallax => { parallax.style.transform = `translateY(${scrollPosition * 0.5}px)`; });
  });
 
  // ====================== SCROLL REVEAL ======================
  const revealElements = document.querySelectorAll('[data-scroll-reveal]');
  const revealOnScroll = () => {
    const windowHeight = window.innerHeight;
    revealElements.forEach(el => { if (el.getBoundingClientRect().top < windowHeight - 100) el.classList.add('revealed'); });
  };
  window.addEventListener('scroll', revealOnScroll);
  revealOnScroll();
 
  // ====================== COUNTERS ======================
  document.querySelectorAll('.counter').forEach(counter => {
    const updateCount = () => {
      const target = +counter.getAttribute('data-target'), count = +counter.innerText, increment = target / 200;
      if (count < target) { counter.innerText = Math.ceil(count + increment); setTimeout(updateCount, 10); }
      else counter.innerText = target;
    };
    new IntersectionObserver(entries => { if (entries[0].isIntersecting) updateCount(); }).observe(counter);
  });
 
  // ====================== TESTIMONIAL CAROUSEL ======================
  const carousel = document.querySelector('.testimonial-carousel');
  if (carousel) {
    let carouselSlides = Array.from(carousel.children);
    const gap = parseInt(getComputedStyle(carousel).gap) || 0;
    let slideWidth = carouselSlides[0].offsetWidth + gap, carouselIndex = 0;
    carousel.appendChild(carouselSlides[0].cloneNode(true));
    carousel.prepend(carouselSlides[carouselSlides.length - 1].cloneNode(true));
    carouselSlides = Array.from(carousel.children);
    carousel.style.transform = `translateX(-${slideWidth}px)`;
    const moveCarousel = () => {
      carouselIndex++;
      carousel.style.transition = 'transform 0.5s ease';
      carousel.style.transform = `translateX(-${(carouselIndex + 1) * slideWidth}px)`;
    };
    carousel.addEventListener('transitionend', () => {
      if (carouselIndex >= carouselSlides.length - 2) {
        carouselIndex = 0; carousel.style.transition = 'none';
        carousel.style.transform = `translateX(-${slideWidth}px)`;
      }
    });
    window.addEventListener('resize', () => {
      slideWidth = carousel.querySelector('.testimonial').offsetWidth + gap;
      carousel.style.transition = 'none';
      carousel.style.transform = `translateX(-${(carouselIndex + 1) * slideWidth}px)`;
    });
    setInterval(moveCarousel, 3000);
  }
 
  // ====================== AUDIO PLAYER ======================
  const audioPlayer = document.getElementById('audio-player');
  const audio = document.getElementById('audio-element');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  const playPauseBtn = document.getElementById('play-pause-btn');
  if (playPauseBtn && audio) {
    playPauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (audio.paused) { audio.play(); playIcon.style.display = 'none'; pauseIcon.style.display = 'block'; }
      else { audio.pause(); playIcon.style.display = 'block'; pauseIcon.style.display = 'none'; }
    });
  }
  if (audioPlayer) {
    let isDraggingAudio = false, offsetAudioX, offsetAudioY;
    const startDrag = (e) => {
      isDraggingAudio = true;
      const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
      offsetAudioX = clientX - audioPlayer.getBoundingClientRect().left;
      offsetAudioY = clientY - audioPlayer.getBoundingClientRect().top;
      audioPlayer.style.cursor = 'grabbing';
    };
    const moveDrag = (e) => {
      if (!isDraggingAudio) return;
      const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
      audioPlayer.style.left = `${clientX - offsetAudioX}px`;
      audioPlayer.style.bottom = 'auto';
      audioPlayer.style.top = `${clientY - offsetAudioY}px`;
    };
    const endDrag = () => { isDraggingAudio = false; audioPlayer.style.cursor = 'move'; };
    audioPlayer.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', endDrag);
    audioPlayer.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', moveDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
  }
 
  // ====================== PROGRESS TABS ======================
  const tabButtons = document.querySelectorAll('.tab-button');
  const evolutionContent = document.querySelector('#evolution-content');
  const progressDescription = document.querySelector('#progress-description');
  const addProgressButton = document.querySelector('#add-progress');
  const progressDateInput = document.querySelector('#progress-date');
  const progressValueInput = document.querySelector('#progress-value');
  let chartInstance = null;
  let userProgress = JSON.parse(localStorage.getItem('userProgress')) || [];
  function saveProgress() { localStorage.setItem('userProgress', JSON.stringify(userProgress)); }
  if (addProgressButton) {
    addProgressButton.addEventListener('click', () => {
      const date = progressDateInput.value, value = parseFloat(progressValueInput.value);
      if (date && !isNaN(value)) {
        userProgress.push({ date, value });
        userProgress.sort((a, b) => new Date(a.date) - new Date(b.date));
        saveProgress();
        showErrorPopup('Data added! Switch tabs to see updated chart.');
        updateChart(document.querySelector('.tab-button.active')?.dataset.tab);
      } else {
        showErrorPopup('Please enter a valid date and value.');
      }
    });
  }
 
  document.querySelectorAll('.product-card').forEach(card => { card.addEventListener('mouseenter', () => { card.style.transition = 'transform 0.3s ease'; }); });
 
  function aggregateData(tab) {
    if (userProgress.length === 0) {
      if (tab === 'daily') return { labels: ['Day 1','Day 2','Day 3','Day 4','Day 5','Day 6','Day 7'], data: [65,68,70,72,75,78,80], description: 'Your daily progress shows a steady increase. Add your own data for real tracking!' };
      if (tab === 'weekly') return { labels: ['Week 1','Week 2','Week 3','Week 4'], data: [70,75,80,85], description: "On a weekly basis, you've gained an average of 5 points per week. Add your own data!" };
      if (tab === 'monthly') return { labels: ['Month 1','Month 2','Month 3'], data: [75,85,95], description: 'Your monthly evolution demonstrates significant transformation. Add your own data!' };
    }
    const aggregated = {};
    userProgress.forEach(entry => {
      const date = new Date(entry.date);
      let key;
      if (tab === 'daily') key = entry.date;
      else if (tab === 'weekly') key = `Week ${Math.floor(date.getDate()/7)+1} (${date.getFullYear()}-${date.getMonth()+1})`;
      else if (tab === 'monthly') key = `Month ${date.getMonth()+1} (${date.getFullYear()})`;
      if (!aggregated[key]) aggregated[key] = [];
      aggregated[key].push(entry.value);
    });
    const labels = Object.keys(aggregated);
    const data = labels.map(key => aggregated[key].reduce((s,v) => s+v, 0) / aggregated[key].length);
    return { labels, data, description: `Your ${tab} progress based on your entered data.` };
  }
 
  function updateChart(tab) {
    const { labels, data, description } = aggregateData(tab);
    if (progressDescription) progressDescription.innerText = description;
    if (chartInstance) chartInstance.destroy();
    const ctxChart = document.getElementById('progress-chart')?.getContext('2d');
    if (!ctxChart) return;
    chartInstance = new Chart(ctxChart, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Progress', data, borderColor: '#e91e63', backgroundColor: 'rgba(233,30,99,0.2)', fill: true, tension: 0.4 }] },
      options: { responsive: true, scales: { y: { beginAtZero: false } }, plugins: { legend: { display: true } } }
    });
  }
 
  if (tabButtons && evolutionContent) {
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        updateChart(button.dataset.tab);
      });
    });
    tabButtons[0]?.click();
  }
 
  // ====================== ACCORDION ======================
  document.querySelectorAll('.accordion-header').forEach(header => { header.addEventListener('click', () => { header.parentElement.classList.toggle('active'); }); });
 
  // ====================== PLAY OVERLAY ======================
  const playOverlay = document.querySelector('.play-overlay');
  if (playOverlay) playOverlay.addEventListener('click', () => { showErrorPopup('Video playback started'); });
 
  // ====================== NEWSLETTER ======================
  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('newsletter-email');
      const email = emailInput.value.trim();
      if (!email || !email.includes('@')) { showErrorPopup("Please enter a valid email"); return; }
      const submitBtn = newsletterForm.querySelector('button');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Saving..."; submitBtn.disabled = true;
      try {
        const res = await fetch('/.netlify/functions/save-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'newsletter-subscribe', email }) });
        const data = await res.json();
        if (data.success) {
          const popup = document.getElementById('newsletter-popup');
          popup.classList.add('show');
          setTimeout(() => { popup.classList.remove('show'); }, 10000);
          document.getElementById('popup-close-btn').onclick = () => { popup.classList.remove('show'); };
          emailInput.value = '';
        } else { showErrorPopup("Error: " + (data.error || "Unknown")); }
      } catch (err) { showErrorPopup("Network error. Please try again."); }
      finally { submitBtn.textContent = originalText; submitBtn.disabled = false; }
    });
  }
 
  // ====================== PROGRESS CURVE ======================
  const ctxCurve = document.getElementById('progress-curve');
  if (ctxCurve) {
    new Chart(ctxCurve, {
      type: 'line',
      data: {
        labels: ['Week 1','Week 2','Week 3','Week 4','Week 5','Week 6','Week 7','Week 8','Week 9','Week 10','Week 11','Week 12'],
        datasets: [
          { label: 'Average Weight Loss (lbs)', data: [2,4,6,8,10,12,13,14,15,16,17,18], borderColor: '#e91e63', backgroundColor: 'rgba(233,30,99,0.2)', fill: true, tension: 0.4 },
          { label: 'Average Confidence Score (1-10)', data: [4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5], borderColor: '#673ab7', backgroundColor: 'rgba(103,58,183,0.2)', fill: true, tension: 0.4 }
        ]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: true } } }
    });
  }
 
  // ================================================================
  //   CART & WISHLIST
  // ================================================================
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
  const cartDrawer = document.querySelector('.cart-drawer');
  const wishlistModal = document.querySelector('.wishlist-modal');
  const overlay = document.querySelector('.overlay');
  const cartItemsContainer = document.querySelector('.cart-items');
  const wishlistItemsContainer = document.querySelector('.wishlist-items');
  const cartBadge = document.querySelector('.cart-badge');
  const wishlistBadge = document.querySelector('.wishlist-badge');
  const cartIcon = document.querySelector('.cart-icon');
 
  function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); }
  function saveWishlist() { localStorage.setItem('wishlist', JSON.stringify(wishlist)); }
 
  function updateBadges() {
    const cartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartBadge) { cartBadge.textContent = cartQuantity; cartBadge.classList.toggle('active', cartQuantity > 0); }
    if (wishlistBadge) { wishlistBadge.textContent = wishlist.length; wishlistBadge.classList.toggle('active', wishlist.length > 0); }
  }
 
  function renderCart() {
    if (!cartItemsContainer) return;
    cartItemsContainer.innerHTML = '';
 
    const emptyCart           = cartDrawer.querySelector('.empty-cart');
    const reviewsCarouselCart = cartDrawer.querySelector('.reviews-carousel');
    const cartMarquee         = cartDrawer.querySelector('.cart-marquee');
    const paymentIcons        = cartDrawer.querySelector('.payment-icons');
    const cartFooter          = cartDrawer.querySelector('.cart-drawer__footer');
 
    const countdown   = cartDrawer.querySelector('.cart-drawer__countdown');
    const progressBar = cartDrawer.querySelector('.cart-drawer__progress-container');
    const promoMsg    = cartDrawer.querySelector('.cart-promo-message');
    const banner      = cartDrawer.querySelector('.cart-drawer__paul-banner');
    const promoCodes  = cartDrawer.querySelector('.cart-drawer__promo-slider-container');
 
    if (cart.length === 0) {
      if (emptyCart)           emptyCart.style.display           = 'block';
      if (reviewsCarouselCart) reviewsCarouselCart.style.display = 'none';
      if (cartMarquee)         cartMarquee.style.display         = 'none';
      if (paymentIcons)        paymentIcons.style.display        = 'none';
      if (cartFooter)          cartFooter.style.display          = 'none';
      if (countdown)   countdown.style.display   = 'none';
      if (progressBar) progressBar.style.display = 'none';
      if (promoMsg)    promoMsg.style.display     = 'none';
      if (banner)      banner.style.display       = 'none';
      if (promoCodes)  promoCodes.style.display   = 'none';
    } else {
      if (emptyCart)           emptyCart.style.display           = 'none';
      if (reviewsCarouselCart) reviewsCarouselCart.style.display = 'block';
      if (cartMarquee)         cartMarquee.style.display         = 'block';
      if (paymentIcons)        paymentIcons.style.display        = 'flex';
      if (cartFooter)          cartFooter.style.display          = 'block';
      if (countdown)   countdown.style.display   = 'flex';
      if (progressBar) progressBar.style.display = 'block';
      if (promoMsg)    promoMsg.style.display     = 'block';
      if (banner)      banner.style.display       = 'block';
      if (promoCodes)  promoCodes.style.display   = 'block';
 
      cart.forEach(item => {
        const cartItem = document.createElement('div');
        cartItem.classList.add('cart-item');
        cartItem.dataset.id = item.id;
        if (item.size  != null) cartItem.dataset.size  = item.size;
        if (item.color != null) cartItem.dataset.color = item.color;
        cartItem.innerHTML = `
          <img src="${item.image}" alt="${item.title}">
          <div class="item-meta">
            <h4>${item.title}</h4>
            <p>$${parseFloat(item.price).toFixed(2)}</p>
            ${item.size  ? `<p class="item-variant">Size: ${item.size}</p>`   : ''}
            ${item.color ? `<p class="item-variant">Color: ${item.color}</p>` : ''}
            <div class="quantity-row">
              <div class="quantity">
                <button class="qty-minus">−</button>
                <span>${item.quantity}</span>
                <button class="qty-plus">+</button>
              </div>
              <button class="remove-item"><i class="fi fi-sr-trash"></i></button>
            </div>
          </div>`;
        cartItemsContainer.appendChild(cartItem);
 
        const img   = cartItem.querySelector('img');
        const title = cartItem.querySelector('h4');
        if (img && title && typeof window.getProductUrl === 'function') {
          const productUrl = window.getProductUrl(item.id);
          img.style.cursor = 'pointer'; title.style.cursor = 'pointer';
          img.addEventListener('click',   () => { window.location.href = productUrl; });
          title.addEventListener('click', () => { window.location.href = productUrl; });
        }
      });
 
      cartItemsContainer.querySelectorAll('.qty-plus').forEach(btn  => btn.addEventListener('click', handleQuantityChange));
      cartItemsContainer.querySelectorAll('.qty-minus').forEach(btn => btn.addEventListener('click', handleQuantityChange));
      cartItemsContainer.querySelectorAll('.remove-item').forEach(btn => btn.addEventListener('click', removeFromCart));
    }
 
    updateSubtotal();
    if (products.length) {
      const cd = (products.find(p => p.type === 'settings') || {}).cart_drawer || {};
      updateCartProgressBar(cd);
      updateCartPromoMessage(cd);
    }
  }
 
  function handleQuantityChange(e) {
    const btn = e.target, itemElement = btn.closest('.cart-item');
    const id = itemElement.dataset.id;
    const size  = itemElement.dataset.size  !== undefined ? itemElement.dataset.size  : null;
    const color = itemElement.dataset.color !== undefined ? itemElement.dataset.color : null;
    const item = cart.find(i => i.id === id && i.size === size && i.color === color);
    if (item) {
      if (btn.classList.contains('qty-plus')) item.quantity++;
      else if (btn.classList.contains('qty-minus') && item.quantity > 1) item.quantity--;
      else if (btn.classList.contains('qty-minus') && item.quantity === 1) { removeFromCart(e); return; }
      itemElement.querySelector('.quantity span').textContent = item.quantity;
      saveCart(); updateCartQuantityInSheet(); updateSubtotal(); updateBadges(); renderCart();
    }
  }
 
  function removeFromCart(e) {
    const itemElement = e.target.closest('.cart-item');
    const id = itemElement.dataset.id;
    const size  = itemElement.dataset.size  !== undefined ? itemElement.dataset.size  : null;
    const color = itemElement.dataset.color !== undefined ? itemElement.dataset.color : null;
    cart = cart.filter(i => !(i.id === id && i.size === size && i.color === color));
    saveCart(); updateCartQuantityInSheet(); updateSubtotal(); updateBadges(); renderCart();
  }
 
  function updateSubtotal() {
    const el = cartDrawer ? cartDrawer.querySelector('.cart-drawer__footer .subtotal') : document.querySelector('.subtotal');
    if (el) el.textContent = `Subtotal: $${cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}`;
  }
 
  function addToCart(e) {
    e.stopPropagation();
    const container = e.target.closest('.product-card') || e.target.closest('.product-section');
    if (!container) return;
    const id = container.dataset.id || container.dataset.productId;
    const product = products.find(p => p.id === id);
    if (!product) return;
    function getVariantPrice(product, color, size) {
      if (!color || !size) return product.price;
      const variant = product.variants.find(v => v.color === color && v.size === size);
      return variant ? variant.price : product.price;
    }
    function getVariantComparePrice(product, color, size) {
      return getVariantPrice(product, color, size) * (product.compare_price / product.price);
    }
    const isProductPage = !!container.dataset.productId;
    let quantity = 1;
    const qtyInput = container.querySelector('.quantity input');
    if (qtyInput) quantity = parseInt(qtyInput.value);
    let selectedSize = null, selectedColor = null, itemImage = upgradeShopifyImageUrl(product.image), cjVariantId = null;
    if (isProductPage) {
      const sizeSelect = document.getElementById('size-select');
      const activeSwatch = document.querySelector('.color-swatches .swatch.active');
      selectedSize  = sizeSelect && sizeSelect.value !== "" ? sizeSelect.value : null;
      selectedColor = activeSwatch ? activeSwatch.dataset.color : null;
      if ((product.colors && product.colors.length > 0 && !selectedColor) || (product.sizes && product.sizes.length > 0 && !selectedSize)) {
        showErrorPopup("Please select a color first."); return;
      }
      if (selectedColor) { const colorObj = product.colors.find(c => c.name === selectedColor); if (colorObj && colorObj.image) itemImage = upgradeShopifyImageUrl(colorObj.image); }
    } else {
      if (product.colors && product.colors.length > 0) {
        selectedColor = product.colors[0].name;
        if (product.colors[0].image) itemImage = upgradeShopifyImageUrl(product.colors[0].image);
      }
      if (product.sizes && product.sizes.length > 0) selectedSize = product.sizes[0];
    }
    const variant = product.variants.find(v => {
      const colorMatch = !selectedColor || v.color === selectedColor;
      const sizeMatch  = (!selectedSize && v.size === "") || (selectedSize === null && v.size === "") || (selectedSize && v.size === selectedSize);
      return colorMatch && sizeMatch;
    });
    if (variant) cjVariantId = variant.vid;
    else if (product.variants && product.variants.length > 0) cjVariantId = product.variants[0].vid;
    const varPrice   = getVariantPrice(product, selectedColor, selectedSize);
    const varCompare = getVariantComparePrice(product, selectedColor, selectedSize);
    let cartItem = cart.find(i => i.id === id && i.size === selectedSize && i.color === selectedColor);
    if (cartItem) cartItem.quantity += quantity;
    else cart.push({ id: product.id, title: product.title, price: varPrice, compare_price: varCompare, image: itemImage, size: selectedSize, color: selectedColor, quantity, cj_product_id: product.cj_id, cj_variant_id: cjVariantId });
    saveCart(); updateCartQuantityInSheet(); updateBadges();
    if (cartIcon) { cartIcon.classList.add('added'); setTimeout(() => cartIcon.classList.remove('added'), 500); }
    openCartDrawer();
  }
 
  function renderWishlist() {
    if (!wishlistItemsContainer) return;
    wishlistItemsContainer.innerHTML = '';
    wishlist.forEach(id => {
      const product = products.find(p => p.id === id);
      if (product) {
        const wishlistItem = document.createElement('div');
        wishlistItem.classList.add('wishlist-item');
        wishlistItem.dataset.id = id;
        const comparePriceHTML = product.compare_price && product.compare_price > product.price
          ? `<p class="compare-price">$${parseFloat(product.compare_price).toFixed(2)}</p>` : '';
        wishlistItem.innerHTML = `
          <img src="${upgradeShopifyImageUrl(product.image)}" alt="${product.title}" class="wishlist-img">
          <h4 class="wishlist-title">${product.title}</h4>
          <p>$${parseFloat(product.price).toFixed(2)}</p>
          ${comparePriceHTML}
          <button class="remove-wishlist">Remove</button>`;
        const img = wishlistItem.querySelector('.wishlist-img');
        const titleEl = wishlistItem.querySelector('.wishlist-title');
        if (img && titleEl && typeof window.getProductUrl === 'function') {
          const productUrl = window.getProductUrl(id);
          img.style.cursor = 'pointer'; titleEl.style.cursor = 'pointer';
          img.addEventListener('click',    (e) => { e.stopPropagation(); window.location.href = productUrl; });
          titleEl.addEventListener('click',(e) => { e.stopPropagation(); window.location.href = productUrl; });
        }
        wishlistItemsContainer.appendChild(wishlistItem);
      }
    });
    wishlistItemsContainer.querySelectorAll('.remove-wishlist').forEach(btn => btn.addEventListener('click', removeFromWishlist));
  }
 
  function removeFromWishlist(e) {
    const itemElement = e.target.closest('.wishlist-item');
    const id = itemElement.dataset.id;
    wishlist = wishlist.filter(i => i !== id);
    itemElement.remove();
    saveWishlist(); updateBadges(); updateWishlistIcons();
  }
 
  function addAllToCart() {
    wishlist.forEach(id => {
      const product = products.find(p => p.id === id);
      if (product) {
        let cartItem = cart.find(i => i.id === id);
        if (cartItem) cartItem.quantity++;
        else cart.push({ id: product.id, title: product.title, price: product.price, image: product.image, quantity: 1 });
      }
    });
    saveCart(); updateCartQuantityInSheet(); updateBadges(); closeWishlistModal(); openCartDrawer();
  }
 
  async function updateCartQuantityInSheet() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;
    const qty = cart.reduce((sum, item) => sum + item.quantity, 0);
    await fetch('/.netlify/functions/save-account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-cart-quantity', email: userEmail, currentCartQuantity: qty })
    }).catch(() => {});
  }
 
  // ── openCartDrawer ──
  function openCartDrawer() {
    renderCart();
    cartDrawer.classList.add('active');
    overlay.classList.add('active');
    setTimeout(() => initCartDrawerExtras(), 100);
  }
 
  // ================================================================
  //   CART DRAWER EXTRAS
  // ================================================================
  let _countdownTimer   = null;
  let _countdownStarted = false;
  let _bannerTimer      = null;
  let _promoTimer       = null;
 
  function initCartDrawerExtras() {
    if (!products || products.length === 0) return;
    const settings = products.find(p => p.type === 'settings') || {};
    const cd       = settings.cart_drawer || {};
    const promos   = settings.promos || [];
    initCartCountdown(cd);
    updateCartProgressBar(cd);
    updateCartPromoMessage(cd);
    initCartBanner(cd);
    initCartPromoCodeSlider(promos);
  }
 
  // ── 1. COUNTDOWN ─────────────────────────────────────────────
  function initCartCountdown(cd) {
    const body = cartDrawer.querySelector('.cart-drawer__body');
    if (!body) return;
    let el = body.querySelector('.cart-drawer__countdown');
    if (!el) {
      el = document.createElement('div');
      el.className = 'cart-drawer__countdown';
      el.innerHTML = `
        <span class="cart-drawer__countdown-text"></span>
        <span class="cart-drawer__countdown-time" id="drawerCountdownTime"></span>`;
      body.insertAdjacentElement('afterbegin', el);
    }
    const textEl = el.querySelector('.cart-drawer__countdown-text');
    if (textEl) textEl.textContent = cd.countdown_text;
 
    if (_countdownStarted) return;
    _countdownStarted = true;
 
    const totalSeconds = (parseInt(cd.countdown_minutes) || 10) * 60;
    const suffix = cd.countdown_suffix || '';
    const STORAGE_KEY = 'drawerCountdownEnd';
 
    function runCycle() {
      const savedEnd = localStorage.getItem(STORAGE_KEY);
      const now = Date.now();
 
      let endTime;
      if (savedEnd && parseInt(savedEnd) > now) {
        endTime = parseInt(savedEnd);
      } else {
        endTime = now + totalSeconds * 1000;
        localStorage.setItem(STORAGE_KEY, endTime);
      }
 
      if (_countdownTimer) clearInterval(_countdownTimer);
      _countdownTimer = setInterval(() => {
        const timeEl = document.getElementById('drawerCountdownTime');
        const remaining = Math.floor((endTime - Date.now()) / 1000);
 
        if (remaining <= 0) {
          if (timeEl) timeEl.textContent = `0:00 ${suffix}`;
          clearInterval(_countdownTimer);
          setTimeout(() => {
            localStorage.removeItem(STORAGE_KEY);
            _countdownStarted = false;
            runCycle();
          }, 3000);
          return;
        }
 
        if (timeEl) {
          const m = Math.floor(remaining / 60);
          const s = remaining % 60;
          timeEl.textContent = `${m}:${s < 10 ? '0' : ''}${s} ${suffix}`;
        }
      }, 1000);
    }
 
    runCycle();
  }
 
  // ── 2. PROGRESS BAR ──────────────────────────────────────────
  function updateCartProgressBar(cd) {
    const body = cartDrawer.querySelector('.cart-drawer__body');
    if (!body) return;
    const threshold    = parseFloat(cd.free_shipping_threshold) || 75;
    const cartSubtotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const remaining    = Math.max(0, threshold - cartSubtotal);
    const pct          = Math.min(100, (cartSubtotal / threshold) * 100);
    let container = body.querySelector('.cart-drawer__progress-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'cart-drawer__progress-container';
      container.innerHTML = `
      <span class="cart-drawer__progress-message"></span>
      <div class="cart-drawer__progress-bar">
        <div class="cart-drawer__progress-fill"></div>
        <span class="cart-drawer__progress-truck">
          <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17v-2.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
          </svg>
        </span>
      </div>`;
      const countdown = body.querySelector('.cart-drawer__countdown');
      if (countdown) countdown.insertAdjacentElement('afterend', container);
      else body.insertAdjacentElement('afterbegin', container);
    }
    const msgEl   = container.querySelector('.cart-drawer__progress-message');
    const fillEl  = container.querySelector('.cart-drawer__progress-fill');
    const truckEl = container.querySelector('.cart-drawer__progress-truck');
    if (cartSubtotal >= threshold) {
      msgEl.textContent = cd.progress_success_message;
      msgEl.style.color = '#22a06b';
      fillEl.style.width = '100%';
    } else {
      msgEl.textContent = (cd.progress_message || '').replace('${remaining}', `$${remaining.toFixed(2)}`);
      msgEl.style.color = '';
      fillEl.style.width = `${pct}%`;
    }
    requestAnimationFrame(() => {
      const barW = container.querySelector('.cart-drawer__progress-bar').offsetWidth;
      truckEl.style.right = `${Math.max(2, barW - (pct / 100) * barW - truckEl.offsetWidth / 2)}px`;
    });
  }
 
  // ── 3. PROMO MESSAGE ─────────────────────────────────────────
  function updateCartPromoMessage(cd) {
    const body = cartDrawer.querySelector('.cart-drawer__body');
    if (!body) return;
    const buyQty = parseInt(cd.promo_buy_quantity) || 3;
    const getQty = parseInt(cd.promo_get_quantity) || 1;
    const count  = cart.reduce((s, i) => s + i.quantity, 0);
    let el = body.querySelector('.cart-promo-message');
    if (!el) {
      el = document.createElement('div');
      el.className = 'cart-promo-message';
      el.innerHTML = '<span class="promo-text"></span>';
      const progress = body.querySelector('.cart-drawer__progress-container');
      if (progress) progress.insertAdjacentElement('afterend', el);
      else body.insertAdjacentElement('afterbegin', el);
    }
    const span = el.querySelector('.promo-text');
    let msg = '', cls = '';
    if (count >= buyQty) {
      msg = (cd.promo_complete_message || '').replace('{get}', `<strong class="promo-number">${getQty}</strong>`);
      cls = 'complete';
    } else if (count > 0) {
      const rem = buyQty - count;
      msg = (cd.promo_progress_message || '')
            .replace('{remaining}', `<strong class="promo-number">${rem}</strong>`)
            .replace('{get}', `<strong class="promo-number">${getQty}</strong>`);
      cls = 'progress';
    } else {
      msg = (cd.promo_initial_message || '')
            .replace('{buy}', `<strong class="promo-number">${buyQty}</strong>`)
            .replace('{get}', `<strong class="promo-number">${getQty}</strong>`);
      cls = 'initial';
    }
    span.innerHTML = msg;
    span.className = `promo-text ${cls}`;
  }
 
  // ── 4. BANNER SLIDER ─────────────────────────────────────────
  function initCartBanner(cd) {
    const body = cartDrawer.querySelector('.cart-drawer__body');
    if (!body) return;
    const slides   = cd.banner_slides || [];
    const duration = cd.banner_slide_duration_ms || 5000;
    if (!slides.length) return;
    let banner = body.querySelector('.cart-drawer__paul-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'cart-drawer__paul-banner';
      const itemsDiv = body.querySelector('.cart-items');
      if (itemsDiv) itemsDiv.insertAdjacentElement('beforebegin', banner);
      else body.insertAdjacentElement('afterbegin', banner);
    }
    if (!banner.dataset.built) {
      banner.dataset.built = '1';
      const slidesHTML = slides.map((s, i) => `
        <div class="paul-banner-slide${i === 0 ? ' active' : ''}">
          <img src="${upgradeShopifyImageUrl(s.image)}" alt="${s.text}" class="paul-banner-image" loading="lazy">
          <h2 class="paul-banner-title">${s.text}</h2>
        </div>`).join('');
      const dotsHTML = slides.map((s, i) =>
        `<span class="paul-banner-indicator${i === 0 ? ' active' : ''}" data-slide="${i}"></span>`
      ).join('');
      banner.innerHTML = `
        <div class="paul-banner-slider-container">${slidesHTML}</div>
        <div class="paul-banner-indicators dots">${dotsHTML}</div>`;
      banner.querySelectorAll('.paul-banner-indicator').forEach(dot => {
        dot.addEventListener('click', () => { bannerGoTo(banner, parseInt(dot.dataset.slide)); restartBannerTimer(banner, duration); });
      });
    }
    if (_bannerTimer) clearInterval(_bannerTimer);
    _bannerTimer = setInterval(() => {
      const allSlides = banner.querySelectorAll('.paul-banner-slide');
      const active = Array.from(allSlides).findIndex(s => s.classList.contains('active'));
      bannerGoTo(banner, (active + 1) % allSlides.length);
    }, duration);
  }
 
  function bannerGoTo(banner, idx) {
    banner.querySelectorAll('.paul-banner-slide').forEach((s, i) => s.classList.toggle('active', i === idx));
    banner.querySelectorAll('.paul-banner-indicator').forEach((d, i) => d.classList.toggle('active', i === idx));
  }
  function restartBannerTimer(banner, duration) {
    if (_bannerTimer) clearInterval(_bannerTimer);
    _bannerTimer = setInterval(() => {
      const allSlides = banner.querySelectorAll('.paul-banner-slide');
      const active = Array.from(allSlides).findIndex(s => s.classList.contains('active'));
      bannerGoTo(banner, (active + 1) % allSlides.length);
    }, duration);
  }
 
  // ── 5. PROMO CODE SLIDER ─────────────────────────────────────
  function initCartPromoCodeSlider(promos) {
    const body = cartDrawer.querySelector('.cart-drawer__body');
    if (!body || !promos.length) return;
    let container = body.querySelector('.cart-drawer__promo-slider-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'cart-drawer__promo-slider-container';
      const slidesHTML = promos.map((p, i) => `
        <div class="cart-drawer__promo-slide${i === 0 ? ' active' : ''}" data-index="${i}">
          <div class="cart-drawer__promo-content">
            <h3 class="cart-drawer__promo-title">🎟️ Exclusive Code</h3>
            <p class="cart-drawer__promo-text">Use on <strong>${p.items}+</strong> items — Save <strong>${p.percent}%</strong></p>
            <div class="cart-drawer__promo-code-row">
              <span class="cart-drawer__promo-code" id="drawer-code-${i}">${p.code}</span>
              <button class="cart-drawer__promo-copy-btn" data-target="drawer-code-${i}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>`).join('');
      const dotsHTML = promos.map((p, i) =>
        `<span class="cart-drawer__promo-dot${i === 0 ? ' active' : ''}" data-index="${i}"></span>`
      ).join('');
      container.innerHTML = `
        <div class="cart-drawer__promo-slider">${slidesHTML}</div>
        <div class="cart-drawer__promo-indicators dots">${dotsHTML}</div>`;
      container.querySelectorAll('.cart-drawer__promo-dot').forEach(dot => {
        dot.addEventListener('click', () => { promoGoTo(container, parseInt(dot.dataset.index)); restartPromoTimer(container, promos.length); });
      });
      container.addEventListener('click', e => {
        const btn = e.target.closest('.cart-drawer__promo-copy-btn');
        if (!btn) return;
        const targetEl = container.querySelector(`#${btn.dataset.target}`);
        if (!targetEl) return;
        navigator.clipboard.writeText(targetEl.textContent.trim()).then(() => {
          btn.classList.add('copied');
          setTimeout(() => btn.classList.remove('copied'), 1500);
        });
      });
      const payIcons = body.querySelector('.payment-icons');
      if (payIcons) payIcons.insertAdjacentElement('beforebegin', container);
      else body.appendChild(container);
    }
    if (_promoTimer) clearInterval(_promoTimer);
    if (promos.length > 1) restartPromoTimer(container, promos.length);
  }
 
  function promoGoTo(container, idx) {
    container.querySelectorAll('.cart-drawer__promo-slide').forEach((s, i) => s.classList.toggle('active', i === idx));
    container.querySelectorAll('.cart-drawer__promo-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
  }
  function restartPromoTimer(container, count) {
    if (_promoTimer) clearInterval(_promoTimer);
    _promoTimer = setInterval(() => {
      const active = container.querySelector('.cart-drawer__promo-slide.active');
      const idx = active ? parseInt(active.dataset.index) : 0;
      promoGoTo(container, (idx + 1) % count);
    }, 6000);
  }
 
  // ── Fermeture / wishlist / checkout ──
  function closeCartDrawer() { cartDrawer.classList.remove('active'); overlay.classList.remove('active'); }
  function openWishlistModal() { renderWishlist(); wishlistModal.classList.add('active'); overlay.classList.add('active'); }
  function closeWishlistModal() { wishlistModal.classList.remove('active'); overlay.classList.remove('active'); }
  function checkout() { localStorage.setItem('checkoutCart', JSON.stringify(cart)); window.location.href = '/checkout.html'; }
 
  function toggleWishlist(e) {
    const icon = e.target.closest('.wishlist-toggle, .wishlist-icon-product, .mini-wishlist-icon');
    if (!icon) return;
    const id = icon.dataset.id || icon.closest('[data-id],[data-product-id]')?.dataset.id || icon.closest('[data-id],[data-product-id]')?.dataset.productId;
    if (!id) return;
    const isMini = icon.classList.contains('mini-wishlist-icon');
    const toggleClass = isMini ? 'added' : 'active';
    const index = wishlist.indexOf(id);
    if (index === -1) { wishlist.push(id); icon.classList.add(toggleClass); }
    else { wishlist.splice(index, 1); icon.classList.remove(toggleClass); }
    saveWishlist(); updateBadges(); updateWishlistIcons();
    document.dispatchEvent(new Event('wishlist:change'));
  }
 
  function updateWishlistIcons() {
    document.querySelectorAll('.wishlist-toggle, .wishlist-icon-product, .mini-wishlist-icon').forEach(icon => {
      const id = icon.dataset.id || icon.closest('[data-id],[data-product-id]')?.dataset.id || icon.closest('[data-id],[data-product-id]')?.dataset.productId;
      if (!id) return;
      const isInWishlist = wishlist.includes(id);
      const isMini = icon.classList.contains('mini-wishlist-icon');
      icon.classList.toggle(isMini ? 'added' : 'active', isInWishlist);
      icon.classList.toggle('fas', isInWishlist);
      icon.classList.toggle('far', !isInWishlist);
      const emptySvg  = icon.querySelector('.wishlist-icon-empty');
      const filledSvg = icon.querySelector('.wishlist-icon-filled');
      if (filledSvg && emptySvg) { filledSvg.style.display = isInWishlist ? 'block' : 'none'; emptySvg.style.display = isInWishlist ? 'none' : 'block'; }
    });
  }
 
  updateBadges();
  updateWishlistIcons();
  document.querySelectorAll('.add-to-cart').forEach(btn => btn.addEventListener('click', addToCart));
  document.querySelectorAll('.buy-now').forEach(btn => { btn.addEventListener('click', (e) => { addToCart(e); checkout(); }); });
  document.querySelectorAll('.wishlist-toggle, .wishlist-icon-product, .mini-wishlist-icon').forEach(icon => { icon.addEventListener('click', toggleWishlist); });
 
  const cartWrapper = document.querySelector('.icon-wrapper:has(.cart-icon)');
  if (cartWrapper) cartWrapper.addEventListener('click', openCartDrawer);
  const wishlistWrapper = document.querySelector('.icon-wrapper:has(.wishlist-icon)');
  if (wishlistWrapper) wishlistWrapper.addEventListener('click', openWishlistModal);
 
  if (overlay) overlay.addEventListener('click', () => { closeCartDrawer(); closeWishlistModal(); });
  const closeDrawerBtn = document.querySelector('.close-drawer');
  if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeCartDrawer);
  const closeModalBtn = document.querySelector('.close-modal');
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeWishlistModal);
  const checkoutBtn = cartDrawer ? cartDrawer.querySelector('.cart-drawer__footer .checkout') : document.querySelector('.checkout');
  if (checkoutBtn) checkoutBtn.addEventListener('click', checkout);
  const addAllBtn = document.querySelector('.add-all-to-cart');
  if (addAllBtn) addAllBtn.addEventListener('click', addAllToCart);
 
  document.addEventListener('wishlist:change', () => { updateBadges(); updateWishlistIcons(); renderWishlist(); });
 
  // Reviews carousel in cart
  const reviewsCarouselCart = document.querySelector('.reviews-carousel');
  if (reviewsCarouselCart) {
    const reviewItems = reviewsCarouselCart.querySelectorAll('.review-item');
    let currentReview = 0;
    if (reviewItems.length > 0) {
      reviewItems[currentReview].classList.add('active');
      setInterval(() => {
        reviewItems[currentReview].classList.remove('active');
        currentReview = (currentReview + 1) % reviewItems.length;
        reviewItems[currentReview].classList.add('active');
      }, 5000);
    }
  }
 
  // ====================== PAUL BANNER (page principale) ======================
  const paulContainer = document.getElementById('paul-banner');
  if (paulContainer) {
    const paulVideoUrl    = '';
    const paulVideo       = paulContainer.querySelector('.paul-banner-video');
    const paulSoundBtn    = paulContainer.querySelector('.paul-video-sound-toggle');
    const paulVideoWrapper= paulContainer.querySelector('.paul-banner-video-wrapper');
    if (paulVideoUrl) {
      paulVideo.src = paulVideoUrl;
      paulVideoWrapper.style.display = 'block';
      document.querySelectorAll('.paul-banner-image').forEach(img => img.style.display = 'none');
    } else {
      paulVideoWrapper.style.display = 'none';
      paulContainer.classList.add('image-mode');
    }
    if (paulVideo && paulSoundBtn && paulVideoUrl) {
      paulSoundBtn.addEventListener('click', () => { paulVideo.muted = !paulVideo.muted; paulSoundBtn.classList.toggle('muted', paulVideo.muted); });
    }
    const paulSlides     = paulContainer.querySelectorAll('.paul-banner-slide');
    const paulIndicators = paulContainer.querySelectorAll('.paul-banner-indicator');
    if (paulSlides.length > 1) {
      let paulCurrentSlide = 0, paulSlideTimer;
      function paulShowSlide(index) {
        paulSlides.forEach((s, i) => s.classList.toggle('active', i === index));
        paulIndicators.forEach((ind, i) => ind.classList.toggle('active', i === index));
        paulCurrentSlide = index;
      }
      function paulNextSlide() { paulShowSlide((paulCurrentSlide + 1) % paulSlides.length); }
      paulShowSlide(0);
      paulSlideTimer = setInterval(paulNextSlide, 5000);
      paulIndicators.forEach((ind, i) => { ind.addEventListener('click', () => { clearInterval(paulSlideTimer); paulShowSlide(i); paulSlideTimer = setInterval(paulNextSlide, 5000); }); });
      paulContainer.addEventListener('mouseenter', () => clearInterval(paulSlideTimer));
      paulContainer.addEventListener('mouseleave', () => { paulSlideTimer = setInterval(paulNextSlide, 5000); });
    }
  }
 
  // ====================== FRANCENEL BANNER ======================
  const francenelContainer = document.getElementById('francenel-milliadaire-banner');
  if (francenelContainer) {
    const francVideoUrl    = 'https://cdn.shopify.com/videos/c/o/v/8747957409cc4beda31702abfcd4ed91.mp4';
    const francVideo       = francenelContainer.querySelector('.francenel-milliadaire-banner-video');
    const francSoundBtn    = francenelContainer.querySelector('.francenel-milliadaire-video-sound-toggle');
    const francVideoWrapper= francenelContainer.querySelector('.francenel-milliadaire-banner-video-wrapper');
    if (francVideoUrl) {
      francVideo.src = francVideoUrl;
      francVideoWrapper.style.display = 'block';
      document.querySelectorAll('.francenel-milliadaire-banner-image').forEach(img => img.style.display = 'none');
    } else {
      francVideoWrapper.style.display = 'none';
      francenelContainer.classList.add('image-mode');
    }
    if (francVideo && francSoundBtn && francVideoUrl) {
      francSoundBtn.addEventListener('click', () => { francVideo.muted = !francVideo.muted; francSoundBtn.classList.toggle('muted', francVideo.muted); });
    }
    const francSlides     = francenelContainer.querySelectorAll('.francenel-milliadaire-banner-slide');
    const francIndicators = francenelContainer.querySelectorAll('.francenel-milliadaire-banner-indicator');
    if (francSlides.length > 1) {
      let francCurrentSlide = 0, francSlideTimer;
      function francShowSlide(index) {
        francSlides.forEach((s, i) => s.classList.toggle('active', i === index));
        francIndicators.forEach((ind, i) => ind.classList.toggle('active', i === index));
        francCurrentSlide = index;
      }
      function francNextSlide() { francShowSlide((francCurrentSlide + 1) % francSlides.length); }
      francShowSlide(0);
      francSlideTimer = setInterval(francNextSlide, 5000);
      francIndicators.forEach((ind, i) => { ind.addEventListener('click', () => { clearInterval(francSlideTimer); francShowSlide(i); francSlideTimer = setInterval(francNextSlide, 5000); }); });
      francenelContainer.addEventListener('mouseenter', () => clearInterval(francSlideTimer));
      francenelContainer.addEventListener('mouseleave', () => { francSlideTimer = setInterval(francNextSlide, 5000); });
    }
  }
 
  // ================================================================
  //   SHOP HERO BANNER
  // ================================================================
  (function() {
    const heroSlides = [
      'https://cdn.shopify.com/s/files/1/0643/8263/2041/files/blog_img_3.webp?v=1772583394',
      'https://cdn.shopify.com/s/files/1/0643/8263/2041/files/big_health_1.jpg?v=1771457668',
      'https://cdn.shopify.com/s/files/1/0643/8263/2041/files/bg_plus_size_fit.webp?v=1772559170'
    ];
    const hero = document.querySelector('.hero-section');
    if (!hero) return;
    heroSlides.forEach((src, i) => {
      const div = document.createElement('div');
      div.className = 'hero-slide' + (i === 0 ? ' active' : '');
      div.style.backgroundImage = `url('${upgradeShopifyImageUrl(src)}')`;
      hero.appendChild(div);
    });
    const thumbsWrap = document.createElement('div');
    thumbsWrap.className = 'hero-thumbnails';
    heroSlides.forEach((src, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'hero-thumb' + (i === 0 ? ' active' : '');
      const img = document.createElement('img'); img.src = upgradeShopifyImageUrl(src); img.alt = 'Slide ' + (i + 1);
      thumb.appendChild(img);
      thumb.addEventListener('click', () => heroGoTo(i));
      thumbsWrap.appendChild(thumb);
    });
    function placeThumbs() {
      const isMobile = window.innerWidth <= 768;
      const bannerContent = document.querySelector('.shop-banner-section .banner-content');
      if (isMobile && bannerContent && !bannerContent.contains(thumbsWrap)) bannerContent.insertBefore(thumbsWrap, bannerContent.firstChild);
      else if (!isMobile && bannerContent && bannerContent.contains(thumbsWrap)) hero.appendChild(thumbsWrap);
      else if (!isMobile && !hero.contains(thumbsWrap)) hero.appendChild(thumbsWrap);
    }
    placeThumbs();
    window.addEventListener('resize', placeThumbs);
    let heroCurrentSlide = 0, heroTimer;
    function heroGoTo(index) {
      const allSlides = hero.querySelectorAll('.hero-slide'), allThumbs = thumbsWrap.querySelectorAll('.hero-thumb');
      allSlides[heroCurrentSlide].classList.remove('active'); allThumbs[heroCurrentSlide].classList.remove('active');
      heroCurrentSlide = index;
      allSlides[heroCurrentSlide].classList.add('active'); allThumbs[heroCurrentSlide].classList.add('active');
      clearInterval(heroTimer);
      heroTimer = setInterval(() => heroGoTo((heroCurrentSlide + 1) % heroSlides.length), 5000);
    }
    heroTimer = setInterval(() => heroGoTo((heroCurrentSlide + 1) % heroSlides.length), 5000);
  })();
 
  // ====================== ANNOUNCEMENT BAR ======================
  const announcementItems = document.querySelectorAll(".paul-announcement-item");
  let announcementCurrent = 0;
  function showAnnouncementItem(index) {
    announcementItems.forEach((item, i) => item.classList.toggle("active", i === index));
    announcementCurrent = index;
  }
  if (announcementItems.length > 0) setInterval(() => showAnnouncementItem((announcementCurrent + 1) % announcementItems.length), 4000);
 
  // ====================== PROMO CODE ======================
  const promoCode = document.getElementById("paulPromoCode");
  const copiedMessage = document.getElementById("copiedMessage");
  if (promoCode) {
    promoCode.addEventListener("click", function() {
      navigator.clipboard.writeText("paul26").then(function() {
        copiedMessage.style.display = "inline";
        setTimeout(() => { copiedMessage.style.display = "none"; }, 2000);
      });
    });
  }
 
  // ====================== AUTO OPEN CART ======================
  if (window.location.pathname.toLowerCase().includes('shop.html') && localStorage.getItem('autoOpenCart') === 'true') {
    localStorage.removeItem('autoOpenCart');
    setTimeout(() => { if (typeof openCartDrawer === 'function') openCartDrawer(); }, 1200);
  }
 
(function initHeaderParticles() {
  function create() {
    const header = document.querySelector('.sticky-header');
    if (!header) return;

    const container = document.createElement('div');
    container.className = 'header-particles';
    header.appendChild(container);

    const types = ['type-rose', 'type-gold', 'type-plum', 'type-petal', 'type-star'];
    const count = 22;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'header-particle ' + types[i % types.length];

      const left     = Math.random() * 100;
      const duration = 4 + Math.random() * 6;
      const delay    = Math.random() * 6;

      p.style.cssText = `
        left: ${left}%;
        bottom: 0;
        animation-duration: ${duration}s;
        animation-delay: -${delay}s;
      `;

      container.appendChild(p);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', create);
  } else {
    create();
  }
})();

});



 
// ====================== SWATCH SCROLL MOBILE ======================
document.addEventListener('click', function(e) {
  if (e.target.closest('.swatch')) {
    const isMobile = window.innerWidth <= 768 || /Mobi|Android|iPhone/i.test(navigator.userAgent);
    if (isMobile) {
      const mediaSlider = document.getElementById('main-image-slider');
      if (mediaSlider) setTimeout(() => { mediaSlider.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
    }
  }
});
 
// ====================== PAUL AUTH POPUP ======================
document.addEventListener('DOMContentLoaded', () => {
  const trigger = document.getElementById('paulTrigger');
  const paulPopupOverlay = document.getElementById('paulPopup');
  const closeBtn = document.querySelector('.paul-close');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const goToSignup = document.getElementById('goToSignup');
  const goToLogin  = document.getElementById('goToLogin');
  const pathname = window.location.pathname.toLowerCase();
  const isAccountPage = /account/i.test(pathname);
 
  window.showToast = (msg) => {
    let toast = document.getElementById('toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; toast.className = 'toast'; document.body.appendChild(toast); }
    toast.textContent = msg; toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 5000);
  };
 
  window.openAccountPopup = (id) => {
    const popup = document.getElementById(id);
    if (popup) popup.classList.add('open');
    if (id === 'address-popup') {
      document.getElementById('addr-email').value = localStorage.getItem('userEmail') || '';
      document.getElementById('addr-first').value = localStorage.getItem('userFirstName') || '';
      document.getElementById('addr-last').value  = localStorage.getItem('userLastName') || '';
      document.getElementById('addr-line1').value = localStorage.getItem('userAddressLine1') || '';
      document.getElementById('addr-line2').value = localStorage.getItem('userLine2') || '';
      document.getElementById('addr-city').value  = localStorage.getItem('userCity') || '';
      document.getElementById('addr-state').value = localStorage.getItem('userState') || '';
      document.getElementById('addr-zip').value   = localStorage.getItem('userZip') || '';
    }
  };
  window.closeAccountPopup = (id) => { const popup = document.getElementById(id); if (popup) popup.classList.remove('open'); };
 
  function openPaulPopup() {
    if (!paulPopupOverlay || !loginForm || !signupForm) return;
    paulPopupOverlay.classList.add('active');
    loginForm.style.display = 'block'; signupForm.style.display = 'none';
  }
  function closePaulPopup() {
    if (isAccountPage) return;
    if (paulPopupOverlay) paulPopupOverlay.classList.remove('active');
  }
 
  if (trigger) { trigger.addEventListener('click', (e) => { e.preventDefault(); if (localStorage.getItem('isLoggedIn') === 'true') window.location.href = '/account.html'; else openPaulPopup(); }); }
  if (closeBtn) closeBtn.addEventListener('click', closePaulPopup);
  if (paulPopupOverlay) paulPopupOverlay.addEventListener('click', (e) => { if (e.target === paulPopupOverlay && !isAccountPage) closePaulPopup(); });
  if (goToSignup) goToSignup.addEventListener('click', () => { loginForm.style.display = 'none'; signupForm.style.display = 'block'; });
  if (goToLogin)  goToLogin.addEventListener('click',  () => { signupForm.style.display = 'none'; loginForm.style.display = 'block'; });
 
  document.querySelectorAll('.password-toggle').forEach(toggle => {
    toggle.addEventListener('click', function() {
      const input = document.getElementById(this.getAttribute('data-target'));
      if (!input) return;
      const icon = this.querySelector('i');
      if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fi-sr-eye', 'fi-sr-eye-crossed'); }
      else { input.type = 'password'; icon.classList.replace('fi-sr-eye-crossed', 'fi-sr-eye'); }
    });
  });
 
  // REGISTER
  const registerBtn = document.querySelector('.paul-btn-register');
  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      const lastName   = signupForm.querySelector('input[placeholder="Last Name"]').value.trim();
      const firstName  = signupForm.querySelector('input[placeholder="First Name"]').value.trim();
      const email      = signupForm.querySelector('input[placeholder="Email"]').value.trim();
      const phone      = signupForm.querySelector('input[placeholder="Phone (optional)"]').value.trim();
      const password   = signupForm.querySelector('input[placeholder*="Password"], input[type="password"], #signup-password').value.trim();
      const newsletter = signupForm.querySelector('input[type="checkbox"]').checked ? "Yes" : "No";
      if (!password) return window.showToast("Password is required");
      const originalText = registerBtn.textContent;
      registerBtn.textContent = "Creating account..."; registerBtn.disabled = true;
      try {
        const res  = await fetch('/.netlify/functions/save-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastName, firstName, email, phone, password, newsletter }) });
        const data = await res.json();
        if (data.success) { registerBtn.textContent = "Your profil is ready..."; window.showToast("Account created successfully!"); setTimeout(() => goToLogin.click(), 800); }
        else { registerBtn.textContent = originalText; registerBtn.disabled = false; window.showToast("Error: " + (data.error || "Unknown")); }
      } catch (err) { registerBtn.textContent = originalText; registerBtn.disabled = false; window.showToast("Network error"); }
    });
  }
 
  // LOGIN
  const loginBtn = document.querySelector('.paul-btn-login');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email         = loginForm.querySelector('input[type="email"]').value.trim();
      const passwordInput = loginForm.querySelector('input[placeholder*="Password"], input[type="password"], #login-password');
      const password      = passwordInput ? passwordInput.value.trim() : '';
      if (!email || !password) { window.showToast("Email and password required"); return; }
      const originalText = loginBtn.textContent;
      loginBtn.textContent = "Checking..."; loginBtn.disabled = true;
      try {
        const res  = await fetch('/.netlify/functions/verify-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        const data = await res.json();
        if (data.success) {
          loginBtn.textContent = "Your account Loading...";
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userEmail', email);
          localStorage.setItem('userFirstName', data.user.firstName);
          localStorage.setItem('userLastName',  data.user.lastName);
          localStorage.setItem('userAddressLine1', data.user.addressLine1 || '');
          localStorage.setItem('userLine2',  data.user.line2  || '');
          localStorage.setItem('userCity',   data.user.city   || '');
          localStorage.setItem('userState',  data.user.state  || '');
          localStorage.setItem('userZip',    data.user.zip    || '');
          const addressStr = [data.user.addressLine1, data.user.line2, data.user.city, data.user.state, data.user.zip].filter(Boolean).join(', ');
          localStorage.setItem('userAddress', addressStr || 'No default address set');
          window.showToast(`Welcome ${data.user.firstName} !`);
          paulPopupOverlay.classList.remove('active');
          if (isAccountPage) location.reload(); else window.location.href = '/account.html';
        } else { loginBtn.textContent = originalText; loginBtn.disabled = false; window.showToast("Incorrect email or password"); }
      } catch (err) { loginBtn.textContent = originalText; loginBtn.disabled = false; window.showToast("Network error"); }
    });
  }
 
  // ACCOUNT PAGE
  if (isAccountPage) {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
      const hideStyle = document.createElement('style');
      hideStyle.innerHTML = `
        body > *:not(#paulPopup) { display: none !important; }
        #paulPopup { display: flex !important; visibility: visible !important; opacity: 1 !important; z-index: 999999 !important; }
      `;
      document.head.appendChild(hideStyle);
      setTimeout(() => {
        openPaulPopup();
        const closeBtnPopup = document.querySelector('.paul-close');
        if (closeBtnPopup) {
          closeBtnPopup.style.pointerEvents = 'none';
          closeBtnPopup.style.opacity = '0.3';
          closeBtnPopup.title = 'You must log in to access your account';
        }
      }, 100);
      return;
    }
    document.getElementById('user-full-name').textContent = `${localStorage.getItem('userFirstName') || ''} ${localStorage.getItem('userLastName') || ''}`;
    document.getElementById('user-email').textContent = localStorage.getItem('userEmail') || '';
    document.getElementById('user-name').textContent = localStorage.getItem('userFirstName') || '';
    document.getElementById('user-address').textContent = localStorage.getItem('userAddress') || 'No default address set';
    loadAccountStats();
  }
 
  window.openSavedItems = () => {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
      showToast("Please log in to view your saved items");
      return;
    }
    localStorage.setItem('autoOpenCart', 'true');
    window.location.href = 'shop.html';
  };
 
  async function loadAccountStats() {
    const email = localStorage.getItem('userEmail');
    if (!email) return;
    try {
      const res = await fetch('/.netlify/functions/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-stats', email })
      });
      const data = await res.json();
 
      // Member since + points
      const memberSinceEl = document.getElementById('member-since');
      if (memberSinceEl) memberSinceEl.textContent = `Member since ${data.memberSince || 'January 2026'}`;
      const points = data.points || 0;
      let levelText = 'Basic Member';
      if (points >= 100 && points < 200) levelText = 'Member pro';
      else if (points >= 200) levelText = 'Member super pro';
      const levelEl = document.getElementById('membership-level');
      const pointsEl = document.getElementById('membership-points');
      if (levelEl) levelEl.textContent = levelText;
      if (pointsEl) pointsEl.textContent = `${points} pts`;
      console.log(`✅ Stats loaded - Reviews Written = ${data.reviewsCount}`);
 
      // Stats
      const statValues = document.querySelectorAll('.membership-stats-grid .stat-value');
      if (statValues.length >= 3) {
        statValues[0].textContent = data.orders || 0;
        statValues[1].textContent = `$${(data.totalSpent || 0).toFixed(2)}`;
        statValues[3].textContent = data.reviewsCount || 0;
      }
      document.querySelector('[data-wishlist-count]').textContent = data.quantityInCart || 0;
 
      const historyContainer = document.querySelector('.order-history');
      if (!historyContainer) {
        console.warn("⚠️ .order-history not found in DOM");
        return;
      }
 
      if (data.history && Array.isArray(data.history) && data.history.length > 0) {
 
        // ══════════════════════════════════════════════════════════════
        // RÉCUPÉRATION DE LA COULEUR — toutes les sources possibles
        //
        // PayPal sauvegarde : description = "Pink|https://image..."
        //                     sku         = "CJ_PINK_XL"
        //
        // On cherche dans cet ordre :
        // 1. item.color                    (champ direct backend)
        // 2. item.description avant le |   (format PayPal)
        // 3. item.sku → vid dans products  (PayPal sku = cj_variant_id)
        // 4. item.cj_variant_id → vid      (champ direct)
        // ══════════════════════════════════════════════════════════════
        function resolveColor(item, prods) {
          // 1. Champ direct color
          if (item.color && item.color !== 'N/A' && item.color.trim() !== '') return item.color.trim();
 
          // 2. PayPal : description = "ColorName|imageUrl"
          if (item.description && typeof item.description === 'string') {
            const part = item.description.split('|')[0].trim();
            if (part && part !== 'N/A' && part !== '') return part;
          }
 
          // 3. PayPal sku OU cj_variant_id → chercher le vid dans products.data.json
          const vidToFind = item.sku || item.cj_variant_id || item.vid || '';
          const productId = item.id || item.product_id || '';
          if (vidToFind && prods && prods.length > 0) {
            const product = prods.find(p => String(p.id) === String(productId));
            if (product && product.variants) {
              const variant = product.variants.find(v => String(v.vid) === String(vidToFind));
              if (variant && variant.color) return variant.color;
            }
          }
 
          // 4. Autres champs fallback
          const fallback = item.variant_color || item.variant_name || '';
          if (fallback && fallback !== 'N/A') return fallback;
 
          return '';
        }
 
        // ── Retrouver l'URL produit depuis son id dans products.data.json ──
        function getUrlFromId(productId) {
          const prods = window.__allProducts || [];
          const idx = prods.findIndex(p => String(p.id) === String(productId));
          if (idx === -1) return null;
          const currentPath = window.location.pathname;
          const isInside = currentPath.includes('/products/') || /product\d+\.html$/.test(currentPath);
          return isInside ? `product${idx + 1}.html` : `products/product${idx + 1}.html`;
        }
 
        // ── Construction du DOM — sans innerHTML pour éviter l'écrasement des listeners ──
        historyContainer.innerHTML = '<h2>Order History</h2>';
        const sorted = [...data.history].reverse();
 
        sorted.forEach(order => {
          const entry = document.createElement('div');
          entry.className = 'order-entry';
 
          const orderHeader = document.createElement('div');
          orderHeader.className = 'order-header';
          orderHeader.innerHTML = `<strong>Date: ${order.date}</strong><strong>Total: $${parseFloat(order.total || 0).toFixed(2)}</strong>`;
          entry.appendChild(orderHeader);
 
          const orderQty = document.createElement('p');
          orderQty.innerHTML = `<strong>Total quantity:</strong> ${order.totalQuantity || 0} item(s)`;
          entry.appendChild(orderQty);
 
          const orderItemsDiv = document.createElement('div');
          orderItemsDiv.className = 'order-items';
 
          order.items.forEach(item => {
            const itemId = item.id || item.product_id || '';
 
            // Résoudre la couleur immédiatement si products déjà chargés
            const prods = window.__allProducts || [];
            const resolvedColor = resolveColor(item, prods);
 
            // Élément cliquable
            const itemEl = document.createElement('div');
            itemEl.className = 'order-item-clickable';
            itemEl.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #eee;';
 
            // Image
            if (item.image_variant) {
              const img = document.createElement('img');
              img.src = item.image_variant;
              img.className = 'order-item-image';
              img.style.cursor = 'pointer';
              itemEl.appendChild(img);
            }
 
            // Bloc texte
            const infoDiv = document.createElement('div');
 
            const titleEl = document.createElement('strong');
            titleEl.className = 'order-item-title';
            titleEl.style.cursor = 'pointer';
            titleEl.textContent = item.title;
            infoDiv.appendChild(titleEl);
            infoDiv.appendChild(document.createElement('br'));
 
            // Span couleur — stocke les données pour remplissage différé si besoin
            const colorSpan = document.createElement('span');
            colorSpan.className = 'item-color-line';
            colorSpan.dataset.itemId = itemId;
            colorSpan.dataset.sku = item.sku || '';
            colorSpan.dataset.variantId = item.cj_variant_id || item.vid || '';
            colorSpan.dataset.description = item.description || '';
            colorSpan.dataset.directColor = item.color || '';
 
            if (resolvedColor) {
              colorSpan.innerHTML = `Color: <strong>${resolvedColor}</strong>`;
            }
            infoDiv.appendChild(colorSpan);
            infoDiv.appendChild(document.createElement('br'));
 
            const priceSpan = document.createElement('span');
            priceSpan.textContent = `Price: $${parseFloat(item.price || 0).toFixed(2)} × ${item.quantity}`;
            infoDiv.appendChild(priceSpan);
 
            itemEl.appendChild(infoDiv);
            orderItemsDiv.appendChild(itemEl);
 
            // ── CLIC : listener direct, jamais écrasé ──
            itemEl.addEventListener('click', function () {
              if (!itemId) return;
              const url = getUrlFromId(itemId);
              if (url) {
                window.location.href = url;
              } else {
                console.warn(`Product ID="${itemId}" not found in products.data.json`);
              }
            });
          });
 
          entry.appendChild(orderItemsDiv);
          historyContainer.appendChild(entry);
        });
 
        // ── Si products pas encore chargés au moment du render, on remplit les couleurs dès qu'ils arrivent ──
        function fillPendingColors() {
          const prods = window.__allProducts || [];
          historyContainer.querySelectorAll('.item-color-line').forEach(span => {
            if (span.innerHTML !== '') return; // déjà rempli
            const fakeItem = {
              id:            span.dataset.itemId,
              sku:           span.dataset.sku,
              cj_variant_id: span.dataset.variantId,
              description:   span.dataset.description,
              color:         span.dataset.directColor
            };
            const color = resolveColor(fakeItem, prods);
            if (color) span.innerHTML = `Color: <strong>${color}</strong>`;
          });
        }
 
        if (window.__allProducts && window.__allProducts.length > 0) {
          fillPendingColors();
        } else {
          let tries = 0;
          const wait = setInterval(() => {
            tries++;
            if (window.__allProducts && window.__allProducts.length > 0) {
              clearInterval(wait);
              fillPendingColors();
            } else if (tries > 50) {
              clearInterval(wait);
            }
          }, 100);
        }
 
      } else {
        historyContainer.innerHTML = `<h2>Order History</h2><p>No orders yet</p>`;
      }
    } catch (e) {
      console.error("Stats load error", e);
    }
  }
 
  window.saveAddress = async () => {
    const email = localStorage.getItem('userEmail');
    const line1 = document.getElementById('addr-line1').value.trim();
    const line2 = document.getElementById('addr-line2').value.trim();
    const city = document.getElementById('addr-city').value.trim();
    const state = document.getElementById('addr-state').value.trim();
    const zip = document.getElementById('addr-zip').value.trim();
    const addressStr = [line1, line2, city, state, zip].filter(Boolean).join(', ');
    try {
      const res = await fetch('/.netlify/functions/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-address', email, line1, line2, city, state, zip })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('userAddress', addressStr || 'No default address set');
        document.getElementById('user-address').textContent = addressStr || 'No default address set';
        showToast("Address saved successfully!");
        closeAccountPopup('address-popup');
      } else {
        showToast("Error: " + data.error);
      }
    } catch (err) {
      showToast("Network error while saving address");
    }
  };
 
  window.updatePassword = async () => {
    const email = document.getElementById('security-email').value.trim();
    const newPassword = document.getElementById('new-password').value.trim();
    if (!email || !newPassword) return showToast("Email and new password are required");
    try {
      const res = await fetch('/.netlify/functions/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-password', email, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        showToast("Password updated successfully!");
        closeAccountPopup('password-popup');
      } else {
        showToast("Error: " + data.error);
      }
    } catch (err) {
      showToast("Network error while updating password");
    }
  };
 
  window.trackOrder = () => {
    const num = document.getElementById('tracking-number').value.trim();
    const result = document.getElementById('track-result');
    if (!num) {
      result.textContent = "Please enter a tracking number";
      return;
    }
    result.textContent = `✅ Order ${num} tracked - Estimated arrival: 3-5 days`;
    setTimeout(() => closeAccountPopup('track-popup'), 4000);
  };
 
  window.logout = () => {
    localStorage.clear();
    window.location.href = 'index.html';
  };
});
 
window.addEventListener('load', () => {
  const pathname = window.location.pathname.toLowerCase();
  const isAccountPage = /account/i.test(pathname);
  if (isAccountPage && localStorage.getItem('isLoggedIn') !== 'true') {
    const hideStyle = document.createElement('style');
    hideStyle.innerHTML = `
      body > *:not(#paulPopup) { display: none !important; }
      #paulPopup { display: flex !important; visibility: visible !important; opacity: 1 !important; z-index: 999999 !important; }
    `;
    document.head.appendChild(hideStyle);
    setTimeout(() => {
      const overlay = document.getElementById('paulPopup');
      if (overlay) overlay.classList.add('active');
    }, 150);
  }
 
  // ====================== handleOrderItemClick (global, backup) ======================
  window.handleOrderItemClick = function(id) {
    if (!id) return;
    const url = window.getProductUrl ? window.getProductUrl(id) : 'shop.html';
    console.log(`🖱️ Order History click → ID=${id} | URL=${url}`);
    if (!url || url === 'shop.html') {
      console.error(`❌ Product ID=${id} not found`);
      return;
    }
    window.location.href = url;
  };
});






/* ================================================================
   FAQ SMART SEARCH — à ajouter dans page.js
   Fonctionnement :
   - Charge faq-data.json
   - Affiche des suggestions en temps réel sous la barre de recherche
   - Au clic sur une suggestion → scroll vers la question + ouvre l'accordion
================================================================ */

(function () {

    // ── 1. Ne s'exécute que sur la page FAQ ──
    const searchInput = document.getElementById('faq-search-input');
    if (!searchInput) return;

    // ── 2. Variables ──
    let faqData = [];
    let selectedIndex = -1;
    let dropdown = null;

    // ── 3. Créer le dropdown de suggestions ──
    function createDropdown() {
        dropdown = document.createElement('div');
        dropdown.id = 'faq-suggestions-dropdown';
        dropdown.setAttribute('role', 'listbox');
        searchInput.parentElement.style.position = 'relative';
        searchInput.parentElement.appendChild(dropdown);
    }

    // ── 4. Charger faq-data.json ──
    fetch('faq-data.json')
        .then(function (res) { return res.json(); })
        .then(function (data) {
            faqData = data;
            createDropdown();
            bindEvents();
        })
        .catch(function () {
            // Si le JSON ne charge pas, le search inline existant continue de fonctionner
            console.warn('CurvaFit FAQ: faq-data.json not found, smart search disabled.');
        });

    // ── 5. Filtrer les résultats ──
    function filterData(query) {
        if (!query || query.length < 2) return [];
        var q = query.toLowerCase();
        return faqData.filter(function (item) {
            return item.question.toLowerCase().includes(q) ||
                   item.category.toLowerCase().includes(q);
        }).slice(0, 7); // max 7 suggestions
    }

    // ── 6. Highlight du texte trouvé ──
    function highlight(text, query) {
        if (!query) return text;
        var regex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    // ── 7. Afficher les suggestions ──
    function showSuggestions(results, query) {
        dropdown.innerHTML = '';
        selectedIndex = -1;

        if (results.length === 0) {
            dropdown.classList.remove('faq-dd--open');
            return;
        }

        results.forEach(function (item, index) {
            var li = document.createElement('div');
            li.className = 'faq-dd-item';
            li.setAttribute('role', 'option');
            li.setAttribute('data-index', index);
            li.setAttribute('data-section', item.section);
            li.setAttribute('data-id', item.id);

            li.innerHTML =
                '<span class="faq-dd-cat">' + item.category + '</span>' +
                '<span class="faq-dd-text">' + highlight(item.question, query) + '</span>' +
                '<span class="faq-dd-arrow">↓</span>';

            li.addEventListener('mousedown', function (e) {
                e.preventDefault(); // empêche le blur avant le click
                goToQuestion(item);
            });

            dropdown.appendChild(li);
        });

        dropdown.classList.add('faq-dd--open');
    }

    // ── 8. Fermer le dropdown ──
    function closeDropdown() {
        if (dropdown) {
            dropdown.classList.remove('faq-dd--open');
            selectedIndex = -1;
        }
    }

    // ── 9. Aller vers la question ──
    function goToQuestion(item) {
        closeDropdown();
        searchInput.value = item.question;

        // Trouver la section
        var section = document.getElementById(item.section);
        if (!section) return;

        // Trouver le bon accordion-item dans cette section
        var accordionItems = section.querySelectorAll('.accordion-item');
        var targetItem = null;

        accordionItems.forEach(function (acc) {
            var btn = acc.querySelector('.accordion-header');
            if (btn && btn.textContent.trim().toLowerCase().includes(
                item.question.toLowerCase().substring(0, 30)
            )) {
                targetItem = acc;
            }
        });

        // Si pas trouvé par texte exact, prendre le premier de la section
        if (!targetItem && accordionItems.length > 0) {
            var idx = faqData.filter(function(d){ return d.section === item.section; })
                             .findIndex(function(d){ return d.id === item.id; });
            targetItem = accordionItems[idx] || accordionItems[0];
        }

        // Ouvrir l'accordion item
        if (targetItem) {
            // Fermer tous les autres dans la même section
            section.querySelectorAll('.accordion-item.active').forEach(function (a) {
                a.classList.remove('active');
                var content = a.querySelector('.accordion-content');
                if (content) content.style.display = 'none';
            });

            // Ouvrir le cible
            targetItem.classList.add('active');
            var content = targetItem.querySelector('.accordion-content');
            if (content) content.style.display = 'block';

            // Scroll avec offset pour le sticky header
            setTimeout(function () {
                var offset = 120;
                var top = targetItem.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top: top, behavior: 'smooth' });

                // Highlight visuel temporaire
                targetItem.classList.add('faq-item--highlight');
                setTimeout(function () {
                    targetItem.classList.remove('faq-item--highlight');
                }, 2000);
            }, 100);
        }
    }

    // ── 10. Navigation clavier dans les suggestions ──
    function navigateDropdown(direction) {
        var items = dropdown.querySelectorAll('.faq-dd-item');
        if (!items.length) return;

        if (selectedIndex >= 0) {
            items[selectedIndex].classList.remove('faq-dd-item--active');
        }

        selectedIndex += direction;

        if (selectedIndex < 0) selectedIndex = items.length - 1;
        if (selectedIndex >= items.length) selectedIndex = 0;

        items[selectedIndex].classList.add('faq-dd-item--active');
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }

    // ── 11. Lier les events ──
    function bindEvents() {

        // Frappe dans la barre
        searchInput.addEventListener('input', function () {
            var query = this.value.trim();
            var results = filterData(query);
            showSuggestions(results, query);

            // Clear button
            var clearBtn = document.getElementById('faq-search-clear');
            if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';
        });

        // Clavier
        searchInput.addEventListener('keydown', function (e) {
            if (!dropdown.classList.contains('faq-dd--open')) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateDropdown(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateDropdown(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0) {
                    var items = dropdown.querySelectorAll('.faq-dd-item');
                    if (items[selectedIndex]) {
                        var section = items[selectedIndex].getAttribute('data-section');
                        var id = items[selectedIndex].getAttribute('data-id');
                        var item = faqData.find(function (d) { return d.id === id; });
                        if (item) goToQuestion(item);
                    }
                }
            } else if (e.key === 'Escape') {
                closeDropdown();
            }
        });

        // Fermer au clic ailleurs
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#faq-search-input') &&
                !e.target.closest('#faq-suggestions-dropdown')) {
                closeDropdown();
            }
        });

        // Clear button
        var clearBtn = document.getElementById('faq-search-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                searchInput.value = '';
                this.style.display = 'none';
                closeDropdown();
                var countEl = document.getElementById('faq-search-count');
                if (countEl) countEl.style.display = 'none';
                // Réafficher toutes les questions
                document.querySelectorAll('.accordion-item').forEach(function (i) {
                    i.style.display = '';
                });
                document.querySelectorAll('.faq-category').forEach(function (c) {
                    c.style.display = '';
                });
            });
        }
    }

})();



// ══════════════════════════════════════════
//  STORY FORM & COMMUNITY STORIES
// ══════════════════════════════════════════

const storyForm = document.getElementById('story-form');
if (storyForm) {

  // ── Gestion des étoiles ──
  const ratingStars = document.querySelectorAll('#story-rating i');
  const ratingInput = document.getElementById('story-rating-value');
  if (ratingStars.length) {
    ratingStars.forEach(star => {
      star.addEventListener('click', () => {
        const val = parseInt(star.dataset.val);
        ratingInput.value = val;
        ratingStars.forEach((s, i) => {
          s.className = i < val ? 'fi fi-sr-star' : 'fi fi-rr-star';
        });
      });
      star.addEventListener('mouseover', () => {
        const val = parseInt(star.dataset.val);
        ratingStars.forEach((s, i) => {
          s.className = i < val ? 'fi fi-sr-star' : 'fi fi-rr-star';
        });
      });
      star.addEventListener('mouseout', () => {
        const val = parseInt(ratingInput.value);
        ratingStars.forEach((s, i) => {
          s.className = i < val ? 'fi fi-sr-star' : 'fi fi-rr-star';
        });
      });
    });
  }

  storyForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const btn = storyForm.querySelector('button[type="submit"]');
    const original = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;

    const fields    = storyForm.querySelectorAll('input, select, textarea');
    const nameAge   = fields[0].value.split(',');
    const fileInput = storyForm.querySelector('input[type="file"]');

    // ── Convertir la photo en base64 si présente ──
    let photoBase64 = '';
    if (fileInput && fileInput.files && fileInput.files[0]) {
      photoBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(fileInput.files[0]);
      });
    }

    // fields index :
    // 0 = firstName+age | 1 = email | 2 = startWeight | 3 = program (select)
    // 4 = duration | 5 = result | 6 = story (textarea) | 7 = file | 8 = checkbox
    const payload = {
      firstName:   nameAge[0]?.trim() || fields[0].value.trim(),
      age:         nameAge[1]?.trim() || '',
      email:       fields[1].value.trim(),
      startWeight: fields[2].value.trim(),
      program:     fields[3].value,
      duration:    fields[4].value.trim(),
      result:      fields[5].value.trim(),
      story:       fields[6].value.trim(),
      rating:      document.getElementById('story-rating-value')?.value || '5',
      photo:       photoBase64,
      anonymous:   storyForm.querySelector('input[type="checkbox"]')?.checked ? 'true' : 'false'
    };

    try {
      const res  = await fetch('/.netlify/functions/story-share', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        btn.textContent = '✅ Story sent!';
        storyForm.reset();
        // Reset étoiles visuellement
        ratingStars.forEach(s => s.className = 'fi fi-rr-star');
        if (ratingInput) ratingInput.value = '5';
        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 4000);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      btn.textContent = '❌ Error — try again';
      btn.disabled = false;
      console.error(err);
    }
  });
}

const PROGRAM_TAG = {
  'Beginner — Soft Start':         { cls: 'dt-tag--beginner',     icon: '🌱' },
  'Intermediate — Deeper Refiner': { cls: 'dt-tag--intermediate', icon: '🔥' },
  'Maintenance — Forever Fit':     { cls: 'dt-tag--maintenance',  icon: '🌟' }
};

function buildStoryCard(s) {
  const tag     = PROGRAM_TAG[s.program] || { cls: 'dt-tag--beginner', icon: '🌱' };
  const nameStr = s.age ? `${s.firstName}, ${s.age}` : s.firstName;

  const avatarHTML = s.photo
    ? `<img src="${s.photo}" alt="${s.firstName}" class="dt-header-img">`
    : `<div class="dt-avatar-placeholder"><i class="fi fi-rr-user"></i></div>`;

  return `
    <div class="dt-card dt-card--community">
      <div class="dt-header">
        ${avatarHTML}
        <div>
          <h3>${nameStr}</h3>
          <span class="dt-tag ${tag.cls}">${tag.icon} ${s.program}</span>
        </div>
      </div>
      ${s.startWeight ? `
      <div class="dt-numbers">
        <div class="dt-num"><span>${s.startWeight} kg</span><small>Start</small></div>
        ${s.result ? `
        <div class="dt-arrow">→</div>
        <div class="dt-num dt-num--result"><span>${s.result}</span><small>${s.duration || ''}</small></div>` : ''}
      </div>` : ''}
      <p class="dt-quote">"${s.story}"</p>
      <div class="rating">
        ${[1,2,3,4,5].map(i =>
          `<i class="${i <= parseInt(s.rating || 5) ? 'fi fi-sr-star' : 'fi fi-rr-star'}"></i>`
        ).join('')}
      </div>
      ${s.date ? `<small class="dt-date">Shared on ${s.date}</small>` : ''}
    </div>`;
}

async function loadCommunityStories() {
  const grid = document.querySelector('#detailed-testimonials .dt-grid');
  if (!grid) return;

  try {
    const res  = await fetch('/.netlify/functions/story-share');
    const data = await res.json();

    if (!data.success || !data.stories.length) return;

    const divider = document.createElement('div');
    divider.className = 'dt-community-divider';
    divider.innerHTML = `
      <span class="section-label">From Our Community</span>
      <h3>Stories Shared by CurvaFit Members</h3>`;
    grid.appendChild(divider);

    data.stories.forEach(s => {
      const temp = document.createElement('div');
      temp.innerHTML = buildStoryCard(s);
      grid.appendChild(temp.firstElementChild);
    });

  } catch (err) {
    console.warn('Community stories could not load:', err);
  }
}

loadCommunityStories();