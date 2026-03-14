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
      mainDiv.dataset.originalSrc = src;
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
      thumbsContainer.scrollTo({ left: scrollAmount, behavior: 'smooth' });
    } else {
      const scrollAmount = activeThumb.offsetTop - (thumbsContainer.clientHeight / 2) + (activeThumb.clientHeight / 2);
      thumbsContainer.scrollTo({ top: scrollAmount, behavior: 'smooth' });
    }
    const activeContainer = images[currentMainIndex];
    const activeImg = activeContainer.querySelector('img');
    if (activeImg && activeContainer.dataset.originalSrc) {
      activeImg.src = activeContainer.dataset.originalSrc;
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
    prev.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      slideMini(slider, 'prev');
    });
    next.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      slideMini(slider, 'next');
    });
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
  fetch('/products.data.json')
    .then(response => response.json())
    .then(data => {
      products = data;
      const settings = products.find(p => p.type === "settings") || {};
      const enableMediaZoom = (settings.enable_media_zoom || "no").toLowerCase() === "yes";
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
      document.querySelectorAll('.product-card').forEach(card => {
        const id = card.dataset.id;
        const product = products.find(p => p.id === id);
        if (product) {
          card.querySelector('h3').textContent = product.title;
          card.querySelector('.current-price').textContent = `$${product.price.toFixed(2)}`;
          card.querySelector('.compare-price').textContent = `$${product.compare_price.toFixed(2)}`;
          card.querySelector('p').textContent = product.description;
          const img = card.querySelector('img');
          if (img) {
            img.src = product.image;
            img.alt = product.title;
          }
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
            defaultOpt.value = "";
            defaultOpt.textContent = "Select Size";
            sizeSelect.appendChild(defaultOpt);
            prod.sizes.forEach(size => {
              const opt = document.createElement('option');
              opt.value = size;
              opt.textContent = size;
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
          if (sizeSelect) {
            sizeSelect.addEventListener('change', updateProductPrice);
          }
          updateProductPrice();
        }
        if (enableMediaZoom) {
          const mainSlider = document.getElementById('main-image-slider');
          const mainImages = mainSlider ? mainSlider.querySelectorAll('.main-image') : [];
          const modal = document.getElementById('media-zoom-modal');
          const modalImg = document.getElementById('modal-zoom-image');
          const modalContainer = document.querySelector('.modal-zoom-container');
          const closeBtn = modal ? modal.querySelector('.modal-close') : null;
          const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
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
            if (isTouchDevice) {
              container.style.cursor = 'pointer';
              container.addEventListener('click', (e) => {
                e.stopImmediatePropagation();
                modalImg.src = img.src;
                modal.classList.add('active');
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
            modalImg.addEventListener('click', () => {
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
        if (prod) {
          const baseStartStr = prod.start_date;
          const baseEndStr = prod.end_date;
          if (!baseStartStr || !baseEndStr) {
            showText();
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
            const varPrice = getVariantPrice(product, color, size);
            const ratio = product.compare_price / product.price;
            return varPrice * ratio;
          }
          const hasSizes = product.sizes && product.sizes.length > 0;
          const hasColors = product.colors && product.colors.length > 0;
          const uniqueSizes = hasSizes ? product.sizes : [];
          const uniqueColors = hasColors ? product.colors.map(c => c.name) : [];
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
              const opt = document.createElement('option');
              opt.value = value;
              opt.textContent = value;
              select.appendChild(opt);
            });
            wrapper.appendChild(select);
            return wrapper;
          }
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
                  const selectEl = colorSelect.querySelector('select');
                  selectEl.addEventListener('change', (e) => {
                    const selectedColorName = e.target.value;
                    const colorObj = product.colors.find(c => c.name === selectedColorName);
                    if (colorObj) {
                      const previewImg = div.closest('.variant-row').querySelector('.variant-preview img');
                      if (previewImg) previewImg.src = colorObj.image;
                    }
                    const bundleType = container.closest('.bundle-option').dataset.bundle;
                    calculateBundlePrice(bundleType);
                  });
                }
              }
              if (hasSizes) {
                const sizeSelect = createSelect(uniqueSizes, "Size");
                if (sizeSelect) {
                  div.appendChild(sizeSelect);
                  const selectEl = sizeSelect.querySelector('select');
                  selectEl.addEventListener('change', () => {
                    const bundleType = container.closest('.bundle-option').dataset.bundle;
                    calculateBundlePrice(bundleType);
                  });
                }
              }
              if (!hasColors && !hasSizes) {
                div.innerHTML = '<p style="color:#555; font-size:13px; margin:8px 0;">No options available</p>';
              }
            });
            const previewImgs = container.querySelectorAll('.variant-preview img');
            previewImgs.forEach(img => {
              img.src = product.image;
            });
          }
          function getSelectedValues(selectorsContainer) {
            const selects = selectorsContainer.querySelectorAll("select");
            const values = {};
            selects.forEach(select => {
              const label = select.parentElement.querySelector("label")?.textContent.toLowerCase() || "";
              const value = select.value;
              if (value !== "") {
                if (label.includes("color")) {
                  values.color = value;
                } else if (label.includes("size")) {
                  values.size = value;
                }
              }
            });
            return values;
          }
          function calculateBundlePrice(type) {
            const option = document.querySelector(`.bundle-option[data-bundle="${type}"]`);
            if (!option) return;
            const selectors = option.querySelectorAll(".variant-selectors");
            let totalPrice = 0;
            let totalCompare = 0;
            const ratio = product.compare_price / product.price;
            selectors.forEach(sel => {
              const values = getSelectedValues(sel);
              const color = values.color || null;
              const size = values.size || null;
              const varPrice = getVariantPrice(product, color, size);
              totalPrice += varPrice;
              totalCompare += varPrice * ratio;
            });
            const dSingle = (product.single_discount || 0) / 100;
            const dDuo = (product.duo_discount || 0) / 100;
            const dTrio = (product.trio_discount || 0) / 100;
            const discount = type === "single" ? dSingle : type === "duo" ? dDuo : dTrio;
            const discountedTotal = totalPrice * (1 - discount);
            const priceEl = document.getElementById(`${type}-price`);
            if (priceEl) priceEl.textContent = `$${discountedTotal.toFixed(2)}`;
            const discountedCompare = totalCompare * (1 - discount);
            const originalEl = document.getElementById(`${type}-original-price`);
            if (originalEl) originalEl.textContent = `$${discountedCompare.toFixed(2)}`;
          }
          function updateBundlePrices(product) {
            const dSingle = (product.single_discount || 0) / 100;
            const dDuo = (product.duo_discount || 0) / 100;
            const dTrio = (product.trio_discount || 0) / 100;
            const ratio = product.compare_price / product.price;
            document.getElementById("single-price").textContent = `$${(product.price * (1 - dSingle)).toFixed(2)}`;
            document.getElementById("single-original-price").textContent = `$${(product.price * ratio * (1 - dSingle)).toFixed(2)}`;
            document.getElementById("duo-price").textContent = `$${(product.price * 2 * (1 - dDuo)).toFixed(2)}`;
            document.getElementById("duo-original-price").textContent = `$${(product.price * ratio * 2 * (1 - dDuo)).toFixed(2)}`;
            document.getElementById("trio-price").textContent = `$${(product.price * 3 * (1 - dTrio)).toFixed(2)}`;
            document.getElementById("trio-original-price").textContent = `$${(product.price * ratio * 3 * (1 - dTrio)).toFixed(2)}`;
          }
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
            updateCartQuantityInSheet();
            updateBadges();
            renderCart();
            checkout();
          }
          document.querySelectorAll('.bundle-option label').forEach(label => {
            label.addEventListener('click', e => e.preventDefault());
          });
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
                radio.checked = true;
                this.classList.add("active");
                const selection = this.querySelector(".bundle-selection");
                if (selection) {
                  selection.style.display = "block";
                  populateSelectors(selection);
                  const type = this.dataset.bundle;
                  calculateBundlePrice(type);
                }
              }
            });
          });
          document.querySelectorAll(".bundle-add-btn").forEach(btn => {
            btn.addEventListener("click", function() {
              const container = this.closest(".bundle-selection");
              const type = container.closest(".bundle-option").dataset.bundle;
              const items = [];
              let itemImage = product.image;
              let discount = 0;
              if (type === "single") {
                discount = (product.single_discount || 0) / 100;
              } else if (type === "duo") {
                discount = (product.duo_discount || 0) / 100;
              } else if (type === "trio") {
                discount = (product.trio_discount || 0) / 100;
              }
              const ratio = product.compare_price / product.price;
              if (type === "single") {
                if (!hasColors && !hasSizes) {
                  const varPrice = product.price;
                  const varCompare = varPrice * ratio;
                  const discountedPrice = varPrice * (1 - discount);
                  const variant = product.variants ? product.variants[0] : null;
                  items.push({
                    id: product.id,
                    title: product.title,
                    price: discountedPrice,
                    compare_price: varCompare,
                    image: itemImage,
                    size: null,
                    color: null,
                    quantity: 1,
                    fromBundle: true,
                    cj_product_id: product.cj_id,
                    cj_variant_id: variant ? variant.vid : null
                  });
                } else {
                  const values = getSelectedValues(container);
                  const selectedColor = hasColors ? values.color : null;
                  const selectedSize = hasSizes ? values.size : null;
                  if ((hasColors && !selectedColor) || (hasSizes && !selectedSize)) {
                    return alert("Please complete your selection.");
                  }
                  if (selectedColor) {
                    const colorObj = product.colors.find(c => c.name === selectedColor);
                    if (colorObj) itemImage = colorObj.image;
                  }
                  const varPrice = getVariantPrice(product, selectedColor, selectedSize);
                  const varCompare = varPrice * ratio;
                  const discountedPrice = varPrice * (1 - discount);
                  const variant = product.variants.find(v => v.color === selectedColor && v.size === selectedSize);
                  items.push({
                    id: product.id,
                    title: product.title,
                    price: discountedPrice,
                    compare_price: varCompare,
                    image: itemImage,
                    size: selectedSize,
                    color: selectedColor,
                    quantity: 1,
                    fromBundle: true,
                    cj_product_id: product.cj_id,
                    cj_variant_id: variant ? variant.vid : null
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
                    const varPrice = product.price;
                    const varCompare = varPrice * ratio;
                    const discountedPrice = varPrice * (1 - discount);
                    const variant = product.variants ? product.variants[0] : null;
                    items.push({
                      id: product.id,
                      title: product.title,
                      price: discountedPrice,
                      compare_price: varCompare,
                      image: pairImage,
                      size: null,
                      color: null,
                      quantity: 1,
                      fromBundle: true,
                      cj_product_id: product.cj_id,
                      cj_variant_id: variant ? variant.vid : null
                    });
                    continue;
                  }
                  const values = getSelectedValues(pair);
                  const selectedColor = hasColors ? values.color : null;
                  const selectedSize = hasSizes ? values.size : null;
                  if ((hasColors && !selectedColor) || (hasSizes && !selectedSize)) {
                    valid = false;
                    alert(`Item ${i}: Please complete selection.`);
                    break;
                  }
                  if (selectedColor) {
                    const colorObj = product.colors.find(c => c.name === selectedColor);
                    if (colorObj) pairImage = colorObj.image;
                  }
                  const varPrice = getVariantPrice(product, selectedColor, selectedSize);
                  const varCompare = varPrice * ratio;
                  const discountedPrice = varPrice * (1 - discount);
                  const variant = product.variants.find(v => v.color === selectedColor && v.size === selectedSize);
                  items.push({
                    id: product.id,
                    title: product.title,
                    price: discountedPrice,
                    compare_price: varCompare,
                    image: pairImage,
                    size: selectedSize,
                    color: selectedColor,
                    quantity: 1,
                    fromBundle: true,
                    cj_product_id: product.cj_id,
                    cj_variant_id: variant ? variant.vid : null
                  });
                }
                if (!valid) return;
              }
              if (items.length > 0) {
                addBundleToCart(items);
              }
            });
          });
          updateBundlePrices(product);
          const singleDesc = document.querySelector('.single-description');
          const duoDesc = document.querySelector('.duo-description');
          const trioDesc = document.querySelector('.trio-description');
          if (product.single_discount > 0) {
            singleDesc.textContent = `Save ${product.single_discount}%`;
          } else {
            singleDesc.textContent = 'Standard Price';
          }
          duoDesc.textContent = `Save ${product.duo_discount || 0}%`;
          trioDesc.textContent = `Save ${product.trio_discount || 0}%`;
        }
      }
      setTimeout(() => {
        document.querySelectorAll('.color-swatches .swatch').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('#main-image-slider .main-image').forEach(container => {
          const img = container.querySelector('img');
          if (img && container.dataset.originalSrc) {
            img.src = container.dataset.originalSrc;
          }
        });
        if (typeof updateProductPrice === 'function') updateProductPrice();
      }, 300);
      // === EXPOSE POUR ACCOUNT PAGE (clic produits order history) ===
      window.getProductUrl = getProductUrl;
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
        scales: { y: { beginAtZero: false } },
        plugins: { legend: { display: true } }
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
    playOverlay.addEventListener('click', () => {
      alert('Video playback started');
    });
  }
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('Subscribed!');
    });
  });
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
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: true } }
      }
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
  function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
  }
  function saveWishlist() {
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
  }
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
        if (item.size != null) cartItem.dataset.size = item.size;
        if (item.color != null) cartItem.dataset.color = item.color;
        cartItem.innerHTML = `<img src="${item.image}" alt="${item.title}">
<h4>${item.title}</h4>
<p>$${parseFloat(item.price).toFixed(2)}</p>
${item.size ? `<p>Size: ${item.size}</p>` : ''}
${item.color ? `<p>Color: ${item.color}</p>` : ''}
<div class="quantity">
<button class="qty-minus">-</button>
<span>${item.quantity}</span>
<button class="qty-plus">+</button>
</div>
<button class="remove-item"><i class="fi fi-sr-trash"></i></button>`;
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
    const size = itemElement.dataset.size !== undefined ? itemElement.dataset.size : null;
    const color = itemElement.dataset.color !== undefined ? itemElement.dataset.color : null;
    const item = cart.find(i => i.id === id && i.size === size && i.color === color);
    if (item) {
      if (btn.classList.contains('qty-plus')) item.quantity++;
      else if (btn.classList.contains('qty-minus') && item.quantity > 1) item.quantity--;
      else if (btn.classList.contains('qty-minus') && item.quantity === 1) {
        removeFromCart(e);
        return;
      }
      itemElement.querySelector('.quantity span').textContent = item.quantity;
      saveCart();
      updateCartQuantityInSheet();
      updateSubtotal();
      updateBadges();
      renderCart();
    }
  }
  function removeFromCart(e) {
    const itemElement = e.target.closest('.cart-item');
    const id = itemElement.dataset.id;
    const size = itemElement.dataset.size !== undefined ? itemElement.dataset.size : null;
    const color = itemElement.dataset.color !== undefined ? itemElement.dataset.color : null;
    cart = cart.filter(i => !(i.id === id && i.size === size && i.color === color));
    saveCart();
    updateCartQuantityInSheet();
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
    const isProductPage = !!container.dataset.productId;
    let quantity = 1;
    const qtyInput = container.querySelector('.quantity input');
    if (qtyInput) quantity = parseInt(qtyInput.value);
    let selectedSize = null;
    let selectedColor = null;
    let itemImage = product.image;
    let cjVariantId = null;
    if (isProductPage) {
      const sizeSelect = document.getElementById('size-select');
      const activeSwatch = document.querySelector('.color-swatches .swatch.active');
      selectedSize = sizeSelect && sizeSelect.value !== "" ? sizeSelect.value : null;
      selectedColor = activeSwatch ? activeSwatch.dataset.color : null;
      if ((product.colors && product.colors.length > 0 && !selectedColor) ||
          (product.sizes && product.sizes.length > 0 && !selectedSize)) {
        return alert("Please select all options.");
      }
      if (selectedColor) {
        const colorObj = product.colors.find(c => c.name === selectedColor);
        if (colorObj && colorObj.image) itemImage = colorObj.image;
      }
    } else {
      if (product.colors && product.colors.length > 0) {
        selectedColor = product.colors[0].name;
        const colorObj = product.colors[0];
        if (colorObj && colorObj.image) itemImage = colorObj.image;
      }
      if (product.sizes && product.sizes.length > 0) {
        selectedSize = product.sizes[0];
      }
    }
    const variant = product.variants.find(v => {
      const colorMatch = !selectedColor || v.color === selectedColor;
      const sizeMatch = (!selectedSize && v.size === "") ||
                        (selectedSize === null && v.size === "") ||
                        (selectedSize && v.size === selectedSize);
      return colorMatch && sizeMatch;
    });
    if (variant) {
      cjVariantId = variant.vid;
    } else if (product.variants && product.variants.length > 0) {
      cjVariantId = product.variants[0].vid;
    }
    const varPrice = getVariantPrice(product, selectedColor, selectedSize);
    const varCompare = getVariantComparePrice(product, selectedColor, selectedSize);
    let cartItem = cart.find(i => i.id === id && i.size === selectedSize && i.color === selectedColor);
    if (cartItem) {
      cartItem.quantity += quantity;
    } else {
      cart.push({
        id: product.id,
        title: product.title,
        price: varPrice,
        compare_price: varCompare,
        image: itemImage,
        size: selectedSize,
        color: selectedColor,
        quantity: quantity,
        cj_product_id: product.cj_id,
        cj_variant_id: cjVariantId
      });
    }
    saveCart();
    updateCartQuantityInSheet();
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
        wishlistItem.innerHTML = `<img src="${product.image}" alt="${product.title}">
<h4>${product.title}</h4>
<p>$${parseFloat(product.price).toFixed(2)}</p>
<button class="remove-wishlist">Remove</button>`;
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
    updateCartQuantityInSheet();
    updateBadges();
    closeWishlistModal();
    openCartDrawer();
  }
  async function updateCartQuantityInSheet() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;
    const qty = cart.reduce((sum, item) => sum + item.quantity, 0);
    await fetch('/.netlify/functions/save-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update-cart-quantity',
        email: userEmail,
        currentCartQuantity: qty
      })
    }).catch(() => {});
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
    window.location.href = '/checkout.html';
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
    if (isAdding) {
      wishlist.push(id);
      icon.classList.add(toggleClass);
    } else {
      wishlist.splice(index, 1);
      icon.classList.remove(toggleClass);
    }
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
      if (isInWishlist) {
        icon.classList.remove('far');
        icon.classList.add('fas');
      } else {
        icon.classList.remove('fas');
        icon.classList.add('far');
      }
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
    btn.addEventListener('click', (e) => {
      addToCart(e);
      checkout();
    });
  });
  document.querySelectorAll('.wishlist-toggle, .wishlist-icon-product, .mini-wishlist-icon').forEach(icon => {
    icon.addEventListener('click', toggleWishlist);
  });
  const cartWrapper = document.querySelector('.icon-wrapper:has(.cart-icon)');
  if (cartWrapper) cartWrapper.addEventListener('click', openCartDrawer);
  const wishlistWrapper = document.querySelector('.icon-wrapper:has(.wishlist-icon)');
  if (wishlistWrapper) wishlistWrapper.addEventListener('click', openWishlistModal);
  overlay.addEventListener('click', () => {
    closeCartDrawer();
    closeWishlistModal();
  });
  document.querySelector('.close-drawer').addEventListener('click', closeCartDrawer);
  document.querySelector('.close-modal').addEventListener('click', closeWishlistModal);
  document.querySelector('.checkout').addEventListener('click', checkout);
  document.querySelector('.add-all-to-cart').addEventListener('click', addAllToCart);
  document.addEventListener('wishlist:change', () => {
    updateBadges();
    updateWishlistIcons();
    renderWishlist();
  });
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
    function nextSlide() {
      showSlide((currentSlide + 1) % slides.length);
    }
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
    function nextSlide() {
      showSlide((currentSlide + 1) % slides.length);
    }
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
    items.forEach((item, i) => {
      item.classList.toggle("active", i === index);
    });
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
        setTimeout(() => {
          copiedMessage.style.display = "none";
        }, 2000);
      });
    });
  }
  // === AUTO OPEN CART DRAWER quand on vient de "Saved Items" ===
  if (window.location.pathname.toLowerCase().includes('shop.html') && 
      localStorage.getItem('autoOpenCart') === 'true') {
    localStorage.removeItem('autoOpenCart');
    setTimeout(() => {
      if (typeof openCartDrawer === 'function') {
        openCartDrawer();
      }
    }, 1200);
  }
});

document.addEventListener('click', function(e) {
  if (e.target.closest('.swatch')) {
    const isMobile = window.innerWidth <= 768 || /Mobi|Android|iPhone/i.test(navigator.userAgent);
    if (isMobile) {
      const mediaSlider = document.getElementById('main-image-slider');
      if (mediaSlider) {
        setTimeout(() => {
          mediaSlider.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('paulTrigger');
    const overlay = document.getElementById('paulPopup');
    const closeBtn = document.querySelector('.paul-close');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const goToSignup = document.getElementById('goToSignup');
    const goToLogin = document.getElementById('goToLogin');
    const isAccountPage = window.location.pathname.includes('account.html') || window.location.pathname.endsWith('account.html');
    window.showToast = (msg) => {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 5000);
    };
    window.openAccountPopup = (id) => {
        const popup = document.getElementById(id);
        if (popup) popup.classList.add('open');
        if (id === 'address-popup') {
            document.getElementById('addr-email').value = localStorage.getItem('userEmail') || '';
            document.getElementById('addr-first').value = localStorage.getItem('userFirstName') || '';
            document.getElementById('addr-last').value = localStorage.getItem('userLastName') || '';
            document.getElementById('addr-line1').value = localStorage.getItem('userAddressLine1') || '';
            document.getElementById('addr-line2').value = localStorage.getItem('userLine2') || '';
            document.getElementById('addr-city').value = localStorage.getItem('userCity') || '';
            document.getElementById('addr-state').value = localStorage.getItem('userState') || '';
            document.getElementById('addr-zip').value = localStorage.getItem('userZip') || '';
        }
    };
    window.closeAccountPopup = (id) => {
        const popup = document.getElementById(id);
        if (popup) popup.classList.remove('open');
    };
    function openPaulPopup() {
        overlay.classList.add('active');
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    }
    function closePaulPopup() {
        if (isAccountPage) return;
        overlay.classList.remove('active');
    }
    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        if (localStorage.getItem('isLoggedIn') === 'true') {
            window.location.href = 'account.html';
        } else {
            openPaulPopup();
        }
    });
    closeBtn.addEventListener('click', closePaulPopup);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay && !isAccountPage) closePaulPopup();
    });
    goToSignup.addEventListener('click', () => {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    });
    goToLogin.addEventListener('click', () => {
        signupForm.style.display = 'none';
        loginForm.style.display = 'block';
    });
    document.querySelector('.paul-btn-register').addEventListener('click', async () => {
        const lastName = signupForm.querySelector('input[placeholder="Last Name"]').value.trim();
        const firstName = signupForm.querySelector('input[placeholder="First Name"]').value.trim();
        const email = signupForm.querySelector('input[placeholder="Email"]').value.trim();
        const phone = signupForm.querySelector('input[placeholder="Phone (optional)"]').value.trim();
        const password = signupForm.querySelector('input[type="password"]').value.trim();
        const newsletter = signupForm.querySelector('input[type="checkbox"]').checked ? "Yes" : "No";
        if (!password) return showToast("Password is required");
        try {
            const res = await fetch('/.netlify/functions/save-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lastName, firstName, email, phone, password, newsletter })
            });
            const data = await res.json();
            if (data.success) {
                showToast("Account created successfully!");
                goToLogin.click();
            } else {
                showToast("Error: " + (data.error || "Unknown"));
            }
        } catch (err) {
            showToast("Network error");
        }
    });
    document.querySelector('.paul-btn-login').addEventListener('click', async () => {
        const email = loginForm.querySelector('input[type="email"]').value.trim();
        const password = loginForm.querySelector('input[type="password"]').value.trim();
        try {
            const res = await fetch('/.netlify/functions/verify-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userEmail', email);
                localStorage.setItem('userFirstName', data.user.firstName);
                localStorage.setItem('userLastName', data.user.lastName);
                localStorage.setItem('userAddressLine1', data.user.addressLine1 || '');
                localStorage.setItem('userLine2', data.user.line2 || '');
                localStorage.setItem('userCity', data.user.city || '');
                localStorage.setItem('userState', data.user.state || '');
                localStorage.setItem('userZip', data.user.zip || '');
                const addressStr = [data.user.addressLine1, data.user.line2, data.user.city, data.user.state, data.user.zip]
                    .filter(Boolean).join(', ');
                localStorage.setItem('userAddress', addressStr || 'No default address set');
                showToast(`Welcome ${data.user.firstName} !`);
                overlay.classList.remove('active');
                if (isAccountPage) {
                    location.reload();
                } else {
                    window.location.href = 'account.html';
                }
            } else {
                showToast("Incorrect email or password");
            }
        } catch (err) {
            showToast("Network error");
        }
    });
    function handleOrderClick(e) {
    const clickable = e.target.closest('.order-item-clickable');
    if (clickable) {
        const id = clickable.dataset.id;
        if (id && typeof window.getProductUrl === 'function') {
            console.log("✅ Clic détecté sur produit ID:", id); // Pour debug en console (F12)
            window.location.href = window.getProductUrl(id);
        } else {
            console.warn("⚠️ ID manquant ou getProductUrl non disponible pour ID:", id);
        }
        e.preventDefault(); // Empêche tout comportement par défaut
    }
}
   if (isAccountPage) {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const urlParams = new URLSearchParams(window.location.search);
    const forceLogin = urlParams.get('forceLogin') === '1';
    console.log("🔍 isLoggedIn:", isLoggedIn, "forceLogin:", forceLogin); // Pour debug

    // ==================== PROTECTION ULTRA-STRICTE ====================
    if (!isLoggedIn) {  // Force toujours si non connecté, ignore forceLogin si connecté
        const accountMain = document.querySelector('.account-main');
        const customerSection = document.querySelector('.customer.account');
        if (accountMain) accountMain.style.display = 'none';
        if (customerSection) customerSection.style.display = 'none';

        setTimeout(() => {
            openPaulPopup();
            const closeBtnPopup = document.querySelector('.paul-close');
            if (closeBtnPopup) {
                closeBtnPopup.style.pointerEvents = 'none';
                closeBtnPopup.style.opacity = '0.3';
                closeBtnPopup.title = 'You must log in to access your account.';
            }
            console.log("✅ Popup forcé !"); // Debug
        }, 500);  // Augmenté à 500ms pour plus de sécurité
        return;  // Stoppe l'exécution pour non connectés
    }

    // ==================== UTILISATEUR CONNECTÉ → tout normal ====================
    document.getElementById('user-full-name').textContent = `${localStorage.getItem('userFirstName') || ''} ${localStorage.getItem('userLastName') || ''}`;
    document.getElementById('user-email').textContent = localStorage.getItem('userEmail') || '';
    document.getElementById('user-name').textContent = localStorage.getItem('userFirstName') || '';
    document.getElementById('user-address').textContent = localStorage.getItem('userAddress') || 'No default address set';
    loadAccountStats();
}

    // ==================== SAVED ITEMS → shop.html + ouvre cart drawer ====================
    window.openSavedItems = () => {
        if (localStorage.getItem('isLoggedIn') !== 'true') {
            showToast("Connectez-vous pour voir vos articles sauvegardés");
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

            const statValues = document.querySelectorAll('.membership-stats-grid .stat-value');
            if (statValues.length >= 2) {
                statValues[0].textContent = data.orders || 0;
                statValues[1].textContent = `$${(data.totalSpent || 0).toFixed(2)}`;
            }
            document.querySelector('[data-wishlist-count]').textContent = data.quantityInCart || 0;

            const historyContainer = document.querySelector('.order-history');
            if (!historyContainer) return;

            if (data.history && Array.isArray(data.history) && data.history.length > 0) {
                let html = `<h2>Order History</h2>`;
                const sorted = [...data.history].reverse();
                sorted.forEach(order => {
                    html += `
                        <div class="order-entry" style="margin:15px 0;padding:15px;border:1px solid #ccc;border-radius:8px;background:#f9f9f9;">
                            <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                                <strong>Date : ${order.date}</strong>
                                <strong>Total : $${parseFloat(order.total || 0).toFixed(2)}</strong>
                            </div>
                            <p><strong>Quantité totale :</strong> ${order.totalQuantity || 0} produits</p>
                            <div class="order-items">
                                ${order.items.map(item => `
                                    <div class="order-item-clickable" data-id="${item.id || ''}" 
                                         style="display:flex;align-items:center;margin:8px 0;padding:10px;border-left:4px solid #f0b90b;background:white;cursor:pointer;">
                                        ${item.image_variant ? `<img src="${item.image_variant}" alt="${item.title}" style="width:50px;height:50px;object-fit:cover;margin-right:10px;">` : ''}
                                        <div>
                                            <strong style="color:#007bff;">${item.title}</strong><br>
                                            Couleur variante : ${item.variant_color || 'N/A'}<br>
                                            Prix : $${parseFloat(item.price || 0).toFixed(2)} × ${item.quantity} = $${item.lineTotal || (parseFloat(item.price || 0) * item.quantity).toFixed(2)}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                });
                historyContainer.innerHTML = html;
                document.removeEventListener('click', handleOrderClick); 
                document.addEventListener('click', handleOrderClick);

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
    if (isAccountPage) {
        if (localStorage.getItem('isLoggedIn') !== 'true') {
            setTimeout(() => {
                openPaulPopup();
                closeBtn.style.pointerEvents = 'none';
                closeBtn.style.opacity = '0.3';
            }, 500);
        }
    }
});