(function CurvaFX() {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const mob   = () => window.innerWidth <= 768;
  const noFx  = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lerp  = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  const isProduct = !!$('.product-section');

  /* ── progress bar ── */
  const bar = document.createElement('div');
  bar.className = 'fx-progress';
  document.body.prepend(bar);

  function updateBar() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? window.scrollY / max * 100 : 0) + '%';
  }

  const hdr = $('.sticky-header');
  function updateHdr() {
    if (!hdr) return;
    hdr.classList.toggle('fx-hdr-deep', window.scrollY > 10);
  }

  /* ─────────────────────────────────────────
     ASSIGN CLASSES
  ───────────────────────────────────────── */
  function assign() {
    [
      '.features-section', '.how-it-works-section',
      '.customer-reviews-section', '.faq-preview-section',
      '.faq-section', '.practical-tips-section', '.science-section',
      '.who-for-section', '.no-miracles-section',
      '.results-expectation-section', '.pp-why-section',
      '.pp-before-after-section', '.pp-testimonials-section',
      '#reviews-section', '.mini-product-slider', '#tools',
    ].forEach(s => $$(s).forEach(el => {
      if (!el.dataset.fx) el.classList.add('fx-unfold');
    }));

    [
      '.index-stats', '.community-stats', '.pillars-section',
      '.myths-section', '.events-section', '.process-timeline-section',
      '.store-infos-section',
    ].forEach(s => $$(s).forEach(el => {
      if (!el.dataset.fx) el.classList.add('fx-tilt');
    }));

    [
      '.tools-section', '.program-preview-section',
      '.coaches-section', '.comparison-table-section',
      '.system-breakdown-section',
    ].forEach(s => $$(s).forEach(el => {
      if (!el.dataset.fx) el.classList.add('fx-emerge');
    }));

    $$('.before-after-section').forEach(el => {
      if (!el.dataset.fx) el.classList.add('fx-flip');
    });

    $$('.video-testimonial-section, .promise-section').forEach(el => {
      if (!el.dataset.fx) el.classList.add('fx-zoom-in');
    });

    $$('.gallery-section, .spotlight-section').forEach(el => {
      if (!el.dataset.fx) el.dataset.fxGallery = '1';
    });

    $$('.blog-preview-section').forEach(el => {
      if (!el.dataset.fx) el.dataset.fxBlog = '1';
    });

    $$('.highlight-shop-section, .product-grid-section').forEach(el => {
      if (!el.dataset.fx) el.dataset.fxShop = '1';
    });

    $$('.community-section').forEach(el => {
      if (!el.dataset.fx) el.dataset.fxCommunity = '1';
    });

    $$('#reviews-section, .customer-reviews-section').forEach(el => {
      if (!el.dataset.fx) el.dataset.fxReviews = '1';
    });

    $$('.who-for-section').forEach(el => {
      if (!el.dataset.fx) el.dataset.fxWho = '1';
    });

    $$('.problem-solution-section').forEach(el => {
      if (!el.dataset.fx) el.dataset.fxProblems = '1';
    });

    $$('.nutrition-highlight-section .nutrition-content').forEach(el => {
      if (!el.dataset.fx) el.classList.add('fx-right');
    });

    $$('.tiers-grid').forEach(el => {
      if (!el.dataset.fx) el.classList.add('fx-stagger');
    });

    [
      '.feature-grid', '.pillar-grid',
      '.blog-grid', '.coaches-grid', '.myth-grid',
      '.superpower-grid', '.science-grid', '.tool-grid',
      '.tips-grid', '.grocery-categories', '.gallery-grid',
      '.stat-grid', '.breakdown-blocks', '.nutrition-pillar-grid',
      '.partner-logos', '.hero-cta-group', '.journey-steps',
      '.pp-why-grid', '.pp-ba-grid', '.pp-testimonials-grid',
      '.values-grid',
    ].forEach(s => $$(s).forEach(el => {
      if (!el.dataset.fx) el.classList.add('fx-stagger');
    }));

    [
      '.feature-card', '.blog-card', '.coach-card',
      '.tip-card', '.tool-card', '.pillar-card', '.science-card',
      '.stat-card', '.myth-card', '.testimonial', '.step',
      '.event-item', '.result-item', '.phase-card',
      '.breakdown-block', '.superpower-card', '.category',
      '.pp-why-card', '.pp-testimonial-card', '.pp-ba-col',
      '.program-card',
    ].forEach(s => $$(s).forEach(card => {
      if (!card.dataset.fx) {
        card.classList.add('fx-card');
        addShine(card);
      }
    }));

    $$(
      '.button-3d,.cta,.add-to-cart,.buy-now,.checkout,' +
      '.prog-cta,.paul-btn,.paul-btn-login,.paul-btn-register,' +
      '#write-review,#read-more,.bundle-add-btn'
    ).forEach(b => { if (!b.dataset.fx) b.classList.add('fx-btn'); });

    $$('.hero-cta-group .button-3d:first-child,.final-cta-section .primary-cta').forEach(el => {
      el.classList.add('fx-pulse');
    });

    $$('.promise-badge,.hero-badge').forEach(el => el.classList.add('fx-float'));
    $$('.paul-indicator').forEach(el => el.classList.add('fx-float-slow'));

    [
      '.final-cta-section', '.transformation-journey-section',
      '.curves-superpower-section', '.sample-day-section',
      '.authority-statement-section',
    ].forEach(s => $$(s).forEach(el => el.classList.add('fx-ray')));

    [
      '.final-cta-section h2', '.promise-section h2',
      '.transformation-journey-section h2',
      '.curves-superpower-section h2',
    ].forEach(sel => {
      $$(sel).forEach(el => {
        if (!el.classList.contains('fx-words') && !el.querySelector('span')) {
          el.classList.add('fx-words');
          el.innerHTML = el.textContent.trim()
            .split(/\s+/).map(w => `<span>${w}\u00a0</span>`).join('');
        }
      });
    });

    $$('.before-after-section img').forEach(img => {
      if (img.closest('.fx-reveal')) return;
      const wrap = document.createElement('div');
      wrap.className = 'fx-reveal';
      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(img);
    });
  }

  function addShine(card) {
    if (card.querySelector('.fx-shine')) return;
    const pos = getComputedStyle(card).position;
    if (pos === 'static') card.style.position = 'relative';
    const sh = document.createElement('div');
    sh.className = 'fx-shine';
    card.appendChild(sh);
  }

  /* ─────────────────────────────────────────
     INTERSECTION OBSERVER
  ───────────────────────────────────────── */
  function initObs() {
    const sel = '.fx-unfold,.fx-tilt,.fx-left,.fx-right,.fx-up,' +
                '.fx-emerge,.fx-flip,.fx-zoom-in,.fx-stagger,.fx-reveal,.fx-words';

    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('fx-on');
        e.target.dataset.fx = '1';
        obs.unobserve(e.target);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -24px 0px' });

    $$(sel).forEach(el => { if (!el.dataset.fx) obs.observe(el); });

    const secObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('fx-on');
        e.target.dataset.fx = '1';
        secObs.unobserve(e.target);
      });
    }, { threshold: 0.04, rootMargin: '0px 0px -16px 0px' });

    $$('[data-fx-gallery],[data-fx-blog],[data-fx-shop],[data-fx-community],[data-fx-reviews],[data-fx-who],[data-fx-problems]')
      .forEach(el => { if (!el.dataset.fx) secObs.observe(el); });
  }

  /* ─────────────────────────────────────────
     TILT ENGINE — gentle 3D, bounded rotation
     Max rotations kept small so cards never
     overflow their parent or clip outside the
     viewport. perspective is local to each card.
  ───────────────────────────────────────── */
  function makeTiltEngine(card, opts) {
    const shine  = card.querySelector('.fx-shine');
    const maxRx  = opts.maxRx  || 7;
    const maxRy  = opts.maxRy  || 9;
    const tz     = opts.tz     || 10;
    const spd    = opts.spd    || 0.10;
    const shadow = opts.shadow || '0 14px 36px rgba(30,10,20,.11), 0 0 0 1.5px rgba(192,56,94,.15)';
    const entFx  = opts.entFx  || null;

    let rx = 0, ry = 0, tx = 0, ty = 0;
    let alive = false, raf = null, glowOff = null;

    function tiltLoop() {
      rx = lerp(rx, tx, spd);
      ry = lerp(ry, ty, spd);
      if (alive || Math.abs(rx) > 0.03 || Math.abs(ry) > 0.03) {
        const z = alive ? `translateZ(${tz}px)` : 'translateZ(0)';
        card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) ${z}`;
        raf = requestAnimationFrame(tiltLoop);
      } else {
        card.style.transform = '';
        raf = null;
      }
    }

    card.addEventListener('mouseenter', () => {
      alive = true;
      clearTimeout(glowOff);
      card.style.boxShadow = shadow;
      if (entFx) card.style.filter = entFx;
      if (!raf) raf = requestAnimationFrame(tiltLoop);
    });

    card.addEventListener('mousemove', e => {
      const r  = card.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width  * 2 - 1;
      const ny = (e.clientY - r.top)  / r.height * 2 - 1;
      tx = clamp(-ny * maxRx, -maxRx, maxRx);
      ty = clamp( nx * maxRy, -maxRy, maxRy);
      if (shine) {
        shine.style.setProperty('--sx', ((nx + 1) / 2 * 100) + '%');
        shine.style.setProperty('--sy', ((ny + 1) / 2 * 100) + '%');
      }
    });

    card.addEventListener('mouseleave', () => {
      alive = false;
      tx = 0; ty = 0;
      if (entFx) card.style.filter = '';
      glowOff = setTimeout(() => { card.style.boxShadow = ''; }, 300);
      if (!raf) raf = requestAnimationFrame(tiltLoop);
    });
  }

  /* ─────────────────────────────────────────
     FX-CARD TILT (generic cards)
  ───────────────────────────────────────── */
  function initTilt() {
    if (mob()) return;
    $$('.fx-card').forEach(card => {
      if (card.dataset.tilt) return;
      card.dataset.tilt = '1';
      makeTiltEngine(card, {
        maxRx: 7, maxRy: 9, tz: 10, spd: 0.11
      });
    });
  }

  /* ─────────────────────────────────────────
     PRODUCT CARD TILT — slightly more drama
  ───────────────────────────────────────── */
  function initProductCardTilt() {
    if (mob()) return;
    $$('.product-grid-section .product-card, .highlight-shop-section .highlight-product-card')
      .forEach(card => {
        if (card.dataset.tilt) return;
        card.dataset.tilt = 'product';
        addShine(card);

        const shine  = card.querySelector('.fx-shine');
        let rx = 0, ry = 0, tx = 0, ty = 0;
        let alive = false, raf = null, glowOff = null, enterTimer = null;

        function tiltLoop() {
          rx = lerp(rx, tx, 0.07);
          ry = lerp(ry, ty, 0.07);
          if (alive || Math.abs(rx) > 0.02 || Math.abs(ry) > 0.02) {
            const z = alive ? 'translateZ(8px)' : 'translateZ(0)';
            card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) ${z}`;
            raf = requestAnimationFrame(tiltLoop);
          } else {
            card.style.transform = '';
            raf = null;
          }
        }

        card.addEventListener('mouseenter', () => {
          clearTimeout(enterTimer);
          enterTimer = setTimeout(() => {
            alive = true;
            clearTimeout(glowOff);
            card.style.boxShadow = '0 18px 44px rgba(30,10,20,.14), 0 0 0 1.5px rgba(192,56,94,.22), 0 0 32px rgba(192,56,94,.10)';
            card.style.filter = 'brightness(1.02) saturate(1.04)';
            if (!raf) raf = requestAnimationFrame(tiltLoop);
          }, 100);
        });

        card.addEventListener('mousemove', e => {
          if (!alive) return;
          const r  = card.getBoundingClientRect();
          const nx = (e.clientX - r.left) / r.width  * 2 - 1;
          const ny = (e.clientY - r.top)  / r.height * 2 - 1;
          tx = clamp(-ny * 5, -5, 5);
          ty = clamp( nx * 6, -6, 6);
          if (shine) {
            shine.style.setProperty('--sx', ((nx + 1) / 2 * 100) + '%');
            shine.style.setProperty('--sy', ((ny + 1) / 2 * 100) + '%');
          }
        });

        card.addEventListener('mouseleave', () => {
          clearTimeout(enterTimer);
          alive = false; tx = 0; ty = 0;
          card.style.filter = '';
          glowOff = setTimeout(() => { card.style.boxShadow = ''; }, 300);
          if (!raf) raf = requestAnimationFrame(tiltLoop);
        });
      });
  }

  /* ─────────────────────────────────────────
     COMMUNITY MAIN IMAGE TILT
  ───────────────────────────────────────── */
  function initCommunityImgTilt() {
    if (mob()) return;
    const mainImg = $('.community-section > .container > img');
    if (!mainImg) return;
    let mrx = 0, mry = 0, mtx = 0, mty = 0, mraf = null, malive = false, mglowOff = null;

    function commLoop() {
      mrx = lerp(mrx, mtx, .07);
      mry = lerp(mry, mty, .07);
      if (malive || Math.abs(mrx) > 0.03 || Math.abs(mry) > 0.03) {
        const z = malive ? 'translateZ(14px)' : 'translateZ(0)';
        mainImg.style.transform = `perspective(900px) rotateX(${mrx}deg) rotateY(${mry}deg) ${z}`;
        mraf = requestAnimationFrame(commLoop);
      } else {
        mainImg.style.transform = '';
        mraf = null;
      }
    }

    mainImg.addEventListener('mouseenter', () => {
      malive = true; clearTimeout(mglowOff);
      mainImg.style.boxShadow = '0 24px 56px rgba(30,10,20,.18), 0 0 0 1.5px rgba(192,56,94,.22)';
      mainImg.style.filter    = 'brightness(1.04) saturate(1.05)';
      if (!mraf) mraf = requestAnimationFrame(commLoop);
    });
    mainImg.addEventListener('mousemove', e => {
      const r = mainImg.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width  * 2 - 1;
      const ny = (e.clientY - r.top)  / r.height * 2 - 1;
      mtx = clamp(-ny * 5, -5, 5);
      mty = clamp( nx * 6, -6, 6);
      mainImg.style.setProperty('--comm-rx', mtx.toFixed(2) + 'deg');
      mainImg.style.setProperty('--comm-ry', mty.toFixed(2) + 'deg');
    });
    mainImg.addEventListener('mouseleave', () => {
      malive = false; mtx = 0; mty = 0;
      mainImg.style.filter = '';
      mglowOff = setTimeout(() => { mainImg.style.boxShadow = ''; }, 300);
      if (!mraf) mraf = requestAnimationFrame(commLoop);
    });
  }

  /* ─────────────────────────────────────────
     WHO-FOR CARD TILT
  ───────────────────────────────────────── */
  function initWhoForTilt() {
    if (mob()) return;
    $$('.who-for-section .who-for-card, .who-for-section .who-card').forEach(card => {
      if (card.dataset.tilt) return;
      card.dataset.tilt = 'who';
      addShine(card);
      makeTiltEngine(card, {
        maxRx: 7, maxRy: 9, tz: 12, spd: 0.10,
        shadow: '0 14px 36px rgba(30,10,20,.12), 0 0 0 1.5px rgba(192,56,94,.18)',
        entFx: 'brightness(1.02)'
      });
    });
  }

  /* ─────────────────────────────────────────
     REVIEW CARD TILT
  ───────────────────────────────────────── */
  function initReviewCardTilt() {
    if (mob()) return;
    $$('.review-card').forEach(card => {
      if (card.dataset.tilt) return;
      card.dataset.tilt = 'review';
      addShine(card);
      makeTiltEngine(card, {
        maxRx: 6, maxRy: 8, tz: 10, spd: 0.09,
        shadow: '0 14px 36px rgba(30,10,20,.10), 0 0 0 1.5px rgba(201,150,62,.22)',
        entFx: 'brightness(1.01)'
      });
    });
  }

  /* ─────────────────────────────────────────
     GALLERY IMAGE TILT
  ───────────────────────────────────────── */
  function initGalleryTilt() {
    if (mob()) return;
    $$(
      '.gallery-section .gallery-grid img,' +
      '.spotlight-section .spotlight-grid img'
    ).forEach(img => {
      img.addEventListener('mousemove', e => {
        const r  = img.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width  * 2 - 1;
        const ny = (e.clientY - r.top)  / r.height * 2 - 1;
        img.style.setProperty('--hx', `${(-ny * 5).toFixed(2)}deg`);
        img.style.setProperty('--hy', `${( nx * 6).toFixed(2)}deg`);
      });
      img.addEventListener('mouseleave', () => {
        img.style.setProperty('--hx', '0deg');
        img.style.setProperty('--hy', '0deg');
      });
    });
  }

  /* ─────────────────────────────────────────
     COMMUNITY MEMBER GRID TILT
  ───────────────────────────────────────── */
  function initCommunityTilt() {
    if (mob()) return;
    $$('.community-section .member-grid img').forEach(img => {
      img.addEventListener('mousemove', e => {
        const r  = img.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width * 2 - 1;
        img.style.setProperty('--ry', `${(nx * 8).toFixed(2)}deg`);
      });
      img.addEventListener('mouseleave', () => {
        img.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ─────────────────────────────────────────
     FLY-TO-CART ANIMATION
  ───────────────────────────────────────── */
  function initFly() {
    function cartPos() {
      const icon = $('.cart-icon') || $('.icon-wrapper .cart-icon');
      if (!icon) return null;
      const r = icon.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    function productImgSrc() {
      const img = $('#main-image-slider .main-image.active img')
               || $('#main-image-slider .main-image img');
      return img ? img.src : null;
    }
    function bezier(t, p0, p1, p2, p3) {
      const u = 1 - t;
      return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
    }
    function mkTrail(x, y, s) {
      const t = document.createElement('div');
      t.className = 'fx-fly-trail';
      Object.assign(t.style, {
        width: s * 1.6 + 'px', height: s * 1.6 + 'px',
        left: (x - s * .8) + 'px', top: (y - s * .8) + 'px', opacity: '.4',
      });
      document.body.appendChild(t);
      setTimeout(() => {
        t.style.transition = 'opacity .36s ease, transform .36s ease';
        t.style.opacity = '0'; t.style.transform = 'scale(2)';
        setTimeout(() => t.remove(), 400);
      }, 40);
    }

    document.addEventListener('click', e => {
      const btn = e.target.closest('.add-to-cart,.buy-now,.bundle-add-btn');
      if (!btn) return;
      const cp = cartPos();
      if (!cp) return;

      const br = btn.getBoundingClientRect();
      const sx = br.left + br.width / 2;
      const sy = br.top  + br.height / 2;
      const SZ = 52;

      const ghost = document.createElement('div');
      ghost.className = 'fx-fly-ghost';
      Object.assign(ghost.style, {
        width: SZ + 'px', height: SZ + 'px',
        left: (sx - SZ/2) + 'px', top: (sy - SZ/2) + 'px',
      });
      const src = productImgSrc();
      if (src) {
        const img = document.createElement('img'); img.src = src; ghost.appendChild(img);
      } else {
        ghost.textContent = '🛒'; ghost.style.fontSize = '20px';
      }
      document.body.appendChild(ghost);

      const midX = (sx + cp.x) / 2;
      const midY = Math.min(sy, cp.y) - 150;
      let start = null, lastTrail = 0;
      const DUR = 720;

      function flyFrame(ts) {
        if (!start) start = ts;
        const t = clamp((ts - start) / DUR, 0, 1);
        const ease = t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
        const x  = bezier(ease, sx, midX - 60, midX + 60, cp.x);
        const y  = bezier(ease, sy, midY, midY + 36, cp.y);
        const s  = SZ * (1 - ease * .70);
        const op = t < .82 ? 1 : 1 - (t - .82) / .18;
        Object.assign(ghost.style, {
          left: (x-s/2)+'px', top: (y-s/2)+'px',
          width: s+'px', height: s+'px', opacity: op,
        });
        if (ts - lastTrail > 78 && t < .83) { mkTrail(x, y, s); lastTrail = ts; }
        if (t < 1) { requestAnimationFrame(flyFrame); return; }
        ghost.remove();
        const ci = $('.cart-icon');
        if (ci) {
          ci.classList.add('fx-cart-hit');
          ci.addEventListener('animationend', () => ci.classList.remove('fx-cart-hit'), { once: true });
        }
        const cb = $('.cart-badge');
        if (cb) {
          cb.classList.add('fx-badge-pop');
          cb.addEventListener('animationend', () => cb.classList.remove('fx-badge-pop'), { once: true });
        }
      }
      requestAnimationFrame(flyFrame);
    });
  }

  /* ─────────────────────────────────────────
     PRODUCT SLIDER 3D
  ───────────────────────────────────────── */
  function initSlider3D() {
    const slider = $('#main-image-slider');
    if (!slider) return;
    let lastIdx = 0;

    function activeIdx() {
      return $$('.main-image', slider).findIndex(i => i.classList.contains('active'));
    }
    function doAnim(dir) {
      setTimeout(() => {
        const imgs = $$('.main-image', slider);
        const idx  = activeIdx();
        if (idx < 0) return;
        const cnt = imgs[idx];
        const cls = dir === 'next' ? 'fx-slide-r' : 'fx-slide-l';
        cnt.classList.remove('fx-slide-r', 'fx-slide-l');
        void cnt.offsetWidth;
        cnt.classList.add(cls);
        cnt.addEventListener('animationend', () => cnt.classList.remove(cls), { once: true });
        lastIdx = idx;
      }, 25);
    }

    const prev = slider.querySelector('.slider-arrow.prev');
    const next = slider.querySelector('.slider-arrow.next');
    if (prev) prev.addEventListener('click', () => doAnim('prev'), true);
    if (next) next.addEventListener('click', () => doAnim('next'), true);
    $$('.thumbnail-item').forEach((th, i) => {
      th.addEventListener('click', () => doAnim(i > lastIdx ? 'next' : 'prev'), true);
    });

    if (mob()) return;
    slider.addEventListener('mousemove', e => {
      const div = $('.main-image.active', slider);
      if (!div) return;
      const r  = slider.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width  * 2 - 1;
      const ny = (e.clientY - r.top)  / r.height * 2 - 1;
      div.style.transform  = `perspective(1000px) rotateX(${clamp(-ny*4,-4,4)}deg) rotateY(${clamp(nx*5,-5,5)}deg)`;
      div.style.transition = 'transform .18s ease';
    });
    slider.addEventListener('mouseleave', () => {
      const div = $('.main-image.active', slider);
      if (!div) return;
      div.style.transform  = '';
      div.style.transition = 'transform .45s var(--fx-ease)';
    });
  }

  /* ─────────────────────────────────────────
     HERO PARALLAX DEPTH — subtle layered
  ───────────────────────────────────────── */
  function initHeroDepth() {
    if (mob()) return;
    const hero = $('.home-hero-banner');
    const cnt  = hero && $('.hero-content', hero);
    if (!hero || !cnt) return;

    let htx = 0, hty = 0, hcx = 0, hcy = 0;
    const badge = cnt.querySelector('.hero-badge');
    const h1    = cnt.querySelector('h1');
    const h2    = cnt.querySelector('h2');
    const p     = cnt.querySelector('p');
    const cta   = cnt.querySelector('.hero-cta-group');

    function heroLoop() {
      hcx = lerp(hcx, htx, .052); hcy = lerp(hcy, hty, .052);
      if (badge) badge.style.transform = `translateX(${hcx*.55}px) translateY(${hcy*.38}px)`;
      if (h1)    h1.style.transform    = `translateX(${hcx*.40}px) translateY(${hcy*.28}px)`;
      if (h2)    h2.style.transform    = `translateX(${hcx*.30}px) translateY(${hcy*.20}px)`;
      if (p)     p.style.transform     = `translateX(${hcx*.18}px) translateY(${hcy*.13}px)`;
      if (cta)   cta.style.transform   = `translateX(${hcx*.48}px) translateY(${hcy*.34}px)`;
      requestAnimationFrame(heroLoop);
    }
    heroLoop();

    hero.addEventListener('mousemove', e => {
      const r = hero.getBoundingClientRect();
      htx = (e.clientX - r.left) / r.width  * 2 * 10 - 10;
      hty = (e.clientY - r.top)  / r.height * 2 * 6.5 - 6.5;
    });
    hero.addEventListener('mouseleave', () => { htx = 0; hty = 0; });
  }

  /* ─────────────────────────────────────────
     LOGO TILT
  ───────────────────────────────────────── */
  function initLogoTilt() {
    if (mob()) return;
    const logo = $('.logo img');
    const wrap = logo?.closest('a,.logo');
    if (!wrap || !logo) return;
    let lrx = 0, lry = 0, ltx = 0, lty = 0, lraf = null;

    function logoLoop() {
      lrx = lerp(lrx, ltx, .12); lry = lerp(lry, lty, .12);
      logo.style.transform = `perspective(380px) rotateX(${lrx}deg) rotateY(${lry}deg) scale(1.05)`;
      if (Math.abs(lrx - ltx) > .04 || Math.abs(lry - lty) > .04) {
        lraf = requestAnimationFrame(logoLoop);
      } else {
        logo.style.transform = '';
        lraf = null;
      }
    }
    wrap.addEventListener('mousemove', e => {
      const r = logo.getBoundingClientRect();
      ltx = (e.clientY - r.top  - r.height/2) / r.height * -10;
      lty = (e.clientX - r.left - r.width/2)  / r.width  *  13;
      if (!lraf) lraf = requestAnimationFrame(logoLoop);
    });
    wrap.addEventListener('mouseleave', () => {
      ltx = 0; lty = 0;
      if (!lraf) lraf = requestAnimationFrame(logoLoop);
    });
  }

  /* ─────────────────────────────────────────
     RIPPLE
  ───────────────────────────────────────── */
  function initRipple() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('.fx-btn');
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const s = Math.max(r.width, r.height) * 2.1;
      const d = document.createElement('span');
      d.className = 'fx-ripple-dot';
      Object.assign(d.style, {
        width: s+'px', height: s+'px',
        left: (e.clientX - r.left - s/2)+'px',
        top:  (e.clientY - r.top  - s/2)+'px',
      });
      const prev = btn.style.overflow;
      btn.style.overflow = 'hidden';
      btn.appendChild(d);
      d.addEventListener('animationend', () => {
        d.remove(); btn.style.overflow = prev;
      });
    });
  }

  /* ─────────────────────────────────────────
     WISH POP
  ───────────────────────────────────────── */
  function initWishPop() {
    document.addEventListener('click', e => {
      const ic = e.target.closest('.wishlist-toggle,.mini-wishlist-icon,.wishlist-icon-product');
      if (!ic) return;
      ic.classList.add('fx-wish-pop');
      ic.addEventListener('animationend', () => ic.classList.remove('fx-wish-pop'), { once: true });
    });
  }

  /* ─────────────────────────────────────────
     DOT NAV
  ───────────────────────────────────────── */
  function initDots() {
    if (mob()) return;
    const secs = $$('section').filter(s =>
      s.offsetHeight > 80 &&
      !s.closest('.cart-drawer,.wishlist-modal,[id="paulPopup"]')
    ).slice(0, 14);
    if (secs.length < 4) return;

    const nav = document.createElement('div');
    nav.className = 'fx-dot-nav';
    secs.forEach(sec => {
      const d = document.createElement('div');
      d.className = 'fx-dot-item';
      d.title = sec.querySelector('h2,h1')?.textContent?.trim().slice(0,30) || '';
      d.addEventListener('click', () => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      nav.appendChild(d);
    });
    document.body.appendChild(nav);

    const dots = $$('.fx-dot-item', nav);
    const dotsObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const i = secs.indexOf(e.target);
        if (i > -1 && dots[i]) dots[i].classList.toggle('on', e.isIntersecting);
      });
    }, { threshold: .35 });
    secs.forEach(s => dotsObs.observe(s));
  }

  /* ─────────────────────────────────────────
     SCROLL HANDLER — throttled via RAF
  ───────────────────────────────────────── */
  let scrollNeed = false, scrollRaf = null;
  function onScroll() {
    scrollNeed = true;
    if (!scrollRaf) scrollRaf = requestAnimationFrame(scrollTick);
  }
  function scrollTick() {
    if (scrollNeed) { updateBar(); updateHdr(); scrollNeed = false; }
    scrollRaf = null;
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ─────────────────────────────────────────
     HOOK FETCH — re-init on dynamic content
  ───────────────────────────────────────── */
  function hookFetch() {
    const orig = window.fetch;
    window.fetch = function (...args) {
      return orig.apply(this, args).then(res => {
        if (String(args[0] || '').includes('products.data.json')) {
          setTimeout(() => {
            assign(); initObs();
            if (!mob()) {
              initTilt(); initProductCardTilt(); initGalleryTilt();
              initCommunityTilt(); initCommunityImgTilt();
              initWhoForTilt(); initReviewCardTilt();
            }
          }, 420);
        }
        return res;
      });
    };
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */
  function init() {
    if (noFx()) {
      window.addEventListener('scroll', () => { updateBar(); updateHdr(); }, { passive: true });
      return;
    }

    setTimeout(() => {
      assign(); initObs(); initDots();
      if (!mob()) {
        initTilt(); initProductCardTilt(); initGalleryTilt();
        initCommunityTilt(); initCommunityImgTilt();
        initWhoForTilt(); initReviewCardTilt();
      }
    }, 110);

    initHeroDepth();
    initLogoTilt();
    initRipple();
    initWishPop();
    hookFetch();

    if (isProduct) {
      initFly();
      setTimeout(() => initSlider3D(), 600);
    }

    updateBar(); updateHdr();
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);

})();