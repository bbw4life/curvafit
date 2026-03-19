(function CurvaSearch() {
  'use strict';

  let searchIndex = [];
  let searchReady = false;

  const TYPE_LABELS = {
    page:    'Page',
    product: 'Product',
    blog:    'Blog',
    program: 'Program',
    feature: 'Feature',
    coach:   'Coach',
    policy:  'Policy'
  };

  const TYPE_ORDER = ['product', 'program', 'page', 'blog', 'feature', 'coach', 'policy'];

  function loadIndex() {
    fetch('/search.data.json')
      .then(r => r.json())
      .then(data => {
        searchIndex = data;
        searchReady = true;
        initSearch();
      })
      .catch(() => {
        searchReady = false;
      });
  }

  function score(item, query) {
    const q = query.toLowerCase().trim();
    const title = (item.title || '').toLowerCase();
    const keywords = (item.keywords || []).join(' ').toLowerCase();
    const type = (item.type || '').toLowerCase();

    if (title === q) return 100;
    if (title.startsWith(q)) return 85;
    if (title.includes(q)) return 70;
    const words = q.split(/\s+/);
    const allInTitle = words.every(w => title.includes(w));
    if (allInTitle) return 60;
    if (keywords.includes(q)) return 50;
    const anyInKeywords = words.some(w => keywords.includes(w));
    if (anyInKeywords) return 30;
    if (type.includes(q)) return 15;
    return 0;
  }

  function search(query) {
    if (!query || query.length < 2) return [];
    const results = searchIndex
      .map(item => ({ item, score: score(item, query) }))
      .filter(r => r.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return TYPE_ORDER.indexOf(a.item.type) - TYPE_ORDER.indexOf(b.item.type);
      })
      .slice(0, 8)
      .map(r => r.item);
    return results;
  }

  function highlight(text, query) {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
  }

  function buildDropdown() {
    const existing = document.getElementById('curva-search-dropdown');
    if (existing) return existing;
    const div = document.createElement('div');
    div.id = 'curva-search-dropdown';
    div.className = 'curva-search-dropdown';
    div.setAttribute('role', 'listbox');
    document.body.appendChild(div);

    const style = document.createElement('style');
    style.id = 'curva-search-style';
    style.textContent = `
      .curva-search-dropdown {
        position: fixed;
        z-index: 999999;
        background: #fff;
        border: 1.5px solid rgba(192,56,94,.18);
        border-radius: 14px;
        box-shadow: 0 16px 48px rgba(30,10,20,.16), 0 0 0 1px rgba(192,56,94,.08);
        overflow: hidden;
        min-width: 320px;
        max-width: 480px;
        max-height: 420px;
        overflow-y: auto;
        scrollbar-width: none;
       -ms-overflow-style: none;
        display: none;
        font-family: inherit;
      }
       .curva-search-dropdown::-webkit-scrollbar { display: none; }

      .curva-search-dropdown.open { display: block; }
      .curva-search-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 11px 16px;
        cursor: pointer;
        border-bottom: 1px solid rgba(0,0,0,.05);
        transition: background .15s ease;
        text-decoration: none;
        color: inherit;
      }
      .curva-search-item:last-child { border-bottom: none; }
      .curva-search-item:hover,
      .curva-search-item.active { background: rgba(192,56,94,.07); }
      .curva-search-icon {
        font-size: 18px;
        width: 28px;
        text-align: center;
        flex-shrink: 0;
      }
      .curva-search-text { flex: 1; min-width: 0; }
      .curva-search-title {
        font-size: 14px;
        font-weight: 500;
        color: #1a1a1a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .curva-search-title mark {
        background: rgba(192,56,94,.18);
        color: #c0385e;
        border-radius: 2px;
        padding: 0 1px;
        font-weight: 600;
      }
      .curva-search-badge {
        font-size: 10px;
        font-weight: 500;
        color: #7b3f6e;
        background: rgba(123,63,110,.10);
        border-radius: 20px;
        padding: 2px 8px;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .curva-search-empty {
        padding: 18px 16px;
        font-size: 13px;
        color: #888;
        text-align: center;
      }
      .curva-search-header {
        padding: 8px 16px 4px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: #c0385e;
        background: rgba(192,56,94,.04);
        border-bottom: 1px solid rgba(192,56,94,.08);
      }
      @media (prefers-color-scheme: dark) {
        .curva-search-dropdown { background: #1e1218; border-color: rgba(192,56,94,.25); }
        .curva-search-item { border-bottom-color: rgba(255,255,255,.06); }
        .curva-search-item:hover, .curva-search-item.active { background: rgba(192,56,94,.12); }
        .curva-search-title { color: #f0e8ec; }
        .curva-search-badge { background: rgba(123,63,110,.22); color: #d4a0c0; }
        .curva-search-empty { color: #888; }
        .curva-search-header { background: rgba(192,56,94,.08); color: #e08ab0; }
      }
    `;
    if (!document.getElementById('curva-search-style')) {
      document.head.appendChild(style);
    }
    return div;
  }

  function positionDropdown(input, dropdown) {
    const rect = input.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    dropdown.style.top  = (rect.bottom + 6) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = Math.max(rect.width, 320) + 'px';
  }

  function renderDropdown(dropdown, results, query) {
    dropdown.innerHTML = '';
    if (!results.length) {
      dropdown.innerHTML = `<div class="curva-search-empty">No results for "<strong>${query}</strong>"</div>`;
      return;
    }

    let lastType = null;
    results.forEach((item, idx) => {
      if (item.type !== lastType) {
        const header = document.createElement('div');
        header.className = 'curva-search-header';
        header.textContent = TYPE_LABELS[item.type] || item.type;
        dropdown.appendChild(header);
        lastType = item.type;
      }

      const link = document.createElement('a');
      link.className = 'curva-search-item';
      link.href = item.url;
      link.setAttribute('role', 'option');
      link.dataset.idx = idx;

      const icon = document.createElement('span');
      icon.className = 'curva-search-icon';
      icon.textContent = item.icon || '📄';

      const text = document.createElement('span');
      text.className = 'curva-search-text';

      const title = document.createElement('span');
      title.className = 'curva-search-title';
      title.innerHTML = highlight(item.title, query);

      text.appendChild(title);

      const badge = document.createElement('span');
      badge.className = 'curva-search-badge';
      badge.textContent = TYPE_LABELS[item.type] || item.type;

      link.appendChild(icon);
      link.appendChild(text);
      link.appendChild(badge);

      link.addEventListener('mousedown', e => {
        e.preventDefault();
        window.location.href = item.url;
      });

      dropdown.appendChild(link);
    });
  }

  function initSearch() {
    const searchBars = document.querySelectorAll('.search-bar');
    if (!searchBars.length) return;

    searchBars.forEach(bar => {
      const input = bar.querySelector('input[type="text"]');
      if (!input || input.dataset.curvaSearch) return;
      input.dataset.curvaSearch = '1';

      input.removeAttribute('list');
      const oldDatalist = input.getAttribute('list');
      if (oldDatalist) {
        const dl = document.getElementById(oldDatalist);
        if (dl) dl.style.display = 'none';
      }

      const dropdown = buildDropdown();
      let activeIdx = -1;
      let currentResults = [];
      let closeTimer = null;

      function open() {
        positionDropdown(input, dropdown);
        dropdown.classList.add('open');
      }

      function close() {
        dropdown.classList.remove('open');
        activeIdx = -1;
      }

      function setActive(idx) {
        const items = dropdown.querySelectorAll('.curva-search-item');
        items.forEach((el, i) => el.classList.toggle('active', i === idx));
        activeIdx = idx;
      }

      input.addEventListener('input', () => {
        const q = input.value.trim();
        if (q.length < 2) { close(); return; }
        currentResults = search(q);
        renderDropdown(dropdown, currentResults, q);
        positionDropdown(input, dropdown);
        open();
        activeIdx = -1;
      });

      input.addEventListener('keydown', e => {
        const items = dropdown.querySelectorAll('.curva-search-item');
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActive(Math.min(activeIdx + 1, items.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActive(Math.max(activeIdx - 1, 0));
        } else if (e.key === 'Enter') {
          if (activeIdx >= 0 && items[activeIdx]) {
            e.preventDefault();
            window.location.href = items[activeIdx].href;
          } else if (input.value.trim()) {
            const first = currentResults[0];
            if (first) window.location.href = first.url;
          }
          close();
        } else if (e.key === 'Escape') {
          close();
          input.blur();
        }
      });

      input.addEventListener('focus', () => {
        clearTimeout(closeTimer);
        if (input.value.trim().length >= 2) {
          positionDropdown(input, dropdown);
          open();
        }
      });

      input.addEventListener('blur', () => {
        closeTimer = setTimeout(close, 200);
      });

      window.addEventListener('scroll', () => {
        if (dropdown.classList.contains('open')) {
          positionDropdown(input, dropdown);
        }
      }, { passive: true });

      window.addEventListener('resize', () => {
        if (dropdown.classList.contains('open')) {
          positionDropdown(input, dropdown);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadIndex);
  } else {
    loadIndex();
  }

})();