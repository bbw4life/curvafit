// FAQ Category Filtering
document.addEventListener('DOMContentLoaded', () => {
    const filterButtons = document.querySelectorAll('.filters button');
    const faqCategories = document.querySelectorAll('.faq-category');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.getAttribute('data-category');

            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active to clicked button
            button.classList.add('active');

            // Show/hide categories
            faqCategories.forEach(section => {
                if (category === 'all' || section.getAttribute('data-category') === category) {
                    section.classList.add('visible');
                } else {
                    section.classList.remove('visible');
                }
            });
        });
    });

    // Optional: Initialize all visible or trigger default
    document.querySelector('.filters button.active')?.click();
});



/* ================================================================
   CURVAFIT BLOG — blog.js
   Complete JS for blog.html
================================================================ */

document.addEventListener('DOMContentLoaded', function () {

  // ════════════════════════════════════════
  //  CATEGORY FILTERING
  // ════════════════════════════════════════
  const filterButtons = document.querySelectorAll('.category-filters button');
  const blogCards     = document.querySelectorAll('.blog-card');
  const noResults     = document.getElementById('blog-no-results');

  function applyFilter(category) {
    let visibleCount = 0;
    blogCards.forEach(function (card) {
      const match = category === 'all' || card.getAttribute('data-category') === category;
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
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes blogCardIn {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(styleEl);

  // Init with 'All'
  const activeBtn = document.querySelector('.category-filters button.active');
  if (activeBtn) applyFilter(activeBtn.getAttribute('data-category'));

  // ════════════════════════════════════════
  //  RESET FILTERS (called by no-results button)
  // ════════════════════════════════════════
  window.resetBlogFilters = function () {
    filterButtons.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-category') === 'all');
    });
    applyFilter('all');
    const searchInput = document.getElementById('blog-search-input');
    if (searchInput) searchInput.value = '';
  };

  // ════════════════════════════════════════
  //  LIVE SEARCH
  // ════════════════════════════════════════
  const searchInput = document.getElementById('blog-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      const query = this.value.trim().toLowerCase();
      let visibleCount = 0;

      // Reset category filters
      filterButtons.forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-category') === 'all');
      });

      blogCards.forEach(function (card) {
        const title   = (card.querySelector('h3') || {}).textContent || '';
        const text    = (card.querySelector('p') || {}).textContent  || '';
        const cat     = card.getAttribute('data-category') || '';
        const author  = (card.querySelector('.card-author span') || {}).textContent || '';
        const combined = (title + text + cat + author).toLowerCase();

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

    // Search button click
    const searchBtn = document.querySelector('.search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', function () {
        searchInput.dispatchEvent(new Event('input'));
      });
    }
  }

  // ════════════════════════════════════════
  //  STATS COUNTER ANIMATION
  // ════════════════════════════════════════
  function animateCounter(el, target, duration) {
    var start = 0;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      var current = Math.floor(eased * target);
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

  // ════════════════════════════════════════
  //  POPULAR CAROUSEL — arrows + dots
  // ════════════════════════════════════════
  var carousel = document.getElementById('popular-carousel');
  var prevBtn  = document.getElementById('pop-prev');
  var nextBtn  = document.getElementById('pop-next');
  var dots     = document.querySelectorAll('.pop-dot');

  if (carousel) {
    var cardWidth = 0;

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

    // Auto-scroll every 5 seconds
    var autoTimer = setInterval(function () {
      var maxScroll = carousel.scrollWidth - carousel.clientWidth;
      if (carousel.scrollLeft >= maxScroll - 5) {
        carousel.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        carousel.scrollBy({ left: getCardWidth(), behavior: 'smooth' });
      }
      setTimeout(updateDots, 350);
    }, 5000);

    // Pause on hover
    carousel.addEventListener('mouseenter', function () { clearInterval(autoTimer); });
    carousel.parentElement.addEventListener('mouseenter', function () { clearInterval(autoTimer); });
  }

  // ════════════════════════════════════════
  //  BOOKMARK TOGGLE
  // ════════════════════════════════════════
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
    var card  = btn.closest('.blog-card');
    var title = card ? (card.querySelector('h3') || {}).textContent : '';
    var bookmarks = getBookmarks();

    // Mark if already saved
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

  // ════════════════════════════════════════
  //  NEWSLETTER — Mid-page form
  //  Uses same Netlify function as footer form
  // ════════════════════════════════════════
  var nlForm = document.querySelector('#blog-newsletter #newsletter-form');
  var nlEmail = document.querySelector('#blog-newsletter #newsletter-email');

  if (nlForm && nlEmail) {
    nlForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = nlEmail.value.trim();
      if (!email || !email.includes('@')) return;

      var btn = nlForm.querySelector('.blog-nl-btn');
      var originalHTML = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...';
      }

      try {
        var res = await fetch('/.netlify/functions/save-account', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action: 'newsletter-subscribe', email: email })
        });
        var data = await res.json();

        if (data.success) {
          // Show success popup (same as footer)
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
              btn.disabled = false;
              btn.innerHTML = originalHTML;
            }, 4000);
          }
        } else {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
          }
        }
      } catch (err) {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = originalHTML;
        }
        console.error('Newsletter error:', err);
      }
    });
  }

  // ════════════════════════════════════════
  //  FOOTER NEWSLETTER (duplicate form handling)
  // ════════════════════════════════════════
  var footerNlForm  = document.getElementById('newsletter-form-footer');
  var footerNlEmail = document.getElementById('newsletter-email-footer');

  if (footerNlForm && footerNlEmail) {
    footerNlForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = footerNlEmail.value.trim();
      if (!email || !email.includes('@')) return;

      var btn = footerNlForm.querySelector('button');
      var originalText = btn ? btn.textContent : '';
      if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

      try {
        var res = await fetch('/.netlify/functions/save-account', {
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

  // ════════════════════════════════════════
//  SHARE BUTTONS (featured + cards)
// ════════════════════════════════════════
document.querySelectorAll('.share-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
        e.preventDefault();

        // Pour les cards, utilise l'URL de l'article (href du card-read-more)
        var card = btn.closest('.blog-card');
        var rawUrl = card
            ? (card.querySelector('.card-read-more') || {}).href || window.location.href
            : window.location.href;

        var url   = encodeURIComponent(rawUrl);
        var title = encodeURIComponent(
            card
                ? (card.querySelector('h3') || {}).textContent || document.title
                : document.title
        );

        var icon = btn.querySelector('i');
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

});



// ====================== CONTACT FORM (CORRIGÉ) ======================
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) {
        console.warn("⚠️ Contact form non trouvé (id='contact-form'). Vérifie que tu es bien sur contact.html");
        return;
    }

    console.log("✅ Contact form détecté – listener attaché");

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("🚀 Submit déclenché !");

        const formData = new FormData(contactForm);
        const data = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            subject: formData.get('subject'),
            message: formData.get('message')
        };

        const submitBtn = contactForm.querySelector('button[type="submit"]') || contactForm.querySelector('button');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Sending...";
        submitBtn.disabled = true;

        try {
            const res = await fetch('/.netlify/functions/save-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();
            console.log("Réponse serveur :", result);

            if (result.success) {
                const popup = document.getElementById('contact-success-popup');
                if (popup) {
                    popup.classList.add('show');
                    setTimeout(() => popup.classList.remove('show'), 8000);
                }
                document.getElementById('contact-popup-close').onclick = () => {
                    popup.classList.remove('show');
                };
                contactForm.reset();
                console.log("✅ Message enregistré avec succès !");
            } else {
                showErrorPopup("Error: " + (result.error || "Unknown"));
            }
        } catch (err) {
            console.error("❌ Erreur fetch :", err);
            showErrorPopup("Network error. Please try again.");
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
});



/* ================================================================
   FAQ SMART SEARCH — à ajouter dans page.js
================================================================ */

(function () {

    const searchInput = document.getElementById('faq-search-input');
    if (!searchInput) return;

    // Désactiver l'autocomplete du browser
    searchInput.setAttribute('autocomplete', 'off');

    let faqData = [];
    let selectedIndex = -1;
    let dropdown = null;

    // ── Créer le dropdown (attaché au body pour position:fixed) ──
    function createDropdown() {
        // Supprimer s'il existe déjà pour éviter le double
        var existing = document.getElementById('faq-suggestions-dropdown');
        if (existing) existing.remove();

        dropdown = document.createElement('div');
        dropdown.id = 'faq-suggestions-dropdown';
        dropdown.setAttribute('role', 'listbox');
        document.body.appendChild(dropdown);
    }

    // ── Repositionner le dropdown sous la barre de recherche ──
    function repositionDropdown() {
        if (!dropdown) return;
        var rect = searchInput.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + 8) + 'px';
    }

    // ── Charger faq-data.json ──
    fetch('faq-data.json')
        .then(function (res) { return res.json(); })
        .then(function (data) {
            faqData = data;
            createDropdown();
            bindEvents();
        })
        .catch(function () {
            console.warn('CurvaFit FAQ: faq-data.json introuvable, smart search désactivé.');
        });

    // ── Filtrer ──
    function filterData(query) {
        if (!query || query.length < 2) return [];
        var q = query.toLowerCase();
        return faqData.filter(function (item) {
            return item.question.toLowerCase().includes(q) ||
                   item.category.toLowerCase().includes(q);
        }).slice(0, 7);
    }

    // ── Highlight du mot cherché ──
    function highlight(text, query) {
        if (!query) return text;
        var regex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    // ── Afficher les suggestions ──
    function showSuggestions(results, query) {
        dropdown.innerHTML = '';
        selectedIndex = -1;

        if (results.length === 0) {
            dropdown.classList.remove('faq-dd--open');
            return;
        }

        results.forEach(function (item, index) {
            var li = document.createElement('div');
            li.className = 'faq-dd-item';
            li.setAttribute('role', 'option');
            li.setAttribute('data-index', index);
            li.setAttribute('data-section', item.section);
            li.setAttribute('data-id', item.id);

            li.innerHTML =
                '<span class="faq-dd-cat">' + item.category + '</span>' +
                '<span class="faq-dd-text">' + highlight(item.question, query) + '</span>' +
                '<span class="faq-dd-arrow">↓</span>';

            li.addEventListener('mousedown', function (e) {
                e.preventDefault();
                goToQuestion(item);
            });

            dropdown.appendChild(li);
        });

        repositionDropdown();
        dropdown.classList.add('faq-dd--open');
    }

    // ── Fermer le dropdown ──
    function closeDropdown() {
        if (dropdown) {
            dropdown.classList.remove('faq-dd--open');
            selectedIndex = -1;
        }
    }

    // ── Aller vers la question ──
    function goToQuestion(item) {
        closeDropdown();
        searchInput.value = item.question;

        var section = document.getElementById(item.section);
        if (!section) return;

        var accordionItems = section.querySelectorAll('.accordion-item');
        var targetItem = null;

        // Trouver l'item exact par texte
        accordionItems.forEach(function (acc) {
            var btn = acc.querySelector('.accordion-header');
            if (btn && btn.textContent.trim().toLowerCase().includes(
                item.question.toLowerCase().substring(0, 35)
            )) {
                targetItem = acc;
            }
        });

        // Fallback : trouver par position dans le JSON
        if (!targetItem && accordionItems.length > 0) {
            var sectionItems = faqData.filter(function (d) { return d.section === item.section; });
            var idx = sectionItems.findIndex(function (d) { return d.id === item.id; });
            targetItem = accordionItems[idx] || accordionItems[0];
        }

        if (targetItem) {
            // Fermer les autres accordions ouverts dans la section
            section.querySelectorAll('.accordion-item.active').forEach(function (a) {
                a.classList.remove('active');
                var content = a.querySelector('.accordion-content');
                if (content) content.style.display = 'none';
            });

            // Ouvrir la cible
            targetItem.classList.add('active');
            var content = targetItem.querySelector('.accordion-content');
            if (content) content.style.display = 'block';

            // Scroll avec offset header sticky
            setTimeout(function () {
                var offset = 130;
                var top = targetItem.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top: top, behavior: 'smooth' });

                // Effet visuel de highlight
                targetItem.classList.add('faq-item--highlight');
                setTimeout(function () {
                    targetItem.classList.remove('faq-item--highlight');
                }, 2000);
            }, 100);
        }
    }

    // ── Navigation clavier ──
    function navigateDropdown(direction) {
        var items = dropdown.querySelectorAll('.faq-dd-item');
        if (!items.length) return;

        if (selectedIndex >= 0) {
            items[selectedIndex].classList.remove('faq-dd-item--active');
        }

        selectedIndex += direction;
        if (selectedIndex < 0) selectedIndex = items.length - 1;
        if (selectedIndex >= items.length) selectedIndex = 0;

        items[selectedIndex].classList.add('faq-dd-item--active');
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }

    // ── Lier les events ──
    function bindEvents() {

        // Frappe dans la barre
        searchInput.addEventListener('input', function () {
            var query = this.value.trim();
            var results = filterData(query);
            showSuggestions(results, query);

            var clearBtn = document.getElementById('faq-search-clear');
            if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';
        });

        // Recalculer la position si scroll ou resize
        window.addEventListener('scroll', function () {
            if (dropdown && dropdown.classList.contains('faq-dd--open')) {
                repositionDropdown();
            }
        }, { passive: true });

        window.addEventListener('resize', function () {
            if (dropdown && dropdown.classList.contains('faq-dd--open')) {
                repositionDropdown();
            }
        });

        // Clavier
        searchInput.addEventListener('keydown', function (e) {
            if (!dropdown.classList.contains('faq-dd--open')) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateDropdown(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateDropdown(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0) {
                    var items = dropdown.querySelectorAll('.faq-dd-item');
                    if (items[selectedIndex]) {
                        var id = items[selectedIndex].getAttribute('data-id');
                        var item = faqData.find(function (d) { return d.id === id; });
                        if (item) goToQuestion(item);
                    }
                }
            } else if (e.key === 'Escape') {
                closeDropdown();
            }
        });

        // Fermer au clic ailleurs
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#faq-search-input') &&
                !e.target.closest('#faq-suggestions-dropdown')) {
                closeDropdown();
            }
        });

        // Bouton clear
        var clearBtn = document.getElementById('faq-search-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                searchInput.value = '';
                this.style.display = 'none';
                closeDropdown();
                var countEl = document.getElementById('faq-search-count');
                if (countEl) countEl.style.display = 'none';
                document.querySelectorAll('.accordion-item').forEach(function (i) {
                    i.style.display = '';
                });
                document.querySelectorAll('.faq-category').forEach(function (c) {
                    c.style.display = '';
                });
            });
        }
    }

})();