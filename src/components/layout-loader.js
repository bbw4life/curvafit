(function () {
  'use strict';

  // ── Cache localStorage de secours pour les fragments HTML ──
  // Le cache sert immédiatement de secours visuel, mais chaque chargement
  // vérifie toujours la version réseau pour afficher rapidement les mises à jour.
  var CACHE_VERSION = 'v7';
  var CACHE_PREFIX = 'bbw_layout_cache_' + CACHE_VERSION + '_';

  function cacheKey(url) { return CACHE_PREFIX + url; }

  function readCache(url) {
    try {
      var raw = localStorage.getItem(cacheKey(url));
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (!entry || typeof entry.html !== 'string') return null;
      return entry;
    } catch (e) { return null; }
  }

  function writeCache(url, html) {
    try {
      localStorage.setItem(cacheKey(url), JSON.stringify({ html: html, ts: Date.now() }));
    } catch (e) { /* quota dépassé ou storage indisponible — pas bloquant */ }
  }

  /**
   * Charge un fragment HTML dans un container.
   * - Le cache local s'affiche immédiatement s'il existe, pour éviter un flash.
   * - Une requête sans cache navigateur vérifie toujours le fragment réseau.
   * - Le HTML réseau remplace le cache dès qu'il diffère.
   * @param {string} url
   * @param {string} containerId
   * @param {(html: string) => void} onInject - reçoit le HTML injecté (pour poser des <script> après coup, dispatch d'event, etc.)
   */
  function loadFragment(url, containerId, onInject) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var cached = readCache(url);
    var injectedFromCache = false;

    if (cached) {
      container.innerHTML = cached.html;
      injectedFromCache = true;
      if (onInject) onInject(cached.html);
    }

    fetch(url, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (html) {
        writeCache(url, html);
        // Si rien n'était affiché (pas de cache), ou si le contenu réseau
        // diffère du cache déjà affiché, on (ré)injecte.
        if (!injectedFromCache || html !== cached.html) {
          container.innerHTML = html;
          if (onInject) onInject(html);
        }
      })
      .catch(function (err) {
        console.error('[layout-loader] ' + url + ' load error:', err);
      });
  }

  function appendScript(src) {
    var s = document.createElement('script');
    s.src = src;
    document.body.appendChild(s);
  }

  function loadCurvafitPicksCheckout() {
    if (!document.getElementById('bbw-quiz-overlay')) return;
    var cssHref = '/products/paypal-shipping-modal.css?v=curvafit-picks-checkout-1';
    if (!Array.prototype.some.call(document.querySelectorAll('link[rel="stylesheet"]'), function (link) { return link.href.indexOf('/products/paypal-shipping-modal.css') >= 0; })) {
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = cssHref;
      document.head.appendChild(css);
    }
    if (!Array.prototype.some.call(document.scripts, function (script) { return script.src.indexOf('/products/paypal-shipping-modal.js') >= 0; })) {
      appendScript('/products/paypal-shipping-modal.js?v=curvafit-picks-checkout-1');
    }
  }

  // ── Header ──
  // loadFragment peut appeler ce callback deux fois (injection immédiate
  // depuis un cache périmé, puis re-injection après revalidation réseau
  // si le HTML a changé) — ne charger header.js qu'une seule fois évite
  // deux IIFE initTelegramDrawerButton() concurrents : le second remplace
  // le bouton du DOM (innerHTML) mais le premier script, déjà chargé,
  // ne re-scanne jamais ce nouveau bouton, qui reste alors sans href
  // résolu ni listener tant qu'aucun clic ne se produit (bouton "mort").
  var headerScriptLoaded = false;
  loadFragment('/src/components/header.html?v=nav-submenus-1', 'header-container', function () {
    if (headerScriptLoaded) {
      // Le DOM du header vient d'être remplacé (revalidation réseau après
      // un cache périmé) : le script header.js déjà chargé n'a écouté que
      // le premier bouton Telegram, désormais orphelin — ce signal lui
      // permet de re-scanner le nouveau bouton et d'y rattacher son
      // listener (cf. initTelegramDrawerButton dans header.js).
      document.dispatchEvent(new Event('header:reinjected'));
      return;
    }
    headerScriptLoaded = true;
    appendScript('/src/components/header.js?v=nav-submenus-1');
  });

  // ── Breadcrumb (outerHTML : remplace le placeholder par le vrai <nav>) ──
  (function loadBreadcrumb() {
    var container = document.getElementById('breadcrumb-container');
    if (!container) return;
    var url = '/src/components/breadcrumb.html';
    var cached = readCache(url);

    if (cached) {
      container.outerHTML = cached.html;
    }

    fetch(url, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (html) {
        writeCache(url, html);
        // outerHTML ne peut être réappliqué qu'une fois : si déjà remplacé
        // par le cache, on ne retouche le DOM que si le contenu a changé,
        // en ciblant à nouveau via un sélecteur qui survit au remplacement.
        if (!cached) {
          container.outerHTML = html;
        } else if (html !== cached.html) {
          var currentBreadcrumb = document.getElementById('bc-nav');
          if (currentBreadcrumb) currentBreadcrumb.outerHTML = html;
          else container.outerHTML = html;
        }
      })
      .catch(function (err) {
        console.error('[layout-loader] breadcrumb load error:', err);
      });
  })();

  // ── Footer ──
  // Même garde que le header ci-dessus : loadFragment peut appeler ce
  // callback deux fois (injection immédiate depuis un cache périmé, puis
  // re-injection après revalidation réseau si le HTML a changé) — charger
  // footer.js deux fois créerait deux jeux de listeners/IIFE concurrents
  // sur le nouveau DOM du footer.
  var footerScriptLoaded = false;
  loadFragment('/src/components/footer.html?v=curvafit-picks-2', 'footer-container', function () {
    document.dispatchEvent(new Event('footer:loaded'));
    loadCurvafitPicksCheckout();
    if (footerScriptLoaded) return;
    footerScriptLoaded = true;
    appendScript('/src/components/footer.js?v=curvafit-picks-2');
  });

  // ── Newsletter ──
  loadFragment('/src/components/newsletter.html?v=curvafit-newsletter-2', 'newsletter-container');
})();
