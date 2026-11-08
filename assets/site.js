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
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  } else document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
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
      panels.forEach(panel => { panel.hidden = panel.dataset.familyPanel !== tab.dataset.family; panel.classList.toggle('active', !panel.hidden); });
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
    dialog.showModal();
  }));
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
    const weight = form.elements.weight, portion = form.elements.portion, output = form.querySelector('[data-calc-output] strong');
    const calculate = () => { const value = Math.floor(Number(weight.value) * 1000 / Number(portion.value)); output.textContent = Number.isFinite(value) && value > 0 ? value.toLocaleString(M.lang === 'fr' ? 'fr-CA' : 'en-CA') : '0'; };
    form.addEventListener('input', calculate); form.addEventListener('submit', e => e.preventDefault()); calculate();
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
