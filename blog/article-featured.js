/* ================================================================
   CURVAFIT — article-featured.js
   Fetches blog-articles.json and injects all dynamic data
   into the featured article page (article-featured.html).
   
   Data injected from JSON:
     - featured.*  → hero, meta, breadcrumb, author, conclusion
     - cards[]     → related articles (3 random from same/other categories)
   
   No data needs to be edited manually in the HTML page.
   To update the article header: edit /blog/blog-articles.json → "featured"
================================================================ */

document.addEventListener('DOMContentLoaded', function () {

  // ════════════════════════════════════════
  //  FETCH blog-articles.json and inject
  // ════════════════════════════════════════
  fetch('/blog/blog-articles.json')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var f = data.featured;
      if (!f) return;

      // ── SEO & meta tags ──────────────────────────────────────
      document.getElementById('page-title').textContent        = f.title + ' | CurvaFit Journal';
      document.getElementById('meta-description').setAttribute('content', f.excerpt);
      document.getElementById('meta-og-title').setAttribute('content', f.title);
      document.getElementById('meta-og-desc').setAttribute('content', f.excerpt);
      document.getElementById('meta-og-image').setAttribute('content', f.image);

      // JSON-LD Article schema
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
        'mainEntityOfPage': {
          '@type': 'WebPage',
          '@id': window.location.href
        }
      };
      document.getElementById('json-ld').textContent = JSON.stringify(jsonLd);

      // ── HERO ─────────────────────────────────────────────────
      var heroImg = document.getElementById('hero-image');
      heroImg.src = f.image;
      heroImg.alt = f.imageAlt;

      setText('hero-badge', f.badge);
      setText('hero-readtime', f.readTime);
      setText('hero-title', f.title);
      setText('hero-excerpt', f.excerpt);

      // Author
      setAttr('hero-author-img', 'src', f.author.image);
      setAttr('hero-author-img', 'alt', f.author.name);
      setText('hero-author-name', f.author.name);
      setText('hero-author-role', f.author.role);

      // Stats
      setText('hero-date', f.date);
      setText('hero-views', f.views);
      setText('hero-readtime-stat', f.readTime);

      // Breadcrumb category
      setText('breadcrumb-category', f.badge);

      // ── AUTHOR BIO ────────────────────────────────────────────
      setAttr('bio-author-img', 'src', f.author.image);
      setAttr('bio-author-img', 'alt', f.author.name);
      setText('bio-author-name', f.author.name);
      setText('bio-author-role', f.author.role);
      setText('conclusion-author-name', f.author.name);

      // ── RELATED ARTICLES ──────────────────────────────────────
      injectRelated(data.cards, f.badge);

      // ── SHARE BUTTONS (all zones) ─────────────────────────────
      initShareButtons();

    })
    .catch(function (err) {
      console.error('article-featured.js: error loading blog-articles.json:', err);
    });

  // ════════════════════════════════════════
  //  INJECT RELATED ARTICLES
  //  Picks 3 cards: prioritises same category,
  //  fills with others if needed.
  // ════════════════════════════════════════
  function injectRelated(cards, currentBadge) {
    var relatedGrid = document.getElementById('related-grid');
    if (!relatedGrid || !cards || !cards.length) return;

    // Normalise badge to category slug for comparison
    var currentCat = slugify(currentBadge);

    var sameCategory = cards.filter(function (c) {
      return slugify(c.badge) === currentCat || c.category === currentCat;
    });
    var otherCards = cards.filter(function (c) {
      return slugify(c.badge) !== currentCat && c.category !== currentCat;
    });

    // Shuffle helpers
    shuffle(sameCategory);
    shuffle(otherCards);

    var picks = sameCategory.slice(0, 3);
    if (picks.length < 3) {
      picks = picks.concat(otherCards.slice(0, 3 - picks.length));
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

  // ════════════════════════════════════════
  //  TABLE OF CONTENTS — auto-generated from H2s
  // ════════════════════════════════════════
  function buildTOC() {
    var tocNav = document.getElementById('toc-nav');
    if (!tocNav) return;

    var headings = document.querySelectorAll('.article-content h2');
    if (!headings.length) return;

    var links = [];
    headings.forEach(function (h2, i) {
      // Assign IDs if missing
      if (!h2.id) {
        h2.id = 'toc-heading-' + i;
      }
      var a = document.createElement('a');
      a.href = '#' + h2.id;
      a.textContent = h2.textContent;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.getElementById(h2.id);
        if (target) {
          var offset = 100;
          var top = target.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      });
      tocNav.appendChild(a);
      links.push({ el: h2, link: a });
    });

    // Active link on scroll (IntersectionObserver)
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = links.find(function (l) { return l.el === entry.target; });
        if (link) {
          link.link.classList.toggle('active', entry.isIntersecting);
        }
      });
    }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

    links.forEach(function (l) { observer.observe(l.el); });
  }

  // ════════════════════════════════════════
  //  READING PROGRESS BAR
  // ════════════════════════════════════════
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

  // ════════════════════════════════════════
  //  SIDEBAR SHARE — appear after scrolling past hero
  // ════════════════════════════════════════
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

  // ════════════════════════════════════════
  //  SHARE BUTTONS — all zones
  // ════════════════════════════════════════
  function initShareButtons() {
    var url   = encodeURIComponent(window.location.href);
    var title = encodeURIComponent(document.title);

    document.querySelectorAll('.art-share-btn').forEach(function (btn) {
      if (btn.classList.contains('art-share-btn--copy')) {
        // Copy link behaviour
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          navigator.clipboard.writeText(window.location.href).then(function () {
            btn.classList.add('copied');
            var icon = btn.querySelector('i');
            var originalClass = icon ? icon.className : '';
            var originalHTML  = btn.innerHTML;
            if (icon) icon.className = 'fi fi-rr-check';
            setTimeout(function () {
              btn.classList.remove('copied');
              if (icon) icon.className = originalClass;
            }, 2200);
          }).catch(function () {
            // Fallback for older browsers
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

        if (shareUrl !== '#') {
          window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
        }
      });
    });
  }

  // ════════════════════════════════════════
  //  REACTION BUTTONS
  // ════════════════════════════════════════
  function initReactions() {
    var STORAGE_KEY = 'cf_article_reactions_featured';

    function getReacted() {
      try { return localStorage.getItem(STORAGE_KEY) || ''; }
      catch (e) { return ''; }
    }

    function saveReacted(type) {
      try { localStorage.setItem(STORAGE_KEY, type); }
      catch (e) {}
    }

    var reacted = getReacted();

    document.querySelectorAll('.reaction-btn').forEach(function (btn) {
      var type = btn.getAttribute('data-reaction');

      if (reacted === type) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', function () {
        if (reacted && reacted !== type) return; // already reacted

        var countEl = btn.querySelector('.reaction-btn__count');
        var current = parseInt(countEl.textContent.replace(/,/g, ''), 10) || 0;

        if (btn.classList.contains('active')) {
          // Un-react
          btn.classList.remove('active');
          countEl.textContent = formatCount(Math.max(0, current - 1));
          reacted = '';
          saveReacted('');
        } else {
          // React
          btn.classList.add('active');
          countEl.textContent = formatCount(current + 1);
          reacted = type;
          saveReacted(type);
        }
      });
    });
  }

  // ════════════════════════════════════════
  //  NEWSLETTER — article bottom form
  // ════════════════════════════════════════
  function initNewsletterForm() {
    var form  = document.getElementById('article-nl-form');
    var email = document.getElementById('article-nl-email');
    if (!form || !email) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var val = email.value.trim();
      if (!val || !val.includes('@')) return;

      var btn          = form.querySelector('button');
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
          email.value = '';
          if (btn) {
            btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!';
            setTimeout(function () {
              btn.disabled = false;
              btn.innerHTML = originalHTML;
            }, 4000);
          }
          // Show global popup if it exists
          var popup = document.getElementById('newsletter-popup');
          if (popup) {
            popup.classList.add('show');
            setTimeout(function () { popup.classList.remove('show'); }, 8000);
            var closeBtn = document.getElementById('popup-close-btn');
            if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
          }
        } else {
          if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
        }
      } catch (err) {
        if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
        console.error('Newsletter error:', err);
      }
    });
  }

  // ════════════════════════════════════════
  //  FOOTER NEWSLETTER
  // ════════════════════════════════════════
  function initFooterNewsletter() {
    var form  = document.getElementById('newsletter-form-footer');
    var email = document.getElementById('newsletter-email-footer');
    if (!form || !email) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var val = email.value.trim();
      if (!val || !val.includes('@')) return;

      var btn          = form.querySelector('button');
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
          email.value = '';
          var popup = document.getElementById('newsletter-popup');
          if (popup) {
            popup.classList.add('show');
            setTimeout(function () { popup.classList.remove('show'); }, 8000);
            var closeBtn = document.getElementById('popup-close-btn');
            if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
      }
    });
  }

  // ════════════════════════════════════════
  //  HERO PARALLAX (subtle, desktop only)
  // ════════════════════════════════════════
  function initHeroParallax() {
    var heroImg = document.getElementById('hero-image');
    if (!heroImg || window.innerWidth < 768) return;

    window.addEventListener('scroll', function () {
      var scrollY  = window.scrollY;
      var heroH    = document.getElementById('article-hero').offsetHeight;
      if (scrollY > heroH) return;
      var offset   = scrollY * 0.30;
      heroImg.style.transform = 'scale(1.04) translateY(' + offset + 'px)';
    }, { passive: true });
  }

  // ════════════════════════════════════════
  //  SCROLL REVEAL for sections
  // ════════════════════════════════════════
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
          entry.target.style.opacity    = '1';
          entry.target.style.transform  = 'translateY(0)';
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

  // ════════════════════════════════════════
  //  HELPERS
  // ════════════════════════════════════════
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setAttr(id, attr, value) {
    var el = document.getElementById(id);
    if (el) el.setAttribute(attr, value);
  }

  function slugify(str) {
    return (str || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function formatCount(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return n.toString();
  }

  // ════════════════════════════════════════
  //  INIT ALL NON-JSON-DEPENDENT FEATURES
  // ════════════════════════════════════════
  initProgressBar();
  initSidebarShare();
  initReactions();
  initNewsletterForm();
  initFooterNewsletter();
  initHeroParallax();

  // TOC and scroll reveal run after a small delay so the DOM is fully painted
  setTimeout(function () {
    buildTOC();
    initScrollReveal();
  }, 120);

});