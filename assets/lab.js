// V4 option lab runtime (loaded only by /labo/ builds, after site.js). One small module per option:
// spin engine (hero B/C, catalogue B), expanding reel (expertise B), sector picker (sectors B),
// live contact card (closing B). Reduced motion / Save-Data: no automatic movement and no frame download until
// the visitor interacts; nothing loads before the window load event (the poster image stays the first paint).
(() => {
  const M = window.Maska || {};
  const motionOk = M.motionOk !== false;
  const fr = (document.documentElement.lang || '').startsWith('fr');
  const afterLoad = fn => {
    const go = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 150));
    if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
  };

  // ---------- Spin engine: N frames of one turn, drawn into a canvas with object-fit: cover semantics ----------
  function makeSpin({ canvas, base, count, fit, onChange }) {
    const g = canvas.getContext('2d'), imgs = new Array(count);
    let cur = 0, all = null, dead = false;
    const url = i => `${base}f-${String(i + 1).padStart(3, '0')}.webp`;
    const clamp = i => Math.max(0, Math.min(count - 1, Math.round(i)));
    const nearest = i => { for (let d = 0; d < count; d++) { if (imgs[i - d]) return imgs[i - d]; if (imgs[i + d]) return imgs[i + d]; } return null; };
    function draw() {
      if (dead) return;
      const im = nearest(cur); if (!im) return;
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const [px, py] = fit(), s = Math.max(w / im.naturalWidth, h / im.naturalHeight), dw = im.naturalWidth * s, dh = im.naturalHeight * s;
      g.clearRect(0, 0, w, h); g.drawImage(im, (w - dw) * px, (h - dh) * py, dw, dh);
      canvas.classList.add('is-on');
    }
    const load = i => new Promise(res => {
      if (imgs[i]) return res(imgs[i]);
      const im = new Image(); im.decoding = 'async';
      im.onload = () => { imgs[i] = im; if (Math.abs(i - cur) < 2 || !canvas.classList.contains('is-on')) draw(); res(im); };
      im.onerror = () => res(null); im.src = url(i);
    });
    // Coarse frames first (every 8th, then 4th, 2nd, all) so a fast drag always has a near frame.
    const order = () => { const seen = new Set(), out = []; for (const step of [8, 4, 2, 1]) for (let i = 0; i < count; i += step) if (!seen.has(i)) { seen.add(i); out.push(i); } return out; };
    const loadAll = () => all || (all = (async () => { const o = order(); for (let k = 0; k < o.length; k += 6) await Promise.all(o.slice(k, k + 6).map(load)); })());
    const set = i => { const n = clamp(i); if (n === cur && canvas.classList.contains('is-on')) return; cur = n; canvas.dataset.frame = String(cur); draw(); onChange && onChange(cur); };
    addEventListener('resize', draw, { passive: true });
    return { set, loadAll, load, draw, get cur() { return cur; }, count, destroy() { dead = true; removeEventListener('resize', draw); } };
  }
  // One forward-and-back turn to show the object can be moved; any interaction cancels it.
  function hint(spin, ms = 2600) {
    let raf = 0, t0 = 0;
    const ease = x => (x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
    const step = t => { if (!t0) t0 = t; const p = Math.min(1, (t - t0) / ms), q = p < .5 ? ease(p * 2) : ease((1 - p) * 2); spin.set(q * (spin.count - 1)); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }
  // Drag (pointer) + keyboard (role=slider handle) binding.
  function bindTurn({ surface, handle, spin, span, onStart }) {
    let drag = null;
    surface.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('a, button, input, select, textarea, label')) return;
      onStart(); drag = { x: e.clientX, i: spin.cur, id: e.pointerId, moved: false };
    });
    surface.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; surface.classList.add('is-dragging'); try { surface.setPointerCapture(e.pointerId); } catch { /* not capturable */ } }
      if (drag.moved) spin.set(drag.i + (dx / Math.max(200, span())) * (spin.count - 1));
    });
    const end = () => { if (drag) surface.classList.remove('is-dragging'); drag = null; };
    surface.addEventListener('pointerup', end); surface.addEventListener('pointercancel', end);
    if (handle) {
      handle.addEventListener('focus', onStart);
      handle.addEventListener('keydown', e => {
        const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 6, PageDown: -6 }[e.key];
        if (k) { e.preventDefault(); onStart(); spin.set(spin.cur + k); }
        else if (e.key === 'Home') { e.preventDefault(); onStart(); spin.set(0); }
        else if (e.key === 'End') { e.preventDefault(); onStart(); spin.set(spin.count - 1); }
      });
    }
  }
  const sliderSync = (handle, meter, count) => i => {
    if (handle) { handle.setAttribute('aria-valuenow', String(i + 1)); handle.setAttribute('aria-valuetext', (handle.dataset.textTpl || '{n}').replace('{n}', String(i + 1))); }
    if (meter) meter.style.transform = `scaleX(${(i / (count - 1)).toFixed(3)})`;
  };

  // ---------- Home hero B (drag) / C (scroll) ----------
  const heroCv = document.querySelector('[data-spin-canvas]');
  if (heroCv) {
    const hero = heroCv.closest('[data-home-hero]'), poster = hero.querySelector('img');
    const count = +heroCv.dataset.spinCount, mode = heroCv.dataset.spinMode;
    const wide = heroCv.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, 2) > 1000;
    const fit = () => { const p = getComputedStyle(poster).objectPosition.split(' ').map(v => parseFloat(v) / 100); return [isNaN(p[0]) ? .5 : p[0], isNaN(p[1]) ? .5 : p[1]]; };
    const handle = hero.querySelector('[data-spin-handle]'), meter = hero.querySelector('[data-spin-meter]');
    const spin = makeSpin({ canvas: heroCv, base: heroCv.dataset.spinBase + (wide ? '1280/' : '854/'), count, fit, onChange: sliderSync(handle, meter, count) });
    hero.classList.add(mode === 'scroll' ? 'spin-scroll' : 'spin-drag');
    if (mode === 'drag') {
      let stopHint = () => {}, started = false;
      const start = () => { if (started) return; started = true; spin.loadAll(); };
      bindTurn({ surface: hero, handle, spin, span: () => hero.clientWidth * 0.6, onStart: () => { stopHint(); start(); } });
      if (motionOk) afterLoad(() => { start(); spin.load(0).then(() => spin.loadAll()).then(() => { if (!hero.classList.contains('is-dragging')) stopHint = hint(spin); }); });
    } else if (mode === 'both') {
      // Scroll sets the base frame; drag and keys add an offset on top. Reduced motion: no scroll turn, no hint.
      let base = 0, offset = 0, started = false, stopHint = () => {}, tick = 0;
      const scrollBase = () => { const r = hero.getBoundingClientRect(); return Math.max(0, Math.min(1, -r.top / Math.max(1, r.height * 0.75))) * (count - 1); };
      const view = { set: i => { offset = Math.max(0, Math.min(count - 1, i)) - base; spin.set(base + offset); }, get cur() { return spin.cur; }, count };
      const start = () => { if (started) return; started = true; base = motionOk ? scrollBase() : 0; spin.loadAll(); };
      bindTurn({ surface: hero, handle, spin: view, span: () => hero.clientWidth * 0.6, onStart: () => { stopHint(); start(); } });
      if (motionOk) {
        addEventListener('scroll', () => { if (!tick) tick = requestAnimationFrame(() => { tick = 0; if (!started) return; stopHint(); base = scrollBase(); spin.set(base + offset); }); }, { passive: true });
        afterLoad(() => { start(); spin.load(0).then(() => spin.loadAll()).then(() => { if (!hero.classList.contains('is-dragging') && scrollY < 40) stopHint = hint(view); }); });
      }
    } else if (motionOk) {
      afterLoad(() => {
        spin.loadAll();
        let tick = 0;
        const onScroll = () => { tick = 0; const r = hero.getBoundingClientRect(), p = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height * 0.75))); spin.set(p * (count - 1)); };
        addEventListener('scroll', () => { if (!tick) tick = requestAnimationFrame(onScroll); }, { passive: true });
        spin.load(0).then(onScroll);
      });
    }
  }

  // ---------- Catalogue B: turn the product in the dialog ----------
  const dlg = document.querySelector('[data-product-dialog]');
  const dcv = dlg && dlg.querySelector('[data-dialog-spin]'), dh = dlg && dlg.querySelector('[data-dialog-handle]');
  if (dlg && dcv) {
    let spin = null, stopHint = () => {};
    const area = dcv.parentElement;
    let bound = false, current = null;
    document.querySelectorAll('[data-view-product]').forEach(btn => btn.addEventListener('click', () => {
      const card = btn.closest('[data-product-id]'), base = card && card.dataset.spinBase;
      if (!base) return;
      setTimeout(() => { // after catalogue.js has filled and opened the dialog
        const vid = dlg.querySelector('[data-dialog-video]');
        if (vid) { vid.pause(); vid.removeAttribute('src'); vid.load(); vid.hidden = true; }
        spin && spin.destroy(); dcv.classList.remove('is-on'); dcv.hidden = false; dh.hidden = false;
        spin = makeSpin({ canvas: dcv, base, count: 24, fit: () => [.5, .5], onChange: sliderSync(dh, null, 24) });
        current = spin;
        if (!bound) { bound = true; bindTurn({ surface: area, handle: dh, spin: { set: i => current.set(i), get cur() { return current.cur; }, get count() { return current.count; } }, span: () => area.clientWidth * 0.9, onStart: () => { stopHint(); current.loadAll(); } }); }
        spin.load(0).then(() => (motionOk ? spin.loadAll() : null)).then(() => { if (motionOk && current === spin) stopHint = hint(spin, 2200); });
      }, 0);
    }));
    dlg.addEventListener('close', () => { stopHint(); });
  }

  // ---------- Expertise B: expanding reel ----------
  document.querySelectorAll('[data-reel-acc]').forEach(acc => {
    const items = [...acc.querySelectorAll('[data-ra-item]')];
    const refresh = () => { if (M.refreshClips) { M.refreshClips(); setTimeout(M.refreshClips, 420); } };
    const open = item => {
      items.forEach(it => {
        const on = it === item;
        it.classList.toggle('is-open', on);
        it.querySelector('.ra-btn').setAttribute('aria-expanded', String(on));
        it.querySelector('.ra-panel').hidden = !on;
      });
      refresh();
    };
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    items.forEach(it => {
      it.querySelector('.ra-btn').addEventListener('click', () => open(it));
      if (fine) { let t = 0; it.addEventListener('pointerenter', () => { t = setTimeout(() => open(it), 160); }); it.addEventListener('pointerleave', () => clearTimeout(t)); }
    });
  });

  // ---------- Sectors B: "I run a ..." picker pre-fills the request draft ----------
  document.querySelectorAll('[data-sector-picker]').forEach(sp => {
    const ready = sp.querySelector('[data-sp-ready]'), empty = sp.querySelector('[data-sp-empty]'), go = sp.querySelector('[data-sp-go]');
    sp.addEventListener('change', e => {
      const r = e.target.closest('input[name="sector"]'); if (!r) return;
      empty.hidden = true; ready.hidden = false;
      ready.querySelector('[data-sp-name]').textContent = r.value;
      ready.querySelector('[data-sp-type]').textContent = r.dataset.customerType;
    });
    go.addEventListener('click', () => {
      const r = sp.querySelector('input[name="sector"]:checked');
      if (!r || !M.read || !M.write) return;
      const state = M.read(), draft = { ...(state.drafts.inquiry || {}) }, line = `${go.dataset.sectorPrefix}${r.value}.`;
      draft.customerType = r.dataset.customerType;
      if (!draft.message) draft.message = line;
      else if (!draft.message.includes(line)) draft.message = `${line}\n${draft.message}`;
      state.drafts.inquiry = draft; M.write(state);
    });
  });

  // ---------- Closing B: live open/closed status (published hours, Saint-Hyacinthe time) ----------
  const HOURS = { Mon: [450, 1050], Tue: [450, 1050], Wed: [450, 1050], Thu: [450, 1050], Fri: [450, 960] };
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const NAMES = fr ? { Mon: 'lundi', Tue: 'mardi', Wed: 'mercredi', Thu: 'jeudi', Fri: 'vendredi' } : { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' };
  const clock = m => (fr ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}` : `${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${m < 720 ? 'a.m.' : 'p.m.'}`);
  function status(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(now);
    const wd = parts.find(p => p.type === 'weekday').value, mins = (+parts.find(p => p.type === 'hour').value % 24) * 60 + +parts.find(p => p.type === 'minute').value;
    const today = HOURS[wd];
    if (today && mins >= today[0] && mins < today[1]) return { open: true, text: fr ? `Ouvert maintenant · ferme à ${clock(today[1])}` : `Open now · closes at ${clock(today[1])}` };
    if (today && mins < today[0]) return { open: false, text: fr ? `Fermé · ouvre aujourd’hui à ${clock(today[0])}` : `Closed · opens today at ${clock(today[0])}` };
    for (let d = 1; d <= 7; d++) {
      const day = DAYS[(DAYS.indexOf(wd) + d) % 7];
      if (HOURS[day]) return { open: false, text: fr ? `Fermé · ouvre ${d === 1 ? 'demain' : NAMES[day]} à ${clock(HOURS[day][0])}` : `Closed · opens ${d === 1 ? 'tomorrow' : NAMES[day]} at ${clock(HOURS[day][0])}` };
    }
    return null;
  }
  window.MaskaLabStatus = status; // exposed for the lab test (fixed clock checks)
  document.querySelectorAll('[data-fc-card]').forEach(card => {
    try { const s = status(); if (!s) return; card.querySelector('[data-fc-status-text]').textContent = s.text; card.querySelector('[data-fc-status]').classList.toggle('is-open', s.open); } catch { /* published hours stay visible */ }
  });
})();
