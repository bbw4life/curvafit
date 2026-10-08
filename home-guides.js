(() => {
  const rail = document.getElementById('cf-guides-rail');
  if (!rail) return;
  const labels = {
    en: { language: 'Choose your language', cta: 'Explore this guide' },
    fr: { language: 'Choisissez votre langue', cta: 'Découvrir ce guide' },
    es: { language: 'Elige tu idioma', cta: 'Descubre esta guía' }
  };

  function syncGuideProducts(products) {
    if (!Array.isArray(products)) return;

    rail.querySelectorAll('[data-guide-card]').forEach(card => {
      const product = products.find(item => item.id === card.dataset.productId);
      if (!product) return;

      const image = card.querySelector('.cf-guide-card__cover img');
      const pricing = card.querySelector('[data-guide-pricing]');
      const priceEl = card.querySelector('[data-guide-price]');
      const compareEl = card.querySelector('[data-guide-compare]');
      const discountEl = card.querySelector('[data-guide-discount]');
      card._guideProduct = product;

      if (product.url) {
        card.querySelectorAll('[data-guide-product-link]').forEach(link => {
          link.href = product.url;
        });
      }

      if (image && !image.dataset.guideHoverBound) {
        image.dataset.guideHoverBound = 'yes';
        image.addEventListener('pointerenter', () => {
          const currentProduct = card._guideProduct;
          if (currentProduct?.image_hover) image.src = currentProduct.image_hover;
        });
        image.addEventListener('pointerleave', () => {
          const currentProduct = card._guideProduct;
          const lang = card.querySelector('[data-guide-language]')?.value || 'en';
          const colorName = { en: 'English', fr: 'French', es: 'Spanish' }[lang];
          const cover = (currentProduct?.colors || []).find(color => color.name === colorName);
          const imageUrl = cover?.image || currentProduct?.image;
          if (imageUrl) image.src = imageUrl;
          else image.removeAttribute('src');
        });
      }

      const selectedLanguage = card.querySelector('[data-guide-language]')?.value || 'en';
      const selectedColorName = { en: 'English', fr: 'French', es: 'Spanish' }[selectedLanguage];
      const selectedCover = (product.colors || []).find(color => color.name === selectedColorName);
      const mainImage = selectedCover?.image || product.image;
      if (image && mainImage) image.src = mainImage;
      else if (image) image.removeAttribute('src');

      const price = Number(product.price);
      const comparePrice = Number(product.compare_price);
      if (!Number.isFinite(price) || !priceEl) return;

      const currency = product.currency || 'USD';
      const formatPrice = value => new Intl.NumberFormat(undefined, {
        style: 'currency', currency, maximumFractionDigits: 2
      }).format(value);
      priceEl.textContent = formatPrice(price);

      if (Number.isFinite(comparePrice) && comparePrice > price) {
        compareEl.textContent = formatPrice(comparePrice);
        compareEl.hidden = false;
        const discount = Math.round(((comparePrice - price) / comparePrice) * 100);
        discountEl.textContent = `-${discount}%`;
        discountEl.hidden = false;
      } else {
        compareEl.hidden = true;
        discountEl.hidden = true;
      }
      pricing.hidden = false;
    });
  }

  if (Array.isArray(window.__allProducts) && window.__allProducts.length) {
    syncGuideProducts(window.__allProducts);
  } else {
    let attempts = 0;
    const productWait = window.setInterval(() => {
      attempts += 1;
      if (Array.isArray(window.__allProducts) && window.__allProducts.length) {
        window.clearInterval(productWait);
        syncGuideProducts(window.__allProducts);
      } else if (attempts >= 80) {
        window.clearInterval(productWait);
      }
    }, 100);
  }

  rail.querySelectorAll('[data-guide-card]').forEach(card => {
    const select = card.querySelector('[data-guide-language]');
    const image = card.querySelector('.cf-guide-card__cover img');
    select.addEventListener('change', () => {
      const lang = select.value;
      const suffix = lang[0].toUpperCase() + lang.slice(1);
      const colorName = { en: 'English', fr: 'French', es: 'Spanish' }[lang];
      const product = card._guideProduct;
      const cover = (product?.colors || []).find(color => color.name === colorName);
      const imageUrl = cover?.image || product?.image;
      if (imageUrl) image.src = imageUrl;
      else image.removeAttribute('src');
      image.alt = image.dataset['alt' + suffix];
      card.querySelector('.cf-guide-card__eyebrow').textContent = card.querySelector('.cf-guide-card__eyebrow').dataset['eyebrow' + suffix];
      card.querySelector('.cf-guide-card__title-link').textContent = card.querySelector('.cf-guide-card__title-link').dataset['title' + suffix];
      card.querySelector('.cf-guide-card__body>p').textContent = card.querySelector('.cf-guide-card__body>p').dataset['description' + suffix];
      card.querySelector('[data-language-label]').textContent = labels[lang].language;
      card.querySelector('[data-guide-cta]').textContent = labels[lang].cta;
      select.setAttribute('aria-label', labels[lang].language);
    });
  });
  const step = () => {
    const card = rail.querySelector('[data-guide-card]');
    return card ? card.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).gap || 0) : rail.clientWidth;
  };
  document.querySelector('[data-guide-prev]')?.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
  document.querySelector('[data-guide-next]')?.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));

  function syncCurvafitProductShelf(products) {
    const track = document.getElementById('cf-products-track');
    if (!track || !Array.isArray(products)) return;

    const settings = products.find(item => item.type === 'settings') || {};
    const shelf = settings.curvafit_product_shelf || {};
    const productIds = Array.isArray(shelf.product_ids) ? shelf.product_ids : [];
    const cards = Array.from(track.querySelectorAll('.cf-product-card'));
    const wishlistIcons = '<svg class="wishlist-icon-empty" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg><svg class="wishlist-icon-filled" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 21-1.5-1.3C5.4 15.1 2 12 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1A6 6 0 0 1 16.5 3C19.6 3 22 5.4 22 8.5c0 3.5-3.4 6.6-8.5 11.2L12 21Z"/></svg>';
    const make = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const visibleProducts = productIds.map(id => products.find(item => item.id === id)).filter(Boolean);

    cards.forEach((card, index) => {
      const product = visibleProducts[index];
      card.hidden = !product;
      if (!product) return;

      card.dataset.id = product.id;
      const productUrl = product.url || (typeof window.getProductUrl === 'function' ? window.getProductUrl(product.id) : '#');
      const imageUrl = product.image || (Array.isArray(product.media) ? product.media.find(Boolean) : '') || '';
      const visual = make('div', `cf-product-card__visual cf-product-card__visual--${index + 1}${imageUrl ? ' has-image' : ''}`);
      const imageLink = make('a', 'cf-product-card__image-link');
      imageLink.href = productUrl;
      imageLink.setAttribute('aria-label', product.title || 'View product');
      const image = make('img', 'cf-product-card__image');
      image.alt = product.title || '';
      image.loading = 'lazy';
      image.hidden = !imageUrl;
      if (imageUrl) image.src = imageUrl;
      imageLink.appendChild(image);

      const productBadge = product.badge && product.badge.text ? product.badge.text : '';
      if (productBadge) imageLink.appendChild(make('span', 'cf-product-card__label', productBadge));

      if (!imageUrl) {
        imageLink.appendChild(make('span', 'cf-product-card__seal', 'THE EDIT'));
        const monogram = make('span', 'cf-product-card__monogram', 'C');
        monogram.appendChild(make('span', '', '✦'));
        imageLink.appendChild(monogram);
        imageLink.appendChild(make('span', 'cf-product-card__visual-note', 'A THOUGHTFUL FIND'));
      }

      const wishlist = make('button', 'cf-product-card__wishlist wishlist-toggle');
      wishlist.type = 'button';
      wishlist.dataset.id = product.id;
      wishlist.setAttribute('aria-label', `Add ${product.title || 'product'} to wishlist`);
      wishlist.innerHTML = wishlistIcons;
      visual.append(imageLink, wishlist);

      const body = make('div', 'cf-product-card__body');
      const meta = make('div', 'cf-product-card__meta');
      meta.append(make('span', '', 'PARTNER PICK'), make('span', '', String(index + 1).padStart(2, '0')));
      const title = make('h3');
      const titleLink = make('a');
      titleLink.href = productUrl;
      titleLink.textContent = product.title || '';
      title.appendChild(titleLink);
      const description = make('p', '', product.description || '');

      const bottom = make('div', 'cf-product-card__bottom');
      const pricing = make('div', 'cf-product-card__pricing');
      const price = Number(product.price);
      const comparePrice = Number(product.compare_price);
      const currency = product.currency || 'USD';
      const formatPrice = value => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
      pricing.appendChild(make('span', 'cf-product-card__price', Number.isFinite(price) ? formatPrice(price) : ''));
      if (Number.isFinite(comparePrice) && comparePrice > price) {
        pricing.appendChild(make('s', 'cf-product-card__compare', formatPrice(comparePrice)));
        pricing.appendChild(make('span', 'cf-product-card__discount', `-${Math.round((comparePrice - price) / comparePrice * 100)}%`));
      }

      const addButton = make('button', 'cf-product-card__add add-to-cart');
      addButton.type = 'button';
      addButton.appendChild(make('i', 'fi fi-rr-shopping-cart'));
      const buttonLabels = settings.button_labels || {};
      addButton.appendChild(make('span', '', buttonLabels.add_to_cart || 'Add to Cart'));
      bottom.append(pricing, addButton);
      body.append(meta, title, description, bottom);
      card.replaceChildren(visual, body);

      imageLink.addEventListener('pointerenter', () => {
        if (product.image_hover && imageUrl) image.src = product.image_hover;
      });
      imageLink.addEventListener('pointerleave', () => {
        if (imageUrl) image.src = imageUrl;
      });
    });

    if (typeof window.updateWishlistIcons === 'function') window.updateWishlistIcons();
  }

  if (Array.isArray(window.__allProducts) && window.__allProducts.length) {
    syncCurvafitProductShelf(window.__allProducts);
  } else {
    let attempts = 0;
    const shelfWait = window.setInterval(() => {
      attempts += 1;
      if (Array.isArray(window.__allProducts) && window.__allProducts.length) {
        window.clearInterval(shelfWait);
        syncCurvafitProductShelf(window.__allProducts);
      } else if (attempts >= 80) {
        window.clearInterval(shelfWait);
      }
    }, 100);
  }
})();
