(() => {
  const KEY = 'maska.preview.v1';
  const lang = document.body.dataset.lang || 'fr';
  let ui = {};
  try { ui = JSON.parse(document.querySelector('[data-ui-json]')?.textContent || '{}'); } catch { /* defaults below */ }
  let memory = { items: [], drafts: {} };
  const cleanItem = item => item && typeof item === 'object' && typeof item.key === 'string' ? { ...item, quantity: Math.max(1, Math.min(999, Number(item.quantity) || 1)) } : null;
  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (value && Array.isArray(value.items)) memory = { items: value.items.map(cleanItem).filter(Boolean), drafts: value.drafts && typeof value.drafts === 'object' ? value.drafts : {} };
    } catch { /* Storage denial/corruption falls back to memory. */ }
    return memory;
  }
  function write(state) {
    memory = state;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* The current page still works in memory. */ }
    document.dispatchEvent(new CustomEvent('maska:change', { detail: state }));
    updateCount();
  }
  function updateCount() {
    const count = read().items.length;
    document.querySelectorAll('[data-inquiry-count]').forEach(el => { el.textContent = String(count); el.hidden = count === 0; });
    document.querySelectorAll('[data-add-product]').forEach(button => {
      const exists = read().items.some(item => item.key === `product-${button.dataset.addProduct}`);
      button.classList.toggle('added', exists);
      const label = button.querySelector('span');
      if (label) label.textContent = exists ? (ui.added || 'Ajouté') : (ui.add || 'Ajouter à ma demande');
    });
  }
  function addItem(item) {
    const state = read();
    const index = state.items.findIndex(x => x.key === item.key);
    if (index >= 0) state.items[index] = { ...state.items[index], ...item, quantity: state.items[index].quantity };
    else state.items.push(cleanItem(item));
    write(state);
  }
  let toastTimer;
  function toast(message) {
    const el = document.querySelector('[data-toast]');
    if (!el) return;
    el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }
  function text(item) { return item[lang] || item.fr || item.en || ''; }
  function pack(item) { return item[`pack${lang === 'fr' ? 'Fr' : 'En'}`] || item.packFr || item.packEn || item.detailsText || ''; }
  async function copy(textValue, button) {
    try { await navigator.clipboard.writeText(textValue); toast(ui.copied || 'Copié'); if (button) { const old = button.textContent; button.textContent = ui.copied || old; setTimeout(() => button.textContent = old, 1800); } }
    catch { toast(ui.error || 'Erreur'); }
  }
  window.Maska = { KEY, lang, ui, read, write, addItem, updateCount, toast, text, pack, copy };
  read(); updateCount();
  document.querySelectorAll('.mobile-menu nav a').forEach(a => a.addEventListener('click', () => { a.closest('details').open = false; }));
  document.querySelector('.mobile-menu')?.addEventListener('keydown', event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary').focus(); } });
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in'); observer.unobserve(entry.target); } }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal,.x-split').forEach(el => observer.observe(el));
  } else document.querySelectorAll('.reveal,.x-split').forEach(el => el.classList.add('in'));

  // Count-up numbers ([data-count])
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const runCount = el => {
    const to = +el.dataset.count, from = +(el.dataset.from || 0), raw = el.dataset.raw === '1';
    const fmt = v => raw ? String(Math.round(v)) : Math.round(v).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA');
    if (reduced || !Number.isFinite(to)) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = t => { const p = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  if ('IntersectionObserver' in window && !reduced) {
    const co = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { co.unobserve(en.target); runCount(en.target); } }), { threshold: 0.25 });
    document.querySelectorAll('[data-count]').forEach(el => co.observe(el));
  } else document.querySelectorAll('[data-count]').forEach(runCount);

  // Home 49-Frame Scroll-Scrubbed Hero Canvas (.hero-scroll)
  document.querySelectorAll('.hero-scroll[data-frames]').forEach(hero => {
    const cv = hero.querySelector('.hs-cv'), ctx2d = cv?.getContext('2d'), N = +hero.dataset.frames || 49, base = hero.dataset.src || 'assets/scrub-home/f-';
    if (!cv || !ctx2d) return;
    const imgs = Array(N), pad = n => String(n).padStart(3, '0');
    const draw = i => {
      const im = imgs[i]; if (!im || !im.complete || !im.naturalWidth) return;
      ctx2d.drawImage(im, 0, 0, cv.width, cv.height);
    };
    const load = i => { if (imgs[i]) return; const im = new Image(); im.src = `${base}${pad(i + 1)}.webp`; im.onload = () => { if (i === 0) draw(0); }; imgs[i] = im; };
    let warmed = false;
    const warm = () => {
      if (warmed || reduced) return;
      warmed = true;
      load(0);
      for (let i = 1; i < N; i++) setTimeout(() => load(i), i * 16);
      hero.querySelectorAll('[data-deferred-video]').forEach(v => {
        if (!v.src && v.dataset.src) v.src = v.dataset.src;
        v.onplaying = () => v.classList.add('is-playing');
        v.play().catch(() => {});
      });
    };
    addEventListener('scroll', warm, { passive: true, once: true });
    addEventListener('pointermove', warm, { passive: true, once: true });
    addEventListener('touchstart', warm, { passive: true, once: true });
    const onScroll = () => {
      warm();
      const r = hero.getBoundingClientRect(), p = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height * 0.7)));
      draw(Math.min(N - 1, Math.floor(p * (N - 1))));
      hero.style.setProperty('--p', (0.2 + p * 0.8).toFixed(3));
    };
    addEventListener('scroll', onScroll, { passive: true });
  });

  // Pauseable marquee (.x-pause) & hover videos ([data-hover-video])
  document.querySelectorAll('.x-pause').forEach(btn => btn.addEventListener('click', () => {
    const box = btn.closest('.x-moving') || document.body, paused = box.classList.toggle('is-paused');
    btn.setAttribute('aria-pressed', String(paused));
    const sp = btn.querySelector('span'); if (sp) sp.textContent = paused ? btn.dataset.play : btn.dataset.pause;
  }));
  document.querySelectorAll('.reel-it').forEach(it => {
    const v = it.querySelector('video');
    it.addEventListener('pointerenter', () => {
      if (!v || reduced) return;
      if (!v.src && v.dataset.src) v.src = v.dataset.src;
      v.onplaying = () => v.classList.add('is-playing');
      v.play().catch(() => {});
    });
    it.addEventListener('pointerleave', () => { if (v) v.pause(); });
  });

  // Live Saint-Hyacinthe cold-chain & opening status
  const liveText = document.querySelector('[data-live-hours-text]');
  if (liveText) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      const wd = parts.find(p => p.type === 'weekday')?.value, hr = +(parts.find(p => p.type === 'hour')?.value || 0), mn = +(parts.find(p => p.type === 'minute')?.value || 0), mins = hr * 60 + mn;
      const isOpen = (['Mon', 'Tue', 'Wed', 'Thu'].includes(wd) && mins >= 450 && mins < 1050) || (wd === 'Fri' && mins >= 450 && mins < 960);
      liveText.textContent = lang === 'fr'
        ? (isOpen ? 'Saint-Hyacinthe : Ouvert maintenant • Permis C1 MAPAQ' : 'Saint-Hyacinthe : Lun–Jeu 7h30–17h30, Ven 7h30–16h00 • C1 MAPAQ')
        : (isOpen ? 'Saint-Hyacinthe: Open now • C1 MAPAQ Permit' : 'Saint-Hyacinthe: Mon–Thu 7:30–17:30, Fri 7:30–16:00 • C1 MAPAQ');
    } catch { /* fallback text stays */ }
  }
  requestAnimationFrame(() => document.querySelector('[data-home-hero]')?.classList.add('is-ready'));
})();

(() => {
  const M = window.Maska;
  if (!M) return;
  document.querySelectorAll('[data-family-explorer]').forEach(explorer => {
    const tabs = [...explorer.querySelectorAll('[data-family]')];
    const panels = [...explorer.querySelectorAll('[data-family-panel]')];
    function activate(tab, focus = false) {
      tabs.forEach(x => { const selected = x === tab; x.setAttribute('aria-selected', String(selected)); x.tabIndex = selected ? 0 : -1; });
      panels.forEach(panel => {
        const isCurrent = panel.dataset.familyPanel === tab.dataset.family;
        panel.hidden = !isCurrent;
        panel.classList.toggle('active', isCurrent);
        const vid = panel.querySelector('video');
        if (vid) {
          if (isCurrent && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
            if (!vid.src && vid.dataset.src) vid.src = vid.dataset.src;
            vid.onplaying = () => vid.classList.add('is-playing');
            vid.play().catch(() => {});
          } else vid.pause();
        }
      });
      if (focus) tab.focus();
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { event.preventDefault(); activate(tabs[next], true); }
      });
    });
    explorer.querySelectorAll('[data-add-family]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.addFamily, tab = explorer.querySelector(`[data-family="${id}"]`);
      M.addItem({ key: `family-${id}`, type: 'family', id, fr: tab.dataset.fr, en: tab.dataset.en, packFr: `Catalogue officiel, page ${tab.dataset.page}`, packEn: `Official catalogue, page ${tab.dataset.page}`, quantity: 1 });
      M.toast(M.ui.added);
    }));
  });
  const modeSwitch = document.querySelector('[data-mode-switch]');
  if (modeSwitch) {
    const buttons = [...modeSwitch.querySelectorAll('[data-mode]')], panels = [...document.querySelectorAll('[data-catalogue-mode-panel]')];
    const setMode = mode => { buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode))); panels.forEach(p => { p.hidden = p.dataset.catalogueModePanel !== mode; }); };
    buttons.forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode))); setMode('wholesale');
  }
  const grid = document.querySelector('[data-product-grid]');
  if (grid) {
    const cards = [...grid.querySelectorAll('[data-product-id]')], search = document.querySelector('[data-product-search]'), filters = [...document.querySelectorAll('[data-filter]')];
    const count = document.querySelector('[data-product-count]'), empty = document.querySelector('[data-empty-products]'), resets = [...document.querySelectorAll('[data-reset-products]')];
    let category = 'all';
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    function apply() {
      const query = normalize(search?.value), tokens = query.split(/\s+/).filter(Boolean); let visible = 0;
      cards.forEach(card => { const haystack = normalize(card.dataset.search), show = (category === 'all' || card.dataset.category === category) && tokens.every(token => haystack.includes(token)); card.hidden = !show; if (show) visible++; });
      if (count) count.textContent = visible === 0 ? M.ui.resultZero : visible === 1 ? M.ui.resultOne : M.ui.resultMany.replace('{count}', visible);
      if (empty) empty.hidden = visible !== 0;
      resets.forEach(b => { b.hidden = category === 'all' && !query; });
    }
    search?.addEventListener('input', apply);
    filters.forEach(button => button.addEventListener('click', () => { category = button.dataset.filter; filters.forEach(b => b.setAttribute('aria-pressed', String(b === button))); apply(); }));
    resets.forEach(button => button.addEventListener('click', () => { category = 'all'; if (search) search.value = ''; filters.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === 'all'))); apply(); search?.focus(); }));
    apply();
  }
  const dialog = document.querySelector('[data-product-dialog]'); let activeCard = null;
  document.querySelectorAll('[data-view-product]').forEach(button => button.addEventListener('click', () => {
    activeCard = button.closest('[data-product-id]');
    if (!dialog || !activeCard) return;
    const name = M.lang === 'fr' ? activeCard.dataset.fr : activeCard.dataset.en, pack = M.lang === 'fr' ? activeCard.dataset.packFr : activeCard.dataset.packEn;
    dialog.querySelector('[data-dialog-name]').textContent = name; dialog.querySelector('[data-dialog-pack]').textContent = pack;
    dialog.querySelector('[data-dialog-category]').textContent = activeCard.querySelector('.product-category').textContent;
    const image = dialog.querySelector('[data-dialog-image]'); image.src = activeCard.dataset.image; image.alt = name;
    const dvid = dialog.querySelector('[data-dialog-video]');
    if (dvid && activeCard.dataset.video) { dvid.src = activeCard.dataset.video; dvid.poster = activeCard.dataset.poster || ''; dvid.play().catch(() => {}); }
    dialog.showModal();
  }));
  document.querySelectorAll('[data-product-id]').forEach(card => {
    const v = card.querySelector('[data-card-video]');
    if (!v) return;
    card.addEventListener('pointerenter', () => v.play().catch(() => {}));
    card.addEventListener('pointerleave', () => { if (!card.classList.contains('video-on')) v.pause(); });
  });
  const toggleAllBtn = document.querySelector('[data-toggle-all-videos]');
  toggleAllBtn?.addEventListener('click', () => {
    const on = toggleAllBtn.getAttribute('aria-pressed') !== 'true';
    toggleAllBtn.setAttribute('aria-pressed', String(on));
    document.querySelectorAll('[data-product-id]').forEach(card => {
      card.classList.toggle('video-on', on);
      const v = card.querySelector('[data-card-video]');
      if (v) { if (on && !card.hidden) v.play().catch(() => {}); else v.pause(); }
    });
  });
  dialog?.querySelector('[data-close-dialog]')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  dialog?.querySelector('[data-dialog-add]')?.addEventListener('click', () => { if (activeCard) addProduct(activeCard); dialog.close(); });
  function addProduct(card) {
    const id = card.dataset.productId;
    M.addItem({ key: `product-${id}`, type: 'product', id, fr: card.dataset.fr, en: card.dataset.en, packFr: card.dataset.packFr, packEn: card.dataset.packEn, image: card.dataset.image, quantity: 1 });
    M.toast(M.ui.added);
  }
  document.querySelectorAll('[data-add-product]').forEach(button => button.addEventListener('click', () => addProduct(button.closest('[data-product-id]'))));
})();

(() => {
  const M = window.Maska;
  document.querySelectorAll('[data-portion-calculator]').forEach(form => {
    const weight = form.elements.weight, portion = form.elements.portion, output = form.querySelector('[data-calc-output] strong'), bar = form.querySelector('[data-calc-bar]');
    const calculate = () => {
      const value = Math.floor(Number(weight.value) * 1000 / Number(portion.value));
      output.textContent = Number.isFinite(value) && value > 0 ? value.toLocaleString(M.lang === 'fr' ? 'fr-CA' : 'en-CA') : '0';
      if (bar) bar.style.width = `${Math.max(12, Math.min(100, Math.round((value / 150) * 100)))}%`;
    };
    form.addEventListener('input', calculate); form.addEventListener('submit', e => e.preventDefault()); calculate();
    form.querySelectorAll('[data-calc-preset]').forEach(btn => btn.addEventListener('click', () => {
      const [w, p] = btn.dataset.calcPreset.split(','); weight.value = w; portion.value = p; calculate();
    }));
    form.querySelector('[data-calc-add]')?.addEventListener('click', () => {
      const w = Number(weight.value) || 10, p = Number(portion.value) || 170, count = Math.max(1, Math.floor(w * 1000 / p));
      M.addItem({ key: `calc-${Date.now()}`, type: 'custom', id: 'calc', fr: `Simulation portionnage (${w} kg)`, en: `Portion simulation (${w} kg)`, packFr: `${p} g × ~${count} portions`, packEn: `${p} g × ~${count} portions`, quantity: 1 });
      M.toast(M.ui.added);
    });
  });
  const form = document.querySelector('[data-cut-form]');
  if (!form || !M) return;
  let copy = {};
  try { copy = JSON.parse(document.querySelector('[data-custom-copy]')?.textContent || '{}'); } catch { /* DOM labels remain usable. */ }
  const docket = document.querySelector('.cut-docket');
  const selectedText = name => form.querySelector(`[name="${name}"]:checked`)?.nextElementSibling?.textContent.trim() || '';
  function values(lang = M.lang) {
    const proteinId = form.elements.protein.value, cutId = form.elements.cut.value, packageId = form.elements.package.value, portion = Number(form.elements.portion.value), quantity = Math.max(1, Number(form.elements.quantity.value) || 1);
    const data = copy[lang];
    const protein = data?.proteins?.find(x => x[0] === proteinId)?.[1] || selectedText('protein');
    const cut = data?.cuts?.find(x => x[0] === cutId)?.[1] || form.elements.cut.selectedOptions[0].textContent;
    const pack = data?.packages?.find(x => x[0] === packageId)?.[1] || selectedText('package');
    return { proteinId, cutId, packageId, portion, quantity, protein, cut, pack };
  }
  function update() {
    const v = values(), kg = (v.portion * v.quantity / 1000).toLocaleString(M.lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 2 });
    docket.querySelector('[data-docket-code]').textContent = `${v.proteinId.slice(0, 3).toUpperCase()}-${String(v.portion).padStart(4, '0')}`;
    docket.querySelector('[data-docket-protein]').textContent = v.protein; docket.querySelector('[data-docket-cut]').textContent = v.cut;
    docket.querySelector('[data-docket-portion]').textContent = `${v.portion} g`; docket.querySelector('[data-docket-quantity]').textContent = String(v.quantity); docket.querySelector('[data-docket-package]').textContent = v.pack;
    docket.querySelector('[data-docket-weight]').textContent = `${kg} kg`; docket.querySelector('[data-docket-portions]').textContent = `${v.quantity} ${copy[M.lang]?.totalPortions || 'portions'}`;
    document.querySelector('[data-portion-output]').textContent = `${v.portion} g`;
    const dvid = docket.querySelector('[data-docket-video]');
    if (dvid) {
      const clipMap = { boeuf: 'hero-products-bavette', porc: 'food-pork-cubes', poulet: 'hero-custom-chicken', veau: 'food-veal-osso-buco' };
      const clip = clipMap[v.proteinId] || 'hero-products-bavette', pref = dvid.dataset.assetPrefix || '';
      const nextSrc = `${pref}assets/video/${clip}.mp4`;
      if (dvid.dataset.currentClip !== clip) { dvid.dataset.currentClip = clip; dvid.src = nextSrc; dvid.poster = `${pref}assets/video/${clip}.webp`; dvid.play().catch(() => {}); }
    }
    const scale = Math.max(0.6, Math.min(2.2, v.portion / 170));
    docket.querySelectorAll('[data-slice-bar]').forEach(el => { el.style.transform = `scaleX(${scale.toFixed(2)})`; });
  }
  form.addEventListener('input', update); update();
  document.querySelector('[data-add-custom]')?.addEventListener('click', () => {
    const current = values(), fr = values('fr'), en = values('en');
    const details = { proteinId: current.proteinId, cutId: current.cutId, packageId: current.packageId, portion: current.portion, quantity: current.quantity };
    M.addItem({ key: `custom-${Date.now()}`, type: 'custom', id: 'custom', fr: `${fr.protein} | ${fr.cut}`, en: `${en.protein} | ${en.cut}`, packFr: `${fr.portion} g × ${fr.quantity} portions • ${fr.pack}`, packEn: `${en.portion} g × ${en.quantity} portions • ${en.pack}`, details, quantity: 1 });
    M.toast(copy[M.lang]?.added || M.ui.added);
  });
  // The independent history timeline is initialized by timeline.js.
})();

(() => {
  document.querySelectorAll('[data-timeline]').forEach(timeline => {
    const tabs = [...timeline.querySelectorAll('[data-year]')];
    const activate = (selected, focus = false) => {
      tabs.forEach(tab => { tab.setAttribute('aria-selected', String(tab === selected)); tab.tabIndex = tab === selected ? 0 : -1; });
      timeline.querySelectorAll('[data-year-panel]').forEach(panel => { panel.hidden = panel.dataset.yearPanel !== selected.dataset.year; });
      if (focus) selected.focus();
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { event.preventDefault(); activate(tabs[next], true); }
      });
    });
  });
  document.querySelectorAll('.story').forEach(st => {
    const steps = [...st.querySelectorAll('.st-step')], cards = [...st.querySelectorAll('.st-card')];
    const setStep = idx => {
      steps.forEach((s, i) => s.classList.toggle('is-on', i === idx));
      cards.forEach((c, i) => c.classList.toggle('is-on', i === idx));
    };
    steps.forEach((s, i) => s.addEventListener('click', () => setStep(i)));
  });
})();

(() => {
  const M = window.Maska; if (!M) return;
  const route = document.querySelector('[data-route-form]');
  if (route) {
    let copy = {}; try { copy = JSON.parse(document.querySelector('[data-route-copy]').textContent); } catch { return; }
    const update = () => {
      const shop = route.elements.orderType.value === 'shop', other = route.elements.region.value === '3' && !shop;
      const prefix = shop ? 'shop' : other ? 'other' : 'business';
      document.querySelector('[data-route-title]').textContent = copy[`${prefix}Title`]; document.querySelector('[data-route-text]').textContent = copy[`${prefix}Text`];
      document.querySelector('[data-route-shop]').hidden = !shop; document.querySelector('[data-route-call]').hidden = shop;
    };
    route.addEventListener('input', update); update();
  }
  document.querySelectorAll('.territory').forEach(sec => {
    const pathEl = sec.querySelector('.tr-route'), truck = sec.querySelector('.tr-truck');
    if (!pathEl || !pathEl.getTotalLength) return;
    const len = pathEl.getTotalLength();
    const move = p => {
      if (!truck || !pathEl.getPointAtLength) return;
      const pt = pathEl.getPointAtLength(p * len);
      truck.setAttribute('transform', `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`);
    };
    move(0.35);
    addEventListener('scroll', () => {
      const r = sec.getBoundingClientRect(), p = Math.max(0.08, Math.min(0.96, (innerHeight - r.top) / Math.max(1, innerHeight + r.height)));
      move(p);
    }, { passive: true });
  });
  document.querySelectorAll('[data-career-pick]').forEach(card => card.addEventListener('click', () => {
    document.querySelectorAll('[data-career-pick]').forEach(c => c.classList.toggle('active', c === card));
    const sel = document.querySelector('[data-career-form] [name="interest"]');
    if (sel) { sel.value = card.dataset.careerPick; sel.dispatchEvent(new Event('input', { bubbles: true })); }
  }));
  document.querySelectorAll('[data-topic-pill]').forEach(pill => pill.addEventListener('click', () => {
    document.querySelectorAll('[data-topic-pill]').forEach(p => { const on = p === pill; p.classList.toggle('active', on); p.setAttribute('aria-pressed', String(on)); });
    const sel = document.querySelector('[data-contact-form] [name="topic"]');
    if (sel) { sel.value = pill.dataset.topicPill; sel.dispatchEvent(new Event('input', { bubbles: true })); }
  }));
  function draft(form, key) {
    const state = M.read(), saved = state.drafts[key] || {};
    Object.entries(saved).forEach(([name, value]) => { if (form.elements[name] && typeof value === 'string') form.elements[name].value = value; });
    form.addEventListener('input', () => { const current = M.read(); current.drafts[key] = Object.fromEntries(new FormData(form)); M.write(current); });
  }
  function showError(form, message) { const el = form.querySelector('[data-form-error]'); if (el) { el.textContent = message; el.hidden = !message; } }
  const career = document.querySelector('[data-career-form]');
  if (career) {
    draft(career, 'careers');
    career.addEventListener('submit', event => {
      event.preventDefault(); showError(career, '');
      if (!career.reportValidity()) { showError(career, M.ui.error); return; }
      const data = new FormData(career), name = data.get('name'), interest = career.elements.interest.selectedOptions[0].textContent, experience = data.get('experience');
      const subject = M.lang === 'fr' ? `Candidature spontanée | ${name} | ${interest}` : `Unsolicited application | ${name} | ${interest}`;
      const body = M.lang === 'fr' ? `Bonjour,\n\nJe souhaite vous présenter ma candidature.\n\nNom : ${name}\nDomaine d’intérêt : ${interest}\n\nExpérience et disponibilité :\n${experience}\n\nVous trouverez mon CV en pièce jointe.\n\nMerci,\n${name}` : `Hello,\n\nI would like to introduce my application.\n\nName: ${name}\nArea of interest: ${interest}\n\nExperience and availability:\n${experience}\n\nMy resume is attached.\n\nThank you,\n${name}`;
      document.querySelector('[data-career-email]').href = `mailto:cv@viandesmaska.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      const result = document.querySelector('[data-career-result]'); result.hidden = false; result.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
    });
  }
  const contact = document.querySelector('[data-contact-form]'); let contactText = '';
  if (contact) {
    draft(contact, 'contact');
    contact.addEventListener('submit', event => {
      event.preventDefault(); showError(contact, '');
      if (!contact.reportValidity()) { showError(contact, M.ui.error); return; }
      const data = new FormData(contact), topic = contact.elements.topic.selectedOptions[0].textContent, name = data.get('name'), company = data.get('company'), message = data.get('message');
      const subject = M.lang === 'fr' ? `Demande via le site Maska | ${topic} | ${name}` : `Request from the Maska website | ${topic} | ${name}`;
      contactText = M.lang === 'fr' ? `Bonjour,\n\nSujet : ${topic}\nNom : ${name}\nEntreprise : ${company || 'Non précisée'}\n\nMessage :\n${message}\n\nMerci.` : `Hello,\n\nTopic: ${topic}\nName: ${name}\nCompany: ${company || 'Not provided'}\n\nMessage:\n${message}\n\nThank you.`;
      document.querySelector('[data-contact-email]').href = `mailto:info@viandesmaska.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(contactText)}`;
      document.querySelector('[data-contact-preview]').textContent = contactText;
      const result = document.querySelector('[data-contact-result]'); result.hidden = false; result.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
    });
    document.querySelector('[data-copy-contact]')?.addEventListener('click', event => M.copy(contactText, event.currentTarget));
  }
  document.querySelector('[data-delete-data]')?.addEventListener('click', () => {
    try { localStorage.removeItem(M.KEY); } catch { /* Memory is cleared below. */ }
    M.write({ items: [], drafts: {} }); const status = document.querySelector('[data-delete-status]'); if (status) status.textContent = M.ui.deleted; M.toast(M.ui.deleted);
  });
})();

(() => {
  const M = window.Maska, form = document.querySelector('[data-inquiry-form]'); if (!M || !form) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let copy = {}; try { copy = JSON.parse(document.querySelector('[data-inquiry-copy]').textContent); } catch { /* default subject below */ }
  function summary(items) {
    if (!items.length) return `<p>${esc(M.ui.noProduct)}</p>`;
    return `<p><strong>${items.length}</strong> ${M.lang === 'fr' ? 'ligne(s) dans la demande' : 'line item(s) in the request'}</p><ul>${items.map(item => `<li>${esc(M.text(item))}</li>`).join('')}</ul>`;
  }
  function render() {
    const state = M.read(), host = document.querySelector('[data-inquiry-items]'), empty = document.querySelector('[data-inquiry-empty]');
    empty.hidden = state.items.length > 0;
    host.innerHTML = state.items.map(item => `<article class="inquiry-item" data-item-key="${esc(item.key)}">${item.image ? `<img src="${esc(item.image)}" alt="" width="76" height="76">` : '<div class="inquiry-item-mark" aria-hidden="true">M</div>'}<div><h3>${esc(M.text(item))}</h3><p>${esc(M.pack(item))}</p></div><div class="inquiry-item-controls">${item.type === 'product' ? `<label><span class="sr-only">${esc(M.ui.quantity)}</span><input type="number" min="1" max="999" value="${item.quantity}" data-item-quantity aria-label="${esc(M.ui.quantity)}"></label>` : ''}<button type="button" data-item-remove>${esc(M.ui.remove)}</button></div></article>`).join('');
    document.querySelector('[data-inquiry-summary]').innerHTML = summary(state.items);
    host.querySelectorAll('[data-item-remove]').forEach(button => button.addEventListener('click', () => { const key = button.closest('[data-item-key]').dataset.itemKey, current = M.read(); current.items = current.items.filter(item => item.key !== key); M.write(current); }));
    host.querySelectorAll('[data-item-quantity]').forEach(input => input.addEventListener('change', () => { const key = input.closest('[data-item-key]').dataset.itemKey, current = M.read(), item = current.items.find(x => x.key === key); if (item) item.quantity = Math.max(1, Math.min(999, Number(input.value) || 1)); M.write(current); }));
  }
  document.addEventListener('maska:change', render); render(); M.updateCount();
  const saved = M.read().drafts.inquiry || {};
  Object.entries(saved).forEach(([name, value]) => { const field = form.elements[name]; if (!field) return; if (field.type === 'checkbox') field.checked = value === 'on'; else if (typeof value === 'string') field.value = value; });
  form.addEventListener('input', () => { const state = M.read(); state.drafts.inquiry = Object.fromEntries(new FormData(form)); M.write(state); });
  let requestText = '';
  form.addEventListener('submit', event => {
    event.preventDefault(); const error = form.querySelector('[data-form-error]'); error.hidden = true;
    if (!form.reportValidity()) { error.textContent = M.ui.error; error.hidden = false; return; }
    const data = new FormData(form);
    if (!String(data.get('email') || '').trim() && !String(data.get('phone') || '').trim()) { error.textContent = M.ui.contactRequired; error.hidden = false; form.elements.email.focus(); return; }
    const items = M.read().items;
    const labels = M.lang === 'fr' ? { name: 'Nom', company: 'Entreprise', email: 'Courriel', phone: 'Téléphone', region: 'Région', type: 'Type de clientèle', message: 'Précisions', products: 'PRODUITS ET PRÉPARATIONS' } : { name: 'Name', company: 'Company', email: 'Email', phone: 'Phone', region: 'Region', type: 'Customer type', message: 'Details', products: 'PRODUCTS AND PREPARATIONS' };
    const lines = [labels.products, ''];
    if (items.length) items.forEach((item, i) => { lines.push(`${i + 1}. ${M.text(item)}`, `   ${M.pack(item)}${item.type === 'product' ? ` | ${M.ui.quantity}: ${item.quantity}` : ''}`, ''); });
    else lines.push(M.ui.noProduct, '');
    lines.push('---', `${labels.name}: ${data.get('name')}`, `${labels.company}: ${data.get('company') || '-'}`, `${labels.email}: ${data.get('email') || '-'}`, `${labels.phone}: ${data.get('phone') || '-'}`, `${labels.region}: ${data.get('region')}`, `${labels.type}: ${data.get('customerType')}`, '', `${labels.message}:`, data.get('message') || '-');
    requestText = lines.join('\n');
    const subject = `${copy.subject || (M.lang === 'fr' ? 'Demande de renseignements via le site Maska' : 'Information request from the Maska website')} | ${data.get('name')}`;
    document.querySelector('[data-inquiry-email]').href = `mailto:info@viandesmaska.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(requestText)}`;
    document.querySelector('[data-inquiry-preview]').textContent = requestText;
    const result = document.querySelector('[data-inquiry-result]'); result.hidden = false; result.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  });
  document.querySelector('[data-copy-inquiry]')?.addEventListener('click', event => M.copy(requestText, event.currentTarget));
})();
