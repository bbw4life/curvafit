/* ================================================================
   CURVAFIT — article-featured.js
================================================================ */

document.addEventListener('DOMContentLoaded', function () {

  fetch('/blog/blog-articles.json')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var f = data.featured;
      if (!f) return;

      document.getElementById('page-title').textContent = f.title + ' | CurvaFit Journal';
      document.getElementById('meta-description').setAttribute('content', f.excerpt);
      document.getElementById('meta-og-title').setAttribute('content', f.title);
      document.getElementById('meta-og-desc').setAttribute('content', f.excerpt);
      document.getElementById('meta-og-image').setAttribute('content', f.image);

      var jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': f.title,
        'description': f.excerpt,
        'image': f.image,
        'author': {
          '@type': 'Person',
          'name': f.author.name,
          'jobTitle': f.author.role
        },
        'publisher': {
          '@type': 'Organization',
          'name': 'CurvaFit',
          'logo': {
            '@type': 'ImageObject',
            'url': 'https://cdn.shopify.com/s/files/1/0643/8263/2041/files/curvalogo.png?v=1771465065'
          }
        },
        'datePublished': f.date,
        'mainEntityOfPage': { '@type': 'WebPage', '@id': window.location.href }
      };
      document.getElementById('json-ld').textContent = JSON.stringify(jsonLd);

      var heroImg = document.getElementById('hero-image');
      heroImg.src = f.image;
      heroImg.alt = f.imageAlt;

      setText('hero-badge',        f.badge);
      setText('hero-readtime',     f.readTime);
      setText('hero-title',        f.title);
      setText('hero-excerpt',      f.excerpt);

      setAttr('hero-author-img', 'src', f.author.image);
      setAttr('hero-author-img', 'alt', f.author.name);
      setText('hero-author-name',  f.author.name);
      setText('hero-author-role',  f.author.role);

      setText('hero-date',         f.date);
      setText('hero-views',        f.views);
      setText('hero-readtime-stat',f.readTime);
      setText('breadcrumb-category', f.badge);

      setAttr('bio-author-img', 'src', f.author.image);
      setAttr('bio-author-img', 'alt', f.author.name);
      setText('bio-author-name',   f.author.name);
      setText('bio-author-role',   f.author.role);
      setText('conclusion-author-name', f.author.name);

      injectRelated(data.cards, f.badge);
      initShareButtons();
    })
    .catch(function (err) {
      console.error('article-featured.js: error loading blog-articles.json:', err);
    });

  function injectRelated(cards, currentBadge) {
    var relatedGrid = document.getElementById('related-grid');
    if (!relatedGrid || !cards || !cards.length) return;

    var currentCat   = slugify(currentBadge);
    var sameCategory = cards.filter(function (c) {
      return slugify(c.badge) === currentCat || c.category === currentCat;
    });
    var otherCards = cards.filter(function (c) {
      return slugify(c.badge) !== currentCat && c.category !== currentCat;
    });

    shuffle(sameCategory);
    shuffle(otherCards);

    var picks = sameCategory.slice(0, 3);
    if (picks.length < 3) picks = picks.concat(otherCards.slice(0, 3 - picks.length));

    relatedGrid.innerHTML = picks.map(function (card) {
      return '<a href="' + card.url + '" class="related-card">' +
        '<div class="related-card__img-wrap">' +
          '<img src="' + card.image + '" alt="' + card.imageAlt + '" loading="lazy">' +
          '<span class="related-card__badge">' + card.badge + '</span>' +
        '</div>' +
        '<div class="related-card__body">' +
          '<h3 class="related-card__title">' + card.title + '</h3>' +
          '<p class="related-card__excerpt">' + card.excerpt + '</p>' +
          '<div class="related-card__meta">' +
            '<span><i class="fi fi-rr-clock"></i> ' + card.readTime + '</span>' +
            '<span><i class="fi fi-rr-eye"></i> ' + card.views + '</span>' +
            '<span class="related-card__cta">Read Article →</span>' +
          '</div>' +
        '</div>' +
      '</a>';
    }).join('');
  }

  function buildTOC() {
    var tocNav   = document.getElementById('toc-nav');
    if (!tocNav) return;
    var headings = document.querySelectorAll('.article-content h2');
    if (!headings.length) return;

    var links = [];
    headings.forEach(function (h2, i) {
      if (!h2.id) h2.id = 'toc-heading-' + i;
      var a = document.createElement('a');
      a.href        = '#' + h2.id;
      a.textContent = h2.textContent;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.getElementById(h2.id);
        if (target) {
          var top = target.getBoundingClientRect().top + window.scrollY - 100;
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      });
      tocNav.appendChild(a);
      links.push({ el: h2, link: a });
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = links.find(function (l) { return l.el === entry.target; });
        if (link) link.link.classList.toggle('active', entry.isIntersecting);
      });
    }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

    links.forEach(function (l) { observer.observe(l.el); });
  }

  function initProgressBar() {
    var bar = document.getElementById('reading-progress-bar');
    if (!bar) return;
    function updateProgress() {
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress  = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
      bar.style.width = progress.toFixed(1) + '%';
    }
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  function initSidebarShare() {
    var stickyShare = document.getElementById('sidebar-share-sticky');
    var hero        = document.getElementById('article-hero');
    if (!stickyShare || !hero) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        stickyShare.classList.toggle('visible', !entry.isIntersecting);
      });
    }, { threshold: 0 });
    observer.observe(hero);
  }

  function initShareButtons() {
    var url   = encodeURIComponent(window.location.href);
    var title = encodeURIComponent(document.title);

    document.querySelectorAll('.art-share-btn').forEach(function (btn) {
      if (btn.classList.contains('art-share-btn--copy')) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          navigator.clipboard.writeText(window.location.href).then(function () {
            btn.classList.add('copied');
            var icon = btn.querySelector('i');
            var originalClass = icon ? icon.className : '';
            if (icon) icon.className = 'fi fi-rr-check';
            setTimeout(function () {
              btn.classList.remove('copied');
              if (icon) icon.className = originalClass;
            }, 2200);
          }).catch(function () {
            var ta = document.createElement('textarea');
            ta.value = window.location.href;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          });
        });
        return;
      }

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var shareUrl = '#';
        if (btn.classList.contains('art-share-btn--fb')) {
          shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
        } else if (btn.classList.contains('art-share-btn--pi')) {
          var img = encodeURIComponent(document.getElementById('hero-image') ? document.getElementById('hero-image').src : '');
          shareUrl = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
        } else if (btn.classList.contains('art-share-btn--wa')) {
          shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
        } else if (btn.classList.contains('art-share-btn--tw')) {
          shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
        }
        if (shareUrl !== '#') window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
      });
    });
  }

  function initReactions() {
    var STORAGE_KEY = 'cf_article_reactions_featured';
    function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
    function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

    var reacted = getReacted();

    document.querySelectorAll('.reaction-btn').forEach(function (btn) {
      var type = btn.getAttribute('data-reaction');
      if (reacted === type) btn.classList.add('active');

      btn.addEventListener('click', function () {
        if (reacted && reacted !== type) return;
        var countEl = btn.querySelector('.reaction-btn__count');
        var current = parseInt(countEl.textContent.replace(/,/g, ''), 10) || 0;
        if (btn.classList.contains('active')) {
          btn.classList.remove('active');
          countEl.textContent = formatCount(Math.max(0, current - 1));
          reacted = ''; saveReacted('');
        } else {
          btn.classList.add('active');
          countEl.textContent = formatCount(current + 1);
          reacted = type; saveReacted(type);
        }
      });
    });
  }

  function initNewsletterForm() {
    var form  = document.getElementById('article-nl-form');
    var email = document.getElementById('article-nl-email');
    if (!form || !email) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var val = email.value.trim();
      if (!val || !val.includes('@')) return;
      var btn = form.querySelector('button');
      var originalHTML = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...'; }
      try {
        var res  = await fetch('/.netlify/functions/save-account', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
        });
        var data = await res.json();
        if (data.success) {
          email.value = '';
          if (btn) { btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!'; setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000); }
          var popup = document.getElementById('newsletter-popup');
          if (popup) { popup.classList.add('show'); setTimeout(function () { popup.classList.remove('show'); }, 8000); var closeBtn = document.getElementById('popup-close-btn'); if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); }; }
        } else { if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; } }
      } catch (err) { if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; } console.error('Newsletter error:', err); }
    });
  }

  function initFooterNewsletter() {
    var form  = document.getElementById('newsletter-form-footer');
    var email = document.getElementById('newsletter-email-footer');
    if (!form || !email) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var val = email.value.trim();
      if (!val || !val.includes('@')) return;
      var btn = form.querySelector('button');
      var originalText = btn ? btn.textContent : '';
      if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }
      try {
        var res  = await fetch('/.netlify/functions/save-account', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
        });
        var data = await res.json();
        if (data.success) {
          email.value = '';
          var popup = document.getElementById('newsletter-popup');
          if (popup) { popup.classList.add('show'); setTimeout(function () { popup.classList.remove('show'); }, 8000); var closeBtn = document.getElementById('popup-close-btn'); if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); }; }
        }
      } catch (err) { console.error(err); }
      finally { if (btn) { btn.textContent = originalText; btn.disabled = false; } }
    });
  }

  function initHeroParallax() {
    var heroImg = document.getElementById('hero-image');
    if (!heroImg || window.innerWidth < 768) return;
    window.addEventListener('scroll', function () {
      var scrollY = window.scrollY;
      var heroH   = document.getElementById('article-hero').offsetHeight;
      if (scrollY > heroH) return;
      heroImg.style.transform = 'scale(1.04) translateY(' + (scrollY * 0.30) + 'px)';
    }, { passive: true });
  }

  function initScrollReveal() {
    var revealEls = document.querySelectorAll(
      '.article-section, .article-takeaways, .article-mid-cta, ' +
      '.article-results, .article-author-bio, .article-reactions, ' +
      '.article-share-bottom, .article-newsletter, .related-card, ' +
      '.habit-card, .roadmap-week, .result-item'
    );
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity   = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    revealEls.forEach(function (el) {
      el.style.opacity    = '0';
      el.style.transform  = 'translateY(22px)';
      el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
      observer.observe(el);
    });
  }

  function setText(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }
  function setAttr(id, attr, value) { var el = document.getElementById(id); if (el) el.setAttribute(attr, value); }
  function slugify(str) { return (str || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''); }
  function shuffle(arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; } return arr; }
  function formatCount(n) { if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'; return n.toString(); }

  initProgressBar();
  initSidebarShare();
  initReactions();
  initNewsletterForm();
  initFooterNewsletter();
  initHeroParallax();

  setTimeout(function () { buildTOC(); initScrollReveal(); }, 120);

});


/* ================================================================
   CURVAFIT — ARTICLE REVIEWS & REACTIONS
================================================================ */

(function () {
  'use strict';

  function getArticleId() {
    const reactionsEl = document.getElementById('article-reactions');
    if (reactionsEl && reactionsEl.dataset.articleId) return reactionsEl.dataset.articleId;
    const path = window.location.pathname;
    return path.split('/').pop().replace('.html', '') || 'article-unknown';
  }

  const ARTICLE_ID       = getArticleId();
  const API              = '/.netlify/functions/reviews-article';
  const REVIEWS_PER_PAGE = 5;

  let allReviews  = [];
  let shownCount  = 0;
  let likeGranted = false;

  /* ── 1. CHARGER LES STATS ───────────────────────────────────── */
  async function loadStats() {
    try {
      const res  = await fetch(`${API}?articleId=${encodeURIComponent(ARTICLE_ID)}`);
      const data = await res.json();
      if (!data.success) return;

      setCount('count-helpful',  data.likes);
      setCount('count-inspired', data.reviewsCount);
      setCount('count-more',     data.shares);

      allReviews = data.reviews || [];
      renderReviews(true);
    } catch (e) {
      console.warn('[ArticleReviews] loadStats failed:', e.message);
    }
  }

  function setCount(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  /* ── 2. LIKE ────────────────────────────────────────────────── */
  const btnHelpful = document.getElementById('btn-helpful');
  if (btnHelpful) {
    btnHelpful.addEventListener('click', async () => {
      if (likeGranted) return;
      likeGranted = true;
      btnHelpful.classList.add('active');
      try {
        const res  = await fetch(API, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'like', articleId: ARTICLE_ID })
        });
        const data = await res.json();
        if (data.success) setCount('count-helpful', data.likes);
      } catch (e) { console.warn('[ArticleReviews] like failed:', e.message); }
    });
  }

  /* ── 3. SHARE ───────────────────────────────────────────────── */
  async function recordShare() {
    try {
      const res  = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
      });
      const data = await res.json();
      if (data.success) setCount('count-more', data.shares);
    } catch (e) { console.warn('[ArticleReviews] share failed:', e.message); }
  }

  function attachShareListeners() {
    document.querySelectorAll('.art-share-btn').forEach(btn => {
      btn.addEventListener('click', recordShare, { once: false });
    });
    const btnMore = document.getElementById('btn-more');
    if (btnMore) {
      btnMore.addEventListener('click', () => {
        recordShare();
        const formWrap = document.getElementById('art-review-form-wrap');
        if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
    ['hero-copy-link', 'bottom-copy-link'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', recordShare);
    });
  }

  /* ── 4. AVATAR ──────────────────────────────────────────────── */
  let avatarBase64 = '';

  function compressAvatar(file) {
    return new Promise((resolve) => {
      if (!file) { resolve(''); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const MAX = 150;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
      img.src = url;
    });
  }

  const avatarInput  = document.getElementById('art-rv-avatar-input');
  const avatarWrap   = document.getElementById('art-rv-avatar-wrap');
  const avatarPrev   = document.getElementById('art-rv-avatar-preview');
  const avatarPlaceh = document.getElementById('art-rv-avatar-placeholder');

  if (avatarWrap && avatarInput) {
    avatarWrap.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', async () => {
      const file = avatarInput.files[0];
      if (!file) return;
      avatarBase64 = await compressAvatar(file);
      if (avatarBase64 && avatarPrev && avatarPlaceh) {
        avatarPrev.src = avatarBase64;
        avatarPrev.style.display = 'block';
        avatarPlaceh.style.display = 'none';
      }
    });
  }

  /* ── 5. ÉTOILES ─────────────────────────────────────────────── */
  const stars       = document.querySelectorAll('.art-rv-star');
  const ratingInput = document.getElementById('art-rv-rating');
  let selectedRating = 0;

  function paintStars(upTo) {
    stars.forEach((s, i) => {
      s.classList.toggle('fi-sr-star', i < upTo);
      s.classList.toggle('fi-rr-star', i >= upTo);
      s.classList.toggle('selected',   i < upTo);
    });
  }

  stars.forEach(star => {
    star.addEventListener('mouseover', () => paintStars(parseInt(star.dataset.val)));
    star.addEventListener('mouseout',  () => paintStars(selectedRating));
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.val);
      if (ratingInput) ratingInput.value = selectedRating;
      paintStars(selectedRating);
    });
  });

  /* ── 6. COMPTEUR CARACTÈRES ─────────────────────────────────── */
  const textarea = document.getElementById('art-rv-text');
  const charNum  = document.getElementById('art-rv-char-num');
  if (textarea && charNum) {
    textarea.addEventListener('input', () => { charNum.textContent = textarea.value.length; });
  }

  /* ── 7. SOUMISSION FORMULAIRE ───────────────────────────────── */
  const form      = document.getElementById('art-review-form');
  const submitBtn = document.getElementById('art-rv-submit');
  const errorEl   = document.getElementById('art-rv-error');
  const successEl = document.getElementById('art-rv-success');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const firstName = document.getElementById('art-rv-firstname').value.trim();
      const lastName  = document.getElementById('art-rv-lastname').value.trim();
      const text      = document.getElementById('art-rv-text').value.trim();
      const rating    = parseInt(ratingInput ? ratingInput.value : '0');

      if (errorEl)   errorEl.style.display   = 'none';
      if (successEl) successEl.style.display = 'none';

      if (!firstName || !lastName) { showError('Please enter your first and last name.'); return; }
      if (rating === 0)            { showError('Please select a star rating.'); return; }
      if (!text || text.length < 10) { showError('Please write at least 10 characters in your review.'); return; }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending…';

      try {
        const res  = await fetch(API, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add-review', articleId: ARTICLE_ID,
            firstName, lastName, avatar: avatarBase64, text, rating
          })
        });
        const data = await res.json();

        if (data.success) {
          if (successEl) successEl.style.display = 'flex';
          setCount('count-inspired', data.reviewsCount);

          allReviews.unshift({
            firstName, lastName, avatar: avatarBase64, text, rating,
            date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          });
          renderReviews(true);

          form.reset();
          selectedRating = 0; paintStars(0);
          avatarBase64 = '';
          if (avatarPrev)   { avatarPrev.style.display = 'none'; avatarPrev.src = ''; }
          if (avatarPlaceh) avatarPlaceh.style.display = 'flex';
          if (charNum)      charNum.textContent = '0';

          submitBtn.innerHTML = '<i class="fi fi-rr-check-circle"></i> Review submitted!';
          setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Submit Review';
            if (successEl) successEl.style.display = 'none';
          }, 4000);

        } else {
          showError('Error: ' + (data.error || 'Unknown error'));
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Submit Review';
        }
      } catch (err) {
        showError('Network error. Please try again.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Submit Review';
      }
    });
  }

  function showError(msg) {
    if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
  }

  /* ── 8. AFFICHAGE DES REVIEWS ───────────────────────────────── */
  const listWrap    = document.getElementById('art-reviews-list-wrap');
  const listEl      = document.getElementById('art-reviews-list');
  const countLabel  = document.getElementById('art-rv-count-label');
  const loadMoreBtn = document.getElementById('art-rv-load-more');

  function renderReviews(reset) {
    if (!listEl) return;
    if (reset) { shownCount = 0; listEl.innerHTML = ''; }
    if (allReviews.length === 0) { if (listWrap) listWrap.style.display = 'none'; return; }

    if (listWrap) listWrap.style.display = 'block';
    if (countLabel) countLabel.textContent = `${allReviews.length} review${allReviews.length > 1 ? 's' : ''}`;

    const slice = allReviews.slice(shownCount, shownCount + REVIEWS_PER_PAGE);
    slice.forEach(rv => listEl.appendChild(buildReviewCard(rv)));
    shownCount += slice.length;

    if (loadMoreBtn) loadMoreBtn.style.display = shownCount < allReviews.length ? 'block' : 'none';
  }

  if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => renderReviews(false));

  function buildReviewCard(rv) {
    const card = document.createElement('div');
    card.className = 'art-rv-card';

    const avatarHTML = rv.avatar
      ? `<img class="art-rv-card__avatar" src="${rv.avatar}" alt="${rv.firstName}" loading="lazy">`
      : `<div class="art-rv-card__avatar-placeholder">${(rv.firstName || '?').charAt(0).toUpperCase()}</div>`;

    const rating = parseInt(rv.rating) || 5;
    let starsHTML = '';
    for (let i = 1; i <= 5; i++) {
      starsHTML += `<i class="fi ${i <= rating ? 'fi-sr-star' : 'fi-rr-star empty'}"></i>`;
    }

    card.innerHTML = `
      ${avatarHTML}
      <div class="art-rv-card__body">
        <div class="art-rv-card__top">
          <span class="art-rv-card__name">${escHtml(rv.firstName)} ${escHtml(rv.lastName)}</span>
          <span class="art-rv-card__date">${escHtml(rv.date || '')}</span>
        </div>
        <div class="art-rv-card__stars">${starsHTML}</div>
        <p class="art-rv-card__text">${escHtml(rv.text)}</p>
      </div>`;

    return card;
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── 9. BOUTON INSPIRED ─────────────────────────────────────── */
  const btnInspired = document.getElementById('btn-inspired');
  if (btnInspired) {
    btnInspired.addEventListener('click', () => {
      btnInspired.classList.toggle('active');
      const target = allReviews.length > 0
        ? document.getElementById('art-reviews-list-wrap')
        : document.getElementById('art-review-form-wrap');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /* ── 10. INIT ───────────────────────────────────────────────── */
  attachShareListeners();
  loadStats();

})();