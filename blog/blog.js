/* ================================================================
   BBW4LIFE BLOG — blog.js
   Injection depuis blog-articles.json + toutes les fonctions blog
================================================================ */

// Fetch partagé de blog-articles.json (reutilise la meme promesse entre
// blog.js / articles.js / blog-search.js pour eviter les requetes en double)
window.bbwFetchBlogArticles = window.bbwFetchBlogArticles || function () {
  if (!window.__bbwBlogArticlesPromise) {
    window.__bbwBlogArticlesPromise = fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); });
  }
  return window.__bbwBlogArticlesPromise;
};

document.addEventListener('DOMContentLoaded', function () {

  // ════════════════════════════════════════
  //  HELPERS SHARE BUTTONS (réutilisé après injection)
  // ════════════════════════════════════════
  function shareButtonsHTML() {
    return `
      <div class="card-share-row">
        <span class="card-share-label">Share:</span>
        <a href="#" class="share-btn card-share-btn" aria-label="Share on Facebook"><i class="fab fa-facebook-f"></i></a>
        <a href="#" class="share-btn card-share-btn" aria-label="Share on X / Twitter"><i class="fab fa-x-twitter"></i></a>
        <a href="#" class="share-btn card-share-btn" aria-label="Share on Pinterest"><i class="fab fa-pinterest-p"></i></a>
        <a href="#" class="share-btn card-share-btn" aria-label="Share on LinkedIn"><i class="fab fa-linkedin-in"></i></a>
        <a href="#" class="share-btn card-share-btn" aria-label="Share on WhatsApp"><i class="fab fa-whatsapp"></i></a>
        <button type="button" class="share-btn card-share-btn" data-native-share aria-label="Share article" title="Share article"><i class="fas fa-share-alt" aria-hidden="true"></i></button>
      </div>`;
  }

  // ════════════════════════════════════════
  //  INJECTION DEPUIS blog-articles.json
  // ════════════════════════════════════════
  window.bbwFetchBlogArticles()
    .then(function (data) {

      // News ticker content comes from the same source as the article cards.
      var tickerInner = document.querySelector('.blog-ticker .ticker-inner');
      if (tickerInner && Array.isArray(data.cards) && data.cards.length) {
        var tickerItems = data.cards.map(function (card) {
          return `
            <span class="ticker-item">
              ${card.isNew ? '<span class="ticker-new-pill">new</span>' : ''}
              <span class="ticker-item-title">${card.title || ''}</span>
              <span class="ticker-item-meta">${card.readTime || ''} read</span>
            </span>
            <span class="ticker-sep" aria-hidden="true"></span>`;
        }).join('');

        // The duplicate lets the existing -50% animation loop seamlessly.
        tickerInner.innerHTML = tickerItems + tickerItems;
      }

      // ── FEATURED ──────────────────────────────────────────────
      var gridContainer = document.getElementById('blog-grid-container');
      if (gridContainer && data.cards) {
        gridContainer.innerHTML = data.cards.map(function (card) {
          return `
            <article class="blog-card" data-category="${card.category}" id="${card.id}">
              <div class="blog-card-img-wrap">
                <a href="${card.url}" class="card-img-link"><img src="${card.image}" alt="${card.imageAlt}" loading="lazy"></a>
                <span class="card-category-badge">${card.badge}</span>
                ${card.isNew ? '<span class="card-new-badge">New</span>' : ''}
                <button class="card-bookmark" aria-label="Bookmark article" title="Save article"><i class="fi fi-rr-bookmark"></i></button>
                <div class="card-read-time"><i class="fi fi-rr-clock"></i> ${card.readTime}</div>
              </div>
              <div class="blog-card-body">
                <h3>${card.title}</h3>
                <p class="card-excerpt">${card.excerpt}</p>
                <button type="button" class="card-excerpt-toggle" aria-expanded="false">Read more</button>
                <div class="blog-card-meta">
                  <div class="card-author">
                    <img src="${card.author.image}" alt="${card.author.name}" class="card-author-img">
                    <span>${card.author.name}</span>
                  </div>
                  <div class="card-stats">
                    <span><i class="fi fi-rr-eye"></i> ${card.views}</span>
                    <span class="card-date">${card.date}</span>
                  </div>
                </div>
                <a href="${card.url}" class="card-read-more">Read Article <span>→</span></a>
                ${shareButtonsHTML()}
              </div>
            </article>`;
        }).join('');
      }

      // ── POPULAR CAROUSEL ───────────────────────────────────────
      var popularCarousel = document.getElementById('popular-carousel');
      var popularDots     = document.getElementById('popular-dots');
      if (popularCarousel && data.popular) {
        popularCarousel.innerHTML = data.popular.map(function (item) {
          return `
            <div class="popular-item">
              <div class="popular-img-wrap">
                <a href="${item.url}" class="card-img-link"><img src="${item.image}" alt="${item.imageAlt}"></a>
                <span class="popular-rank">${item.rank}</span>
              </div>
              <div class="popular-body">
                <span class="popular-cat">${item.category}</span>
                <h3>${item.title}</h3>
                <div class="popular-meta">
                  <span><i class="fi fi-rr-eye"></i> ${item.views} reads</span>
                  <span><i class="fi fi-rr-clock"></i> ${item.readTime}</span>
                </div>
                <a href="${item.url}" class="popular-link">Read Now →</a>
                ${shareButtonsHTML()}
              </div>
            </div>`;
        }).join('');

        // Générer les dots dynamiquement selon le nombre d'items
        if (popularDots) {
          popularDots.innerHTML = data.popular.map(function (_, i) {
            return `<span class="pop-dot${i === 0 ? ' active' : ''}" data-idx="${i}"></span>`;
          }).join('');
        }
      }

      // ── HOME JOURNAL CARDS ──────────────────────────────────────
      var homeJournal = document.getElementById('comm-blog-scroller');
      if (homeJournal && Array.isArray(data.cards) && Array.isArray(data.popular)) {
        var homeCards = data.popular.slice(0, 4).map(function (item) {
          return data.cards.find(function (card) { return card.url === item.url; });
        }).filter(Boolean);

        homeJournal.innerHTML = homeCards.map(function (card) {
          return `
            <article class="blog-card comm-journal-card">
              <div class="blog-card-img-wrap">
                <a href="${card.url}" class="card-img-link">
                  <img src="${card.image}" alt="${card.imageAlt}" loading="lazy">
                </a>
                <span class="card-category-badge">${card.badge}</span>
                <div class="card-read-time"><i class="fi fi-rr-clock"></i> ${card.readTime}</div>
              </div>
              <div class="blog-card-body">
                <h3>${card.title}</h3>
                <p class="card-excerpt">${card.excerpt}</p>
                <div class="blog-card-meta">
                  <div class="card-author">
                    <img src="${card.author.image}" alt="" class="card-author-img" loading="lazy">
                    <span>${card.author.name}</span>
                  </div>
                  <div class="card-stats">
                    <span><i class="fi fi-rr-eye"></i> ${card.views}</span>
                    <span class="card-date">${card.date}</span>
                  </div>
                </div>
                <a href="${card.url}" class="card-read-more">Read Article <span>→</span></a>
              </div>
            </article>`;
        }).join('');
      }

      // ── AUTHORS ────────────────────────────────────────────────
      var statsContainer = document.getElementById('blog-stats-container');
      if (statsContainer && data.stats) {
        statsContainer.innerHTML = data.stats.map(function (stat, i) {
          return `
            ${i > 0 ? '<div class="blog-stat-divider"></div>' : ''}
            <div class="blog-stat-item">
              <span class="blog-stat-icon"><i class="${stat.icon}"></i></span>
              <div>
                <strong class="blog-stat-num" data-target="${stat.target}">0</strong>${stat.suffix ? `<span class="blog-stat-suffix">${stat.suffix}</span>` : ''}
                <span class="blog-stat-label">${stat.label}</span>
              </div>
            </div>`;
        }).join('');
      }

      // Après injection, on initialise toutes les fonctions qui dépendent du DOM
      initBlog();

    })
    .catch(function (err) {
      console.error('Erreur chargement blog-articles.json :', err);
    });

  // ════════════════════════════════════════
  //  INIT — appelé après injection JSON
  // ════════════════════════════════════════
  function initBlog() {

    // Expand or collapse each article excerpt after its first three lines.
    document.querySelectorAll('.card-excerpt-toggle').forEach(function (button) {
      button.addEventListener('click', function () {
        var excerpt = button.previousElementSibling;
        var isExpanded = excerpt.classList.toggle('is-expanded');
        button.setAttribute('aria-expanded', String(isExpanded));
        button.textContent = isExpanded ? 'Read less' : 'Read more';
      });
    });

    // ── CATEGORY FILTERING ──────────────────────────────────────
    var filterButtons = document.querySelectorAll('.category-filters button');
    var blogCards     = document.querySelectorAll('.blog-card');
    var noResults     = document.getElementById('blog-no-results');

    function applyFilter(category) {
      var visibleCount = 0;
      blogCards.forEach(function (card) {
        var match = category === 'all' || card.getAttribute('data-category') === category;
        if (match) {
          card.style.display = '';
          card.style.animation = 'none';
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              card.style.animation = 'blogCardIn 0.35s ease both';
            });
          });
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });
      if (noResults) {
        noResults.style.display = visibleCount === 0 ? 'block' : 'none';
      }
    }

    filterButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterButtons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        applyFilter(btn.getAttribute('data-category'));
      });
    });

    // Inject card-in animation
    var styleEl = document.createElement('style');
    styleEl.textContent = `
      @keyframes blogCardIn {
        from { opacity: 0; transform: translateY(18px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(styleEl);

    var activeBtn = document.querySelector('.category-filters button.active');
    if (activeBtn) applyFilter(activeBtn.getAttribute('data-category'));

    // ── RESET FILTERS ───────────────────────────────────────────
    window.resetBlogFilters = function () {
      filterButtons.forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-category') === 'all');
      });
      applyFilter('all');
      var searchInput = document.getElementById('blog-search-input');
      if (searchInput) searchInput.value = '';
    };

    // ── LIVE SEARCH ─────────────────────────────────────────────
    var searchInput = document.getElementById('blog-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        var query = this.value.trim().toLowerCase();
        var visibleCount = 0;

        filterButtons.forEach(function (btn) {
          btn.classList.toggle('active', btn.getAttribute('data-category') === 'all');
        });

        blogCards.forEach(function (card) {
          var title    = (card.querySelector('h3') || {}).textContent || '';
          var text     = (card.querySelector('p') || {}).textContent  || '';
          var cat      = card.getAttribute('data-category') || '';
          var author   = (card.querySelector('.card-author span') || {}).textContent || '';
          var combined = (title + text + cat + author).toLowerCase();

          if (!query || combined.includes(query)) {
            card.style.display = '';
            visibleCount++;
          } else {
            card.style.display = 'none';
          }
        });

        if (noResults) {
          noResults.style.display = visibleCount === 0 ? 'block' : 'none';
        }
      });

      var searchBtn = document.querySelector('.search-btn');
      if (searchBtn) {
        searchBtn.addEventListener('click', function () {
          searchInput.dispatchEvent(new Event('input'));
        });
      }
    }

    // ── STATS COUNTER ANIMATION ─────────────────────────────────
    function animateCounter(el, target, duration) {
      var startTime = null;
      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        var eased    = 1 - Math.pow(1 - progress, 3);
        var current  = Math.floor(eased * target);
        el.textContent = current >= 1000
          ? (current / 1000).toFixed(current >= 10000 ? 0 : 1) + 'k'
          : current;
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = target >= 1000
          ? (target / 1000).toFixed(target >= 10000 ? 0 : 1) + 'k'
          : target;
      }
      requestAnimationFrame(step);
    }

    var statsBar = document.querySelector('.blog-stats-bar');
    if (statsBar) {
      var observed = false;
      var statsObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !observed) {
            observed = true;
            document.querySelectorAll('.blog-stat-num').forEach(function (el) {
              var target = parseInt(el.getAttribute('data-target') || '0', 10);
              animateCounter(el, target, 1800);
            });
          }
        });
      }, { threshold: 0.3 });
      statsObserver.observe(statsBar);
    }

    // ── POPULAR CAROUSEL — arrows + dots ────────────────────────
    var carousel = document.getElementById('popular-carousel');
    var prevBtn  = document.getElementById('pop-prev');
    var nextBtn  = document.getElementById('pop-next');
    var dots     = document.querySelectorAll('.pop-dot');

    if (carousel) {
      function getCardWidth() {
        var firstItem = carousel.querySelector('.popular-item');
        if (!firstItem) return 280;
        var gap = parseInt(getComputedStyle(carousel).gap || '20', 10);
        return firstItem.offsetWidth + gap;
      }

      function updateDots() {
        var idx = Math.round(carousel.scrollLeft / getCardWidth());
        dots.forEach(function (dot, i) {
          dot.classList.toggle('active', i === idx);
        });
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          carousel.scrollBy({ left: -getCardWidth(), behavior: 'smooth' });
          setTimeout(updateDots, 350);
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          carousel.scrollBy({ left: getCardWidth(), behavior: 'smooth' });
          setTimeout(updateDots, 350);
        });
      }

      carousel.addEventListener('scroll', function () {
        clearTimeout(carousel._scrollTimer);
        carousel._scrollTimer = setTimeout(updateDots, 80);
      }, { passive: true });

      dots.forEach(function (dot) {
        dot.addEventListener('click', function () {
          var idx = parseInt(dot.getAttribute('data-idx') || '0', 10);
          carousel.scrollTo({ left: idx * getCardWidth(), behavior: 'smooth' });
          setTimeout(updateDots, 350);
        });
      });

      // Auto-scroll toutes les 5 secondes
      var autoTimer = setInterval(function () {
        var maxScroll = carousel.scrollWidth - carousel.clientWidth;
        if (carousel.scrollLeft >= maxScroll - 5) {
          carousel.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          carousel.scrollBy({ left: getCardWidth(), behavior: 'smooth' });
        }
        setTimeout(updateDots, 350);
      }, 5000);

      carousel.addEventListener('mouseenter', function () { clearInterval(autoTimer); });
      carousel.parentElement.addEventListener('mouseenter', function () { clearInterval(autoTimer); });
    }

    // ── BOOKMARK TOGGLE ─────────────────────────────────────────
    var RV_BOOKMARKS = 'cf_blog_bookmarks';

    function getBookmarks() {
      try { return JSON.parse(localStorage.getItem(RV_BOOKMARKS) || '[]'); }
      catch (e) { return []; }
    }

    function saveBookmarks(arr) {
      try { localStorage.setItem(RV_BOOKMARKS, JSON.stringify(arr)); }
      catch (e) {}
    }

    document.querySelectorAll('.card-bookmark').forEach(function (btn) {
      var card      = btn.closest('.blog-card');
      var title     = card ? (card.querySelector('h3') || {}).textContent : '';
      var bookmarks = getBookmarks();

      if (title && bookmarks.includes(title)) {
        btn.classList.add('saved');
        btn.querySelector('i').className = 'fi fi-sr-bookmark';
        btn.setAttribute('title', 'Saved!');
      }

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var bks = getBookmarks();
        var idx = bks.indexOf(title);
        if (idx === -1) {
          bks.push(title);
          btn.classList.add('saved');
          btn.querySelector('i').className = 'fi fi-sr-bookmark';
          btn.setAttribute('title', 'Saved!');
        } else {
          bks.splice(idx, 1);
          btn.classList.remove('saved');
          btn.querySelector('i').className = 'fi fi-rr-bookmark';
          btn.setAttribute('title', 'Save article');
        }
        saveBookmarks(bks);
      });
    });

    // ── SHARE BUTTONS ────────────────────────────────────────────
    document.querySelectorAll('.share-btn').forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        e.preventDefault();

        var card   = btn.closest('.blog-card, .popular-item');
        var rawUrl = card
          ? ((card.querySelector('.card-read-more, .popular-link') || {}).href || window.location.href)
          : window.location.href;
        var heroTitle = document.getElementById('hero-title');
        var rawTitle = card
          ? ((card.querySelector('h3') || {}).textContent || document.title).trim()
          : ((heroTitle && heroTitle.textContent.trim()) || document.title);

        if (btn.hasAttribute('data-native-share')) {
          if (navigator.share) {
            try {
              await navigator.share({ title: rawTitle, url: rawUrl });
            } catch (error) {
              if (error.name !== 'AbortError') console.error('Web Share failed:', error);
            }
          } else if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
              await navigator.clipboard.writeText(rawUrl);
              btn.setAttribute('title', 'Link copied');
            } catch (error) {
              console.error('Could not copy article link:', error);
            }
          }
          return;
        }

        var url   = encodeURIComponent(rawUrl);
        var title = encodeURIComponent(rawTitle);

        var icon     = btn.querySelector('i');
        var shareUrl = '#';

        if (icon) {
          if (icon.classList.contains('fa-facebook-f')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (icon.classList.contains('fa-x-twitter')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          } else if (icon.classList.contains('fa-pinterest-p')) {
            shareUrl = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title;
          } else if (icon.classList.contains('fa-linkedin-in')) {
            shareUrl = 'https://www.linkedin.com/sharing/share-offsite/?url=' + url;
          } else if (icon.classList.contains('fa-whatsapp')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + ' ' + url;
          }
        }

        if (shareUrl !== '#') {
          window.open(shareUrl, '_blank', 'noopener,width=600,height=400');
        }
      });
    });

  } // fin initBlog()


  // ════════════════════════════════════════
  //  NEWSLETTER — Mid-page form
  // ════════════════════════════════════════
  var nlForm  = document.querySelector('#blog-newsletter #newsletter-form');
  var nlEmail = document.querySelector('#blog-newsletter #newsletter-email');

  if (nlForm && nlEmail) {
    nlForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = nlEmail.value.trim();
      if (!email || !email.includes('@')) return;

      var btn          = nlForm.querySelector('.blog-nl-btn');
      var originalHTML = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled  = true;
        btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...';
      }

      try {
        var res  = await fetch('/.netlify/functions/save-account', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action: 'newsletter-subscribe', email: email })
        });
        var data = await res.json();

        if (data.success) {
          var popup = document.getElementById('newsletter-popup');
          if (popup) {
            popup.classList.add('show');
            setTimeout(function () { popup.classList.remove('show'); }, 8000);
            var closePopupBtn = document.getElementById('popup-close-btn');
            if (closePopupBtn) closePopupBtn.onclick = function () { popup.classList.remove('show'); };
          }
          nlEmail.value = '';
          if (btn) {
            btn.innerHTML = '<i class="fi fi-rr-check"></i> Subscribed!';
            setTimeout(function () {
              btn.disabled  = false;
              btn.innerHTML = originalHTML;
            }, 4000);
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
  //  NEWSLETTER — Footer form
  // ════════════════════════════════════════
  var footerNlForm  = document.getElementById('newsletter-form-footer');
  var footerNlEmail = document.getElementById('newsletter-email-footer');

  if (footerNlForm && footerNlEmail) {
    footerNlForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = footerNlEmail.value.trim();
      if (!email || !email.includes('@')) return;

      var btn          = footerNlForm.querySelector('button');
      var originalText = btn ? btn.textContent : '';
      if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

      try {
        var res  = await fetch('/.netlify/functions/save-account', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action: 'newsletter-subscribe', email: email })
        });
        var data = await res.json();

        if (data.success) {
          var popup = document.getElementById('newsletter-popup');
          if (popup) {
            popup.classList.add('show');
            setTimeout(function () { popup.classList.remove('show'); }, 8000);
            var closeBtn = document.getElementById('popup-close-btn');
            if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
          }
          footerNlEmail.value = '';
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
      }
    });
  }

});

