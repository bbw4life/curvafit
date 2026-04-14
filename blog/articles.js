/* ================================================================
   CURVAFIT — article1.js
================================================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* ════════════════════════════════════════════════════════════
     1.  LOAD DATA FROM blog-articles.json — card-1 specific
  ════════════════════════════════════════════════════════════ */
  fetch('/blog/blog-articles.json')
    .then(function (res) { return res.json(); })
    .then(function (data) {

      // ── Find card-1 in the cards array ───────────────────────
      var cardData = null;
      if (data.cards) {
        data.cards.forEach(function (c) {
          if (c.id === 'card-1') cardData = c;
        });
      }

      if (!cardData) {
        console.warn('article1.js: card-1 not found in blog-articles.json');
        return;
      }

      // ── Inject meta tags dynamically ────────────────────────
      var pageTitle = document.getElementById('page-title');
      if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

      var metaDesc = document.getElementById('meta-description');
      if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

      var metaOgTitle = document.getElementById('meta-og-title');
      if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

      var metaOgDesc = document.getElementById('meta-og-desc');
      if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

      var metaOgImage = document.getElementById('meta-og-image');
      if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

      var jsonLd = document.getElementById('json-ld');
      if (jsonLd) {
        var schema = {
          '@context': 'https://schema.org',
          '@type': 'Article',
          'headline': cardData.title,
          'description': cardData.excerpt,
          'image': cardData.image,
          'author': {
            '@type': 'Person',
            'name': cardData.author.name
          },
          'publisher': {
            '@type': 'Organization',
            'name': 'CurvaFit',
            'logo': {
              '@type': 'ImageObject',
              'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png'
            }
          },
          'datePublished': cardData.date,
          'mainEntityOfPage': {
            '@type': 'WebPage',
            '@id': 'https://www.curva-fit.com/blog/article1.html'
          }
        };
        jsonLd.textContent = JSON.stringify(schema);
      }

      // ── Hero image ──────────────────────────────────────────
      var heroImg = document.getElementById('hero-image');
      if (heroImg) {
        heroImg.src = cardData.image;
        heroImg.alt = cardData.imageAlt;
        heroImg.style.display = 'block';
      }

      // ── Hero text fields ────────────────────────────────────
      setText('hero-badge',        cardData.badge);
      setText('hero-readtime',     cardData.readTime);
      setText('hero-title',        cardData.title);
      setText('hero-excerpt',      cardData.excerpt);
      setText('hero-date',         cardData.date);
      setText('hero-views',        cardData.views);
      setText('hero-readtime-stat',cardData.readTime);
      setText('breadcrumb-category', cardData.badge);

      // ── Author chip ─────────────────────────────────────────
      var authorImg = document.getElementById('hero-author-img');
      if (authorImg) {
        authorImg.src = cardData.author.image;
        authorImg.alt = cardData.author.name;
      }
      setText('hero-author-name', cardData.author.name);

      // ── Bio section ─────────────────────────────────────────
      var bioImg = document.getElementById('bio-author-img');
      if (bioImg) {
        bioImg.src = cardData.author.image;
        bioImg.alt = cardData.author.name;
      }
      setText('bio-author-name', cardData.author.name);
      setText('conclusion-author-name', cardData.author.name);

      // ── Quick stats strip ───────────────────────────────────
      setText('strip-readtime', cardData.readTime);
      setText('strip-views',    cardData.views + ' reads');
      setText('strip-date',     cardData.date);

      // ── Inject related articles ─────────────────────────────
      injectRelated(data.cards, cardData.category, 'card-1');

    })
    .catch(function (err) {
      console.error('article1.js: error loading blog-articles.json:', err);
    });


  /* ════════════════════════════════════════════════════════════
     2.  RELATED ARTICLES
  ════════════════════════════════════════════════════════════ */
  function injectRelated(cards, currentCategory, currentId) {
    var relatedGrid = document.getElementById('related-grid');
    if (!relatedGrid || !cards || !cards.length) return;

    // Filter out current article, prefer same category
    var sameCategory = cards.filter(function (c) {
      return c.category === currentCategory && c.id !== currentId;
    });
    var others = cards.filter(function (c) {
      return c.category !== currentCategory && c.id !== currentId;
    });

    shuffle(sameCategory);
    shuffle(others);

    var picks = sameCategory.slice(0, 3);
    if (picks.length < 3) {
      picks = picks.concat(others.slice(0, 3 - picks.length));
    }

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


  /* ════════════════════════════════════════════════════════════
     3.  TABLE OF CONTENTS (auto-built from h2s)
  ════════════════════════════════════════════════════════════ */
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

    // Highlight active section
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var found = links.find(function (l) { return l.el === entry.target; });
        if (found) found.link.classList.toggle('active', entry.isIntersecting);
      });
    }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

    links.forEach(function (l) { observer.observe(l.el); });
  }


  /* ════════════════════════════════════════════════════════════
     4.  READING PROGRESS BAR
  ════════════════════════════════════════════════════════════ */
  function initProgressBar() {
    var bar = document.getElementById('reading-progress-bar');
    if (!bar) return;

    function updateProgress() {
      var scrollTop  = window.scrollY || document.documentElement.scrollTop;
      var docHeight  = document.documentElement.scrollHeight - window.innerHeight;
      var progress   = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
      bar.style.width = progress.toFixed(1) + '%';
    }

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }


  /* ════════════════════════════════════════════════════════════
     5.  STICKY SIDEBAR SHARE (appears after hero)
  ════════════════════════════════════════════════════════════ */
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


  /* ════════════════════════════════════════════════════════════
     6.  SHARE BUTTONS (all share btn groups)
  ════════════════════════════════════════════════════════════ */
  function initShareButtons() {
    var url   = encodeURIComponent(window.location.href);
    var title = encodeURIComponent(document.title);

    document.querySelectorAll('.art-share-btn').forEach(function (btn) {

      // Copy link
      if (btn.id === 'hero-copy-link' || btn.id === 'bottom-copy-link' ||
          btn.classList.contains('art-share-btn--copy')) {
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
            // Fallback
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

      // Social share
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var shareUrl = '#';

        if (btn.classList.contains('art-share-btn--fb')) {
          shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
        } else if (btn.classList.contains('art-share-btn--pi')) {
          var imgEl = document.getElementById('hero-image');
          var img   = encodeURIComponent(imgEl ? imgEl.src : '');
          shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
        } else if (btn.classList.contains('art-share-btn--wa')) {
          shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
        } else if (btn.classList.contains('art-share-btn--tw')) {
          shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
        }

        if (shareUrl !== '#') {
          window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
        }
      });
    });
  }


  /* ════════════════════════════════════════════════════════════
     7.  REACTIONS (like / inspired / more)
  ════════════════════════════════════════════════════════════ */
  function initReactions() {
    var STORAGE_KEY = 'cf_article_reactions_article1';

    function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
    function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

    var reacted = getReacted();

    document.querySelectorAll('.reaction-btn').forEach(function (btn) {
      var type    = btn.getAttribute('data-reaction');
      var countEl = btn.querySelector('.reaction-btn__count');

      if (reacted === type) btn.classList.add('active');

      btn.addEventListener('click', function () {
        if (reacted && reacted !== type) return;
        var current = parseInt((countEl.textContent || '0').replace(/[^0-9]/g, ''), 10) || 0;

        if (btn.classList.contains('active')) {
          btn.classList.remove('active');
          if (countEl) countEl.textContent = Math.max(0, current - 1);
          reacted = '';
          saveReacted('');
        } else {
          btn.classList.add('active');
          if (countEl) countEl.textContent = current + 1;
          reacted = type;
          saveReacted(type);
        }
      });
    });
  }


  /* ════════════════════════════════════════════════════════════
     8.  REVIEW SYSTEM (article1)
  ════════════════════════════════════════════════════════════ */
  (function () {
    var ARTICLE_ID       = 'article1';
    var API              = '/.netlify/functions/reviews-article';
    var REVIEWS_PER_PAGE = 5;
    var allReviews       = [];
    var shownCount       = 0;
    var likeGranted      = false;

    /* Load stats */
    async function loadStats() {
      try {
        var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
        var data = await res.json();
        if (!data.success) return;

        setCount('count-helpful',  data.likes);
        setCount('count-inspired', data.reviewsCount);
        setCount('count-more',     data.shares);

        allReviews = data.reviews || [];
        renderReviews(true);
      } catch (e) {
        console.warn('[article1 reviews] loadStats failed:', e.message);
      }
    }

    function setCount(id, value) {
      var el = document.getElementById(id);
      if (el) el.textContent = value;
    }

    /* Like */
    var btnHelpful = document.getElementById('btn-helpful');
    if (btnHelpful) {
      btnHelpful.addEventListener('click', async function () {
        if (likeGranted) return;
        likeGranted = true;
        btnHelpful.classList.add('active');
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'like', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) setCount('count-helpful', data.likes);
        } catch (e) { console.warn('[article1] like failed:', e.message); }
      });
    }

    /* Share counter */
    async function recordShare() {
      try {
        var res  = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
        });
        var data = await res.json();
        if (data.success) setCount('count-more', data.shares);
      } catch (e) { console.warn('[article1] share failed:', e.message); }
    }

    document.querySelectorAll('.art-share-btn').forEach(function (btn) {
      btn.addEventListener('click', recordShare);
    });

    var btnMore = document.getElementById('btn-more');
    if (btnMore) {
      btnMore.addEventListener('click', function () {
        recordShare();
        var formWrap = document.getElementById('art-review-form-wrap');
        if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    /* Avatar */
    var avatarBase64 = '';

    function compressAvatar(file) {
      return new Promise(function (resolve) {
        if (!file) { resolve(''); return; }
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          var MAX = 150;
          var w   = img.width, h = img.height;
          if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
          else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = function () { URL.revokeObjectURL(url); resolve(''); };
        img.src = url;
      });
    }

    var avatarInput  = document.getElementById('art-rv-avatar-input');
    var avatarWrap   = document.getElementById('art-rv-avatar-wrap');
    var avatarPrev   = document.getElementById('art-rv-avatar-preview');
    var avatarPlaceh = document.getElementById('art-rv-avatar-placeholder');

    if (avatarWrap && avatarInput) {
      avatarWrap.addEventListener('click', function () { avatarInput.click(); });
      avatarInput.addEventListener('change', async function () {
        var file = avatarInput.files[0];
        if (!file) return;
        avatarBase64 = await compressAvatar(file);
        if (avatarBase64 && avatarPrev && avatarPlaceh) {
          avatarPrev.src = avatarBase64;
          avatarPrev.style.display = 'block';
          avatarPlaceh.style.display = 'none';
        }
      });
    }

    /* Stars */
    var stars         = document.querySelectorAll('.art-rv-star');
    var ratingInput   = document.getElementById('art-rv-rating');
    var selectedRating = 0;

    function paintStars(upTo) {
      stars.forEach(function (s, i) {
        s.classList.toggle('fi-sr-star', i < upTo);
        s.classList.toggle('fi-rr-star', i >= upTo);
        s.classList.toggle('selected',   i < upTo);
      });
    }

    stars.forEach(function (star) {
      star.addEventListener('mouseover', function () { paintStars(parseInt(star.dataset.val)); });
      star.addEventListener('mouseout',  function () { paintStars(selectedRating); });
      star.addEventListener('click',     function () {
        selectedRating = parseInt(star.dataset.val);
        if (ratingInput) ratingInput.value = selectedRating;
        paintStars(selectedRating);
      });
    });

    /* Char counter */
    var textarea = document.getElementById('art-rv-text');
    var charNum  = document.getElementById('art-rv-char-num');
    if (textarea && charNum) {
      textarea.addEventListener('input', function () {
        charNum.textContent = textarea.value.length;
      });
    }

    /* Submit review */
    var reviewForm = document.getElementById('art-review-form');
    var submitBtn  = document.getElementById('art-rv-submit');
    var errorEl    = document.getElementById('art-rv-error');
    var successEl  = document.getElementById('art-rv-success');

    if (reviewForm) {
      reviewForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        var firstName = document.getElementById('art-rv-firstname').value.trim();
        var lastName  = document.getElementById('art-rv-lastname').value.trim();
        var text      = document.getElementById('art-rv-text').value.trim();
        var rating    = parseInt(ratingInput ? ratingInput.value : '0');

        if (errorEl)   errorEl.style.display   = 'none';
        if (successEl) successEl.style.display = 'none';

        if (!firstName || !lastName) { showError('Please enter your first and last name.'); return; }
        if (rating === 0)            { showError('Please select a star rating.'); return; }
        if (!text || text.length < 10) { showError('Please write at least 10 characters in your review.'); return; }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending…';

        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add-review', articleId: ARTICLE_ID,
              firstName, lastName, avatar: avatarBase64, text, rating
            })
          });
          var data = await res.json();

          if (data.success) {
            if (successEl) successEl.style.display = 'flex';
            setCount('count-inspired', data.reviewsCount);

            allReviews.unshift({
              firstName, lastName, avatar: avatarBase64, text, rating,
              date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            });
            renderReviews(true);

            reviewForm.reset();
            selectedRating = 0; paintStars(0);
            avatarBase64 = '';
            if (avatarPrev)   { avatarPrev.style.display = 'none'; avatarPrev.src = ''; }
            if (avatarPlaceh) avatarPlaceh.style.display = 'flex';
            if (charNum)      charNum.textContent = '0';

            submitBtn.innerHTML = '<i class="fi fi-rr-check-circle"></i> Review submitted!';
            setTimeout(function () {
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

    /* Render reviews */
    var listWrap    = document.getElementById('art-reviews-list-wrap');
    var listEl      = document.getElementById('art-reviews-list');
    var countLabel  = document.getElementById('art-rv-count-label');
    var loadMoreBtn = document.getElementById('art-rv-load-more');

    function renderReviews(reset) {
      if (!listEl) return;
      if (reset) { shownCount = 0; listEl.innerHTML = ''; }
      if (allReviews.length === 0) { if (listWrap) listWrap.style.display = 'none'; return; }

      if (listWrap) listWrap.style.display = 'block';
      if (countLabel) countLabel.textContent = allReviews.length + ' review' + (allReviews.length > 1 ? 's' : '');

      var slice = allReviews.slice(shownCount, shownCount + REVIEWS_PER_PAGE);
      slice.forEach(function (rv) { listEl.appendChild(buildReviewCard(rv)); });
      shownCount += slice.length;

      if (loadMoreBtn) loadMoreBtn.style.display = shownCount < allReviews.length ? 'block' : 'none';
    }

    if (loadMoreBtn) loadMoreBtn.addEventListener('click', function () { renderReviews(false); });

    function buildReviewCard(rv) {
      var card = document.createElement('div');
      card.className = 'art-rv-card';

      var avatarHTML = rv.avatar
        ? '<img class="art-rv-card__avatar" src="' + rv.avatar + '" alt="' + rv.firstName + '" loading="lazy">'
        : '<div class="art-rv-card__avatar-placeholder">' + (rv.firstName || '?').charAt(0).toUpperCase() + '</div>';

      var rating = parseInt(rv.rating) || 5;
      var starsHTML = '';
      for (var i = 1; i <= 5; i++) {
        starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
      }

      card.innerHTML = avatarHTML +
        '<div class="art-rv-card__body">' +
          '<div class="art-rv-card__top">' +
            '<span class="art-rv-card__name">' + escHtml(rv.firstName) + ' ' + escHtml(rv.lastName) + '</span>' +
            '<span class="art-rv-card__date">' + escHtml(rv.date || '') + '</span>' +
          '</div>' +
          '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
          '<p class="art-rv-card__text">' + escHtml(rv.text) + '</p>' +
        '</div>';

      return card;
    }

    function escHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* Inspired btn — scroll to form */
    var btnInspired = document.getElementById('btn-inspired');
    if (btnInspired) {
      btnInspired.addEventListener('click', function () {
        btnInspired.classList.toggle('active');
        var target = allReviews.length > 0
          ? document.getElementById('art-reviews-list-wrap')
          : document.getElementById('art-review-form-wrap');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    loadStats();
  })();


  /* ════════════════════════════════════════════════════════════
     9.  NEWSLETTER FORMS
  ════════════════════════════════════════════════════════════ */
  function initNewsletterForms() {
    // Mid-article newsletter
    var nlForm  = document.getElementById('article-nl-form');
    var nlEmail = document.getElementById('article-nl-email');

    if (nlForm && nlEmail) {
      nlForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var val = nlEmail.value.trim();
        if (!val || !val.includes('@')) return;

        var btn          = nlForm.querySelector('button');
        var originalHTML = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...'; }

        try {
          var res  = await fetch('/.netlify/functions/save-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
          });
          var data = await res.json();

          if (data.success) {
            nlEmail.value = '';
            if (btn) {
              btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!';
              setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
            }
            showNewsletterPopup();
          } else {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        } catch (err) {
          if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          console.error('Newsletter error:', err);
        }
      });
    }

    // Footer newsletter
    var footerForm  = document.getElementById('newsletter-form-footer');
    var footerEmail = document.getElementById('newsletter-email-footer');

    if (footerForm && footerEmail) {
      footerForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var val = footerEmail.value.trim();
        if (!val || !val.includes('@')) return;

        var btn          = footerForm.querySelector('button');
        var originalText = btn ? btn.textContent : '';
        if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

        try {
          var res  = await fetch('/.netlify/functions/save-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
          });
          var data = await res.json();
          if (data.success) {
            footerEmail.value = '';
            showNewsletterPopup();
          }
        } catch (err) {
          console.error(err);
        } finally {
          if (btn) { btn.textContent = originalText; btn.disabled = false; }
        }
      });
    }
  }

  function showNewsletterPopup() {
    var popup = document.getElementById('newsletter-popup');
    if (popup) {
      popup.classList.add('show');
      setTimeout(function () { popup.classList.remove('show'); }, 8000);
      var closeBtn = document.getElementById('popup-close-btn');
      if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
    }
  }


  /* ════════════════════════════════════════════════════════════
     10. HERO PARALLAX
  ════════════════════════════════════════════════════════════ */
  function initHeroParallax() {
    var heroImg = document.getElementById('hero-image');
    if (!heroImg || window.innerWidth < 768) return;

    window.addEventListener('scroll', function () {
      var scrollY = window.scrollY;
      var heroEl  = document.getElementById('article-hero');
      if (!heroEl) return;
      if (scrollY > heroEl.offsetHeight) return;
      heroImg.style.transform = 'scale(1.04) translateY(' + (scrollY * 0.30) + 'px)';
    }, { passive: true });
  }


  /* ════════════════════════════════════════════════════════════
     11. SCROLL REVEAL ANIMATIONS
  ════════════════════════════════════════════════════════════ */
  function initScrollReveal() {
    var revealEls = document.querySelectorAll(
      '.article-section, .article-takeaways, .article-mid-cta, ' +
      '.article-results, .article-author-bio, .article-reactions, ' +
      '.article-share-bottom, .article-newsletter, .related-card, ' +
      '.a1-infographic, .a1-hormone-card, .a1-framework-pillar'
    );

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity   = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.07 });

    revealEls.forEach(function (el) {
      el.style.opacity    = '0';
      el.style.transform  = 'translateY(22px)';
      el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
      observer.observe(el);
    });
  }


  /* ════════════════════════════════════════════════════════════
     UTILS
  ════════════════════════════════════════════════════════════ */
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j   = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }


  /* ════════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════════ */
  initProgressBar();
  initSidebarShare();
  initShareButtons();
  initReactions();
  initNewsletterForms();
  initHeroParallax();

  // Delayed to allow DOM injection from blog-articles.json
  setTimeout(function () {
    buildTOC();
    initScrollReveal();
  }, 200);

});









/* ================================================================
   ARTICLE 2 — "Nourishing Meals That Honor Your Curves"
================================================================ */

(function () {

  // Only run on article2
  if (!document.body.classList.contains('a2-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-2
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-2') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a2]: card-2 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article2.html' }
          });
        }

        // ── Hero fields ────────────────────────────────────────
        var heroImg = document.getElementById('a2-hero-img');
        if (heroImg) { heroImg.src = cardData.image; heroImg.alt = cardData.imageAlt || cardData.title; }

        a2setText('a2-hero-badge',    cardData.badge);
        a2setText('a2-hero-readtime', cardData.readTime);
        a2setText('a2-hero-title',    cardData.title);
        a2setText('a2-hero-excerpt',  cardData.excerpt);
        a2setText('a2-hero-date',     cardData.date);
        a2setText('a2-hero-views',    cardData.views + ' reads');
        a2setText('a2-breadcrumb-cat', cardData.badge);

        var authorImg = document.getElementById('a2-hero-author-img');
        if (authorImg) { authorImg.src = cardData.author.image; authorImg.alt = cardData.author.name; }
        a2setText('a2-hero-author-name', cardData.author.name);

        // ── Bio ────────────────────────────────────────────────
        var bioImg = document.getElementById('a2-bio-img');
        if (bioImg) { bioImg.src = cardData.author.image; bioImg.alt = cardData.author.name; }
        a2setText('a2-bio-name',         cardData.author.name);
        a2setText('a2-conclusion-author', cardData.author.name);

        // ── Ribbon ─────────────────────────────────────────────
        a2setText('a2-ribbon-readtime', cardData.readTime);
        a2setText('a2-ribbon-views',    cardData.views + ' reads');
        a2setText('a2-ribbon-date',     cardData.date);

        // ── Related articles ───────────────────────────────────
        a2InjectRelated(data.cards, cardData.category, 'card-2');

      })
      .catch(function (err) {
        console.error('articles.js [a2]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a2InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a2-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a2Shuffle(sameCategory);
      a2Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + (card.imageAlt || card.title) + '" loading="lazy">' +
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


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a2BuildTOC() {
      var tocNav   = document.getElementById('a2-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a2-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a2-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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
          var found = links.find(function (l) { return l.el === entry.target; });
          if (found) found.link.classList.toggle('active', entry.isIntersecting);
        });
      }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

      links.forEach(function (l) { observer.observe(l.el); });
    }


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a2InitProgressBar() {
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


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a2InitSidebarShare() {
      var stickyShare = document.getElementById('a2-sticky-share');
      var hero        = document.getElementById('a2-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a2InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a2-share-btn').forEach(function (btn) {

        // Copy link
        if (btn.id === 'a2-hero-copy' || btn.id === 'a2-bottom-copy' ||
            btn.classList.contains('a2-share-btn--copy')) {
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
          if (btn.classList.contains('a2-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a2-share-btn--pi')) {
            var imgEl = document.getElementById('a2-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a2-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a2-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a2InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article2';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a2-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       8.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article2';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a2setCount('a2-count-helpful',  data.likes);
          a2setCount('a2-count-inspired', data.reviewsCount);
          a2setCount('a2-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a2 reviews] loadStats failed:', e.message);
        }
      }

      function a2setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a2-btn-helpful');
      if (btnHelpful) {
        btnHelpful.addEventListener('click', async function () {
          if (likeGranted) return;
          likeGranted = true;
          btnHelpful.classList.add('active');
          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'like', articleId: ARTICLE_ID })
            });
            var data = await res.json();
            if (data.success) a2setCount('a2-count-helpful', data.likes);
          } catch (e) { console.warn('[a2] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a2setCount('a2-count-more', data.shares);
        } catch (e) { console.warn('[a2] share failed:', e.message); }
      }

      document.querySelectorAll('.a2-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a2-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a2-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
      var avatarBase64 = '';

      function compressAvatar(file) {
        return new Promise(function (resolve) {
          if (!file) { resolve(''); return; }
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () {
            var MAX = 150, w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          };
          img.onerror = function () { URL.revokeObjectURL(url); resolve(''); };
          img.src = url;
        });
      }

      var avatarInput  = document.getElementById('a2-rv-avatar-input');
      var avatarWrap   = document.getElementById('a2-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a2-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a2-rv-avatar-placeholder');

      if (avatarWrap && avatarInput) {
        avatarWrap.addEventListener('click', function () { avatarInput.click(); });
        avatarInput.addEventListener('change', async function () {
          var file = avatarInput.files[0];
          if (!file) return;
          avatarBase64 = await compressAvatar(file);
          if (avatarBase64 && avatarPrev && avatarPlaceh) {
            avatarPrev.src = avatarBase64;
            avatarPrev.style.display = 'block';
            avatarPlaceh.style.display = 'none';
          }
        });
      }

      // Stars
      var stars          = document.querySelectorAll('#a2-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a2-rv-rating');
      var selectedRating = 0;

      function paintStars(upTo) {
        stars.forEach(function (s, i) {
          s.classList.toggle('fi-sr-star', i < upTo);
          s.classList.toggle('fi-rr-star', i >= upTo);
          s.classList.toggle('selected',   i < upTo);
        });
      }

      stars.forEach(function (star) {
        star.addEventListener('mouseover', function () { paintStars(parseInt(star.dataset.val)); });
        star.addEventListener('mouseout',  function () { paintStars(selectedRating); });
        star.addEventListener('click',     function () {
          selectedRating = parseInt(star.dataset.val);
          if (ratingInput) ratingInput.value = selectedRating;
          paintStars(selectedRating);
        });
      });

      // Char counter
      var textarea = document.getElementById('a2-rv-text');
      var charNum  = document.getElementById('a2-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a2-art-review-form');
      var submitBtn  = document.getElementById('a2-rv-submit');
      var errorEl    = document.getElementById('a2-rv-error');
      var successEl  = document.getElementById('a2-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a2-rv-firstname').value.trim();
          var lastName  = document.getElementById('a2-rv-lastname').value.trim();
          var text      = document.getElementById('a2-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)        { showError('Please enter your first and last name.'); return; }
          if (rating === 0)                   { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10)      { showError('Please write at least 10 characters.'); return; }

          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending…';

          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'add-review', articleId: ARTICLE_ID,
                firstName, lastName, avatar: avatarBase64, text, rating
              })
            });
            var data = await res.json();

            if (data.success) {
              if (successEl) successEl.style.display = 'flex';
              a2setCount('a2-count-inspired', data.reviewsCount);

              allReviews.unshift({
                firstName, lastName, avatar: avatarBase64, text, rating,
                date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
              });
              renderReviews(true);

              reviewForm.reset();
              selectedRating = 0; paintStars(0);
              avatarBase64 = '';
              if (avatarPrev)   { avatarPrev.style.display = 'none'; avatarPrev.src = ''; }
              if (avatarPlaceh) avatarPlaceh.style.display = 'flex';
              if (charNum)      charNum.textContent = '0';

              submitBtn.innerHTML = '<i class="fi fi-rr-check-circle"></i> Review submitted!';
              setTimeout(function () {
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

      // Reviews list
      var listWrap    = document.getElementById('a2-art-reviews-list-wrap');
      var listEl      = document.getElementById('a2-art-reviews-list');
      var countLabel  = document.getElementById('a2-rv-count-label');
      var loadMoreBtn = document.getElementById('a2-rv-load-more');

      function renderReviews(reset) {
        if (!listEl) return;
        if (reset) { shownCount = 0; listEl.innerHTML = ''; }
        if (allReviews.length === 0) { if (listWrap) listWrap.style.display = 'none'; return; }
        if (listWrap) listWrap.style.display = 'block';
        if (countLabel) countLabel.textContent = allReviews.length + ' review' + (allReviews.length > 1 ? 's' : '');

        var slice = allReviews.slice(shownCount, shownCount + REVIEWS_PER_PAGE);
        slice.forEach(function (rv) { listEl.appendChild(buildReviewCard(rv)); });
        shownCount += slice.length;
        if (loadMoreBtn) loadMoreBtn.style.display = shownCount < allReviews.length ? 'block' : 'none';
      }

      if (loadMoreBtn) loadMoreBtn.addEventListener('click', function () { renderReviews(false); });

      function buildReviewCard(rv) {
        var card = document.createElement('div');
        card.className = 'art-rv-card';

        var avatarHTML = rv.avatar
          ? '<img class="art-rv-card__avatar" src="' + rv.avatar + '" alt="' + rv.firstName + '" loading="lazy">'
          : '<div class="art-rv-card__avatar-placeholder">' + (rv.firstName || '?').charAt(0).toUpperCase() + '</div>';

        var rating = parseInt(rv.rating) || 5;
        var starsHTML = '';
        for (var i = 1; i <= 5; i++) {
          starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
        }

        card.innerHTML = avatarHTML +
          '<div class="art-rv-card__body">' +
            '<div class="art-rv-card__top">' +
              '<span class="art-rv-card__name">' + a2EscHtml(rv.firstName) + ' ' + a2EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a2EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a2EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      // Inspired btn scroll to reviews/form
      var btnInspired = document.getElementById('a2-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a2-art-reviews-list-wrap')
            : document.getElementById('a2-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       9.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a2InitNewsletterForms() {
      // Mid-article
      var nlForm  = document.getElementById('a2-article-nl-form');
      var nlEmail = document.getElementById('a2-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...'; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();

            if (data.success) {
              nlEmail.value = '';
              if (btn) {
                btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!';
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a2ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer (shared across all articles — only attach if not already attached)
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a2Bound) {
        footerForm.dataset.a2Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a2ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a2ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       10. HERO PARALLAX (image panel)
    ════════════════════════════════════════════════════════════ */
    function a2InitHeroParallax() {
      var heroImg = document.getElementById('a2-hero-img');
      if (!heroImg || window.innerWidth < 900) return;

      var hero = document.getElementById('a2-hero');
      window.addEventListener('scroll', function () {
        if (!hero) return;
        var scrollY = window.scrollY;
        if (scrollY > hero.offsetHeight) return;
        heroImg.style.transform = 'scale(1.06) translateY(' + (scrollY * 0.20) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       11. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a2InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a2-section, .a2-takeaways, .a2-pullquote, .a2-mid-cta, ' +
        '.a2-author-bio, .a2-reactions, .a2-food-card, ' +
        '.a2-pitfall, .a2-pillar-card, .a2-day-card, .a2-plate-visual, ' +
        '.a2-timing-card, .a2-figure, .a2-callout, .a2-hunger-scale, ' +
        '#a2-article-reactions, #a2-article-share-bottom, #a2-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(24px)';
        el.style.transition = 'opacity 0.60s ease, transform 0.60s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       12. FLOATING CARDS ENTRANCE ANIMATION
    ════════════════════════════════════════════════════════════ */
    function a2AnimateFloatCards() {
      var cards = document.querySelectorAll('.a2-float-card');
      cards.forEach(function (card, i) {
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(20px) scale(0.9)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        setTimeout(function () {
          card.style.opacity   = '1';
          card.style.transform = 'translateY(0) scale(1)';
        }, 800 + i * 300);
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a2setText(id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a2Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a2EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a2InitProgressBar();
    a2InitSidebarShare();
    a2InitShareButtons();
    a2InitReactions();
    a2InitNewsletterForms();
    a2InitHeroParallax();
    a2AnimateFloatCards();

    // Delayed to allow JSON injection to settle
    setTimeout(function () {
      a2BuildTOC();
      a2InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE







/* ================================================================
   CURVAFIT — article3 script
   "Cultivating Body Confidence Through Daily Affirmations"
   Append this block to /blog/articles.js
================================================================ */

(function () {
  'use strict';

  /* Run only on article3 page */
  if (!document.getElementById('a3-affirmation-strip') && !document.getElementById('a3-affirmation-track')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-3 specific
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-3') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [article3]: card-3 not found in blog-articles.json');
          return;
        }

        /* ── Meta tags ───────────────────────────────────────── */
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article3.html' }
          });
        }

        /* ── Hero image ──────────────────────────────────────── */
        var heroImg = document.getElementById('hero-image');
        if (heroImg) {
          heroImg.src = cardData.image;
          heroImg.alt = cardData.imageAlt;
          heroImg.style.display = 'block';
        }

        /* ── Hero text ───────────────────────────────────────── */
        setText('hero-badge',           cardData.badge);
        setText('hero-readtime',        cardData.readTime);
        setText('hero-title',           cardData.title);
        setText('hero-excerpt',         cardData.excerpt);
        setText('hero-date',            cardData.date);
        setText('hero-views',           cardData.views);
        setText('hero-readtime-stat',   cardData.readTime);
        setText('breadcrumb-category',  cardData.badge);

        /* ── Author chip ─────────────────────────────────────── */
        var heroAuthorImg = document.getElementById('hero-author-img');
        if (heroAuthorImg) {
          heroAuthorImg.src = cardData.author.image;
          heroAuthorImg.alt = cardData.author.name;
        }
        setText('hero-author-name', cardData.author.name);

        /* ── Bio section ─────────────────────────────────────── */
        var bioImg = document.getElementById('bio-author-img');
        if (bioImg) {
          bioImg.src = cardData.author.image;
          bioImg.alt = cardData.author.name;
        }
        setText('bio-author-name',       cardData.author.name);
        setText('conclusion-author-name', cardData.author.name);

        /* ── Related articles ────────────────────────────────── */
        injectRelated(data.cards, cardData.category, 'card-3');

      })
      .catch(function (err) {
        console.error('articles.js [article3]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function injectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var same   = cards.filter(function (c) { return c.category === currentCategory && c.id !== currentId; });
      var others = cards.filter(function (c) { return c.category !== currentCategory && c.id !== currentId; });

      shuffle(same);
      shuffle(others);

      var picks = same.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

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


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function buildTOC() {
      var tocNav   = document.getElementById('toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.article-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a3-heading-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
        a.textContent = h2.textContent;
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var target = document.getElementById(h2.id);
          if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
        });
        tocNav.appendChild(a);
        links.push({ el: h2, link: a });
      });

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var found = links.find(function (l) { return l.el === entry.target; });
          if (found) found.link.classList.toggle('active', entry.isIntersecting);
        });
      }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

      links.forEach(function (l) { observer.observe(l.el); });
    }


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function initProgressBar() {
      var bar = document.getElementById('reading-progress-bar');
      if (!bar) return;
      function update() {
        var scrollTop = window.scrollY || document.documentElement.scrollTop;
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0).toFixed(1) + '%';
      }
      window.addEventListener('scroll', update, { passive: true });
      update();
    }


    /* ════════════════════════════════════════════════════════════
       5.  SIDEBAR SHARE STICKY
    ════════════════════════════════════════════════════════════ */
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


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function initShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.art-share-btn').forEach(function (btn) {

        /* Copy link */
        if (btn.classList.contains('art-share-btn--copy')) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            navigator.clipboard.writeText(window.location.href).then(function () {
              btn.classList.add('copied');
              var icon = btn.querySelector('i');
              var orig = icon ? icon.className : '';
              if (icon) icon.className = 'fi fi-rr-check';
              setTimeout(function () {
                btn.classList.remove('copied');
                if (icon) icon.className = orig;
              }, 2200);
            }).catch(function () {
              var ta = document.createElement('textarea');
              ta.value = window.location.href;
              document.body.appendChild(ta); ta.select();
              document.execCommand('copy');
              document.body.removeChild(ta);
            });
          });
          return;
        }

        /* Social */
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var shareUrl = '#';
          if (btn.classList.contains('art-share-btn--fb'))
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          else if (btn.classList.contains('art-share-btn--pi')) {
            var imgEl = document.getElementById('hero-image');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + encodeURIComponent(imgEl ? imgEl.src : '');
          } else if (btn.classList.contains('art-share-btn--wa'))
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          else if (btn.classList.contains('art-share-btn--tw'))
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;

          if (shareUrl !== '#') window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  DAILY AFFIRMATION ROTATOR (Sidebar)
    ════════════════════════════════════════════════════════════ */
    function initDailyAffirmation() {
      var affirmations = [
        '"I am worthy of love exactly as I am."',
        '"My body carries me through every beautiful day."',
        '"I celebrate every step of my journey."',
        '"My curves tell a story of strength."',
        '"I am allowed to take up space in every room."',
        '"Today I choose compassion over criticism."',
        '"I am more than what I weigh or what I look like."',
        '"My beauty already exists — it is not a project."',
        '"I treat my body as the partner it truly is."',
        '"Every day of practice is a gift I give my future self."',
        '"I forgive myself and begin again with gentleness."',
        '"I am exactly where my journey needs me to be."'
      ];

      var quoteEl = document.getElementById('a3-daily-quote');
      var nextBtn = document.getElementById('a3-next-affirmation');
      if (!quoteEl || !nextBtn) return;

      /* Pick today's default by date index */
      var today   = new Date();
      var dayIdx  = (today.getFullYear() * 1000 + today.getMonth() * 31 + today.getDate()) % affirmations.length;
      var current = dayIdx;

      quoteEl.textContent = affirmations[current];

      nextBtn.addEventListener('click', function () {
        current = (current + 1) % affirmations.length;
        quoteEl.style.opacity = '0';
        quoteEl.style.transform = 'translateY(6px)';
        setTimeout(function () {
          quoteEl.textContent = affirmations[current];
          quoteEl.style.opacity = '1';
          quoteEl.style.transform = 'translateY(0)';
        }, 250);
      });

      quoteEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    }


    /* ════════════════════════════════════════════════════════════
       8.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function initReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article3';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('.reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl.textContent || '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = ''; saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type; saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       9.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article3';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          setCount('count-helpful',  data.likes);
          setCount('count-inspired', data.reviewsCount);
          setCount('count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) { console.warn('[article3 reviews] loadStats failed:', e.message); }
      }

      function setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      var btnHelpful = document.getElementById('btn-helpful');
      if (btnHelpful) {
        btnHelpful.addEventListener('click', async function () {
          if (likeGranted) return;
          likeGranted = true;
          btnHelpful.classList.add('active');
          try {
            var res  = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'like', articleId: ARTICLE_ID }) });
            var data = await res.json();
            if (data.success) setCount('count-helpful', data.likes);
          } catch (e) { console.warn('[article3] like failed:', e.message); }
        });
      }

      async function recordShare() {
        try {
          var res  = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID }) });
          var data = await res.json();
          if (data.success) setCount('count-more', data.shares);
        } catch (e) { console.warn('[article3] share failed:', e.message); }
      }

      document.querySelectorAll('.art-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var target = allReviews.length > 0
            ? document.getElementById('art-reviews-list-wrap')
            : document.getElementById('art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      /* Avatar */
      var avatarBase64 = '';

      function compressAvatar(file) {
        return new Promise(function (resolve) {
          if (!file) { resolve(''); return; }
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () {
            var MAX = 150, w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          };
          img.onerror = function () { URL.revokeObjectURL(url); resolve(''); };
          img.src = url;
        });
      }

      var avatarInput  = document.getElementById('art-rv-avatar-input');
      var avatarWrap   = document.getElementById('art-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('art-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('art-rv-avatar-placeholder');

      if (avatarWrap && avatarInput) {
        avatarWrap.addEventListener('click', function () { avatarInput.click(); });
        avatarInput.addEventListener('change', async function () {
          var file = avatarInput.files[0];
          if (!file) return;
          avatarBase64 = await compressAvatar(file);
          if (avatarBase64 && avatarPrev && avatarPlaceh) {
            avatarPrev.src = avatarBase64;
            avatarPrev.style.display = 'block';
            avatarPlaceh.style.display = 'none';
          }
        });
      }

      /* Stars */
      var stars          = document.querySelectorAll('.art-rv-star');
      var ratingInput    = document.getElementById('art-rv-rating');
      var selectedRating = 0;

      function paintStars(upTo) {
        stars.forEach(function (s, i) {
          s.classList.toggle('fi-sr-star', i < upTo);
          s.classList.toggle('fi-rr-star', i >= upTo);
          s.classList.toggle('selected',   i < upTo);
        });
      }

      stars.forEach(function (star) {
        star.addEventListener('mouseover', function () { paintStars(parseInt(star.dataset.val)); });
        star.addEventListener('mouseout',  function () { paintStars(selectedRating); });
        star.addEventListener('click',     function () {
          selectedRating = parseInt(star.dataset.val);
          if (ratingInput) ratingInput.value = selectedRating;
          paintStars(selectedRating);
        });
      });

      /* Char counter */
      var textarea = document.getElementById('art-rv-text');
      var charNum  = document.getElementById('art-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      /* Submit */
      var reviewForm = document.getElementById('art-review-form');
      var submitBtn  = document.getElementById('art-rv-submit');
      var errorEl    = document.getElementById('art-rv-error');
      var successEl  = document.getElementById('art-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var firstName = document.getElementById('art-rv-firstname').value.trim();
          var lastName  = document.getElementById('art-rv-lastname').value.trim();
          var text      = document.getElementById('art-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName) { showError('Please enter your first and last name.'); return; }
          if (rating === 0)            { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10) { showError('Please write at least 10 characters in your review.'); return; }

          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending…';

          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'add-review', articleId: ARTICLE_ID, firstName, lastName, avatar: avatarBase64, text, rating })
            });
            var data = await res.json();

            if (data.success) {
              if (successEl) successEl.style.display = 'flex';
              setCount('count-inspired', data.reviewsCount);
              allReviews.unshift({ firstName, lastName, avatar: avatarBase64, text, rating, date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) });
              renderReviews(true);
              reviewForm.reset();
              selectedRating = 0; paintStars(0);
              avatarBase64 = '';
              if (avatarPrev)   { avatarPrev.style.display = 'none'; avatarPrev.src = ''; }
              if (avatarPlaceh) avatarPlaceh.style.display = 'flex';
              if (charNum)      charNum.textContent = '0';
              submitBtn.innerHTML = '<i class="fi fi-rr-check-circle"></i> Review submitted!';
              setTimeout(function () {
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

      /* Render reviews */
      var listWrap    = document.getElementById('art-reviews-list-wrap');
      var listEl      = document.getElementById('art-reviews-list');
      var countLabel  = document.getElementById('art-rv-count-label');
      var loadMoreBtn = document.getElementById('art-rv-load-more');

      function renderReviews(reset) {
        if (!listEl) return;
        if (reset) { shownCount = 0; listEl.innerHTML = ''; }
        if (allReviews.length === 0) { if (listWrap) listWrap.style.display = 'none'; return; }
        if (listWrap) listWrap.style.display = 'block';
        if (countLabel) countLabel.textContent = allReviews.length + ' review' + (allReviews.length > 1 ? 's' : '');
        var slice = allReviews.slice(shownCount, shownCount + REVIEWS_PER_PAGE);
        slice.forEach(function (rv) { listEl.appendChild(buildReviewCard(rv)); });
        shownCount += slice.length;
        if (loadMoreBtn) loadMoreBtn.style.display = shownCount < allReviews.length ? 'block' : 'none';
      }

      if (loadMoreBtn) loadMoreBtn.addEventListener('click', function () { renderReviews(false); });

      function buildReviewCard(rv) {
        var card = document.createElement('div');
        card.className = 'art-rv-card';
        var avatarHTML = rv.avatar
          ? '<img class="art-rv-card__avatar" src="' + rv.avatar + '" alt="' + rv.firstName + '" loading="lazy">'
          : '<div class="art-rv-card__avatar-placeholder">' + (rv.firstName || '?').charAt(0).toUpperCase() + '</div>';
        var rating = parseInt(rv.rating) || 5;
        var starsHTML = '';
        for (var i = 1; i <= 5; i++) starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
        card.innerHTML = avatarHTML + '<div class="art-rv-card__body"><div class="art-rv-card__top"><span class="art-rv-card__name">' + escHtml(rv.firstName) + ' ' + escHtml(rv.lastName) + '</span><span class="art-rv-card__date">' + escHtml(rv.date || '') + '</span></div><div class="art-rv-card__stars">' + starsHTML + '</div><p class="art-rv-card__text">' + escHtml(rv.text) + '</p></div>';
        return card;
      }

      function escHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }

      var btnInspired = document.getElementById('btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0 ? document.getElementById('art-reviews-list-wrap') : document.getElementById('art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       10. NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function initNewsletterForms() {
      var nlForm  = document.getElementById('article-nl-form');
      var nlEmail = document.getElementById('article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;
          var btn = nlForm.querySelector('button');
          var orig = btn ? btn.innerHTML : '';
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...'; }
          try {
            var res  = await fetch('/.netlify/functions/save-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'newsletter-subscribe', email: val }) });
            var data = await res.json();
            if (data.success) {
              nlEmail.value = '';
              if (btn) { btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!'; setTimeout(function () { btn.disabled = false; btn.innerHTML = orig; }, 4000); }
              showNewsletterPopup();
            } else { if (btn) { btn.disabled = false; btn.innerHTML = orig; } }
          } catch (err) { if (btn) { btn.disabled = false; btn.innerHTML = orig; } }
        });
      }

      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');
      if (footerForm && footerEmail) {
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;
          var btn = footerForm.querySelector('button');
          var orig = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }
          try {
            var res  = await fetch('/.netlify/functions/save-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'newsletter-subscribe', email: val }) });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; showNewsletterPopup(); }
          } catch (err) { console.error(err); } finally { if (btn) { btn.textContent = orig; btn.disabled = false; } }
        });
      }
    }

    function showNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       11. HERO PARALLAX
    ════════════════════════════════════════════════════════════ */
    function initHeroParallax() {
      var heroImg = document.getElementById('hero-image');
      if (!heroImg || window.innerWidth < 768) return;
      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        var heroEl  = document.getElementById('article-hero');
        if (!heroEl || scrollY > heroEl.offsetHeight) return;
        heroImg.style.transform = 'scale(1.04) translateY(' + (scrollY * 0.28) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       12. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function initScrollReveal() {
      var els = document.querySelectorAll(
        '.article-section, .article-takeaways, .article-mid-cta, ' +
        '.article-results, .article-author-bio, .article-reactions, ' +
        '.article-share-bottom, .article-newsletter, .related-card, ' +
        '.a3-confidence-model, .a3-aff-block, .a3-ritual-day, .a3-compare-card'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      els.forEach(function (el) {
        el.style.opacity   = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       13. AFFIRMATION LIST — click-to-highlight
    ════════════════════════════════════════════════════════════ */
    function initAffirmationHighlight() {
      document.querySelectorAll('.a3-aff-list li').forEach(function (li) {
        li.addEventListener('click', function () {
          var wasSelected = li.classList.contains('a3-aff-selected');
          /* Clear all */
          document.querySelectorAll('.a3-aff-list li').forEach(function (l) {
            l.classList.remove('a3-aff-selected');
            l.style.background = '';
          });
          if (!wasSelected) {
            li.classList.add('a3-aff-selected');
            li.style.background = 'rgba(192, 56, 94, 0.10)';
            li.style.borderLeft = '3px solid #c0385e';
            li.style.paddingLeft = '11px';
          }
        });
        li.style.cursor = 'pointer';
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function setText(id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    initProgressBar();
    initSidebarShare();
    initShareButtons();
    initReactions();
    initNewsletterForms();
    initHeroParallax();
    initDailyAffirmation();

    setTimeout(function () {
      buildTOC();
      initScrollReveal();
      initAffirmationHighlight();
    }, 200);

  });

})();









/* ================================================================
   ARTICLE 4 — "Understanding and Overcoming Emotional Eating Triggers"
================================================================ */

(function () {

  // Only run on article4
  if (!document.body.classList.contains('a4-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-4
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-4') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a4]: card-4 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article4.html' }
          });
        }

        // ── Hero fields ────────────────────────────────────────
        var heroBgImg = document.getElementById('a4-hero-bg-img');
        if (heroBgImg) { heroBgImg.src = cardData.image; heroBgImg.alt = cardData.imageAlt || cardData.title; }

        var heroImg = document.getElementById('a4-hero-img');
        if (heroImg) { heroImg.src = cardData.image; heroImg.alt = cardData.imageAlt || cardData.title; }

        a4setText('a4-hero-badge',    cardData.badge);
        a4setText('a4-hero-readtime', cardData.readTime);
        a4setText('a4-hero-views',    cardData.views + ' reads');
        a4setText('a4-hero-date',     cardData.date);
        a4setText('a4-hero-author-name',  cardData.author.name);
        a4setText('a4-hero-author-name2', cardData.author.name);
        a4setText('a4-hero-excerpt',  cardData.excerpt);
        a4setText('a4-breadcrumb-cat', cardData.badge);

        // Show/hide "New" badge
        var newBadge = document.getElementById('a4-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        var authorImg = document.getElementById('a4-hero-author-img');
        if (authorImg) { authorImg.src = cardData.author.image; authorImg.alt = cardData.author.name; }

        // ── Sidebar author name ────────────────────────────────
        a4setText('a4-sidebar-author', cardData.author.name);

        // ── Bio ────────────────────────────────────────────────
        var bioImg = document.getElementById('a4-bio-img');
        if (bioImg) { bioImg.src = cardData.author.image; bioImg.alt = cardData.author.name; }
        a4setText('a4-bio-name',          cardData.author.name);
        a4setText('a4-conclusion-author', cardData.author.name);
        a4setText('a4-pullquote-author',  cardData.author.name);

        // ── Ribbon ─────────────────────────────────────────────
        a4setText('a4-ribbon-readtime', cardData.readTime);
        a4setText('a4-ribbon-views',    cardData.views + ' reads');
        a4setText('a4-ribbon-date',     cardData.date);

        // ── Related articles ───────────────────────────────────
        a4InjectRelated(data.cards, cardData.category, 'card-4');

      })
      .catch(function (err) {
        console.error('articles.js [a4]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a4InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a4-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a4Shuffle(sameCategory);
      a4Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + (card.imageAlt || card.title) + '" loading="lazy">' +
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


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a4BuildTOC() {
      var tocNav   = document.getElementById('a4-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a4-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a4-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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
          var found = links.find(function (l) { return l.el === entry.target; });
          if (found) found.link.classList.toggle('active', entry.isIntersecting);
        });
      }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

      links.forEach(function (l) { observer.observe(l.el); });
    }


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a4InitProgressBar() {
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


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a4InitSidebarShare() {
      var stickyShare = document.getElementById('a4-sticky-share');
      var hero        = document.getElementById('a4-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a4InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a4-share-btn').forEach(function (btn) {

        // Copy link buttons
        if (btn.id === 'a4-hero-copy' || btn.id === 'a4-bottom-copy' ||
            btn.classList.contains('a4-share-btn--copy')) {
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
          if (btn.classList.contains('a4-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a4-share-btn--pi')) {
            var imgEl = document.getElementById('a4-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a4-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a4-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a4InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article4';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a4-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       8.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article4';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a4setCount('a4-count-helpful',  data.likes);
          a4setCount('a4-count-inspired', data.reviewsCount);
          a4setCount('a4-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a4 reviews] loadStats failed:', e.message);
        }
      }

      function a4setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a4-btn-helpful');
      if (btnHelpful) {
        btnHelpful.addEventListener('click', async function () {
          if (likeGranted) return;
          likeGranted = true;
          btnHelpful.classList.add('active');
          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'like', articleId: ARTICLE_ID })
            });
            var data = await res.json();
            if (data.success) a4setCount('a4-count-helpful', data.likes);
          } catch (e) { console.warn('[a4] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a4setCount('a4-count-more', data.shares);
        } catch (e) { console.warn('[a4] share failed:', e.message); }
      }

      document.querySelectorAll('.a4-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a4-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a4-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
      var avatarBase64 = '';

      function compressAvatar(file) {
        return new Promise(function (resolve) {
          if (!file) { resolve(''); return; }
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () {
            var MAX = 150, w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          };
          img.onerror = function () { URL.revokeObjectURL(url); resolve(''); };
          img.src = url;
        });
      }

      var avatarInput  = document.getElementById('a4-rv-avatar-input');
      var avatarWrap   = document.getElementById('a4-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a4-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a4-rv-avatar-placeholder');

      if (avatarWrap && avatarInput) {
        avatarWrap.addEventListener('click', function () { avatarInput.click(); });
        avatarInput.addEventListener('change', async function () {
          var file = avatarInput.files[0];
          if (!file) return;
          avatarBase64 = await compressAvatar(file);
          if (avatarBase64 && avatarPrev && avatarPlaceh) {
            avatarPrev.src = avatarBase64;
            avatarPrev.style.display = 'block';
            avatarPlaceh.style.display = 'none';
          }
        });
      }

      // Stars
      var stars          = document.querySelectorAll('#a4-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a4-rv-rating');
      var selectedRating = 0;

      function paintStars(upTo) {
        stars.forEach(function (s, i) {
          s.classList.toggle('fi-sr-star', i < upTo);
          s.classList.toggle('fi-rr-star', i >= upTo);
          s.classList.toggle('selected',   i < upTo);
        });
      }

      stars.forEach(function (star) {
        star.addEventListener('mouseover', function () { paintStars(parseInt(star.dataset.val)); });
        star.addEventListener('mouseout',  function () { paintStars(selectedRating); });
        star.addEventListener('click',     function () {
          selectedRating = parseInt(star.dataset.val);
          if (ratingInput) ratingInput.value = selectedRating;
          paintStars(selectedRating);
        });
      });

      // Char counter
      var textarea = document.getElementById('a4-rv-text');
      var charNum  = document.getElementById('a4-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a4-art-review-form');
      var submitBtn  = document.getElementById('a4-rv-submit');
      var errorEl    = document.getElementById('a4-rv-error');
      var successEl  = document.getElementById('a4-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a4-rv-firstname').value.trim();
          var lastName  = document.getElementById('a4-rv-lastname').value.trim();
          var text      = document.getElementById('a4-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)        { showError('Please enter your first and last name.'); return; }
          if (rating === 0)                   { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10)      { showError('Please write at least 10 characters.'); return; }

          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending…';

          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'add-review', articleId: ARTICLE_ID,
                firstName, lastName, avatar: avatarBase64, text, rating
              })
            });
            var data = await res.json();

            if (data.success) {
              if (successEl) successEl.style.display = 'flex';
              a4setCount('a4-count-inspired', data.reviewsCount);

              allReviews.unshift({
                firstName, lastName, avatar: avatarBase64, text, rating,
                date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
              });
              renderReviews(true);

              reviewForm.reset();
              selectedRating = 0; paintStars(0);
              avatarBase64 = '';
              if (avatarPrev)   { avatarPrev.style.display = 'none'; avatarPrev.src = ''; }
              if (avatarPlaceh) avatarPlaceh.style.display = 'flex';
              if (charNum)      charNum.textContent = '0';

              submitBtn.innerHTML = '<i class="fi fi-rr-check-circle"></i> Review submitted!';
              setTimeout(function () {
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

      // Reviews list
      var listWrap    = document.getElementById('a4-art-reviews-list-wrap');
      var listEl      = document.getElementById('a4-art-reviews-list');
      var countLabel  = document.getElementById('a4-rv-count-label');
      var loadMoreBtn = document.getElementById('a4-rv-load-more');

      function renderReviews(reset) {
        if (!listEl) return;
        if (reset) { shownCount = 0; listEl.innerHTML = ''; }
        if (allReviews.length === 0) { if (listWrap) listWrap.style.display = 'none'; return; }
        if (listWrap) listWrap.style.display = 'block';
        if (countLabel) countLabel.textContent = allReviews.length + ' review' + (allReviews.length > 1 ? 's' : '');

        var slice = allReviews.slice(shownCount, shownCount + REVIEWS_PER_PAGE);
        slice.forEach(function (rv) { listEl.appendChild(buildReviewCard(rv)); });
        shownCount += slice.length;
        if (loadMoreBtn) loadMoreBtn.style.display = shownCount < allReviews.length ? 'block' : 'none';
      }

      if (loadMoreBtn) loadMoreBtn.addEventListener('click', function () { renderReviews(false); });

      function buildReviewCard(rv) {
        var card = document.createElement('div');
        card.className = 'art-rv-card';

        var avatarHTML = rv.avatar
          ? '<img class="art-rv-card__avatar" src="' + rv.avatar + '" alt="' + rv.firstName + '" loading="lazy">'
          : '<div class="art-rv-card__avatar-placeholder">' + (rv.firstName || '?').charAt(0).toUpperCase() + '</div>';

        var rating = parseInt(rv.rating) || 5;
        var starsHTML = '';
        for (var i = 1; i <= 5; i++) {
          starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
        }

        card.innerHTML = avatarHTML +
          '<div class="art-rv-card__body">' +
            '<div class="art-rv-card__top">' +
              '<span class="art-rv-card__name">' + a4EscHtml(rv.firstName) + ' ' + a4EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a4EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a4EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      // "I feel seen" btn — scroll to reviews or form
      var btnInspired = document.getElementById('a4-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a4-art-reviews-list-wrap')
            : document.getElementById('a4-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       9.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a4InitNewsletterForms() {
      var nlForm  = document.getElementById('a4-article-nl-form');
      var nlEmail = document.getElementById('a4-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...'; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();

            if (data.success) {
              nlEmail.value = '';
              if (btn) {
                btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!';
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a4ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer newsletter
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a4Bound) {
        footerForm.dataset.a4Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a4ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a4ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       10. HERO PARALLAX
    ════════════════════════════════════════════════════════════ */
    function a4InitHeroParallax() {
      var heroBg = document.querySelector('.a4-hero__bg img');
      if (!heroBg || window.innerWidth < 900) return;

      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        heroBg.style.transform = 'scale(1.06) translateY(' + (scrollY * 0.15) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       11. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a4InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a4-section, .a4-discover, .a4-pullquote, .a4-mid-cta, ' +
        '.a4-author-bio, .a4-trigger-card, .a4-compare-card, ' +
        '.a4-method-step, .a4-toolkit-group, .a4-compassion-item, ' +
        '.a4-week-card, .a4-cycle-visual, .a4-pause-card, ' +
        '.a4-callout, .a4-figure, ' +
        '#a4-article-reactions, #a4-article-share-bottom, #a4-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(26px)';
        el.style.transition = 'opacity 0.62s ease, transform 0.62s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       12. FLOATING CARDS ENTRANCE
    ════════════════════════════════════════════════════════════ */
    function a4AnimateFloatCards() {
      var cards = document.querySelectorAll('.a4-float-insight');
      cards.forEach(function (card, i) {
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(20px) scale(0.92)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        setTimeout(function () {
          card.style.opacity   = '1';
          card.style.transform = 'translateY(0) scale(1)';
        }, 1000 + i * 400);
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a4setText(id, text) {
      var els = document.querySelectorAll('#' + id);
      els.forEach(function (el) { el.textContent = text; });
      // Also try single element by id (for backwards compat)
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a4Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a4EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a4InitProgressBar();
    a4InitSidebarShare();
    a4InitShareButtons();
    a4InitReactions();
    a4InitNewsletterForms();
    a4InitHeroParallax();
    a4AnimateFloatCards();

    // Delayed to allow JSON injection to settle
    setTimeout(function () {
      a4BuildTOC();
      a4InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE







/* ================================================================
   ARTICLE 5 — "Managing PCOS Symptoms with Gentle Lifestyle Changes"
   Add this block inside articles.js
================================================================ */

(function () {

  // Only run on article5
  if (!document.body.classList.contains('a5-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-5
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-5') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a5]: card-5 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article5.html' }
          });
        }

        // ── Hero fields ────────────────────────────────────────
        var heroImg = document.getElementById('a5-hero-img');
        if (heroImg) { heroImg.src = cardData.image; heroImg.alt = cardData.imageAlt || cardData.title; }

        a5setText('a5-hero-badge',       cardData.badge);
        a5setText('a5-hero-readtime',    cardData.readTime);
        a5setText('a5-hero-views',       cardData.views + ' reads');
        a5setText('a5-hero-date',        cardData.date);
        a5setText('a5-hero-author-name', cardData.author.name);
        a5setText('a5-hero-excerpt',     cardData.excerpt);
        a5setText('a5-breadcrumb-cat',   cardData.badge);

        // Show/hide "New" badge
        var newBadge = document.getElementById('a5-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        // Author image
        var authorImg = document.getElementById('a5-hero-author-img');
        if (authorImg) { authorImg.src = cardData.author.image; authorImg.alt = cardData.author.name; }

        // ── Sidebar author name ────────────────────────────────
        a5setText('a5-sidebar-author', cardData.author.name);

        // ── Bio ────────────────────────────────────────────────
        var bioImg = document.getElementById('a5-bio-img');
        if (bioImg) { bioImg.src = cardData.author.image; bioImg.alt = cardData.author.name; }
        a5setText('a5-bio-name',          cardData.author.name);
        a5setText('a5-conclusion-author', cardData.author.name);
        a5setText('a5-pullquote-author',  cardData.author.name);

        // ── Ribbon ─────────────────────────────────────────────
        a5setText('a5-ribbon-readtime', cardData.readTime);
        a5setText('a5-ribbon-views',    cardData.views + ' reads');
        a5setText('a5-ribbon-date',     cardData.date);

        // ── Related articles ───────────────────────────────────
        a5InjectRelated(data.cards, cardData.category, 'card-5');

      })
      .catch(function (err) {
        console.error('articles.js [a5]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a5InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a5-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a5Shuffle(sameCategory);
      a5Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + (card.imageAlt || card.title) + '" loading="lazy">' +
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


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a5BuildTOC() {
      var tocNav   = document.getElementById('a5-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a5-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a5-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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
          var found = links.find(function (l) { return l.el === entry.target; });
          if (found) found.link.classList.toggle('active', entry.isIntersecting);
        });
      }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

      links.forEach(function (l) { observer.observe(l.el); });
    }


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a5InitProgressBar() {
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


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a5InitSidebarShare() {
      var stickyShare = document.getElementById('a5-sticky-share');
      var hero        = document.getElementById('a5-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a5InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a5-share-btn').forEach(function (btn) {

        // Copy link buttons
        if (btn.id === 'a5-hero-copy' || btn.id === 'a5-bottom-copy' ||
            btn.classList.contains('a5-share-btn--copy')) {
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
          if (btn.classList.contains('a5-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a5-share-btn--pi')) {
            var imgEl = document.getElementById('a5-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a5-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a5-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a5InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article5';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a5-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       8.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article5';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a5setCount('a5-count-helpful',  data.likes);
          a5setCount('a5-count-inspired', data.reviewsCount);
          a5setCount('a5-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a5 reviews] loadStats failed:', e.message);
        }
      }

      function a5setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a5-btn-helpful');
      if (btnHelpful) {
        btnHelpful.addEventListener('click', async function () {
          if (likeGranted) return;
          likeGranted = true;
          btnHelpful.classList.add('active');
          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'like', articleId: ARTICLE_ID })
            });
            var data = await res.json();
            if (data.success) a5setCount('a5-count-helpful', data.likes);
          } catch (e) { console.warn('[a5] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a5setCount('a5-count-more', data.shares);
        } catch (e) { console.warn('[a5] share failed:', e.message); }
      }

      document.querySelectorAll('.a5-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a5-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a5-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
      var avatarBase64 = '';

      function compressAvatar(file) {
        return new Promise(function (resolve) {
          if (!file) { resolve(''); return; }
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () {
            var MAX = 150, w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          };
          img.onerror = function () { URL.revokeObjectURL(url); resolve(''); };
          img.src = url;
        });
      }

      var avatarInput  = document.getElementById('a5-rv-avatar-input');
      var avatarWrap   = document.getElementById('a5-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a5-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a5-rv-avatar-placeholder');

      if (avatarWrap && avatarInput) {
        avatarWrap.addEventListener('click', function () { avatarInput.click(); });
        avatarInput.addEventListener('change', async function () {
          var file = avatarInput.files[0];
          if (!file) return;
          avatarBase64 = await compressAvatar(file);
          if (avatarBase64 && avatarPrev && avatarPlaceh) {
            avatarPrev.src = avatarBase64;
            avatarPrev.style.display = 'block';
            avatarPlaceh.style.display = 'none';
          }
        });
      }

      // Stars
      var stars          = document.querySelectorAll('#a5-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a5-rv-rating');
      var selectedRating = 0;

      function paintStars(upTo) {
        stars.forEach(function (s, i) {
          s.classList.toggle('fi-sr-star', i < upTo);
          s.classList.toggle('fi-rr-star', i >= upTo);
          s.classList.toggle('selected',   i < upTo);
        });
      }

      stars.forEach(function (star) {
        star.addEventListener('mouseover', function () { paintStars(parseInt(star.dataset.val)); });
        star.addEventListener('mouseout',  function () { paintStars(selectedRating); });
        star.addEventListener('click',     function () {
          selectedRating = parseInt(star.dataset.val);
          if (ratingInput) ratingInput.value = selectedRating;
          paintStars(selectedRating);
        });
      });

      // Char counter
      var textarea = document.getElementById('a5-rv-text');
      var charNum  = document.getElementById('a5-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a5-art-review-form');
      var submitBtn  = document.getElementById('a5-rv-submit');
      var errorEl    = document.getElementById('a5-rv-error');
      var successEl  = document.getElementById('a5-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a5-rv-firstname').value.trim();
          var lastName  = document.getElementById('a5-rv-lastname').value.trim();
          var text      = document.getElementById('a5-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)   { showError('Please enter your first and last name.'); return; }
          if (rating === 0)              { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10) { showError('Please write at least 10 characters.'); return; }

          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending…';

          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'add-review', articleId: ARTICLE_ID,
                firstName, lastName, avatar: avatarBase64, text, rating
              })
            });
            var data = await res.json();

            if (data.success) {
              if (successEl) successEl.style.display = 'flex';
              a5setCount('a5-count-inspired', data.reviewsCount);

              allReviews.unshift({
                firstName, lastName, avatar: avatarBase64, text, rating,
                date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
              });
              renderReviews(true);

              reviewForm.reset();
              selectedRating = 0; paintStars(0);
              avatarBase64 = '';
              if (avatarPrev)   { avatarPrev.style.display = 'none'; avatarPrev.src = ''; }
              if (avatarPlaceh) avatarPlaceh.style.display = 'flex';
              if (charNum)      charNum.textContent = '0';

              submitBtn.innerHTML = '<i class="fi fi-rr-check-circle"></i> Review submitted!';
              setTimeout(function () {
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

      // Reviews list
      var listWrap    = document.getElementById('a5-art-reviews-list-wrap');
      var listEl      = document.getElementById('a5-art-reviews-list');
      var countLabel  = document.getElementById('a5-rv-count-label');
      var loadMoreBtn = document.getElementById('a5-rv-load-more');

      function renderReviews(reset) {
        if (!listEl) return;
        if (reset) { shownCount = 0; listEl.innerHTML = ''; }
        if (allReviews.length === 0) { if (listWrap) listWrap.style.display = 'none'; return; }
        if (listWrap) listWrap.style.display = 'block';
        if (countLabel) countLabel.textContent = allReviews.length + ' review' + (allReviews.length > 1 ? 's' : '');

        var slice = allReviews.slice(shownCount, shownCount + REVIEWS_PER_PAGE);
        slice.forEach(function (rv) { listEl.appendChild(buildReviewCard(rv)); });
        shownCount += slice.length;
        if (loadMoreBtn) loadMoreBtn.style.display = shownCount < allReviews.length ? 'block' : 'none';
      }

      if (loadMoreBtn) loadMoreBtn.addEventListener('click', function () { renderReviews(false); });

      function buildReviewCard(rv) {
        var card = document.createElement('div');
        card.className = 'art-rv-card';

        var avatarHTML = rv.avatar
          ? '<img class="art-rv-card__avatar" src="' + rv.avatar + '" alt="' + rv.firstName + '" loading="lazy">'
          : '<div class="art-rv-card__avatar-placeholder">' + (rv.firstName || '?').charAt(0).toUpperCase() + '</div>';

        var rating = parseInt(rv.rating) || 5;
        var starsHTML = '';
        for (var i = 1; i <= 5; i++) {
          starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
        }

        card.innerHTML = avatarHTML +
          '<div class="art-rv-card__body">' +
            '<div class="art-rv-card__top">' +
              '<span class="art-rv-card__name">' + a5EscHtml(rv.firstName) + ' ' + a5EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a5EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a5EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      // "I feel seen" btn
      var btnInspired = document.getElementById('a5-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a5-art-reviews-list-wrap')
            : document.getElementById('a5-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       9.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a5InitNewsletterForms() {
      var nlForm  = document.getElementById('a5-article-nl-form');
      var nlEmail = document.getElementById('a5-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...'; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();

            if (data.success) {
              nlEmail.value = '';
              if (btn) {
                btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!';
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a5ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer newsletter
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a5Bound) {
        footerForm.dataset.a5Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a5ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a5ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       10. HERO IMAGE PARALLAX (right panel)
    ════════════════════════════════════════════════════════════ */
    function a5InitHeroParallax() {
      var heroImg = document.querySelector('.a5-hero__img');
      if (!heroImg || window.innerWidth < 960) return;

      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        heroImg.style.transform = 'scale(1.06) translateY(' + (scrollY * 0.12) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       11. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a5InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a5-section, .a5-discover, .a5-pullquote, .a5-mid-cta, ' +
        '.a5-author-bio, .a5-mechanism-card, .a5-foods-card, ' +
        '.a5-exercise-card, .a5-pillar-card, .a5-supp-card, ' +
        '.a5-proto-week, .a5-cascade-visual, .a5-callout, .a5-figure, ' +
        '#a5-article-reactions, #a5-article-share-bottom, #a5-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(26px)';
        el.style.transition = 'opacity 0.62s ease, transform 0.62s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       12. FLOATING CARDS ENTRANCE
    ════════════════════════════════════════════════════════════ */
    function a5AnimateFloatCards() {
      var cards = document.querySelectorAll('.a5-float-card');
      cards.forEach(function (card, i) {
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(20px) scale(0.92)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        setTimeout(function () {
          card.style.opacity   = '1';
          card.style.transform = 'translateY(0) scale(1)';
        }, 1000 + i * 400);
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a5setText(id, text) {
      var els = document.querySelectorAll('#' + id);
      els.forEach(function (el) { el.textContent = text; });
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a5Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a5EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a5InitProgressBar();
    a5InitSidebarShare();
    a5InitShareButtons();
    a5InitReactions();
    a5InitNewsletterForms();
    a5InitHeroParallax();
    a5AnimateFloatCards();

    // Delayed to allow JSON injection to settle
    setTimeout(function () {
      a5BuildTOC();
      a5InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE









/* ================================================================
   ARTICLE 6 — "Understanding and Overcoming Emotional Eating Triggers"
   Add this block inside articles.js
================================================================ */

(function () {

  // Only run on article6
  if (!document.body.classList.contains('a6-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-4
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-4') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a6]: card-4 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article6.html' }
          });
        }

        // ── Hero fields ────────────────────────────────────────
        var heroImg = document.getElementById('a6-hero-img');
        if (heroImg) {
          heroImg.src = cardData.image;
          heroImg.alt = cardData.imageAlt || cardData.title;
        }

        a6setText('a6-hero-badge',       cardData.badge);
        a6setText('a6-hero-readtime',    cardData.readTime);
        a6setText('a6-hero-views',       cardData.views + ' reads');
        a6setText('a6-hero-date',        cardData.date);
        a6setText('a6-hero-author-name', cardData.author.name);
        a6setText('a6-hero-excerpt',     cardData.excerpt);
        a6setText('a6-breadcrumb-cat',   cardData.badge);

        // Show/hide "New" badge
        var newBadge = document.getElementById('a6-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        // Author image
        var authorImg = document.getElementById('a6-hero-author-img');
        if (authorImg) {
          authorImg.src = cardData.author.image;
          authorImg.alt = cardData.author.name;
        }

        // ── Sidebar author ─────────────────────────────────────
        a6setText('a6-sidebar-author', cardData.author.name);

        // ── Bio ────────────────────────────────────────────────
        var bioImg = document.getElementById('a6-bio-img');
        if (bioImg) {
          bioImg.src = cardData.author.image;
          bioImg.alt = cardData.author.name;
        }
        a6setText('a6-bio-name',          cardData.author.name);
        a6setText('a6-conclusion-author', cardData.author.name);
        a6setText('a6-pullquote-author',  cardData.author.name);

        // ── Ribbon ─────────────────────────────────────────────
        a6setText('a6-ribbon-readtime', cardData.readTime);
        a6setText('a6-ribbon-views',    cardData.views + ' reads');
        a6setText('a6-ribbon-date',     cardData.date);

        // ── Related articles ───────────────────────────────────
        a6InjectRelated(data.cards, cardData.category, 'card-4');

      })
      .catch(function (err) {
        console.error('articles.js [a6]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a6InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a6-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a6Shuffle(sameCategory);
      a6Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + (card.imageAlt || card.title) + '" loading="lazy">' +
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


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a6BuildTOC() {
      var tocNav = document.getElementById('a6-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a6-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a6-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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
          var found = links.find(function (l) { return l.el === entry.target; });
          if (found) found.link.classList.toggle('active', entry.isIntersecting);
        });
      }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

      links.forEach(function (l) { observer.observe(l.el); });
    }


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a6InitProgressBar() {
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


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a6InitSidebarShare() {
      var stickyShare = document.getElementById('a6-sticky-share');
      var hero        = document.getElementById('a6-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a6InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a6-share-btn').forEach(function (btn) {

        // Copy link buttons
        if (btn.id === 'a6-hero-copy' || btn.id === 'a6-bottom-copy' ||
            btn.classList.contains('a6-share-btn--copy')) {
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
          if (btn.classList.contains('a6-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a6-share-btn--pi')) {
            var imgEl = document.getElementById('a6-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a6-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a6-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a6InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article6';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a6-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       8.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article6';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a6setCount('a6-count-helpful',  data.likes);
          a6setCount('a6-count-inspired', data.reviewsCount);
          a6setCount('a6-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a6 reviews] loadStats failed:', e.message);
        }
      }

      function a6setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a6-btn-helpful');
      if (btnHelpful) {
        btnHelpful.addEventListener('click', async function () {
          if (likeGranted) return;
          likeGranted = true;
          btnHelpful.classList.add('active');
          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'like', articleId: ARTICLE_ID })
            });
            var data = await res.json();
            if (data.success) a6setCount('a6-count-helpful', data.likes);
          } catch (e) { console.warn('[a6] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a6setCount('a6-count-more', data.shares);
        } catch (e) { console.warn('[a6] share failed:', e.message); }
      }

      document.querySelectorAll('.a6-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a6-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a6-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
      var avatarBase64 = '';

      function compressAvatar(file) {
        return new Promise(function (resolve) {
          if (!file) { resolve(''); return; }
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () {
            var MAX = 150, w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          };
          img.onerror = function () { URL.revokeObjectURL(url); resolve(''); };
          img.src = url;
        });
      }

      var avatarInput  = document.getElementById('a6-rv-avatar-input');
      var avatarWrap   = document.getElementById('a6-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a6-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a6-rv-avatar-placeholder');

      if (avatarWrap && avatarInput) {
        avatarWrap.addEventListener('click', function () { avatarInput.click(); });
        avatarInput.addEventListener('change', async function () {
          var file = avatarInput.files[0];
          if (!file) return;
          avatarBase64 = await compressAvatar(file);
          if (avatarBase64 && avatarPrev && avatarPlaceh) {
            avatarPrev.src = avatarBase64;
            avatarPrev.style.display = 'block';
            avatarPlaceh.style.display = 'none';
          }
        });
      }

      // Stars
      var stars          = document.querySelectorAll('#a6-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a6-rv-rating');
      var selectedRating = 0;

      function paintStars(upTo) {
        stars.forEach(function (s, i) {
          s.classList.toggle('fi-sr-star', i < upTo);
          s.classList.toggle('fi-rr-star', i >= upTo);
          s.classList.toggle('selected',   i < upTo);
        });
      }

      stars.forEach(function (star) {
        star.addEventListener('mouseover', function () { paintStars(parseInt(star.dataset.val)); });
        star.addEventListener('mouseout',  function () { paintStars(selectedRating); });
        star.addEventListener('click',     function () {
          selectedRating = parseInt(star.dataset.val);
          if (ratingInput) ratingInput.value = selectedRating;
          paintStars(selectedRating);
        });
      });

      // Char counter
      var textarea = document.getElementById('a6-rv-text');
      var charNum  = document.getElementById('a6-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a6-art-review-form');
      var submitBtn  = document.getElementById('a6-rv-submit');
      var errorEl    = document.getElementById('a6-rv-error');
      var successEl  = document.getElementById('a6-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a6-rv-firstname').value.trim();
          var lastName  = document.getElementById('a6-rv-lastname').value.trim();
          var text      = document.getElementById('a6-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)   { showError('Please enter your first and last name.'); return; }
          if (rating === 0)              { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10) { showError('Please write at least 10 characters.'); return; }

          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending…';

          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'add-review', articleId: ARTICLE_ID,
                firstName, lastName, avatar: avatarBase64, text, rating
              })
            });
            var data = await res.json();

            if (data.success) {
              if (successEl) successEl.style.display = 'flex';
              a6setCount('a6-count-inspired', data.reviewsCount);

              allReviews.unshift({
                firstName, lastName, avatar: avatarBase64, text, rating,
                date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
              });
              renderReviews(true);

              reviewForm.reset();
              selectedRating = 0; paintStars(0);
              avatarBase64 = '';
              if (avatarPrev)   { avatarPrev.style.display = 'none'; avatarPrev.src = ''; }
              if (avatarPlaceh) avatarPlaceh.style.display = 'flex';
              if (charNum)      charNum.textContent = '0';

              submitBtn.innerHTML = '<i class="fi fi-rr-check-circle"></i> Review submitted!';
              setTimeout(function () {
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

      // Reviews list
      var listWrap    = document.getElementById('a6-art-reviews-list-wrap');
      var listEl      = document.getElementById('a6-art-reviews-list');
      var countLabel  = document.getElementById('a6-rv-count-label');
      var loadMoreBtn = document.getElementById('a6-rv-load-more');

      function renderReviews(reset) {
        if (!listEl) return;
        if (reset) { shownCount = 0; listEl.innerHTML = ''; }
        if (allReviews.length === 0) { if (listWrap) listWrap.style.display = 'none'; return; }
        if (listWrap) listWrap.style.display = 'block';
        if (countLabel) countLabel.textContent = allReviews.length + ' review' + (allReviews.length > 1 ? 's' : '');

        var slice = allReviews.slice(shownCount, shownCount + REVIEWS_PER_PAGE);
        slice.forEach(function (rv) { listEl.appendChild(buildReviewCard(rv)); });
        shownCount += slice.length;
        if (loadMoreBtn) loadMoreBtn.style.display = shownCount < allReviews.length ? 'block' : 'none';
      }

      if (loadMoreBtn) loadMoreBtn.addEventListener('click', function () { renderReviews(false); });

      function buildReviewCard(rv) {
        var card = document.createElement('div');
        card.className = 'art-rv-card';

        var avatarHTML = rv.avatar
          ? '<img class="art-rv-card__avatar" src="' + rv.avatar + '" alt="' + rv.firstName + '" loading="lazy">'
          : '<div class="art-rv-card__avatar-placeholder">' + (rv.firstName || '?').charAt(0).toUpperCase() + '</div>';

        var rating = parseInt(rv.rating) || 5;
        var starsHTML = '';
        for (var i = 1; i <= 5; i++) {
          starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
        }

        card.innerHTML = avatarHTML +
          '<div class="art-rv-card__body">' +
            '<div class="art-rv-card__top">' +
              '<span class="art-rv-card__name">' + a6EscHtml(rv.firstName) + ' ' + a6EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a6EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a6EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      // "I feel seen" btn → scroll to reviews
      var btnInspired = document.getElementById('a6-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a6-art-reviews-list-wrap')
            : document.getElementById('a6-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       9.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a6InitNewsletterForms() {
      var nlForm  = document.getElementById('a6-article-nl-form');
      var nlEmail = document.getElementById('a6-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...'; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();

            if (data.success) {
              nlEmail.value = '';
              if (btn) {
                btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!';
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a6ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer newsletter
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a6Bound) {
        footerForm.dataset.a6Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a6ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a6ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       10. HERO PARALLAX — subtle on scroll
    ════════════════════════════════════════════════════════════ */
    function a6InitHeroParallax() {
      var heroImg = document.querySelector('.a6-hero__img');
      if (!heroImg || window.innerWidth < 960) return;

      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        heroImg.style.transform = 'scale(1.04) translateY(' + (scrollY * 0.10) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       11. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a6InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a6-section, .a6-discover, .a6-pullquote, .a6-mid-cta, ' +
        '.a6-author-bio, .a6-two-col__card, .a6-hunger-card, ' +
        '.a6-mindful-card, .a6-trigger-card, .a6-reset-week, ' +
        '.a6-loop-visual, .a6-callout, .a6-check-steps, ' +
        '#a6-article-reactions, #a6-article-share-bottom, #a6-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(28px)';
        el.style.transition = 'opacity 0.62s ease, transform 0.62s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       12. FLOAT CARDS ENTRANCE
    ════════════════════════════════════════════════════════════ */
    function a6AnimateEmotionCards() {
      var cards = document.querySelectorAll('.a6-emotion-card');
      cards.forEach(function (card, i) {
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(20px) scale(0.90)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        setTimeout(function () {
          card.style.opacity   = '1';
          card.style.transform = 'translateY(0) scale(1)';
        }, 900 + i * 380);
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a6setText(id, text) {
      var els = document.querySelectorAll('#' + id);
      els.forEach(function (el) { el.textContent = text; });
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a6Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a6EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a6InitProgressBar();
    a6InitSidebarShare();
    a6InitShareButtons();
    a6InitReactions();
    a6InitNewsletterForms();
    a6InitHeroParallax();
    a6AnimateEmotionCards();

    // Delayed to allow JSON injection to settle
    setTimeout(function () {
      a6BuildTOC();
      a6InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE








/* ================================================================
   ARTICLE 7 — "Effective Home Workouts Tailored for Curvy Figures"
   ADD THIS BLOCK TO: /blog/articles.js
================================================================ */

(function () {

  // Only run on article7
  if (!document.body.classList.contains('a7-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1. LOAD DATA FROM blog-articles.json — card-7
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-7') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a7]: card-7 not found in blog-articles.json');
          return;
        }

        /* ── Meta tags ─────────────────────────────────────── */
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        /* ── JSON-LD ───────────────────────────────────────── */
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article7.html' }
          });
        }

        /* ── Hero fields ───────────────────────────────────── */
        var heroImg = document.getElementById('a7-hero-img');
        if (heroImg) { heroImg.src = cardData.image; heroImg.alt = cardData.imageAlt || cardData.title; }

        a7setText('a7-hero-badge',       cardData.badge);
        a7setText('a7-hero-readtime',    cardData.readTime);
        a7setText('a7-hero-views',       cardData.views + ' reads');
        a7setText('a7-hero-date',        cardData.date);
        a7setText('a7-hero-author-name', cardData.author.name);
        a7setText('a7-hero-excerpt',     cardData.excerpt);
        a7setText('a7-breadcrumb-cat',   cardData.badge);

        // Show/hide "New" badge
        var newBadge = document.getElementById('a7-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        var authorImg = document.getElementById('a7-hero-author-img');
        if (authorImg) { authorImg.src = cardData.author.image; authorImg.alt = cardData.author.name; }

        /* ── Sidebar author ────────────────────────────────── */
        a7setText('a7-sidebar-author', cardData.author.name);

        /* ── Quote attribution ─────────────────────────────── */
        a7setText('a7-quote-author-1', '— ' + cardData.author.name + ', Fitness Coach');

        /* ── Conclusion ────────────────────────────────────── */
        var conclusionImg = document.getElementById('a7-conclusion-author-img');
        if (conclusionImg) { conclusionImg.src = cardData.author.image; conclusionImg.alt = cardData.author.name; }
        a7setText('a7-conclusion-author-name', cardData.author.name);

        /* ── Author bio ────────────────────────────────────── */
        var bioImg = document.getElementById('a7-bio-img');
        if (bioImg) { bioImg.src = cardData.author.image; bioImg.alt = cardData.author.name; }
        a7setText('a7-bio-name', cardData.author.name);

        /* ── Related articles ──────────────────────────────── */
        a7InjectRelated(data.cards, cardData.category, 'card-7');
      })
      .catch(function (err) {
        console.error('articles.js [a7]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2. RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a7InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a7-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a7Shuffle(sameCategory);
      a7Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + (card.imageAlt || card.title) + '" loading="lazy">' +
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


    /* ════════════════════════════════════════════════════════════
       3. TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a7BuildTOC() {
      var tocNav   = document.getElementById('a7-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a7-body h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a7-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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
          var found = links.find(function (l) { return l.el === entry.target; });
          if (found) found.link.classList.toggle('active', entry.isIntersecting);
        });
      }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

      links.forEach(function (l) { observer.observe(l.el); });
    }


    /* ════════════════════════════════════════════════════════════
       4. READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a7InitProgressBar() {
      var bar = document.getElementById('reading-progress-bar');
      if (!bar) return;
      function updateProgress() {
        var scrollTop  = window.scrollY || document.documentElement.scrollTop;
        var docHeight  = document.documentElement.scrollHeight - window.innerHeight;
        var progress   = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
        bar.style.width = progress.toFixed(1) + '%';
        bar.style.background = 'linear-gradient(90deg, #1e5c36, #c9903a)';
      }
      window.addEventListener('scroll', updateProgress, { passive: true });
      updateProgress();
    }


    /* ════════════════════════════════════════════════════════════
       5. STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a7InitSidebarShare() {
      var stickyShare = document.getElementById('a7-sticky-share');
      var hero        = document.getElementById('a7-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6. SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a7InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a7-share-btn').forEach(function (btn) {

        // Copy link
        if (btn.id === 'a7-hero-copy' || btn.id === 'a7-bottom-copy' ||
            (btn.classList.contains('a7-share-btn--copy') && btn.tagName === 'BUTTON')) {

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
          if (btn.classList.contains('a7-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a7-share-btn--pi')) {
            var imgEl = document.getElementById('a7-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a7-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a7-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7. HERO IMAGE PARALLAX
    ════════════════════════════════════════════════════════════ */
    function a7InitParallax() {
      var heroImg = document.querySelector('.a7-hero__img');
      if (!heroImg || window.innerWidth < 900) return;

      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        heroImg.style.transform = 'scale(1.06) translateY(' + (scrollY * 0.12) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       8. TICKER PAUSE ON HOVER (already CSS, JS for accessibility)
    ════════════════════════════════════════════════════════════ */
    function a7InitTicker() {
      var ticker = document.querySelector('.a7-ticker');
      if (!ticker) return;
      ticker.setAttribute('role', 'marquee');
      ticker.setAttribute('aria-label', 'Article topics');
    }


    /* ════════════════════════════════════════════════════════════
       9. FLOAT CARD ENTRANCE ANIMATION
    ════════════════════════════════════════════════════════════ */
    function a7AnimateFloatCards() {
      var cards = document.querySelectorAll('.a7-float-card');
      cards.forEach(function (card, i) {
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(18px) scale(0.92)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        setTimeout(function () {
          card.style.opacity   = '1';
          card.style.transform = 'translateY(0) scale(1)';
        }, 900 + i * 350);
      });
    }


    /* ════════════════════════════════════════════════════════════
       10. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a7InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a7-section, .a7-lede-block, .a7-editorial-quote, ' +
        '.a7-principle, .a7-workout-card, .a7-timeline-body, ' +
        '.a7-obstacle, .a7-mid-cta, .a7-nutrition-card, ' +
        '.a7-conclusion, .a7-author-bio, ' +
        '#a7-article-reactions, #a7-article-share-bottom, #a7-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.05 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(24px)';
        el.style.transition = 'opacity 0.60s ease, transform 0.60s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       11. REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a7InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article7';

      function getReacted()       { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type)  { try { localStorage.setItem(STORAGE_KEY, type); }         catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a7-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       12. REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article7';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a7setCount('a7-count-helpful',  data.likes);
          a7setCount('a7-count-inspired', data.reviewsCount);
          a7setCount('a7-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a7 reviews] loadStats failed:', e.message);
        }
      }

      function a7setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a7-btn-helpful');
      if (btnHelpful) {
        btnHelpful.addEventListener('click', async function () {
          if (likeGranted) return;
          likeGranted = true;
          btnHelpful.classList.add('active');
          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'like', articleId: ARTICLE_ID })
            });
            var data = await res.json();
            if (data.success) a7setCount('a7-count-helpful', data.likes);
          } catch (e) { console.warn('[a7] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a7setCount('a7-count-more', data.shares);
        } catch (e) { console.warn('[a7] share failed:', e.message); }
      }

      document.querySelectorAll('.a7-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a7-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a7-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
      var avatarBase64 = '';

      function compressAvatar(file) {
        return new Promise(function (resolve) {
          if (!file) { resolve(''); return; }
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () {
            var MAX = 150, w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          };
          img.onerror = function () { URL.revokeObjectURL(url); resolve(''); };
          img.src = url;
        });
      }

      var avatarInput  = document.getElementById('a7-rv-avatar-input');
      var avatarWrap   = document.getElementById('a7-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a7-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a7-rv-avatar-placeholder');

      if (avatarWrap && avatarInput) {
        avatarWrap.addEventListener('click', function () { avatarInput.click(); });
        avatarInput.addEventListener('change', async function () {
          var file = avatarInput.files[0];
          if (!file) return;
          avatarBase64 = await compressAvatar(file);
          if (avatarBase64 && avatarPrev && avatarPlaceh) {
            avatarPrev.src = avatarBase64;
            avatarPrev.style.display = 'block';
            avatarPlaceh.style.display = 'none';
          }
        });
      }

      // Stars
      var stars          = document.querySelectorAll('#a7-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a7-rv-rating');
      var selectedRating = 0;

      function paintStars(upTo) {
        stars.forEach(function (s, i) {
          s.classList.toggle('fi-sr-star', i < upTo);
          s.classList.toggle('fi-rr-star', i >= upTo);
          s.classList.toggle('selected',   i < upTo);
        });
      }

      stars.forEach(function (star) {
        star.addEventListener('mouseover', function () { paintStars(parseInt(star.dataset.val)); });
        star.addEventListener('mouseout',  function () { paintStars(selectedRating); });
        star.addEventListener('click',     function () {
          selectedRating = parseInt(star.dataset.val);
          if (ratingInput) ratingInput.value = selectedRating;
          paintStars(selectedRating);
        });
      });

      // Char counter
      var textarea = document.getElementById('a7-rv-text');
      var charNum  = document.getElementById('a7-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a7-art-review-form');
      var submitBtn  = document.getElementById('a7-rv-submit');
      var errorEl    = document.getElementById('a7-rv-error');
      var successEl  = document.getElementById('a7-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a7-rv-firstname').value.trim();
          var lastName  = document.getElementById('a7-rv-lastname').value.trim();
          var text      = document.getElementById('a7-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)    { showError('Please enter your first and last name.'); return; }
          if (rating === 0)               { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10)  { showError('Please write at least 10 characters.'); return; }

          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending…';

          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'add-review', articleId: ARTICLE_ID,
                firstName, lastName, avatar: avatarBase64, text, rating
              })
            });
            var data = await res.json();

            if (data.success) {
              if (successEl) successEl.style.display = 'flex';
              a7setCount('a7-count-inspired', data.reviewsCount);

              allReviews.unshift({
                firstName, lastName, avatar: avatarBase64, text, rating,
                date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
              });
              renderReviews(true);

              reviewForm.reset();
              selectedRating = 0; paintStars(0);
              avatarBase64 = '';
              if (avatarPrev)   { avatarPrev.style.display = 'none'; avatarPrev.src = ''; }
              if (avatarPlaceh) avatarPlaceh.style.display = 'flex';
              if (charNum)      charNum.textContent = '0';

              submitBtn.innerHTML = '<i class="fi fi-rr-check-circle"></i> Review submitted!';
              setTimeout(function () {
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

      // Reviews list
      var listWrap    = document.getElementById('a7-art-reviews-list-wrap');
      var listEl      = document.getElementById('a7-art-reviews-list');
      var countLabel  = document.getElementById('a7-rv-count-label');
      var loadMoreBtn = document.getElementById('a7-rv-load-more');

      function renderReviews(reset) {
        if (!listEl) return;
        if (reset) { shownCount = 0; listEl.innerHTML = ''; }
        if (allReviews.length === 0) { if (listWrap) listWrap.style.display = 'none'; return; }
        if (listWrap) listWrap.style.display = 'block';
        if (countLabel) countLabel.textContent = allReviews.length + ' review' + (allReviews.length > 1 ? 's' : '');

        var slice = allReviews.slice(shownCount, shownCount + REVIEWS_PER_PAGE);
        slice.forEach(function (rv) { listEl.appendChild(buildReviewCard(rv)); });
        shownCount += slice.length;
        if (loadMoreBtn) loadMoreBtn.style.display = shownCount < allReviews.length ? 'block' : 'none';
      }

      if (loadMoreBtn) loadMoreBtn.addEventListener('click', function () { renderReviews(false); });

      function buildReviewCard(rv) {
        var card = document.createElement('div');
        card.className = 'art-rv-card';

        var avatarHTML = rv.avatar
          ? '<img class="art-rv-card__avatar" src="' + rv.avatar + '" alt="' + rv.firstName + '" loading="lazy">'
          : '<div class="art-rv-card__avatar-placeholder">' + (rv.firstName || '?').charAt(0).toUpperCase() + '</div>';

        var rating = parseInt(rv.rating) || 5;
        var starsHTML = '';
        for (var i = 1; i <= 5; i++) {
          starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
        }

        card.innerHTML = avatarHTML +
          '<div class="art-rv-card__body">' +
            '<div class="art-rv-card__top">' +
              '<span class="art-rv-card__name">' + a7EscHtml(rv.firstName) + ' ' + a7EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a7EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a7EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      // "I'm starting today" btn
      var btnInspired = document.getElementById('a7-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a7-art-reviews-list-wrap')
            : document.getElementById('a7-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       13. NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a7InitNewsletterForms() {
      var nlForm  = document.getElementById('a7-article-nl-form');
      var nlEmail = document.getElementById('a7-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...'; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();

            if (data.success) {
              nlEmail.value = '';
              if (btn) {
                btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!';
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a7ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer newsletter
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a7Bound) {
        footerForm.dataset.a7Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a7ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a7ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       UTILITIES
    ════════════════════════════════════════════════════════════ */
    function a7setText(id, text) {
      var els = document.querySelectorAll('#' + id);
      els.forEach(function (el) { el.textContent = text; });
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a7Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a7EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a7InitProgressBar();
    a7InitSidebarShare();
    a7InitShareButtons();
    a7InitReactions();
    a7InitNewsletterForms();
    a7InitParallax();
    a7InitTicker();
    a7AnimateFloatCards();

    // Delayed to allow JSON injection
    setTimeout(function () {
      a7BuildTOC();
      a7InitScrollReveal();
    }, 220);

  }); // end DOMContentLoaded

})(); // end IIFE








/* ================================================================
   ARTICLE 8 — "Real Journeys: How One Curvy Woman Found Balance"
   ADD THIS BLOCK TO: /blog/articles.js
================================================================ */

(function () {

  // Only run on article8
  if (!document.body.classList.contains('a8-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1. LOAD DATA FROM blog-articles.json — card-8
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-8') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a8]: card-8 not found in blog-articles.json');
          return;
        }

        /* ── Meta tags ─────────────────────────────────────── */
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImg = document.getElementById('meta-og-image');
        if (metaOgImg) metaOgImg.setAttribute('content', cardData.image);

        /* ── JSON-LD ───────────────────────────────────────── */
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article8.html' }
          });
        }

        /* ── Hero fields ───────────────────────────────────── */
        var bgImg = document.getElementById('a8-hero-bg-img');
        if (bgImg) { bgImg.src = cardData.image; bgImg.alt = cardData.imageAlt || cardData.title; }

        a8setText('a8-hero-badge',       cardData.badge);
        a8setText('a8-hero-date',        cardData.date);
        a8setText('a8-hero-readtime',    cardData.readTime);
        a8setText('a8-hero-views',       cardData.views + ' reads');
        a8setText('a8-hero-author-name', cardData.author.name);
        a8setText('a8-hero-excerpt',     cardData.excerpt);
        a8setText('a8-breadcrumb-cat',   cardData.badge);

        // Title — inject dynamically (split for display)
        var heroTitle = document.getElementById('a8-hero-title');
        if (heroTitle) {
          // Build title: use card title for SEO, keep design split
          heroTitle.innerHTML = cardData.title.replace('Real Journeys:', 'Real Journeys:').replace('How One Curvy Woman Found Balance', '<em>How One Curvy<br>Woman Found Balance</em>');
          // Fallback if title doesn't match expected pattern
          if (!heroTitle.querySelector('em')) {
            heroTitle.textContent = cardData.title;
          }
        }

        // Show/hide "New" badge
        var newBadge = document.getElementById('a8-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        var authorImg = document.getElementById('a8-hero-author-img');
        if (authorImg) { authorImg.src = cardData.author.image; authorImg.alt = cardData.author.name; }

        /* ── Quote attributions ────────────────────────────── */
        a8setText('a8-quote-cite-1', cardData.author.name);
        a8setText('a8-full-quote-author', '— ' + cardData.author.name + ', Real Stories');

        /* ── Conclusion ────────────────────────────────────── */
        a8setText('a8-conclusion-author', cardData.author.name);
        var conclusionImg = document.getElementById('a8-conclusion-author-img');
        if (conclusionImg) { conclusionImg.src = cardData.author.image; conclusionImg.alt = cardData.author.name; }
        a8setText('a8-conclusion-author-name', cardData.author.name);

        /* ── Author bio ────────────────────────────────────── */
        var bioImg = document.getElementById('a8-bio-img');
        if (bioImg) { bioImg.src = cardData.author.image; bioImg.alt = cardData.author.name; }
        a8setText('a8-bio-name', cardData.author.name);

        /* ── Related articles ──────────────────────────────── */
        a8InjectRelated(data.cards, cardData.category, 'card-8');
      })
      .catch(function (err) {
        console.error('articles.js [a8]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2. RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a8InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a8-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a8Shuffle(sameCategory);
      a8Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + a8EscAttr(card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + a8EscHtml(card.badge) + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + a8EscHtml(card.title) + '</h3>' +
            '<p class="related-card__excerpt">' + a8EscHtml(card.excerpt) + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + a8EscHtml(card.readTime) + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + a8EscHtml(card.views) + '</span>' +
              '<span class="related-card__cta">Read Story →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3. READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a8InitProgressBar() {
      var bar = document.getElementById('reading-progress-bar');
      if (!bar) return;
      bar.style.background = 'linear-gradient(90deg, #b5533c, #6b2d5a)';

      function update() {
        var scrollTop = window.scrollY || document.documentElement.scrollTop;
        var docH      = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (docH > 0 ? Math.min((scrollTop / docH) * 100, 100) : 0).toFixed(1) + '%';
      }

      window.addEventListener('scroll', update, { passive: true });
      update();
    }


    /* ════════════════════════════════════════════════════════════
       4. LEFT RAIL SHARE PROGRESS & VISIBILITY
    ════════════════════════════════════════════════════════════ */
    function a8InitShareRail() {
      var rail     = document.getElementById('a8-share-rail');
      var hero     = document.getElementById('a8-hero');
      var railBar  = document.getElementById('a8-rail-progress');

      if (!rail || !hero) return;

      // Show/hide rail after hero
      var heroObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          rail.style.opacity   = e.isIntersecting ? '0' : '1';
          rail.style.transform = e.isIntersecting ? 'translateX(-8px)' : 'translateX(0)';
          rail.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        });
      }, { threshold: 0 });

      heroObs.observe(hero);

      // Progress bar
      if (railBar) {
        window.addEventListener('scroll', function () {
          var scrollTop = window.scrollY;
          var docH      = document.documentElement.scrollHeight - window.innerHeight;
          var pct       = docH > 0 ? Math.min((scrollTop / docH) * 100, 100) : 0;
          railBar.style.height = pct.toFixed(1) + '%';
        }, { passive: true });
      }
    }


    /* ════════════════════════════════════════════════════════════
       5. SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a8InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a8-share-btn').forEach(function (btn) {

        // Copy
        if (btn.classList.contains('a8-share-btn--copy')) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            navigator.clipboard.writeText(window.location.href).then(function () {
              var icon = btn.querySelector('i');
              var orig = icon ? icon.className : '';
              if (icon) icon.className = 'fi fi-rr-check';
              setTimeout(function () {
                if (icon) icon.className = orig;
              }, 2000);
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
          if (btn.classList.contains('a8-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a8-share-btn--pi')) {
            var imgEl = document.getElementById('a8-hero-bg-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a8-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a8-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       6. ANIMATE RESULTS BARS (intersection)
    ════════════════════════════════════════════════════════════ */
    function a8AnimateResultBars() {
      var items = document.querySelectorAll('.a8-result-item__bar');
      if (!items.length) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var bar = entry.target;
            var w   = getComputedStyle(bar).getPropertyValue('--a8-bar-w') || '50%';
            bar.style.width = w;
            observer.unobserve(bar);
          }
        });
      }, { threshold: 0.2 });

      items.forEach(function (bar) {
        bar.style.width = '0%';
        observer.observe(bar);
      });
    }


    /* ════════════════════════════════════════════════════════════
       7. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a8InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a8-chapter, .a8-pull-quote, .a8-scene-card, ' +
        '.a8-pillar, .a8-results-strip, .a8-full-quote, ' +
        '.a8-lesson, .a8-now-card, .a8-mid-cta, ' +
        '.a8-science-card, .a8-conclusion, .a8-author-bio, ' +
        '#a8-article-reactions, #a8-article-share-bottom, #a8-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.04 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(22px)';
        el.style.transition = 'opacity 0.65s ease, transform 0.65s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       8. STAGGERED CHIP ENTRANCE
    ════════════════════════════════════════════════════════════ */
    function a8AnimateChips() {
      document.querySelectorAll('.a8-chip').forEach(function (chip, i) {
        chip.style.opacity    = '0';
        chip.style.transform  = 'translateY(20px) scale(0.90)';
        chip.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        setTimeout(function () {
          chip.style.opacity   = '1';
          chip.style.transform = 'translateY(0) scale(1)';
        }, 1100 + i * 350);
      });
    }


    /* ════════════════════════════════════════════════════════════
       9. REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a8InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article8';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }         catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a8-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       10. REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article8';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a8setCount('a8-count-helpful',  data.likes);
          a8setCount('a8-count-inspired', data.reviewsCount);
          a8setCount('a8-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a8 reviews] loadStats failed:', e.message);
        }
      }

      function a8setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a8-btn-helpful');
      if (btnHelpful) {
        btnHelpful.addEventListener('click', async function () {
          if (likeGranted) return;
          likeGranted = true;
          btnHelpful.classList.add('active');
          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'like', articleId: ARTICLE_ID })
            });
            var data = await res.json();
            if (data.success) a8setCount('a8-count-helpful', data.likes);
          } catch (e) { console.warn('[a8] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a8setCount('a8-count-more', data.shares);
        } catch (e) { console.warn('[a8] share failed:', e.message); }
      }

      document.querySelectorAll('.a8-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a8-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var target = document.getElementById('a8-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
      var avatarBase64 = '';

      function compressAvatar(file) {
        return new Promise(function (resolve) {
          if (!file) { resolve(''); return; }
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () {
            var MAX = 150, w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          };
          img.onerror = function () { URL.revokeObjectURL(url); resolve(''); };
          img.src = url;
        });
      }

      var avatarInput  = document.getElementById('a8-rv-avatar-input');
      var avatarWrap   = document.getElementById('a8-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a8-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a8-rv-avatar-placeholder');

      if (avatarWrap && avatarInput) {
        avatarWrap.addEventListener('click', function () { avatarInput.click(); });
        avatarInput.addEventListener('change', async function () {
          var file = avatarInput.files[0];
          if (!file) return;
          avatarBase64 = await compressAvatar(file);
          if (avatarBase64 && avatarPrev && avatarPlaceh) {
            avatarPrev.src = avatarBase64;
            avatarPrev.style.display = 'block';
            avatarPlaceh.style.display = 'none';
          }
        });
      }

      // Stars
      var stars          = document.querySelectorAll('#a8-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a8-rv-rating');
      var selectedRating = 0;

      function paintStars(upTo) {
        stars.forEach(function (s, i) {
          s.classList.toggle('fi-sr-star', i < upTo);
          s.classList.toggle('fi-rr-star', i >= upTo);
          s.classList.toggle('selected',   i < upTo);
        });
      }

      stars.forEach(function (star) {
        star.addEventListener('mouseover', function () { paintStars(parseInt(star.dataset.val)); });
        star.addEventListener('mouseout',  function () { paintStars(selectedRating); });
        star.addEventListener('click',     function () {
          selectedRating = parseInt(star.dataset.val);
          if (ratingInput) ratingInput.value = selectedRating;
          paintStars(selectedRating);
        });
      });

      // Char counter
      var textarea = document.getElementById('a8-rv-text');
      var charNum  = document.getElementById('a8-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a8-art-review-form');
      var submitBtn  = document.getElementById('a8-rv-submit');
      var errorEl    = document.getElementById('a8-rv-error');
      var successEl  = document.getElementById('a8-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a8-rv-firstname').value.trim();
          var lastName  = document.getElementById('a8-rv-lastname').value.trim();
          var text      = document.getElementById('a8-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)    { showError('Please enter your first and last name.'); return; }
          if (rating === 0)               { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10)  { showError('Please write at least 10 characters.'); return; }

          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending…';

          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'add-review', articleId: ARTICLE_ID,
                firstName, lastName, avatar: avatarBase64, text, rating
              })
            });
            var data = await res.json();

            if (data.success) {
              if (successEl) successEl.style.display = 'flex';
              a8setCount('a8-count-inspired', data.reviewsCount);

              allReviews.unshift({
                firstName, lastName, avatar: avatarBase64, text, rating,
                date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
              });
              renderReviews(true);

              reviewForm.reset();
              selectedRating = 0; paintStars(0);
              avatarBase64 = '';
              if (avatarPrev)   { avatarPrev.style.display = 'none'; avatarPrev.src = ''; }
              if (avatarPlaceh) avatarPlaceh.style.display = 'flex';
              if (charNum)      charNum.textContent = '0';

              submitBtn.innerHTML = '<i class="fi fi-rr-check-circle"></i> Story shared!';
              setTimeout(function () {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Share My Story';
                if (successEl) successEl.style.display = 'none';
              }, 4000);
            } else {
              showError('Error: ' + (data.error || 'Unknown error'));
              submitBtn.disabled = false;
              submitBtn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Share My Story';
            }
          } catch (err) {
            showError('Network error. Please try again.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Share My Story';
          }
        });
      }

      function showError(msg) {
        if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
      }

      // Reviews list
      var listWrap    = document.getElementById('a8-art-reviews-list-wrap');
      var listEl      = document.getElementById('a8-art-reviews-list');
      var countLabel  = document.getElementById('a8-rv-count-label');
      var loadMoreBtn = document.getElementById('a8-rv-load-more');

      function renderReviews(reset) {
        if (!listEl) return;
        if (reset) { shownCount = 0; listEl.innerHTML = ''; }
        if (allReviews.length === 0) { if (listWrap) listWrap.style.display = 'none'; return; }
        if (listWrap) listWrap.style.display = 'block';
        if (countLabel) countLabel.textContent = allReviews.length + ' response' + (allReviews.length > 1 ? 's' : '');

        var slice = allReviews.slice(shownCount, shownCount + REVIEWS_PER_PAGE);
        slice.forEach(function (rv) { listEl.appendChild(buildReviewCard(rv)); });
        shownCount += slice.length;
        if (loadMoreBtn) loadMoreBtn.style.display = shownCount < allReviews.length ? 'block' : 'none';
      }

      if (loadMoreBtn) loadMoreBtn.addEventListener('click', function () { renderReviews(false); });

      function buildReviewCard(rv) {
        var card = document.createElement('div');
        card.className = 'art-rv-card';

        var avatarHTML = rv.avatar
          ? '<img class="art-rv-card__avatar" src="' + rv.avatar + '" alt="' + a8EscAttr(rv.firstName) + '" loading="lazy">'
          : '<div class="art-rv-card__avatar-placeholder">' + (rv.firstName || '?').charAt(0).toUpperCase() + '</div>';

        var rating = parseInt(rv.rating) || 5;
        var starsHTML = '';
        for (var i = 1; i <= 5; i++) {
          starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
        }

        card.innerHTML = avatarHTML +
          '<div class="art-rv-card__body">' +
            '<div class="art-rv-card__top">' +
              '<span class="art-rv-card__name">' + a8EscHtml(rv.firstName) + ' ' + a8EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a8EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a8EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      // "I needed this today" btn — scroll to form
      var btnInspired = document.getElementById('a8-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = document.getElementById('a8-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       11. NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a8InitNewsletterForms() {
      var nlForm  = document.getElementById('a8-article-nl-form');
      var nlEmail = document.getElementById('a8-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...'; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();

            if (data.success) {
              nlEmail.value = '';
              if (btn) {
                btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!';
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a8ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer newsletter
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a8Bound) {
        footerForm.dataset.a8Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn  = footerForm.querySelector('button');
          var orig = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a8ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = orig; btn.disabled = false; }
          }
        });
      }
    }

    function a8ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       UTILITIES
    ════════════════════════════════════════════════════════════ */
    function a8setText(id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a8Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }

    function a8EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function a8EscAttr(str) {
      return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT ALL
    ════════════════════════════════════════════════════════════ */
    a8InitProgressBar();
    a8InitShareRail();
    a8InitShareButtons();
    a8InitReactions();
    a8InitNewsletterForms();
    a8AnimateChips();
    a8AnimateResultBars();

    setTimeout(function () {
      a8InitScrollReveal();
    }, 180);

  }); // end DOMContentLoaded

})(); // end IIFE








/* ================================================================
   ARTICLE 9 — "Creating Routines That Last: Habits for Lifelong Wellness"
   Add this block to articles.js
================================================================ */

(function () {

  // Only run on article9
  if (!document.body.classList.contains('a9-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-9
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-9') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a9]: card-9 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article9.html' }
          });
        }

        // ── Hero ───────────────────────────────────────────────
        var heroImg = document.getElementById('a9-hero-img');
        if (heroImg) { heroImg.src = cardData.image; heroImg.alt = cardData.imageAlt || cardData.title; }

        a9setText('a9-hero-badge',       cardData.badge);
        a9setText('a9-hero-readtime',    cardData.readTime);
        a9setText('a9-hero-views',       cardData.views + ' reads');
        a9setText('a9-hero-date',        cardData.date);
        a9setText('a9-hero-excerpt',     cardData.excerpt);
        a9setText('a9-breadcrumb-cat',   cardData.badge);

        // Show/hide "New" badge
        var newBadge = document.getElementById('a9-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        // Author
        var authorImg = document.getElementById('a9-hero-author-img');
        if (authorImg) { authorImg.src = cardData.author.image; authorImg.alt = cardData.author.name; }
        a9setText('a9-hero-author-name', cardData.author.name);

        // ── Sidebar ────────────────────────────────────────────
        a9setText('a9-sidebar-author', cardData.author.name);

        // ── Bio ────────────────────────────────────────────────
        var bioImg = document.getElementById('a9-bio-img');
        if (bioImg) { bioImg.src = cardData.author.image; bioImg.alt = cardData.author.name; }
        a9setText('a9-bio-name',          cardData.author.name);
        a9setText('a9-conclusion-author', cardData.author.name);
        a9setText('a9-pullquote-author',  cardData.author.name);

        // ── Bar ────────────────────────────────────────────────
        a9setText('a9-bar-readtime', cardData.readTime);
        a9setText('a9-bar-views',    cardData.views + ' reads');
        a9setText('a9-bar-date',     cardData.date);

        // ── Related articles ───────────────────────────────────
        a9InjectRelated(data.cards, cardData.category, 'card-9');

      })
      .catch(function (err) {
        console.error('articles.js [a9]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a9InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a9-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a9Shuffle(sameCategory);
      a9Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + (card.imageAlt || card.title) + '" loading="lazy">' +
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


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a9BuildTOC() {
      var tocNav   = document.getElementById('a9-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a9-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a9-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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
          var found = links.find(function (l) { return l.el === entry.target; });
          if (found) found.link.classList.toggle('active', entry.isIntersecting);
        });
      }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

      links.forEach(function (l) { observer.observe(l.el); });
    }


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a9InitProgressBar() {
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


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a9InitSidebarShare() {
      var stickyShare = document.getElementById('a9-sticky-share');
      var hero        = document.getElementById('a9-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a9InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a9-share-btn').forEach(function (btn) {

        // Copy link buttons
        if (btn.id === 'a9-hero-copy' || btn.id === 'a9-bottom-copy' ||
            btn.classList.contains('a9-share-btn--copy')) {
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
          if (btn.classList.contains('a9-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a9-share-btn--pi')) {
            var imgEl = document.getElementById('a9-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a9-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a9-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  INTERACTIVE HABIT TRACKER (Sidebar)
    ════════════════════════════════════════════════════════════ */
    function a9InitHabitTracker() {
      var checkboxes = document.querySelectorAll('.a9-tracker-item input[type="checkbox"]');
      var fill       = document.getElementById('a9-tracker-fill');
      var label      = document.getElementById('a9-tracker-label');
      if (!checkboxes.length || !fill || !label) return;

      var STORAGE_KEY = 'cf_a9_habit_tracker_' + new Date().toDateString();
      var saved = [];
      try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) {}

      // Restore from localStorage
      checkboxes.forEach(function (cb, i) {
        if (saved.indexOf(i) !== -1) {
          cb.checked = true;
          cb.closest('label').style.textDecoration = 'line-through';
          cb.closest('label').style.opacity = '0.6';
        }
      });

      function updateTracker() {
        var done = 0;
        checkboxes.forEach(function (cb) { if (cb.checked) done++; });
        var pct = Math.round((done / checkboxes.length) * 100);
        fill.style.width = pct + '%';
        label.textContent = done + ' / ' + checkboxes.length + ' today';
        // Save
        var checkedIds = [];
        checkboxes.forEach(function (cb, i) { if (cb.checked) checkedIds.push(i); });
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedIds)); } catch (e) {}
      }

      checkboxes.forEach(function (cb) {
        cb.addEventListener('change', function () {
          var lbl = cb.closest('label');
          if (cb.checked) {
            lbl.style.textDecoration = 'line-through';
            lbl.style.opacity = '0.6';
          } else {
            lbl.style.textDecoration = '';
            lbl.style.opacity = '';
          }
          updateTracker();
        });
      });

      updateTracker();
    }


    /* ════════════════════════════════════════════════════════════
       8.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a9InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article9';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a9-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       9.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article9';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a9setCount('a9-count-helpful',  data.likes);
          a9setCount('a9-count-inspired', data.reviewsCount);
          a9setCount('a9-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a9 reviews] loadStats failed:', e.message);
        }
      }

      function a9setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a9-btn-helpful');
      if (btnHelpful) {
        btnHelpful.addEventListener('click', async function () {
          if (likeGranted) return;
          likeGranted = true;
          btnHelpful.classList.add('active');
          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'like', articleId: ARTICLE_ID })
            });
            var data = await res.json();
            if (data.success) a9setCount('a9-count-helpful', data.likes);
          } catch (e) { console.warn('[a9] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a9setCount('a9-count-more', data.shares);
        } catch (e) { console.warn('[a9] share failed:', e.message); }
      }

      document.querySelectorAll('.a9-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a9-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a9-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
      var avatarBase64 = '';

      function compressAvatar(file) {
        return new Promise(function (resolve) {
          if (!file) { resolve(''); return; }
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () {
            var MAX = 150, w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          };
          img.onerror = function () { URL.revokeObjectURL(url); resolve(''); };
          img.src = url;
        });
      }

      var avatarInput  = document.getElementById('a9-rv-avatar-input');
      var avatarWrap   = document.getElementById('a9-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a9-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a9-rv-avatar-placeholder');

      if (avatarWrap && avatarInput) {
        avatarWrap.addEventListener('click', function () { avatarInput.click(); });
        avatarInput.addEventListener('change', async function () {
          var file = avatarInput.files[0];
          if (!file) return;
          avatarBase64 = await compressAvatar(file);
          if (avatarBase64 && avatarPrev && avatarPlaceh) {
            avatarPrev.src = avatarBase64;
            avatarPrev.style.display = 'block';
            avatarPlaceh.style.display = 'none';
          }
        });
      }

      // Stars
      var stars          = document.querySelectorAll('#a9-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a9-rv-rating');
      var selectedRating = 0;

      function paintStars(upTo) {
        stars.forEach(function (s, i) {
          s.classList.toggle('fi-sr-star', i < upTo);
          s.classList.toggle('fi-rr-star', i >= upTo);
          s.classList.toggle('selected',   i < upTo);
        });
      }

      stars.forEach(function (star) {
        star.addEventListener('mouseover', function () { paintStars(parseInt(star.dataset.val)); });
        star.addEventListener('mouseout',  function () { paintStars(selectedRating); });
        star.addEventListener('click',     function () {
          selectedRating = parseInt(star.dataset.val);
          if (ratingInput) ratingInput.value = selectedRating;
          paintStars(selectedRating);
        });
      });

      // Char counter
      var textarea = document.getElementById('a9-rv-text');
      var charNum  = document.getElementById('a9-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a9-art-review-form');
      var submitBtn  = document.getElementById('a9-rv-submit');
      var errorEl    = document.getElementById('a9-rv-error');
      var successEl  = document.getElementById('a9-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a9-rv-firstname').value.trim();
          var lastName  = document.getElementById('a9-rv-lastname').value.trim();
          var text      = document.getElementById('a9-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)        { showError('Please enter your first and last name.'); return; }
          if (rating === 0)                   { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10)      { showError('Please write at least 10 characters.'); return; }

          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending…';

          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'add-review', articleId: ARTICLE_ID,
                firstName, lastName, avatar: avatarBase64, text, rating
              })
            });
            var data = await res.json();

            if (data.success) {
              if (successEl) successEl.style.display = 'flex';
              a9setCount('a9-count-inspired', data.reviewsCount);

              allReviews.unshift({
                firstName, lastName, avatar: avatarBase64, text, rating,
                date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
              });
              renderReviews(true);

              reviewForm.reset();
              selectedRating = 0; paintStars(0);
              avatarBase64 = '';
              if (avatarPrev)   { avatarPrev.style.display = 'none'; avatarPrev.src = ''; }
              if (avatarPlaceh) avatarPlaceh.style.display = 'flex';
              if (charNum)      charNum.textContent = '0';

              submitBtn.innerHTML = '<i class="fi fi-rr-check-circle"></i> Review submitted!';
              setTimeout(function () {
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

      // Reviews list
      var listWrap    = document.getElementById('a9-art-reviews-list-wrap');
      var listEl      = document.getElementById('a9-art-reviews-list');
      var countLabel  = document.getElementById('a9-rv-count-label');
      var loadMoreBtn = document.getElementById('a9-rv-load-more');

      function renderReviews(reset) {
        if (!listEl) return;
        if (reset) { shownCount = 0; listEl.innerHTML = ''; }
        if (allReviews.length === 0) { if (listWrap) listWrap.style.display = 'none'; return; }
        if (listWrap) listWrap.style.display = 'block';
        if (countLabel) countLabel.textContent = allReviews.length + ' review' + (allReviews.length > 1 ? 's' : '');

        var slice = allReviews.slice(shownCount, shownCount + REVIEWS_PER_PAGE);
        slice.forEach(function (rv) { listEl.appendChild(buildReviewCard(rv)); });
        shownCount += slice.length;
        if (loadMoreBtn) loadMoreBtn.style.display = shownCount < allReviews.length ? 'block' : 'none';
      }

      if (loadMoreBtn) loadMoreBtn.addEventListener('click', function () { renderReviews(false); });

      function buildReviewCard(rv) {
        var card = document.createElement('div');
        card.className = 'art-rv-card';

        var avatarHTML = rv.avatar
          ? '<img class="art-rv-card__avatar" src="' + rv.avatar + '" alt="' + rv.firstName + '" loading="lazy">'
          : '<div class="art-rv-card__avatar-placeholder">' + (rv.firstName || '?').charAt(0).toUpperCase() + '</div>';

        var rating = parseInt(rv.rating) || 5;
        var starsHTML = '';
        for (var i = 1; i <= 5; i++) {
          starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
        }

        card.innerHTML = avatarHTML +
          '<div class="art-rv-card__body">' +
            '<div class="art-rv-card__top">' +
              '<span class="art-rv-card__name">' + a9EscHtml(rv.firstName) + ' ' + a9EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a9EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a9EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      // "I'm inspired" btn
      var btnInspired = document.getElementById('a9-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a9-art-reviews-list-wrap')
            : document.getElementById('a9-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       10.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a9InitNewsletterForms() {
      var nlForm  = document.getElementById('a9-article-nl-form');
      var nlEmail = document.getElementById('a9-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...'; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();

            if (data.success) {
              nlEmail.value = '';
              if (btn) {
                btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!';
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a9ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer newsletter
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a9Bound) {
        footerForm.dataset.a9Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a9ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a9ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       11.  HERO PARALLAX
    ════════════════════════════════════════════════════════════ */
    function a9InitHeroParallax() {
      var heroImg = document.querySelector('.a9-hero__img-wrap img');
      if (!heroImg || window.innerWidth < 960) return;

      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        heroImg.style.transform = 'scale(1.04) translateY(' + (scrollY * 0.12) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       12.  SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a9InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a9-section, .a9-discover, .a9-pullquote, .a9-mid-cta, ' +
        '.a9-author-bio, .a9-seed-card, .a9-layer, .a9-routine-card, ' +
        '.a9-recovery-step, .a9-killer-card, .a9-blueprint-phase, ' +
        '.a9-loop-visual, ' +
        '#a9-article-reactions, #a9-article-share-bottom, #a9-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(24px)';
        el.style.transition = 'opacity 0.60s ease, transform 0.60s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a9setText(id, text) {
      var els = document.querySelectorAll('#' + id);
      els.forEach(function (el) { el.textContent = text; });
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a9Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a9EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a9InitProgressBar();
    a9InitSidebarShare();
    a9InitShareButtons();
    a9InitHabitTracker();
    a9InitReactions();
    a9InitNewsletterForms();
    a9InitHeroParallax();

    // Delayed to let JSON injection settle
    setTimeout(function () {
      a9BuildTOC();
      a9InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE








/* ================================================================
   ARTICLE 10 — "Caloric Deficit Without Deprivation"
   Add this block inside articles.js
================================================================ */

(function () {

  if (!document.body.classList.contains('a10-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-10
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-10') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a10]: card-10 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article10.html' }
          });
        }

        // ── Hero fields ────────────────────────────────────────
        var heroImg = document.getElementById('a10-hero-img');
        if (heroImg) { heroImg.src = cardData.image; heroImg.alt = cardData.imageAlt || cardData.title; }

        a10setText('a10-hero-badge',       cardData.badge);
        a10setText('a10-hero-readtime',    cardData.readTime);
        a10setText('a10-hero-views',       cardData.views + ' reads');
        a10setText('a10-hero-date',        cardData.date);
        a10setText('a10-hero-author-name', cardData.author.name);
        a10setText('a10-hero-excerpt',     cardData.excerpt);
        a10setText('a10-breadcrumb-cat',   cardData.badge);

        // New badge visibility
        var newBadge = document.getElementById('a10-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        // Author image
        var authorImg = document.getElementById('a10-hero-author-img');
        if (authorImg) { authorImg.src = cardData.author.image; authorImg.alt = cardData.author.name; }

        // ── Sidebar ────────────────────────────────────────────
        a10setText('a10-sidebar-author-name', cardData.author.name);
        var sidebarAuthorImg = document.getElementById('a10-sidebar-author-img');
        if (sidebarAuthorImg) { sidebarAuthorImg.src = cardData.author.image; sidebarAuthorImg.alt = cardData.author.name; }

        // ── Bio ────────────────────────────────────────────────
        var bioImg = document.getElementById('a10-bio-img');
        if (bioImg) { bioImg.src = cardData.author.image; bioImg.alt = cardData.author.name; }
        a10setText('a10-bio-name',          cardData.author.name);
        a10setText('a10-conclusion-author', cardData.author.name);
        a10setText('a10-pullquote-author',  cardData.author.name);

        // ── Ribbon ─────────────────────────────────────────────
        a10setText('a10-ribbon-readtime', cardData.readTime);
        a10setText('a10-ribbon-views',    cardData.views + ' reads');
        a10setText('a10-ribbon-date',     cardData.date);

        // ── Related articles ───────────────────────────────────
        a10InjectRelated(data.cards, cardData.category, 'card-10');

      })
      .catch(function (err) {
        console.error('articles.js [a10]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a10InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a10-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a10Shuffle(sameCategory);
      a10Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + a10EscHtml(card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + a10EscHtml(card.badge) + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + a10EscHtml(card.title) + '</h3>' +
            '<p class="related-card__excerpt">' + a10EscHtml(card.excerpt) + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + a10EscHtml(card.readTime) + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + a10EscHtml(card.views) + '</span>' +
              '<span class="related-card__cta">Read Article →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a10BuildTOC() {
      var tocNav   = document.getElementById('a10-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a10-article h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a10-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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
          var found = links.find(function (l) { return l.el === entry.target; });
          if (found) found.link.classList.toggle('active', entry.isIntersecting);
        });
      }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

      links.forEach(function (l) { observer.observe(l.el); });
    }


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a10InitProgressBar() {
      var bar = document.getElementById('reading-progress-bar');
      if (!bar) return;
      function updateProgress() {
        var scrollTop  = window.scrollY || document.documentElement.scrollTop;
        var docHeight  = document.documentElement.scrollHeight - window.innerHeight;
        var progress   = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
        bar.style.width = progress.toFixed(1) + '%';
      }
      window.addEventListener('scroll', updateProgress, { passive: true });
      updateProgress();
    }


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a10InitSidebarShare() {
      var stickyShare = document.getElementById('a10-sticky-share');
      var hero        = document.getElementById('a10-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a10InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a10-share-btn').forEach(function (btn) {

        if (btn.id === 'a10-hero-copy' || btn.id === 'a10-bottom-copy' ||
            btn.classList.contains('a10-share-btn--copy')) {
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
          if (btn.classList.contains('a10-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a10-share-btn--pi')) {
            var imgEl = document.getElementById('a10-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a10-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a10-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a10InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article10';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); } catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a10-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;
          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       8.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article10';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a10setCount('a10-count-helpful',  data.likes);
          a10setCount('a10-count-inspired', data.reviewsCount);
          a10setCount('a10-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a10 reviews] loadStats failed:', e.message);
        }
      }

      function a10setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      var btnHelpful = document.getElementById('a10-btn-helpful');
      if (btnHelpful) {
        btnHelpful.addEventListener('click', async function () {
          if (likeGranted) return;
          likeGranted = true;
          btnHelpful.classList.add('active');
          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'like', articleId: ARTICLE_ID })
            });
            var data = await res.json();
            if (data.success) a10setCount('a10-count-helpful', data.likes);
          } catch (e) { console.warn('[a10] like failed:', e.message); }
        });
      }

      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a10setCount('a10-count-more', data.shares);
        } catch (e) { console.warn('[a10] share failed:', e.message); }
      }

      document.querySelectorAll('.a10-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a10-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a10-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      var avatarBase64 = '';

      function compressAvatar(file) {
        return new Promise(function (resolve) {
          if (!file) { resolve(''); return; }
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () {
            var MAX = 150, w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          };
          img.onerror = function () { URL.revokeObjectURL(url); resolve(''); };
          img.src = url;
        });
      }

      var avatarInput  = document.getElementById('a10-rv-avatar-input');
      var avatarWrap   = document.getElementById('a10-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a10-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a10-rv-avatar-placeholder');

      if (avatarWrap && avatarInput) {
        avatarWrap.addEventListener('click', function () { avatarInput.click(); });
        avatarInput.addEventListener('change', async function () {
          var file = avatarInput.files[0];
          if (!file) return;
          avatarBase64 = await compressAvatar(file);
          if (avatarBase64 && avatarPrev && avatarPlaceh) {
            avatarPrev.src = avatarBase64;
            avatarPrev.style.display = 'block';
            avatarPlaceh.style.display = 'none';
          }
        });
      }

      var stars          = document.querySelectorAll('#a10-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a10-rv-rating');
      var selectedRating = 0;

      function paintStars(upTo) {
        stars.forEach(function (s, i) {
          s.classList.toggle('fi-sr-star', i < upTo);
          s.classList.toggle('fi-rr-star', i >= upTo);
          s.classList.toggle('selected',   i < upTo);
        });
      }

      stars.forEach(function (star) {
        star.addEventListener('mouseover', function () { paintStars(parseInt(star.dataset.val)); });
        star.addEventListener('mouseout',  function () { paintStars(selectedRating); });
        star.addEventListener('click',     function () {
          selectedRating = parseInt(star.dataset.val);
          if (ratingInput) ratingInput.value = selectedRating;
          paintStars(selectedRating);
        });
      });

      var textarea = document.getElementById('a10-rv-text');
      var charNum  = document.getElementById('a10-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      var reviewForm = document.getElementById('a10-art-review-form');
      var submitBtn  = document.getElementById('a10-rv-submit');
      var errorEl    = document.getElementById('a10-rv-error');
      var successEl  = document.getElementById('a10-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a10-rv-firstname').value.trim();
          var lastName  = document.getElementById('a10-rv-lastname').value.trim();
          var text      = document.getElementById('a10-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)   { showError('Please enter your first and last name.'); return; }
          if (rating === 0)              { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10) { showError('Please write at least 10 characters.'); return; }

          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending…';

          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'add-review', articleId: ARTICLE_ID,
                firstName, lastName, avatar: avatarBase64, text, rating
              })
            });
            var data = await res.json();

            if (data.success) {
              if (successEl) successEl.style.display = 'flex';
              a10setCount('a10-count-inspired', data.reviewsCount);

              allReviews.unshift({
                firstName, lastName, avatar: avatarBase64, text, rating,
                date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
              });
              renderReviews(true);

              reviewForm.reset();
              selectedRating = 0; paintStars(0);
              avatarBase64 = '';
              if (avatarPrev)   { avatarPrev.style.display = 'none'; avatarPrev.src = ''; }
              if (avatarPlaceh) avatarPlaceh.style.display = 'flex';
              if (charNum)      charNum.textContent = '0';

              submitBtn.innerHTML = '<i class="fi fi-rr-check-circle"></i> Review submitted!';
              setTimeout(function () {
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

      var listWrap    = document.getElementById('a10-art-reviews-list-wrap');
      var listEl      = document.getElementById('a10-art-reviews-list');
      var countLabel  = document.getElementById('a10-rv-count-label');
      var loadMoreBtn = document.getElementById('a10-rv-load-more');

      function renderReviews(reset) {
        if (!listEl) return;
        if (reset) { shownCount = 0; listEl.innerHTML = ''; }
        if (allReviews.length === 0) { if (listWrap) listWrap.style.display = 'none'; return; }
        if (listWrap) listWrap.style.display = 'block';
        if (countLabel) countLabel.textContent = allReviews.length + ' review' + (allReviews.length > 1 ? 's' : '');

        var slice = allReviews.slice(shownCount, shownCount + REVIEWS_PER_PAGE);
        slice.forEach(function (rv) { listEl.appendChild(buildReviewCard(rv)); });
        shownCount += slice.length;
        if (loadMoreBtn) loadMoreBtn.style.display = shownCount < allReviews.length ? 'block' : 'none';
      }

      if (loadMoreBtn) loadMoreBtn.addEventListener('click', function () { renderReviews(false); });

      function buildReviewCard(rv) {
        var card = document.createElement('div');
        card.className = 'art-rv-card';
        var avatarHTML = rv.avatar
          ? '<img class="art-rv-card__avatar" src="' + rv.avatar + '" alt="' + a10EscHtml(rv.firstName) + '" loading="lazy">'
          : '<div class="art-rv-card__avatar-placeholder">' + (rv.firstName || '?').charAt(0).toUpperCase() + '</div>';
        var rating = parseInt(rv.rating) || 5;
        var starsHTML = '';
        for (var i = 1; i <= 5; i++) {
          starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
        }
        card.innerHTML = avatarHTML +
          '<div class="art-rv-card__body">' +
            '<div class="art-rv-card__top">' +
              '<span class="art-rv-card__name">' + a10EscHtml(rv.firstName) + ' ' + a10EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a10EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a10EscHtml(rv.text) + '</p>' +
          '</div>';
        return card;
      }

      var btnInspired = document.getElementById('a10-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a10-art-reviews-list-wrap')
            : document.getElementById('a10-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       9.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a10InitNewsletterForms() {
      var nlForm  = document.getElementById('a10-article-nl-form');
      var nlEmail = document.getElementById('a10-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;
          var btn = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...'; }
          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) {
              nlEmail.value = '';
              if (btn) {
                btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!';
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a10ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a10Bound) {
        footerForm.dataset.a10Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;
          var btn = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }
          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a10ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a10ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       10. HERO PARALLAX (background image)
    ════════════════════════════════════════════════════════════ */
    function a10InitHeroParallax() {
      var heroImg = document.querySelector('.a10-hero__bg-img');
      if (!heroImg || window.innerWidth < 960) return;
      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        heroImg.style.transform = 'scale(1.04) translateY(' + (scrollY * 0.08) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       11. TDEE BAR ANIMATION (animate widths on scroll)
    ════════════════════════════════════════════════════════════ */
    function a10InitTDEEBars() {
      var bars = document.querySelectorAll('.a10-tdee-bar__fill');
      if (!bars.length) return;

      var animated = false;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !animated) {
            animated = true;
            bars.forEach(function (bar) {
              var targetWidth = bar.style.width;
              bar.style.width = '0';
              setTimeout(function () { bar.style.width = targetWidth; }, 100);
            });
            observer.disconnect();
          }
        });
      }, { threshold: 0.3 });

      var tdeeVisual = document.querySelector('.a10-tdee-visual');
      if (tdeeVisual) observer.observe(tdeeVisual);
    }


    /* ════════════════════════════════════════════════════════════
       12. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a10InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a10-section, .a10-learn-box, .a10-pullquote, .a10-mid-cta, ' +
        '.a10-author-bio, .a10-cascade, .a10-tdee-visual, .a10-callout, ' +
        '.a10-figure, .a10-cycle-visual, .a10-zones-grid, .a10-muscle-card, ' +
        '.a10-strategy, .a10-reverse-step, .a10-protocol-week, ' +
        '#a10-article-reactions, #a10-article-share-bottom, #a10-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(26px)';
        el.style.transition = 'opacity 0.62s ease, transform 0.62s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a10setText(id, text) {
      var els = document.querySelectorAll('#' + id);
      els.forEach(function (el) { el.textContent = text; });
    }

    function a10Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a10EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a10InitProgressBar();
    a10InitSidebarShare();
    a10InitShareButtons();
    a10InitReactions();
    a10InitNewsletterForms();
    a10InitHeroParallax();
    a10InitTDEEBars();

    setTimeout(function () {
      a10BuildTOC();
      a10InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE

