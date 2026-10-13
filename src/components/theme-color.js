(function applyConfiguredThemeColor() {
  fetch('/products.data.json')
    .then(response => {
      if (!response.ok) throw new Error(`Theme settings request failed: ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data)) return;
      const settings = data.find(item => item && item.type === 'settings');
      const color = settings && settings.theme_color;
      if (!color) return;

      const metas = document.querySelectorAll('meta[name="theme-color"]');
      const meta = metas[0] || document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = color;
      if (!meta.isConnected) document.head.appendChild(meta);
      metas.forEach((item, index) => {
        if (index > 0) item.remove();
      });
    })
    .catch(error => console.warn('[Theme color] Could not load configured color:', error));
})();
