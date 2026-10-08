/* Curvafit scroll reveals: starts before page content scripts and watches injected blocks. */
(function () {
  'use strict';

  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('scroll-revealed');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  const observe = root => {
    const register = element => {
      const delay = Number(element.dataset.scrollDelay);
      if (Number.isFinite(delay) && delay > 0) {
        element.style.setProperty('--scroll-reveal-delay', `${Math.min(delay, 160)}ms`);
      }
      revealObserver.observe(element);
    };

    if (root.matches && root.matches('[data-scroll-reveal]')) register(root);
    root.querySelectorAll?.('[data-scroll-reveal]').forEach(register);
  };

  document.documentElement.classList.add('has-scroll-reveal');
  observe(document);

  if ('MutationObserver' in window && document.body) {
    const mutationObserver = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) observe(node);
      }));
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }
})();
