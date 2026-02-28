document.addEventListener('DOMContentLoaded', () => {
  let products = [];
function getProductUrl(id) {
  const productIndex = products.findIndex(p => p.id === id) + 1;
  return `product${productIndex}.html`;
}
  function populateMainProductMedia(media) {
    const thumbsContainer = document.getElementById('product-thumbnails');
    const mainSlider = document.getElementById('main-image-slider');
    if (!thumbsContainer || !mainSlider) return;
    thumbsContainer.innerHTML = '';
    mainSlider.querySelectorAll('.main-image').forEach(el => el.remove());
    media.forEach((src, index) => {
      const thumb = document.createElement('div');
      thumb.className = `thumbnail-item ${index === 0 ? 'active' : ''}`;
      thumb.innerHTML = `<img src="${src}" alt="Thumbnail ${index+1}" loading="lazy">`;
      thumb.addEventListener('click', () => changeMainImage(index));
      thumbsContainer.appendChild(thumb);
      const mainDiv = document.createElement('div');
      mainDiv.className = `main-image ${index === 0 ? 'active' : ''}`;
      mainDiv.innerHTML = `<img src="${src}" alt="Main Image" loading="lazy">`;
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
      const scrollAmount = activeThumb.offsetLeft - (thumbsContainer.clientWidth / 2) + (activeThumb.clientWidth / 2);
      thumbsContainer.scrollTo({
        left: scrollAmount,
        behavior: 'smooth'
      });
    } else {
      const scrollAmount = activeThumb.offsetTop - (thumbsContainer.clientHeight / 2) + (activeThumb.clientHeight / 2);
      thumbsContainer.scrollTo({
        top: scrollAmount,
        behavior: 'smooth'
      });
    }
  }
  function populateMiniSlider(slider, media) {
    if (!slider || !media) return;
    slider.innerHTML = '';
    media.forEach((src, i) => {
      const img = document.createElement('img');
      img.src = src;
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
  fetch('products.data.json')
    .then(response => response.json())
    .then(data => {
      products = data;
      const settings = products.find(p => p.type === "settings") || {};
      const enableMediaZoom = (settings.enable_media_zoom || "no").toLowerCase() === "yes";
      // Nouveau code pour le tableau de comparaison
    const comparisonTable = document.querySelector('.comparison-table tbody');
    if (comparisonTable) {
      const rows = comparisonTable.querySelectorAll('tr'); // Récupère toutes les lignes <tr> du <tbody>
      rows.forEach((row, index) => { // Boucle sur chaque ligne (index 0 à 11, correspondant aux 12 produits)
        const product = products[index]; // Récupère le produit correspondant à l'index
        if (product) {
          // Mettre à jour la 1ère cellule : Titre du produit
          const titleCell = row.querySelector('td:nth-child(1)');
          if (titleCell) titleCell.textContent = product.title;
          // Mettre à jour la 2ème cellule : Prix du produit (formaté en $XX.XX)
          const priceCell = row.querySelector('td:nth-child(2)');
          if (priceCell) priceCell.textContent = `$${product.price.toFixed(2)}`;
        }
      });
    }
      document.querySelectorAll('.product-card').forEach(card => {
        const id = card.dataset.id;
        const product = products.find(p => p.id === id);
        if (product) {
          card.querySelector('h3').textContent = product.title;
          card.querySelector('.current-price').textContent = `$${product.price.toFixed(2)}`;
          card.querySelector('.compare-price').textContent = `$${product.compare_price.toFixed(2)}`;
          card.querySelector('p').textContent = product.description;
          const img = card.querySelector('img');
          if (img) { img.src = product.image; img.alt = product.title; }
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
      const productSection = document.querySelector('.product-section');
      if (productSection) {
        const pid = productSection.dataset.productId;
        const prod = products.find(p => p.id === pid);
        if (prod && prod.media) populateMainProductMedia(prod.media);
        populateColorSwatches(prod);


           // ==================== ZOOM LOOPING (desktop = suit la souris comme Shopify) ====================
      if (enableMediaZoom) {
        const mainSlider = document.getElementById('main-image-slider');
        const mainImages = mainSlider ? mainSlider.querySelectorAll('.main-image') : [];
        const modal = document.getElementById('media-zoom-modal');
        const modalImg = document.getElementById('modal-zoom-image');
        const modalContainer = document.querySelector('.modal-zoom-container');
        const closeBtn = modal ? modal.querySelector('.modal-close') : null;

        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // === VARIABLES POUR LE PAN / GLISSER SUR MOBILE ===
        let scale = 1;
        let translateX = 0;
        let translateY = 0;
        let isDragging = false;
        let lastTouchX = 0;
        let lastTouchY = 0;
        let maxTranslateX = 0;
        let maxTranslateY = 0;

        function updateTransform(smooth = true) {
          modalImg.style.transition = smooth ? 'transform 0.25s ease' : 'none';
          modalImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        }

        function calculateBounds() {
          if (!modalImg.naturalWidth || !modalContainer) return;
          const contW = modalContainer.clientWidth;
          const contH = modalContainer.clientHeight;
          const fitScale = Math.min(contW / modalImg.naturalWidth, contH / modalImg.naturalHeight);
          const dispW = modalImg.naturalWidth * fitScale;
          const dispH = modalImg.naturalHeight * fitScale;
          const effW = dispW * scale;
          const effH = dispH * scale;
          maxTranslateX = Math.max(0, (effW - contW) / 2);
          maxTranslateY = Math.max(0, (effH - contH) / 2);
        }

        function clampTranslate() {
          translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX));
          translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY));
        }

        mainImages.forEach(container => {
          const img = container.querySelector('img');
          if (!img) return;

          // ====================== DESKTOP : zoom qui suit la souris (inchangé) ======================
          if (!isTouchDevice) {
            container.addEventListener('mousemove', (e) => {
              const rect = container.getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 100;
              const y = ((e.clientY - rect.top) / rect.height) * 100;
              img.style.transformOrigin = `${x}% ${y}%`;
            });

            container.addEventListener('mouseleave', () => {
              img.style.transformOrigin = 'center center';
            });
          }

          // ====================== MOBILE : clic → plein écran ======================
          if (isTouchDevice) {
            container.style.cursor = 'pointer';
            container.addEventListener('click', (e) => {
              e.stopImmediatePropagation();
              modalImg.src = img.src;
              modal.classList.add('active');

              // Reset zoom à l'ouverture
              scale = 1;
              translateX = 0;
              translateY = 0;
              updateTransform(false);

              if (modalImg.complete) {
                calculateBounds();
              } else {
                modalImg.onload = calculateBounds;
              }
            });
          }
        });

        // ==================== MODAL (fermeture + double-tap + GLISSER) ====================
        if (closeBtn && modal) {
          const closeModal = () => {
            modal.classList.remove('active');
            scale = 1;
            translateX = 0;
            translateY = 0;
            modalImg.style.transform = '';
          };

          closeBtn.addEventListener('click', closeModal);
          modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
          });

          // Double-tap (exactement comme avant, mais avec les variables)
          modalImg.addEventListener('dblclick', () => {
            if (scale > 1) {
              scale = 1;
              translateX = 0;
              translateY = 0;
            } else {
              scale = 2.5;
            }
            calculateBounds();
            clampTranslate();
            updateTransform(true);
          });

          // ====================== GLISSER L'IMAGE (pan / looping comme Shopify) ======================
          modalImg.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1 || scale <= 1) return;
            isDragging = true;
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
            modalImg.style.transition = 'none';
            e.preventDefault();
          });

          modalImg.addEventListener('touchmove', (e) => {
            if (!isDragging || e.touches.length > 1) return;
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const deltaX = touchX - lastTouchX;
            const deltaY = touchY - lastTouchY;
            translateX += deltaX;
            translateY += deltaY;
            lastTouchX = touchX;
            lastTouchY = touchY;
            clampTranslate();
            updateTransform(false);
            e.preventDefault();
          });

          modalImg.addEventListener('touchend', () => {
            isDragging = false;
          });
        }
      }
      // ==================== COLOR SWATCHES + NOM EN HOVER ====================
function populateColorSwatches(product) {
  const container = document.querySelector('.color-swatches');
  if (!container || !product?.colors?.length) return;

  container.innerHTML = '';
  product.colors.forEach((color, index) => {
    const swatch = document.createElement('div');
    swatch.className = `swatch ${index === 0 ? 'active' : ''}`;
    swatch.style.backgroundColor = color.hex;
    swatch.dataset.color = color.name;

    swatch.addEventListener('click', () => {
      // Mise à jour active (ce qui existait déjà)
      container.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');

      // === NOUVEAU : Scroll vers les images médias (exactement comme Shopify) ===
      const mainSlider = document.getElementById('main-image-slider');
      if (mainSlider) {
        mainSlider.scrollIntoView({
          behavior: 'smooth',
          block: 'start'   // remonte bien en haut de la zone images
        });
      }
    });

    container.appendChild(swatch);
  });
}
        // Delivery Date
        if (prod) {
          const baseStartStr = prod.start_date;
          const baseEndStr = prod.end_date;
          if (!baseStartStr || !baseEndStr) {
            showText(); // Si pas de dates, affiche le texte statique
            return;
          }
          const baseStart = new Date(baseStartStr + "T00:00:00");
          const baseEnd = new Date(baseEndStr + "T00:00:00");
          if (isNaN(baseStart.getTime()) || isNaN(baseEnd.getTime())) {
            showText();
            return;
          }
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          let initialDaysUntilStart = Math.max(1, Math.ceil((baseStart.getTime() - today.getTime()) / 86400000));
          let deliveryDurationDays = Math.max(1, Math.ceil((baseEnd.getTime() - baseStart.getTime()) / 86400000));
          const cycleDays = initialDaysUntilStart + deliveryDurationDays;
          let currentStart = new Date(baseStart);
          let currentEnd = new Date(baseEnd);
          while (currentEnd.getTime() < today.getTime()) {
            currentStart.setDate(currentStart.getDate() + cycleDays);
            currentEnd.setDate(currentEnd.getDate() + cycleDays);
          }
          if (currentEnd.getTime() <= today.getTime()) {
            currentStart.setDate(currentStart.getDate() + cycleDays);
            currentEnd.setDate(currentEnd.getDate() + cycleDays);
          }
          function formatDate(date) {
            const d = date.getDate().toString().padStart(2, '0');
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const y = date.getFullYear().toString().slice(-2);
            return `${d}/${m}/${y}`;
          }
          const startEl = document.getElementById("start-date");
          const endEl = document.getElementById("end-date");
          const textEl = document.getElementById("delivery-text");
          if (startEl && endEl) {
            startEl.innerText = formatDate(currentStart);
            endEl.innerText = formatDate(currentEnd);
          }
          // Afficher le texte seulement après mise à jour
          showText();
          function showText() {
            if (textEl) {
              textEl.style.visibility = "visible";
            }
          }
        }
      }
      document.querySelectorAll('.mini-media-slider').forEach(slider => {
        const item = slider.closest('.product-item');
        if (item) {
          const pid = item.dataset.productId;
          const prod = products.find(p => p.id === pid);
          if (prod && prod.media) populateMiniSlider(slider, prod.media);
        }
      });
// Bundle functionality
const bundleContainer = document.querySelector('.bundle-save-container');
if (bundleContainer) {
  const productSection = document.querySelector('.product-section');
  const productId = productSection.dataset.productId;
  const product = products.find(p => p.id === productId);
  if (product) {
    const hasSizes = product.sizes && product.sizes.length > 0;
    const hasColors = product.colors && product.colors.length > 0;
    const uniqueSizes = hasSizes ? product.sizes : [];
    const uniqueColors = hasColors ? product.colors.map(c => c.name) : [];
    // Create a select element for an option
    function createSelect(options, labelText, placeholder = "Select...") {
      if (!options || options.length === 0) return null;
      const wrapper = document.createElement("div");
      const label = document.createElement("label");
      label.textContent = labelText;
      wrapper.appendChild(label);
      const select = document.createElement("select");
      select.required = true;
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = placeholder;
      select.appendChild(defaultOption);
      options.forEach(value => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = value;
        select.appendChild(opt);
      });
      wrapper.appendChild(select);
      return wrapper;
    }
    // Populate selectors in a container
    function populateSelectors(container) {
      if (container.dataset.populated) return;
      container.dataset.populated = "true";
      const selectorsDivs = container.querySelectorAll(".variant-selectors");
      selectorsDivs.forEach(div => {
        div.innerHTML = "";
        if (hasColors) {
          const colorSelect = createSelect(uniqueColors, "Color");
          if (colorSelect) {
            div.appendChild(colorSelect);
            colorSelect.querySelector('select').addEventListener('change', (e) => {
              const selectedColorName = e.target.value;
              const colorObj = product.colors.find(c => c.name === selectedColorName);
              if (colorObj) {
                const previewImg = div.closest('.variant-row').querySelector('.variant-preview img');
                if (previewImg) previewImg.src = colorObj.image;
              }
            });
          }
        }
        if (hasSizes) {
          const sizeSelect = createSelect(uniqueSizes, "Size");
          if (sizeSelect) div.appendChild(sizeSelect);
        }
        // No options case
        if (!hasColors && !hasSizes) {
          div.innerHTML = '<p style="color:#555; font-size:13px; margin:8px 0;">No options available</p>';
        }
      });
      // Set initial images
      const previewImgs = container.querySelectorAll('.variant-preview img');
      previewImgs.forEach(img => {
        img.src = product.image; // Default to main image
      });
    }
    // Get selected values from a selectors container
    function getSelectedValues(selectorsContainer) {
      const selects = selectorsContainer.querySelectorAll("select");
      const values = {};
      selects.forEach(select => {
        const label = select.parentElement.querySelector("label")?.textContent.toLowerCase() || "";
        const value = select.value;
        if (label.includes("color")) {
          values.color = value;
        } else if (label.includes("size")) {
          values.size = value;
        }
      });
      return values;
    }
    // Update bundle prices
    function updateBundlePrices(product) {
      const price = product.price;
      const compare = product.compare_price || price; // Si pas de compare, utilise price
      const dSingle = (product.single_discount || 0) / 100; // Direct du JSON, fallback 0 si absent
      const dDuo = (product.duo_discount || 0) / 100; // Pas de fallback hardcoded, utilise 0 si absent
      const dTrio = (product.trio_discount || 0) / 100; // Idem
      // Single : applique discount si >0
      document.getElementById("single-price").textContent = `$${ (price * (1 - dSingle)).toFixed(2) }`;
      document.getElementById("single-original-price").textContent = (compare > price * (1 - dSingle)) ? `$${ (compare * (1 - dSingle)).toFixed(2) }` : "";
      // Duo : x2 avec discount
      document.getElementById("duo-price").textContent = `$${ (price * 2 * (1 - dDuo)).toFixed(2) }`;
      document.getElementById("duo-original-price").textContent = `$${ (compare * 2 * (1 - dDuo)).toFixed(2) }`; // Original sans discount
      // Trio : x3 avec discount
      document.getElementById("trio-price").textContent = `$${ (price * 3 * (1 - dTrio)).toFixed(2) }`;
      document.getElementById("trio-original-price").textContent = `$${ (compare * 3 * (1 - dTrio)).toFixed(2) }`; // Original sans discount
    }
    // Add items to cart and redirect to checkout
    function addBundleToCart(items) {
      items.forEach(item => {
        let cartItem = cart.find(i => i.id === item.id && i.size === item.size && i.color === item.color);
        if (cartItem) {
          cartItem.quantity += item.quantity;
        } else {
          cart.push(item);
        }
      });
      saveCart();
      updateBadges();
      renderCart();
      checkout(); // Redirect to checkout.html
    }
    // Prevent default label behavior
    document.querySelectorAll('.bundle-option label').forEach(label => {
      label.addEventListener('click', e => e.preventDefault());
    });
    // Click on bundle option → toggle
    document.querySelectorAll(".bundle-option").forEach(option => {
      option.addEventListener("click", function(e) {
        if (e.target.closest(".bundle-selection")) return; // Avoid toggle if click in selection
        const radio = this.querySelector("input[type='radio']");
        const wasChecked = radio.checked;
        // Close all
        document.querySelectorAll(".bundle-option").forEach(el => {
          el.classList.remove("active");
          const sel = el.querySelector(".bundle-selection");
          if (sel) sel.style.display = "none";
          el.querySelector("input[type='radio']").checked = false;
        });
        if (!wasChecked) {
          radio.checked = true;
          this.classList.add("active");
          const selection = this.querySelector(".bundle-selection");
          if (selection) {
            selection.style.display = "block";
            populateSelectors(selection);
          }
        } // If was checked, stays closed
      });
    });
    // Click on "Add to cart" buttons
    document.querySelectorAll(".bundle-add-btn").forEach(btn => {
      btn.addEventListener("click", function() {
        const container = this.closest(".bundle-selection");
        const type = container.closest(".bundle-option").dataset.bundle;
        const items = [];
        let itemImage = product.image;
        // Calcul du discount selon le type de bundle
        let discount = 0;
        if (type === "single") {
          discount = (product.single_discount || 0) / 100;
        } else if (type === "duo") {
          discount = (product.duo_discount || 0) / 100;
        } else if (type === "trio") {
          discount = (product.trio_discount || 0) / 100;
        }
        // Prix réduit par item (appliqué uniformément pour que le total soit correct)
        const discountedPrice = product.price * (1 - discount);
        if (type === "single") {
          if (!hasColors && !hasSizes) {
            items.push({
              id: product.id,
              title: product.title,
              price: discountedPrice, // Prix réduit
              compare_price: product.compare_price, // Ajout pour économies dans checkout
              image: itemImage,
              size: null,
              color: null,
              quantity: 1,
              fromBundle: true // Marqueur bundle
            });
          } else {
            const values = getSelectedValues(container);
            if (hasColors && values.color) {
              const colorObj = product.colors.find(c => c.name === values.color);
              if (colorObj) itemImage = colorObj.image;
            }
            const selectedSize = hasSizes ? values.size : null;
            const selectedColor = hasColors ? values.color : null;
            if ((hasColors && !selectedColor) || (hasSizes && !selectedSize)) {
              return alert("Please complete your selection.");
            }
            items.push({
              id: product.id,
              title: product.title,
              price: discountedPrice, // Prix réduit
              compare_price: product.compare_price, // Ajout pour économies dans checkout
              image: itemImage,
              size: selectedSize,
              color: selectedColor,
              quantity: 1,
              fromBundle: true // Marqueur bundle
            });
          }
        } else {
          const count = type === "duo" ? 2 : 3;
          let valid = true;
          for (let i = 1; i <= count; i++) {
            const pair = container.querySelector(`.variant-pair[data-index="${i}"]`);
            if (!pair) continue;
            let pairImage = product.image;
            if (!hasColors && !hasSizes) {
              items.push({
                id: product.id,
                title: product.title,
                price: discountedPrice, // Prix réduit
                compare_price: product.compare_price, // Ajout pour économies dans checkout
                image: pairImage,
                size: null,
                color: null,
                quantity: 1,
                fromBundle: true // Marqueur bundle
              });
              continue;
            }
            const values = getSelectedValues(pair);
            if (hasColors && values.color) {
              const colorObj = product.colors.find(c => c.name === values.color);
              if (colorObj) pairImage = colorObj.image;
            }
            const selectedSize = hasSizes ? values.size : null;
            const selectedColor = hasColors ? values.color : null;
            if ((hasColors && !selectedColor) || (hasSizes && !selectedSize)) {
              valid = false;
              alert(`Item ${i}: Please complete selection.`);
              break;
            }
            items.push({
              id: product.id,
              title: product.title,
              price: discountedPrice, // Prix réduit
              compare_price: product.compare_price, // Ajout pour économies dans checkout
              image: pairImage,
              size: selectedSize,
              color: selectedColor,
              quantity: 1,
              fromBundle: true // Marqueur bundle
            });
          }
          if (!valid) return;
        }
        if (items.length > 0) {
          addBundleToCart(items);
        }
      });
    });
    // Initial prices
    updateBundlePrices(product);
    // Mise à jour des descriptions dynamiques
    const singleDesc = document.querySelector('.single-description');
    const duoDesc = document.querySelector('.duo-description');
    const trioDesc = document.querySelector('.trio-description');
    if (product.single_discount > 0) {
      singleDesc.textContent = `Save ${product.single_discount}%`;
    } else {
      singleDesc.textContent = 'Standard Price'; // Garde le texte statique si 0
    }
    duoDesc.textContent = `Save ${product.duo_discount || 0}%`; // Utilise du JSON, fallback 0 si absent
    trioDesc.textContent = `Save ${product.trio_discount || 0}%`; // Idem
  }
}
    })
    .catch(error => console.error('Erreur de chargement des produits:', error));
  document.querySelectorAll('section').forEach(sec => {
    if (!sec.hasAttribute('data-scroll-reveal')) {
      sec.setAttribute('data-scroll-reveal', '');
    }
  });
  const hamburger = document.querySelector('.hamburger-menu');
  const nav = document.querySelector('.main-nav');
  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      nav.classList.toggle('active');
    });
  }
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
      if (searchBar.classList.contains('active')) {
        searchInput.focus();
      } else {
        searchInput.blur();
      }
    });
    document.addEventListener('click', (e) => {
      if (!searchBar.contains(e.target) && !searchIcon.contains(e.target)) {
        searchBar.classList.remove('active');
        headerContainer.classList.remove('search-active');
      }
    });
    submitSearch.addEventListener('click', () => {
      const query = searchInput.value;
      if (query) alert(`Searching for: ${query}`);
    });
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value;
        if (query) alert(`Searching for: ${query}`);
      }
    });
  }
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
  const parallaxes = document.querySelectorAll('.parallax-background');
  window.addEventListener('scroll', () => {
    const scrollPosition = window.pageYOffset;
    parallaxes.forEach(parallax => {
      parallax.style.transform = `translateY(${scrollPosition * 0.5}px)`;
    });
  });
  const revealElements = document.querySelectorAll('[data-scroll-reveal]');
  const revealOnScroll = () => {
    const windowHeight = window.innerHeight;
    revealElements.forEach(el => {
      const elTop = el.getBoundingClientRect().top;
      if (elTop < windowHeight - 100) el.classList.add('revealed');
    });
  };
  window.addEventListener('scroll', revealOnScroll);
  revealOnScroll();
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
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) updateCount();
    });
    observer.observe(counter);
  });
  const carousel = document.querySelector('.testimonial-carousel');
  if (carousel) {
    let slides = Array.from(carousel.children);
    const gap = parseInt(getComputedStyle(carousel).gap) || 0;
    let slideWidth = slides[0].offsetWidth + gap;
    let index = 0;
    const firstClone = slides[0].cloneNode(true);
    const lastClone = slides[slides.length - 1].cloneNode(true);
    carousel.appendChild(firstClone);
    carousel.prepend(lastClone);
    slides = Array.from(carousel.children);
    carousel.style.transform = `translateX(-${slideWidth}px)`;
    const moveCarousel = () => {
      index++;
      carousel.style.transition = 'transform 0.5s ease';
      carousel.style.transform = `translateX(-${(index + 1) * slideWidth}px)`;
    };
    carousel.addEventListener('transitionend', () => {
      if (index >= slides.length - 2) {
        index = 0;
        carousel.style.transition = 'none';
        carousel.style.transform = `translateX(-${slideWidth}px)`;
      }
    });
    window.addEventListener('resize', () => {
      slideWidth = carousel.querySelector('.testimonial').offsetWidth + gap;
      carousel.style.transition = 'none';
      carousel.style.transform = `translateX(-${(index + 1) * slideWidth}px)`;
    });
    setInterval(moveCarousel, 3000);
  }
  const audioPlayer = document.getElementById('audio-player');
  const audio = document.getElementById('audio-element');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  const playPauseBtn = document.getElementById('play-pause-btn');
  if (playPauseBtn && audio) {
    playPauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
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
  if (audioPlayer) {
    let isDragging = false;
    let offsetX, offsetY;
    const startDrag = (e) => {
      isDragging = true;
      const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
      offsetX = clientX - audioPlayer.getBoundingClientRect().left;
      offsetY = clientY - audioPlayer.getBoundingClientRect().top;
      audioPlayer.style.cursor = 'grabbing';
    };
    const moveDrag = (e) => {
      if (isDragging) {
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        audioPlayer.style.left = `${clientX - offsetX}px`;
        audioPlayer.style.bottom = 'auto';
        audioPlayer.style.top = `${clientY - offsetY}px`;
      }
    };
    const endDrag = () => {
      isDragging = false;
      audioPlayer.style.cursor = 'move';
    };
    audioPlayer.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', endDrag);
    audioPlayer.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', moveDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
  }
  const tabButtons = document.querySelectorAll('.tab-button');
  const evolutionContent = document.querySelector('#evolution-content');
  const progressDescription = document.querySelector('#progress-description');
  const addProgressButton = document.querySelector('#add-progress');
  const progressDateInput = document.querySelector('#progress-date');
  const progressValueInput = document.querySelector('#progress-value');
  let chartInstance = null;
  let userProgress = JSON.parse(localStorage.getItem('userProgress')) || [];
  function saveProgress() {
    localStorage.setItem('userProgress', JSON.stringify(userProgress));
  }
  if (addProgressButton) {
    addProgressButton.addEventListener('click', () => {
      const date = progressDateInput.value;
      const value = parseFloat(progressValueInput.value);
      if (date && !isNaN(value)) {
        userProgress.push({ date, value });
        userProgress.sort((a, b) => new Date(a.date) - new Date(b.date));
        saveProgress();
        alert('Data added! Switch tabs to see updated chart.');
        const activeTab = document.querySelector('.tab-button.active')?.dataset.tab;
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
      if (tab === 'daily') return { labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'], data: [65, 68, 70, 72, 75, 78, 80], description: 'Your daily progress shows a steady increase in performance. Add your own data for real tracking!' };
      else if (tab === 'weekly') return { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], data: [70, 75, 80, 85], description: 'On a weekly basis, you\'ve gained an average of 5 points per week. Add your own data!' };
      else if (tab === 'monthly') return { labels: ['Month 1', 'Month 2', 'Month 3'], data: [75, 85, 95], description: 'Your monthly evolution demonstrates significant transformation over time. Add your own data!' };
    }
    const aggregated = {};
    userProgress.forEach(entry => {
      const date = new Date(entry.date);
      let key;
      if (tab === 'daily') key = entry.date;
      else if (tab === 'weekly') key = `Week ${Math.floor(date.getDate() / 7) + 1} (${date.getFullYear()}-${date.getMonth() + 1})`;
      else if (tab === 'monthly') key = `Month ${date.getMonth() + 1} (${date.getFullYear()})`;
      if (!aggregated[key]) aggregated[key] = [];
      aggregated[key].push(entry.value);
    });
    const labels = Object.keys(aggregated);
    const data = labels.map(key => {
      const values = aggregated[key];
      return values.reduce((sum, val) => sum + val, 0) / values.length;
    });
    const description = userProgress.length > 0 ? `Your ${tab} progress based on your entered data. Keep adding to track accurately!` : 'No data yet—add some above to see your real progress.';
    return { labels, data, description };
  }
  function updateChart(tab) {
    const { labels, data, description } = aggregateData(tab);
    progressDescription.innerText = description;
    if (chartInstance) chartInstance.destroy();
    const ctx = document.getElementById('progress-chart')?.getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: [{ label: 'Progress (e.g., Weight or Points)', data: data, borderColor: '#e91e63', backgroundColor: 'rgba(233, 30, 99, 0.2)', fill: true, tension: 0.4 }] },
      options: { responsive: true, scales: { y: { beginAtZero: false } }, plugins: { legend: { display: true } } }
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
    tabButtons[0]?.click();
  }
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      item.classList.toggle('active');
    });
  });
  const playOverlay = document.querySelector('.play-overlay');
  if (playOverlay) {
    playOverlay.addEventListener('click', () => { alert('Video playback started'); });
  }
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => { e.preventDefault(); alert('Subscribed!'); });
  });
  const ctx = document.getElementById('progress-curve');
  if (ctx) {
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8', 'Week 9', 'Week 10', 'Week 11', 'Week 12'],
        datasets: [
          { label: 'Average Weight Loss (lbs)', data: [2, 4, 6, 8, 10, 12, 13, 14, 15, 16, 17, 18], borderColor: '#e91e63', backgroundColor: 'rgba(233, 30, 99, 0.2)', fill: true, tension: 0.4 },
          { label: 'Average Confidence Score (1-10)', data: [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5], borderColor: '#673ab7', backgroundColor: 'rgba(103, 58, 183, 0.2)', fill: true, tension: 0.4 }
        ]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: true } } }
    });
  }
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
  function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); }
  function saveWishlist() { localStorage.setItem('wishlist', JSON.stringify(wishlist)); }
  function updateBadges() {
    const cartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartBadge.textContent = cartQuantity;
    cartBadge.classList.toggle('active', cartQuantity > 0);
    const wishlistCount = wishlist.length;
    wishlistBadge.textContent = wishlistCount;
    wishlistBadge.classList.toggle('active', wishlistCount > 0);
  }
  function renderCart() {
    cartItemsContainer.innerHTML = '';
    const emptyCart = document.querySelector('.empty-cart');
    const reviewsCarousel = document.querySelector('.reviews-carousel');
    const cartMarquee = document.querySelector('.cart-marquee');
    const paymentIcons = document.querySelector('.payment-icons');
    const cartFooter = document.querySelector('.cart-footer');
    if (cart.length === 0) {
      emptyCart.style.display = 'block';
      reviewsCarousel.style.display = 'none';
      cartMarquee.style.display = 'none';
      paymentIcons.style.display = 'none';
      cartFooter.style.display = 'none';
    } else {
      emptyCart.style.display = 'none';
      reviewsCarousel.style.display = 'block';
      cartMarquee.style.display = 'block';
      paymentIcons.style.display = 'flex';
      cartFooter.style.display = 'block';
      cart.forEach(item => {
        const cartItem = document.createElement('div');
        cartItem.classList.add('cart-item');
        cartItem.dataset.id = item.id;
        cartItem.dataset.size = item.size;
        cartItem.dataset.color = item.color;
        cartItem.innerHTML = `
          <img src="${item.image}" alt="${item.title}">
          <h4>${item.title}</h4>
          <p>$${parseFloat(item.price).toFixed(2)}</p>
          <p>Size: ${item.size || 'N/A'}</p>
          <p>Color: ${item.color || 'N/A'}</p>
          <div class="quantity">
            <button class="qty-minus">-</button>
            <span>${item.quantity}</span>
            <button class="qty-plus">+</button>
          </div>
          <button class="remove-item"><i class="fi fi-sr-trash"></i></button>
        `;
        cartItemsContainer.appendChild(cartItem);
        const img = cartItem.querySelector('img');
        const title = cartItem.querySelector('h4');
        if (img && title) {
          const productUrl = getProductUrl(item.id);
          img.style.cursor = 'pointer';
          title.style.cursor = 'pointer';
          img.addEventListener('click', () => {
            window.location.href = productUrl;
          });
          title.addEventListener('click', () => {
            window.location.href = productUrl;
          });
        }
      });
      cartItemsContainer.querySelectorAll('.qty-plus').forEach(btn => btn.addEventListener('click', handleQuantityChange));
      cartItemsContainer.querySelectorAll('.qty-minus').forEach(btn => btn.addEventListener('click', handleQuantityChange));
      cartItemsContainer.querySelectorAll('.remove-item').forEach(btn => btn.addEventListener('click', removeFromCart));
    }
    updateSubtotal();
  }
  function handleQuantityChange(e) {
    const btn = e.target;
    const itemElement = btn.closest('.cart-item');
    const id = itemElement.dataset.id;
    const size = itemElement.dataset.size;
    const color = itemElement.dataset.color;
    const item = cart.find(i => i.id === id && i.size === size && i.color === color);
    if (item) {
      if (btn.classList.contains('qty-plus')) item.quantity++;
      else if (btn.classList.contains('qty-minus') && item.quantity > 1) item.quantity--;
      else if (btn.classList.contains('qty-minus') && item.quantity === 1) { removeFromCart(e); return; }
      itemElement.querySelector('.quantity span').textContent = item.quantity;
      saveCart();
      updateSubtotal();
      updateBadges();
      renderCart();
    }
  }
  function removeFromCart(e) {
    const itemElement = e.target.closest('.cart-item');
    const id = itemElement.dataset.id;
    const size = itemElement.dataset.size;
    const color = itemElement.dataset.color;
    cart = cart.filter(i => !(i.id === id && i.size === size && i.color === color));
    saveCart();
    updateSubtotal();
    updateBadges();
    renderCart();
  }
  function updateSubtotal() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    subtotalElement.textContent = `Subtotal: $${subtotal.toFixed(2)}`;
  }
  function addToCart(e) {
    e.stopPropagation();
    const container = e.target.closest('.product-card') || e.target.closest('.product-section');
    if (!container) return;
    const id = container.dataset.id || container.dataset.productId;
    const product = products.find(p => p.id === id);
    if (!product) return;
    const isProductPage = !!container.dataset.productId;
    let quantity = 1;
    const qtyInput = container.querySelector('.quantity input');
    if (qtyInput) quantity = parseInt(qtyInput.value);
    let selectedSize = product.sizes ? product.sizes[0] : null;
    let selectedColor = product.colors ? product.colors[0].name : null;
    let itemImage = product.image;
    if (isProductPage) {
      const sizeSelect = document.getElementById('size-select');
      const activeSwatch = document.querySelector('.color-swatches .swatch.active');
      if (sizeSelect) selectedSize = sizeSelect.value;
      if (activeSwatch) selectedColor = activeSwatch.dataset.color;
      if (product.colors && selectedColor) {
        const colorObj = product.colors.find(c => c.name === selectedColor);
        if (colorObj && colorObj.image) itemImage = colorObj.image;
      }
    }
    let item = cart.find(i => i.id === id && i.size === selectedSize && i.color === selectedColor);
    if (item) item.quantity += quantity;
    else {
      cart.push({
        id: product.id,
        title: product.title,
        price: product.price,
        compare_price: product.compare_price, // Ajout pour économies dans checkout (même pour ajouts normaux)
        image: itemImage,
        size: selectedSize,
        color: selectedColor,
        quantity: quantity
      });
    }
    saveCart();
    updateBadges();
    cartIcon.classList.add('added');
    setTimeout(() => cartIcon.classList.remove('added'), 500);
    openCartDrawer();
  }
  function renderWishlist() {
    wishlistItemsContainer.innerHTML = '';
    wishlist.forEach(id => {
      const product = products.find(p => p.id === id);
      if (product) {
        const wishlistItem = document.createElement('div');
        wishlistItem.classList.add('wishlist-item');
        wishlistItem.dataset.id = id;
        wishlistItem.innerHTML = `
          <img src="${product.image}" alt="${product.title}">
          <h4>${product.title}</h4>
          <p>$${parseFloat(product.price).toFixed(2)}</p>
          <button class="remove-wishlist">Remove</button>
        `;
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
    saveWishlist();
    updateBadges();
    updateWishlistIcons();
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
    saveCart();
    updateBadges();
    closeWishlistModal();
    openCartDrawer();
  }
  function openCartDrawer() {
    renderCart();
    cartDrawer.classList.add('active');
    overlay.classList.add('active');
  }
  function closeCartDrawer() {
    cartDrawer.classList.remove('active');
    overlay.classList.remove('active');
  }
  function openWishlistModal() {
    renderWishlist();
    wishlistModal.classList.add('active');
    overlay.classList.add('active');
  }
  function closeWishlistModal() {
    wishlistModal.classList.remove('active');
    overlay.classList.remove('active');
  }
  function checkout() {
    localStorage.setItem('checkoutCart', JSON.stringify(cart));
    window.location.href = 'checkout.html';
  }
  function toggleWishlist(e) {
    const icon = e.target.closest('.wishlist-toggle, .wishlist-icon-product, .mini-wishlist-icon');
    if (!icon) return;
    const id = icon.dataset.id || icon.closest('[data-id],[data-product-id]')?.dataset.id || icon.closest('[data-id],[data-product-id]')?.dataset.productId;
    if (!id) return;
    const isMini = icon.classList.contains('mini-wishlist-icon');
    const toggleClass = isMini ? 'added' : 'active';
    const index = wishlist.indexOf(id);
    const isAdding = index === -1;
    if (isAdding) { wishlist.push(id); icon.classList.add(toggleClass); }
    else { wishlist.splice(index, 1); icon.classList.remove(toggleClass); }
    saveWishlist();
    updateBadges();
    updateWishlistIcons();
    document.dispatchEvent(new Event('wishlist:change'));
  }
  function updateWishlistIcons() {
    document.querySelectorAll('.wishlist-toggle, .wishlist-icon-product, .mini-wishlist-icon').forEach(icon => {
      const id = icon.dataset.id || icon.closest('[data-id],[data-product-id]')?.dataset.id || icon.closest('[data-id],[data-product-id]')?.dataset.productId;
      if (!id) return;
      const isInWishlist = wishlist.includes(id);
      const isMini = icon.classList.contains('mini-wishlist-icon');
      const toggleClass = isMini ? 'added' : 'active';
      icon.classList.toggle(toggleClass, isInWishlist);
      if (isInWishlist) { icon.classList.remove('far'); icon.classList.add('fas'); }
      else { icon.classList.remove('fas'); icon.classList.add('far'); }
      const emptySvg = icon.querySelector('.wishlist-icon-empty');
      const filledSvg = icon.querySelector('.wishlist-icon-filled');
      if (filledSvg && emptySvg) {
        filledSvg.style.display = isInWishlist ? 'block' : 'none';
        emptySvg.style.display = isInWishlist ? 'none' : 'block';
      }
    });
  }
  updateBadges();
  updateWishlistIcons();
  document.querySelectorAll('.add-to-cart').forEach(btn => btn.addEventListener('click', addToCart));
  document.querySelectorAll('.buy-now').forEach(btn => {
    btn.addEventListener('click', (e) => { addToCart(e); checkout(); });
  });
  document.querySelectorAll('.wishlist-toggle, .wishlist-icon-product, .mini-wishlist-icon').forEach(icon => {
    icon.addEventListener('click', toggleWishlist);
  });
  const cartWrapper = document.querySelector('.icon-wrapper:has(.cart-icon)');
  if (cartWrapper) cartWrapper.addEventListener('click', openCartDrawer);
  const wishlistWrapper = document.querySelector('.icon-wrapper:has(.wishlist-icon)');
  if (wishlistWrapper) wishlistWrapper.addEventListener('click', openWishlistModal);
  overlay.addEventListener('click', () => { closeCartDrawer(); closeWishlistModal(); });
  document.querySelector('.close-drawer').addEventListener('click', closeCartDrawer);
  document.querySelector('.close-modal').addEventListener('click', closeWishlistModal);
  document.querySelector('.checkout').addEventListener('click', checkout);
  document.querySelector('.add-all-to-cart').addEventListener('click', addAllToCart);
  document.addEventListener('wishlist:change', () => { updateBadges(); updateWishlistIcons(); renderWishlist(); });
  const reviewsCarousel = document.querySelector('.reviews-carousel');
  if (reviewsCarousel) {
    const reviewItems = reviewsCarousel.querySelectorAll('.review-item');
    let currentReview = 0;
    reviewItems[currentReview].classList.add('active');
    setInterval(() => {
      reviewItems[currentReview].classList.remove('active');
      currentReview = (currentReview + 1) % reviewItems.length;
      reviewItems[currentReview].classList.add('active');
    }, 5000);
  }

  const paulContainer = document.getElementById('paul-banner');
  if (paulContainer) {
    const videoUrl = '';
    const video = paulContainer.querySelector('.paul-banner-video');
    const soundBtn = paulContainer.querySelector('.paul-video-sound-toggle');
    const videoWrapper = paulContainer.querySelector('.paul-banner-video-wrapper');
    if (videoUrl) {
      video.src = videoUrl;
      videoWrapper.style.display = 'block';
      document.querySelectorAll('.paul-banner-image').forEach(img => img.style.display = 'none');
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
    const slides = paulContainer.querySelectorAll('.paul-banner-slide');
    const indicators = paulContainer.querySelectorAll('.paul-banner-indicator');
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
  
  const francenelContainer = document.getElementById('francenel-milliadaire-banner');
  if (francenelContainer) {
    const videoUrl = 'https://cdn.shopify.com/videos/c/o/v/8747957409cc4beda31702abfcd4ed91.mp4';
    const video = francenelContainer.querySelector('.francenel-milliadaire-banner-video');
    const soundBtn = francenelContainer.querySelector('.francenel-milliadaire-video-sound-toggle');
    const videoWrapper = francenelContainer.querySelector('.francenel-milliadaire-banner-video-wrapper');
    if (videoUrl) {
      video.src = videoUrl;
      videoWrapper.style.display = 'block';
      document.querySelectorAll('.francenel-milliadaire-banner-image').forEach(img => img.style.display = 'none');
    } else {
      videoWrapper.style.display = 'none';
      francenelContainer.classList.add('image-mode');
    }
    if (video && soundBtn && videoUrl) {
      soundBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        soundBtn.classList.toggle('muted', video.muted);
      });
    }
    const slides = francenelContainer.querySelectorAll('.francenel-milliadaire-banner-slide');
    const indicators = francenelContainer.querySelectorAll('.francenel-milliadaire-banner-indicator');
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
    francenelContainer.addEventListener('mouseenter', () => clearInterval(slideTimer));
    francenelContainer.addEventListener('mouseleave', () => slideTimer = setInterval(nextSlide, intervalTime));
  }
  const items = document.querySelectorAll(".paul-announcement-item");
  let current = 0;
  const intervalTime = 4000;
  function showItem(index) {
    items.forEach((item, i) => { item.classList.toggle("active", i === index); });
    current = index;
  }
  function nextItem() {
    let next = (current + 1) % items.length;
    showItem(next);
  }
  setInterval(nextItem, intervalTime);
  const promoCode = document.getElementById("paulPromoCode");
  const copiedMessage = document.getElementById("copiedMessage");
  if (promoCode) {
    promoCode.addEventListener("click", function() {
      const codeText = "paul26";
      navigator.clipboard.writeText(codeText).then(function() {
        copiedMessage.style.display = "inline";
        setTimeout(() => { copiedMessage.style.display = "none"; }, 2000);
      });
    });
  }
});