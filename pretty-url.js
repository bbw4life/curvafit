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
    '/products/product4.html': '/curvafit/high-waisted-plus-size-yoga-pants',
    '/products/product5.html': '/curvafit/plus-size-shockproof-sports-bra',
    '/products/product6.html': '/curvafit/nylon-yoga-vest',
    '/products/product7.html': '/curvafit/tennis-skort',
    '/products/product8.html': '/curvafit/quick-dry-sports-shorts',
    '/products/product9.html': '/curvafit/shaping-hip-belt',
    '/products/product10.html': '/curvafit/printed-non-slip-yoga-mat',
    '/products/product11.html': '/curvafit/fitness-water-bottle-1-3l',
    '/products/product12.html': '/curvafit/colorful-fitness-dumbbells',
    '/products/product13.html': '/curvafit/m4-step-counting-smart-bracelet',
    '/products/product14.html': '/curvafit/pocket-leggings-for-every-move',
    '/products/product15.html': '/curvafit/back-on-track-14-day-restart-guide',
    // ── CURVAFIT JOURNAL ──────────────────────────────────
    '/blog/article1.html': '/curvafit/journal/how-to-start-walking-plus-size-gentle-4-week-plan',
    '/blog/article2.html': '/curvafit/journal/simple-meal-prep-busy-weeks-easy-ideas-no-strict-diet',
    '/blog/article3.html': '/curvafit/journal/chair-workouts-beginners-gentle-moves-home',
    '/blog/article4.html': '/curvafit/journal/restart-routine-after-setback-without-guilt',
    '/blog/article5.html': '/curvafit/journal/stay-consistent-when-motivation-disappears-7-habits',
    '/blog/article6.html': '/curvafit/journal/anti-chafing-tips-plus-size-women',
    '/blog/article7.html': '/curvafit/journal/first-day-gym-confidence-building-guide',
    '/blog/article8.html': '/curvafit/journal/plate-method-balanced-meals-without-calorie-counting',
  };

  window.CURVAFIT_SLUGS = SLUGS;
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
