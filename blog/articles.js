/* ================================================================
   Curvafit — article1.js
================================================================ */

document.addEventListener('DOMContentLoaded', function () {
  // Ajoute cette ligne au tout début :
  var cardId = document.body.getAttribute('data-article-card') ||
    (document.body.classList.contains('a1-page') ? 'card-1' : '');
  if (!cardId) return;
  var pageArticleId = 'article' + cardId.replace(/^card-/, '');

  window.bbwFetchBlogArticles()
    .then(function (data) {

      // ── Find card-1 in the cards array ───────────────────────
      var cardData = null;
      if (data.cards) {
        data.cards.forEach(function (c) {
          if (c.id === cardId) cardData = c;
        });
      }

      if (!cardData) {
        console.warn('articles.js: ' + cardId + ' not found in blog-articles.json');
        return;
      }

      var canonicalUrl = new URL(cardData.url, window.location.origin).href;
      var canonicalLink = document.querySelector('link[rel="canonical"]');
      if (canonicalLink) canonicalLink.href = canonicalUrl;
      var ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl) ogUrl.content = canonicalUrl;

      // ── Inject meta tags dynamically ────────────────────────
      var pageTitle = document.getElementById('page-title');
      if (pageTitle) pageTitle.textContent = cardData.title + ' | Curvafit Journal';
      else document.title = cardData.title + ' | Curvafit Journal';

      var metaDesc = document.getElementById('meta-description');
      if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

      var metaOgTitle = document.getElementById('meta-og-title');
      if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — Curvafit Journal');

      var metaOgDesc = document.getElementById('meta-og-desc');
      if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

      var metaOgImage = document.getElementById('meta-og-image');
      if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

      var metaTwitterTitle = document.getElementById('meta-twitter-title');
      if (metaTwitterTitle) metaTwitterTitle.setAttribute('content', cardData.title + ' | Curvafit Journal');
      var metaTwitterDesc = document.getElementById('meta-twitter-desc');
      if (metaTwitterDesc) metaTwitterDesc.setAttribute('content', cardData.excerpt);
      var metaTwitterImage = document.getElementById('meta-twitter-image');
      if (metaTwitterImage) metaTwitterImage.setAttribute('content', cardData.image);

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
            'name': 'Curvafit',
            'logo': {
              '@type': 'ImageObject',
              'url': 'https://curvafit.com/public/Logo-Curvafit.png'
            }
          },
          'datePublished': cardData.date,
          'mainEntityOfPage': {
            '@type': 'WebPage',
            '@id': canonicalUrl
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
      var articleHero = document.getElementById('article-hero');
      if (articleHero && document.body.classList.contains('a4-page')) {
        articleHero.style.backgroundImage = 'url("' + cardData.image.replace(/"/g, '\\"') + '")';
        articleHero.style.backgroundColor = 'transparent';
        articleHero.style.backgroundSize = 'cover';
        articleHero.style.backgroundPosition = 'center 42%';
      }
      if (articleHero && document.body.classList.contains('a6-page')) {
        articleHero.style.backgroundImage = 'url("' + cardData.image.replace(/"/g, '\\"') + '")';
        articleHero.style.backgroundColor = 'transparent';
        articleHero.style.backgroundSize = 'cover';
        articleHero.style.backgroundPosition = 'center 42%';
      }
      if (articleHero && document.body.classList.contains('a7-page')) {
        articleHero.style.backgroundImage = 'url("' + cardData.image.replace(/"/g, '\\"') + '")';
        articleHero.style.backgroundColor = 'transparent';
        articleHero.style.backgroundSize = 'cover';
        articleHero.style.backgroundPosition = 'center';
      }
      if (articleHero && document.body.classList.contains('a8-page')) {
        articleHero.style.backgroundImage = 'url("' + cardData.image.replace(/"/g, '\\"') + '")';
        articleHero.style.backgroundColor = 'transparent';
        articleHero.style.backgroundSize = 'cover';
        articleHero.style.backgroundPosition = 'center 45%';
      }

      // ── Hero text fields ────────────────────────────────────
      setText('hero-badge',        cardData.badge);
      setText('hero-readtime',     cardData.readTime);
      setHeroTitle(cardData.title);
      setHeroExcerpt(cardData.excerpt);
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
      setText('hero-author-role', cardData.author.role || 'Curvafit Journal');

      // ── Bio section ─────────────────────────────────────────
      var bioImg = document.getElementById('bio-author-img');
      if (bioImg) {
        bioImg.src = cardData.author.image;
        bioImg.alt = cardData.author.name;
      }
      setText('bio-author-name', cardData.author.name);
      setText('bio-author-role', cardData.author.role || 'Curvafit Journal');
      setText('conclusion-author-name', cardData.author.name);

      // ── Quick stats strip ───────────────────────────────────
      setText('strip-readtime', cardData.readTime);
      setText('strip-views',    cardData.views + ' reads');
      setText('strip-date',     cardData.date);

      // ── Inject related articles ─────────────────────────────
      injectRelated(data.cards, cardData.category, cardId);

    })
    .catch(function (err) {
      console.error('articles.js: error loading blog-articles.json:', err);
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

      // The blog's shared Web Share handler owns native-share buttons.
      if (btn.hasAttribute('data-native-share')) return;

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
    var STORAGE_KEY = 'cf_article_reactions_' + pageArticleId;

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
    var ARTICLE_ID       = pageArticleId;
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
      } catch (e) {
        console.warn('[article1 reviews] loadStats failed:', e.message);
      }
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

    
    var textarea = document.getElementById('art-rv-text');
    var charNum  = document.getElementById('art-rv-char-num');
    if (textarea && charNum) {
      textarea.addEventListener('input', function () {
        charNum.textContent = textarea.value.length;
      });
    }

    
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

  function setHeroTitle(text) {
    var el = document.getElementById('hero-title');
    if (!el) return;

    var title = String(text || '');
    var accents = [
      { phrase: 'Restart Your Routine After a Setback', className: 'article-hero__title-accent article-hero__title-accent--opening' },
      { phrase: 'Without Guilt', className: 'article-hero__title-accent' },
      { phrase: 'Chair Workouts for Beginners', className: 'article-hero__title-accent article-hero__title-accent--opening' },
      { phrase: '8 Gentle Moves You Can Do at Home', className: 'article-hero__title-accent' },
      { phrase: 'How to Start', className: 'article-hero__title-accent article-hero__title-accent--opening' },
      { phrase: 'Gentle 4-Week Plan', className: 'article-hero__title-accent' },
      { phrase: 'Simple Meal Prep', className: 'article-hero__title-accent article-hero__title-accent--opening' },
      { phrase: 'No Strict Diet Needed', className: 'article-hero__title-accent' },
      { phrase: 'Staying Consistent When Motivation Disappears', className: 'article-hero__title-accent article-hero__title-accent--opening' },
      { phrase: '7 Habits That Actually Work', className: 'article-hero__title-accent' },
      { phrase: 'Anti-Chafing Tips for Plus-Size Women', className: 'article-hero__title-accent article-hero__title-accent--opening' },
      { phrase: 'What to Wear and What to Avoid', className: 'article-hero__title-accent' },
      { phrase: 'Your First Day at the Gym', className: 'article-hero__title-accent article-hero__title-accent--opening' },
      { phrase: 'A Calm, Confidence-Building Guide', className: 'article-hero__title-accent' },
      { phrase: 'The Plate Method Explained', className: 'article-hero__title-accent article-hero__title-accent--opening' },
      { phrase: 'Balanced Meals Without Counting Calories', className: 'article-hero__title-accent' }
    ].map(function (accent) {
      var start = title.toLowerCase().indexOf(accent.phrase.toLowerCase());
      return start < 0 ? null : {
        start: start,
        end: start + accent.phrase.length,
        className: accent.className
      };
    }).filter(Boolean).sort(function (a, b) { return a.start - b.start; });

    el.replaceChildren();
    if (!accents.length) {
      el.textContent = title;
      return;
    }

    var cursor = 0;
    accents.forEach(function (accent) {
      if (accent.start < cursor) return;
      el.appendChild(document.createTextNode(title.slice(cursor, accent.start)));
      var highlighted = document.createElement('span');
      highlighted.className = accent.className;
      highlighted.textContent = title.slice(accent.start, accent.end);
      el.appendChild(highlighted);
      cursor = accent.end;
    });
    el.appendChild(document.createTextNode(title.slice(cursor)));
  }

  function setHeroExcerpt(text) {
    var el = document.getElementById('hero-excerpt');
    if (!el) return;

    var excerpt = String(text || '');
    var accents = [
      { phrase: 'returning to routines after a pause', className: 'article-hero__excerpt-accent' },
      { phrase: 'without punishment or trying to make up for missed days', className: 'article-hero__excerpt-accent article-hero__excerpt-accent--champagne' },
      { phrase: 'eight gentle movements', className: 'article-hero__excerpt-accent' },
      { phrase: 'chair option for each', className: 'article-hero__excerpt-accent article-hero__excerpt-accent--champagne' },
      { phrase: 'three planned walks each week', className: 'article-hero__excerpt-accent' },
      { phrase: 'repeat a week whenever you need more time', className: 'article-hero__excerpt-accent article-hero__excerpt-accent--champagne' },
      { phrase: 'Ten flexible meal-prep ideas', className: 'article-hero__excerpt-accent' },
      { phrase: 'simple ways to plan ahead', className: 'article-hero__excerpt-accent article-hero__excerpt-accent--champagne' },
      { phrase: 'no strict diet rules', className: 'article-hero__excerpt-accent article-hero__excerpt-accent--rose' },
      { phrase: 'Seven practical ways to make a routine easier to return to', className: 'article-hero__excerpt-accent' },
      { phrase: 'keep a flexible Plan B', className: 'article-hero__excerpt-accent article-hero__excerpt-accent--champagne' },
      { phrase: 'choose a smooth feel and a fit that stays in place without digging in', className: 'article-hero__excerpt-accent' },
      { phrase: 'fabrics that move moisture away from the skin', className: 'article-hero__excerpt-accent article-hero__excerpt-accent--champagne' },
      { phrase: 'planning your first visit', className: 'article-hero__excerpt-accent' },
      { phrase: 'ask gym staff questions', className: 'article-hero__excerpt-accent article-hero__excerpt-accent--champagne' },
      { phrase: 'flexible visual starting point', className: 'article-hero__excerpt-accent' },
      { phrase: 'not a strict rule', className: 'article-hero__excerpt-accent article-hero__excerpt-accent--champagne' },
      { phrase: 'does not require calorie counting', className: 'article-hero__excerpt-accent article-hero__excerpt-accent--champagne' }
    ].map(function (accent) {
      var start = excerpt.toLowerCase().indexOf(accent.phrase.toLowerCase());
      return start < 0 ? null : {
        start: start,
        end: start + accent.phrase.length,
        className: accent.className
      };
    }).filter(Boolean).sort(function (a, b) { return a.start - b.start; });

    el.replaceChildren();
    if (!accents.length) {
      el.textContent = excerpt;
      return;
    }

    var cursor = 0;
    accents.forEach(function (accent) {
      if (accent.start < cursor) return;
      el.appendChild(document.createTextNode(excerpt.slice(cursor, accent.start)));
      var highlighted = document.createElement('span');
      highlighted.className = accent.className;
      highlighted.textContent = excerpt.slice(accent.start, accent.end);
      el.appendChild(highlighted);
      cursor = accent.end;
    });
    el.appendChild(document.createTextNode(excerpt.slice(cursor)));
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
