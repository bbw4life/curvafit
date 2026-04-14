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

        a5setText('a5-hero-badge',    cardData.badge);
        a5setText('a5-hero-readtime', cardData.readTime);
        a5setText('a5-hero-views',    cardData.views + ' reads');
        a5setText('a5-hero-date',     cardData.date);
        a5setText('a5-hero-author-name', cardData.author.name);
        a5setText('a5-hero-excerpt',  cardData.excerpt);
        a5setText('a5-breadcrumb-cat', cardData.badge);

        // Show/hide "New" badge
        var newBadge = document.getElementById('a5-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        // Author avatar
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
            '<img src="' + card.image + '" alt="' + a5EscHtml(card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + a5EscHtml(card.badge) + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + a5EscHtml(card.title) + '</h3>' +
            '<p class="related-card__excerpt">' + a5EscHtml(card.excerpt) + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + a5EscHtml(card.readTime) + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + a5EscHtml(card.views) + '</span>' +
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
        // a5 brand color for the progress bar
        bar.style.background = 'linear-gradient(90deg, #2d6a4f, #d4b77a)';
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
       7.  HERO PARALLAX
    ════════════════════════════════════════════════════════════ */
    function a5InitHeroParallax() {
      var heroImg = document.querySelector('.a5-hero__img-frame img');
      if (!heroImg || window.innerWidth < 1024) return;

      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        heroImg.style.transform = 'scale(1.06) translateY(' + (scrollY * 0.12) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       8.  FLOATING CARDS ENTRANCE
    ════════════════════════════════════════════════════════════ */
    function a5AnimateFloatCards() {
      var cards = document.querySelectorAll('.a5-float-stat');
      cards.forEach(function (card, i) {
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(20px) scale(0.92)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        setTimeout(function () {
          card.style.opacity   = '1';
          card.style.transform = 'translateY(0) scale(1)';
        }, 900 + i * 450);
      });
    }


    /* ════════════════════════════════════════════════════════════
       9.  SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a5InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a5-section, .a5-learn-grid, .a5-pullquote, .a5-mid-cta, ' +
        '.a5-author-bio, .a5-hormone-card, .a5-principle-card, ' +
        '.a5-supplement-card, .a5-phase-card, .a5-cascade-visual, ' +
        '.a5-sample-day, .a5-callout, .a5-exercise-card, ' +
        '.a5-sleep-card, .a5-stress-card, ' +
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
       10.  REACTIONS
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
       11.  REVIEW SYSTEM
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

      // Avatar compression
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
          ? '<img class="art-rv-card__avatar" src="' + rv.avatar + '" alt="' + a5EscHtml(rv.firstName) + '" loading="lazy">'
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
       12.  NEWSLETTER FORMS
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

      // Footer newsletter (only bind once)
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
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a5setText(id, text) {
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

    // Delayed for DOM settle
    setTimeout(function () {
      a5BuildTOC();
      a5InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE

