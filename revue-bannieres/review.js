/* REVIEW TODO kit. Every <article class="item" data-id="..."> gets Approve / Decline / Notes.
   Choices autosave in this browser (localStorage, per page). The answer box at the bottom builds the text to paste back.
   Page setup: <body data-review="001-higgsfield-test" data-title="..."> and an empty <section id="answer"></section>. */
(function () {
  var body = document.body, key = 'review:' + body.dataset.review, st = {};
  try { st = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { st = {}; }
  var items = [].slice.call(document.querySelectorAll('article.item[data-id]'));
  function save() { try { localStorage.setItem(key, JSON.stringify(st)); } catch (e) {} }
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2600); }

  items.forEach(function (el) {
    var id = el.dataset.id, s = st[id] || {}, title = el.dataset.title || ($('h2', el) || {}).textContent || id;
    var box = document.createElement('div');
    box.className = 'decide';
    box.innerHTML = '<div class="dec" role="group" aria-label="Decision for ' + esc(id) + '">' +
      '<button type="button" class="ok" data-v="approve" aria-pressed="false">✓ Approve</button>' +
      '<button type="button" class="no" data-v="decline" aria-pressed="false">✕ Decline</button></div>' +
      '<label class="nl" for="n-' + esc(id) + '">Notes for ' + esc(id) + ' (optional)</label>' +
      '<textarea id="n-' + esc(id) + '" rows="2" placeholder="What to keep, change or try next…"></textarea>';
    el.appendChild(box);
    var btns = box.querySelectorAll('button'), ta = box.querySelector('textarea');
    function paint() {
      var d = (st[id] || {}).dec || '';
      el.dataset.dec = d;
      [].forEach.call(btns, function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === d)); });
    }
    [].forEach.call(btns, function (b) {
      b.addEventListener('click', function () {
        st[id] = st[id] || {};
        st[id].dec = st[id].dec === b.dataset.v ? '' : b.dataset.v;
        save(); paint(); build();
      });
    });
    ta.value = s.note || '';
    ta.addEventListener('input', function () { st[id] = st[id] || {}; st[id].note = ta.value; save(); build(); });
    el._title = title.trim();
    paint();
  });

  var ans = $('#answer');
  ans.innerHTML = '<div class="eyebrow">Your answer</div><h2>Paste this back into the chat</h2>' +
    '<p class="mut small">Built from your choices above. It updates as you click and saves automatically in this browser.</p>' +
    '<p class="progress" id="prog"></p>' +
    '<label class="nl" for="overall">Overall notes (optional)</label><textarea id="overall" rows="3" placeholder="Anything that applies to the whole page…"></textarea>' +
    '<div class="bar"><button type="button" class="btn primary" id="copy">Copy answer</button>' +
    '<button type="button" class="btn" id="dl">Download .md</button>' +
    '<button type="button" class="btn" id="reset">Reset this page</button></div>' +
    '<label class="nl" for="out">Answer text</label><textarea id="out" class="out" readonly></textarea>';
  var ov = $('#overall'), out = $('#out');
  ov.value = st.__overall || '';
  ov.addEventListener('input', function () { st.__overall = ov.value; save(); build(); });

  function md() {
    var lab = { approve: 'APPROVE', decline: 'DECLINE' }, done = 0, o = [];
    o.push('# Review answer: ' + body.dataset.review + ' · ' + (body.dataset.title || document.title));
    o.push('Answered ' + new Date().toISOString().slice(0, 16).replace('T', ' '), '');
    items.forEach(function (el) {
      var s = st[el.dataset.id] || {};
      if (s.dec) done++;
      o.push('- [' + (lab[s.dec] || 'UNDECIDED') + '] ' + el.dataset.id + ' · ' + el._title);
      if (s.note && s.note.trim()) o.push('  - Note: ' + s.note.trim().replace(/\n+/g, ' / '));
    });
    if (st.__overall && st.__overall.trim()) o.push('', 'Overall: ' + st.__overall.trim().replace(/\n+/g, ' / '));
    return { text: o.join('\n'), done: done };
  }
  function build() {
    var r = md();
    out.value = r.text;
    $('#prog').textContent = r.done + ' of ' + items.length + ' decided' + (r.done === items.length ? ' · ready to paste' : '');
  }
  $('#copy').addEventListener('click', function () {
    var t = out.value;
    function fallback() { out.focus(); out.select(); try { document.execCommand('copy'); toast('Copied. Paste it into the chat.'); } catch (e) { toast('Select the text below and copy it.'); } }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(function () { toast('Copied. Paste it into the chat.'); }, fallback); else fallback();
  });
  $('#dl').addEventListener('click', function () {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([out.value], { type: 'text/markdown' }));
    a.download = 'review-' + body.dataset.review + '.md'; document.body.appendChild(a); a.click(); a.remove();
    toast('Downloaded review-' + body.dataset.review + '.md');
  });
  $('#reset').addEventListener('click', function () {
    if (!confirm('Clear every decision and note on this page?')) return;
    try { localStorage.removeItem(key); } catch (e) {} location.reload();
  });
  window.__review = { md: function () { return md().text; }, state: function () { return st; } };
  build();
})();
