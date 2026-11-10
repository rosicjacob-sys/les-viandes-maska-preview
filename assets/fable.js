// Fable version runtime (loaded only by /fable/ pages, after site.js and lab.js). Small on purpose: the spin engine,
// clip controller, sector picker and live card are shared. Here: overlay header, pinned story, clip fade-in,
// family deep links, portion grid, sticky timeline year. No motion is started here under reduced motion.
(() => {
  if (!document.body.classList.contains('fable')) return;
  const M = window.Maska || {};
  const onScroll = fn => { let t = 0; addEventListener('scroll', () => { if (!t) t = requestAnimationFrame(() => { t = 0; fn(); }); }, { passive: true }); addEventListener('resize', fn, { passive: true }); fn(); };

  // Header: clear over the hero at the very top, solid dark glass once the page moves.
  const header = document.querySelector('.site-header');
  if (header) onScroll(() => { const top = scrollY < 48; header.classList.toggle('is-top', top); header.classList.toggle('is-solid', !top); });

  // Clips fade in over their still once they actually play (the still stays as the first paint and the fallback).
  document.querySelectorAll('.fx-hero-media video, .fx-stage-card video').forEach(v => v.addEventListener('playing', () => v.classList.add('is-playing')));

  // Pinned expertise story: the chapter crossing the reading line picks the picture. Sticky positioning only.
  document.querySelectorAll('[data-fx-story]').forEach(st => {
    const chapters = [...st.querySelectorAll('[data-chapter]')], cards = [...st.querySelectorAll('[data-stage]')], now = st.querySelector('[data-fx-stage-now]');
    let cur = 0;
    const set = i => {
      if (i === cur) return; cur = i;
      chapters.forEach((c, k) => c.classList.toggle('is-on', k === i));
      cards.forEach((c, k) => c.classList.toggle('is-on', k === i));
      if (now) now.textContent = String(i + 1).padStart(2, '0');
      if (M.refreshClips) { M.refreshClips(); setTimeout(M.refreshClips, 560); }
    };
    onScroll(() => {
      const line = innerHeight * (innerWidth <= 1000 ? 0.62 : 0.5); let best = 0, dist = Infinity;
      chapters.forEach((c, k) => { const r = c.getBoundingClientRect(), d = line < r.top ? r.top - line : line > r.bottom ? line - r.bottom : 0; if (d < dist) { dist = d; best = k; } });
      set(best);
    });
    chapters.forEach((c, k) => c.addEventListener('focusin', () => set(k)));
  });

  // Catalogue deep link from the Home family index: produits.html#famille-<id> opens that family.
  const fam = /^#famille-([a-z-]+)$/.exec(location.hash);
  if (fam) {
    const tab = document.querySelector(`[data-family="${fam[1]}"]`);
    if (tab) { tab.click(); const box = tab.closest('[data-family-explorer]') || tab; requestAnimationFrame(() => box.scrollIntoView({ block: 'start', behavior: 'auto' })); }
  }

  // Portion grid: one square per portion (up to 120), redrawn whenever the calculator result changes.
  document.querySelectorAll('[data-fx-portions]').forEach(grid => {
    const form = grid.closest('form'), out = form.querySelector('[data-calc-output] strong'), more = form.querySelector('[data-fx-portions-more]'), CAP = 120;
    const draw = () => {
      const n = Math.max(0, parseInt(out.textContent.replace(/\D/g, ''), 10) || 0), shown = Math.min(n, CAP);
      if (grid.childElementCount !== shown) {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < shown; i++) { const c = document.createElement('i'); c.style.setProperty('--i', i); frag.appendChild(c); }
        grid.textContent = ''; grid.appendChild(frag);
      }
      more.textContent = n > CAP ? more.dataset.moreTpl.replace('{n}', String(n - CAP)) : '';
    };
    new MutationObserver(draw).observe(out, { childList: true, characterData: true, subtree: true });
    form.addEventListener('input', () => requestAnimationFrame(draw));
    draw();
  });

  // Notre histoire: the sticky year shows the latest milestone that has passed the reading line.
  document.querySelectorAll('[data-fx-timeline]').forEach(tl => {
    const items = [...tl.querySelectorAll('[data-fx-year]')], now = tl.querySelector('[data-fx-year-now]'), bar = tl.querySelector('[data-fx-tl-progress]');
    onScroll(() => {
      const line = innerHeight * 0.45; let k = 0;
      items.forEach((it, i) => { if (it.getBoundingClientRect().top <= line) k = i; });
      items.forEach((it, i) => it.classList.toggle('is-on', i === k));
      if (now.textContent !== items[k].dataset.fxYear) now.textContent = items[k].dataset.fxYear;
      if (bar) bar.style.transform = `scaleX(${((k + 1) / items.length).toFixed(3)})`;
    });
  });
})();
