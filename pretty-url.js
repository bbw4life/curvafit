(function () {
  var SLUGS = {
    // ── ACCOUNT ───────────────────────────────────────────
    '/account.html': '/bbw4life/my-account',

    // ── CART ──────────────────────────────────────────────
    '/cart.html': '/bbw4life/cart',

    // ── PRODUCTS ──────────────────────────────────────────
    '/products/product1.html': '/curvafit/gentle-walking-4-week-guide',
    '/products/product2.html': '/curvafit/simple-meal-planner-4-weeks-easy-meals-shopping-lists',
    '/products/product3.html': '/curvafit/move-at-home-gentle-workouts-no-equipment',
    '/products/product15.html': '/curvafit/back-on-track-14-day-restart-guide',
    // ── BLOG ARTICLES ─────────────────────────────────────
    '/blog/article-featured.html': '/bbw4life/journal/beauty-has-no-sizes-movement-redefining-beauty',
    '/blog/article1.html':  '/bbw4life/journal/stop-dieting-how-bbw-women-take-care-of-themselves',
    '/blog/article2.html':  '/bbw4life/journal/nutrition-curvy-women-eat-to-feel-amazing-not-to-shrink',
    '/blog/article3.html':  '/bbw4life/journal/7-body-positive-affirmations-that-change-how-you-see-yourself',
    '/blog/article4.html':  '/bbw4life/journal/stop-letting-opinions-destroy-your-body-confidence',
    '/blog/article5.html':  '/bbw4life/journal/pcos-plus-size-body-understanding-your-hormones',
    '/blog/article6.html':  '/bbw4life/journal/gentle-home-exercises-plus-size-women-move-without-injury',
    '/blog/article7.html':  '/bbw4life/journal/plus-size-fashion-2026-outfits-that-turn-heads',
    '/blog/article8.html':  '/bbw4life/journal/how-i-stopped-being-ashamed-of-my-body-and-started-loving-it',
    '/blog/article9.html':  '/bbw4life/journal/10-must-have-wardrobe-pieces-plus-size-women',
    '/blog/article10.html': '/bbw4life/journal/bbw-style-guide-dress-confidently-for-every-occasion',
    '/blog/article11.html': '/bbw4life/journal/plus-size-dresses-find-the-model-that-flatters-every-curve',
    '/blog/article12.html': '/bbw4life/journal/bbw-and-seduction-your-body-is-a-gift-not-an-obstacle',
    '/blog/article13.html': '/bbw4life/journal/how-to-dress-as-bbw-and-feel-beautiful-not-just-covered',
    '/blog/article14.html': '/bbw4life/journal/bbw-and-seduction-your-body-is-a-power-not-a-problem',
    '/blog/article15.html': '/bbw4life/journal/bbw4life-big-beautiful-woman-lifestyle-pride-family',
  };

  window.BBW_SLUGS = SLUGS;
  var path = window.location.pathname;
  var pretty = SLUGS[path];

  // ── Setting settings.use_pretty_urls (products.data.json) ──────────
  // "yes" (défaut) → comportement actuel, URL réécrite en jolie URL.
  // "no" → on n'y touche pas, la barre d'adresse garde le .html brut.
  // Ce script s'exécute tôt et de façon synchrone (avant même que le body
  // existe) : on ne peut pas attendre un fetch réseau ici sans retarder
  // l'affichage. Fast-path : dernière valeur connue en localStorage.
  // Confirmation asynchrone en fond pour rester à jour si le setting
  // change côté products.data.json (même mécanisme que preloader-inline.js).
  var PRETTY_URL_CACHE_KEY = 'bbw_use_pretty_urls';
  var prettyUrlsEnabled = true;
  try {
    var cachedSetting = localStorage.getItem(PRETTY_URL_CACHE_KEY);
    if (cachedSetting === 'no') prettyUrlsEnabled = false;
  } catch (e) {}

  function applyPrettyUrl() {
    if (!prettyUrlsEnabled) return;
    if (pretty && window.location.pathname === path && path !== pretty) {
      // Préserve la query string (ex: ?openCart=true venant d'une notification
      // push) et le hash — sinon ils sont perdus avant que le reste du site
      // (ex: checkOpenCartFromPush dans script.js) ne puisse les lire.
      var newUrl = pretty + window.location.search + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  }

  applyPrettyUrl();

  fetch('/products.data.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var arr = Array.isArray(data) ? data : [];
      var settings = arr.find(function (p) { return p.type === 'settings'; }) || {};
      var setting = (settings.use_pretty_urls || 'yes').trim().toLowerCase();
      try { localStorage.setItem(PRETTY_URL_CACHE_KEY, setting === 'no' ? 'no' : 'yes'); } catch (e) {}
      // Si le cache disait "yes" (ou rien) mais la vraie valeur est "no",
      // et qu'on avait déjà réécrit l'URL en jolie URL par erreur : on
      // restaure le .html d'origine pour rester cohérent avec le setting.
      if (setting === 'no' && prettyUrlsEnabled && window.location.pathname === pretty) {
        window.history.replaceState({}, document.title, path + window.location.search + window.location.hash);
      }
      // Si le cache disait "no" mais la vraie valeur est "yes" : applique
      // la jolie URL maintenant qu'on sait qu'elle doit l'être.
      if (setting !== 'no' && !prettyUrlsEnabled) {
        prettyUrlsEnabled = true;
        applyPrettyUrl();
      }
    })
    .catch(function () {});
})();