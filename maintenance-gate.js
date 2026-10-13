(function () {
  'use strict';

  // The maintenance page and internal admin tools must stay accessible.
  var EXEMPT_PATHS = [
    '/coming-soon.html',
    '/eprolo-viewer.html',
    '/cj-viewer.html',
    '/bbw4life-analytiques.html'
  ];

  var path = window.location.pathname;
  if (EXEMPT_PATHS.indexOf(path) !== -1) return;

  // An authenticated admin can browse the site while maintenance is enabled.
  var SESSION_KEY = 'eprolo_auth_ok';
  var isAdmin = false;
  try { isAdmin = sessionStorage.getItem(SESSION_KEY) === 'yes'; } catch (e) {}
  if (isAdmin) return;

  // Do not trust a saved maintenance value: it can stay "yes" after the
  // setting is turned off. Read a fresh copy on every page load instead.
  try { localStorage.removeItem('bbw_maintenance_mode'); } catch (e) {}

  fetch('/products.data.json?_maintenance=' + Date.now(), { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) throw new Error('Could not load maintenance setting');
      return response.json();
    })
    .then(function (data) {
      var arr = Array.isArray(data) ? data : [];
      var settings = arr.find(function (item) { return item.type === 'settings'; }) || {};
      var enabled = String(settings.maintenance_mode || 'no').trim().toLowerCase() === 'yes';

      // The admin may have unlocked the site while the request was in flight.
      var stillAdmin = false;
      try { stillAdmin = sessionStorage.getItem(SESSION_KEY) === 'yes'; } catch (e) {}

      if (enabled && !stillAdmin) {
        window.location.replace('/coming-soon.html');
      }
    })
    .catch(function () {});
})();
