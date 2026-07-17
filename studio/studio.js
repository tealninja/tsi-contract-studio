/* ============================================================
   TSI Contract Studio — shared utilities + file I/O
   studio.js

   Vanilla ES6, no dependencies. Loaded by every studio page.
   Exposes a single global: window.TSI
   ============================================================ */
(function () {
  'use strict';

  const TSI = {};

  /* ── Paths ──────────────────────────────────────────────────
     Every page lives in studio/, so app-relative reads climb one
     level to the TSI-Contract-Studio root. */
  const ROOT = '../';
  TSI.ROOT = ROOT;

  /* ── Formatting ─────────────────────────────────────────────
     House rules: numbers are mono, negatives use − (U+2212),
     units stay attached to the value. */
  const MINUS = '−';

  TSI.fmtMoney = function (n, currency) {
    if (n == null || n === '' || isNaN(n)) return '—';
    const neg = n < 0;
    const abs = Math.abs(Number(n));
    const s = abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
    const sym = currency === 'none' ? '' : '$';
    return (neg ? MINUS : '') + sym + s;
  };

  TSI.fmtPct = function (n) {
    if (n == null || n === '' || isNaN(n)) return '—';
    return (n < 0 ? MINUS : '') + Math.abs(Number(n)) + '%';
  };

  TSI.fmtDate = function (iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  TSI.stamp = function () {
    // YYYY-MM-DD for filenames / export logs
    return new Date().toISOString().slice(0, 10);
  };

  TSI.escapeHTML = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ── Reads (fetch, relative paths) ──────────────────────────
     Works over localhost; fails on file:// — we surface that
     clearly rather than leaving a blank screen. */
  TSI.readText = async function (relPath) {
    const url = relPath.startsWith('..') || relPath.startsWith('/') ? relPath : ROOT + relPath;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Read failed (' + r.status + '): ' + url);
    return r.text();
  };

  TSI.readJSON = async function (relPath) {
    const url = relPath.startsWith('..') || relPath.startsWith('/') ? relPath : ROOT + relPath;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Read failed (' + r.status + '): ' + url);
    return r.json();
  };

  TSI.isFileProtocol = function () { return location.protocol === 'file:'; };

  TSI.hasFileSystemAccess = function () { return typeof window.showSaveFilePicker === 'function'; };

  /* ── Writes ─────────────────────────────────────────────────
     Prefer the File System Access API (Chrome/Edge). We keep the
     chosen handle in memory keyed by a logical name so subsequent
     saves in the same session write silently. If the API is
     unavailable (Firefox/Safari), fall back to a download and let
     the user drop the file into the right folder. */
  const handles = Object.create(null);

  TSI.saveFile = async function (key, suggestedName, text, opts) {
    opts = opts || {};
    if (TSI.hasFileSystemAccess()) {
      try {
        let handle = handles[key];
        if (!handle || opts.repick) {
          handle = await window.showSaveFilePicker({
            suggestedName: suggestedName,
            types: opts.types || [{
              description: suggestedName.endsWith('.json') ? 'JSON file' : 'HTML file',
              accept: suggestedName.endsWith('.json')
                ? { 'application/json': ['.json'] }
                : { 'text/html': ['.html'] }
            }]
          });
          handles[key] = handle;
        }
        const w = await handle.createWritable();
        await w.write(text);
        await w.close();
        return { method: 'fsapi', name: handle.name };
      } catch (e) {
        if (e && e.name === 'AbortError') return { method: 'cancelled' };
        // fall through to download on any other failure
        TSI.downloadFile(suggestedName, text);
        return { method: 'download', name: suggestedName, note: 'File System Access failed; downloaded instead.' };
      }
    }
    TSI.downloadFile(suggestedName, text);
    return { method: 'download', name: suggestedName };
  };

  TSI.downloadFile = function (name, text, mime) {
    const blob = new Blob([text], { type: mime || (name.endsWith('.json') ? 'application/json' : 'text/html') });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };

  /* ── Toasts ─────────────────────────────────────────────── */
  function toastHost() {
    let host = document.querySelector('.toast-host');
    if (!host) { host = document.createElement('div'); host.className = 'toast-host'; document.body.appendChild(host); }
    return host;
  }
  TSI.toast = function (msg, kind, ms) {
    const el = document.createElement('div');
    el.className = 'toast toast-' + (kind || 'ok');
    el.textContent = msg;
    toastHost().appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 200);
    }, ms || 2600);
  };

  /* ── Theme ──────────────────────────────────────────────── */
  TSI.applyTheme = function (t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('tsi-theme', t); } catch (e) {}
  };
  TSI.initTheme = function () {
    let t = 'light';
    try { t = localStorage.getItem('tsi-theme') || 'light'; } catch (e) {}
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  };
  TSI.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    TSI.applyTheme(cur === 'dark' ? 'light' : 'dark');
  };

  /* ── Chrome (header nav active-state + env warning) ─────── */
  TSI.initChrome = function () {
    TSI.initTheme();
    const here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.app-nav a').forEach(function (a) {
      const href = a.getAttribute('href');
      if (href === here || (here === '' && href === 'index.html')) a.classList.add('active');
    });
    if (TSI.isFileProtocol()) {
      const b = document.createElement('div');
      b.className = 'banner banner-warning no-print';
      b.style.margin = '12px 24px 0';
      b.innerHTML = '<strong>Opened via file://</strong> — file reads will fail. ' +
        'Serve this folder over localhost: <span class="mono">python -m http.server 8080</span>';
      document.body.insertBefore(b, document.body.firstChild.nextSibling);
    }
  };

  /* ── Query params (Intel handoff, project selection) ────── */
  TSI.params = function () {
    return Object.fromEntries(new URLSearchParams(location.search).entries());
  };

  /* ── URL param → project field mapping (Intel handoff) ──── */
  TSI.PARAM_MAP = {
    buyer: 'buyer', site: 'site', price: 'contractPrice',
    name: 'name', law: 'governingLaw', effectiveDate: 'effectiveDate'
  };

  /* ============================================================
     Defined-terms engine + calculated fields
     Any element with [data-term] shows a definition tooltip and,
     on click, scrolls to Article 1. Any [data-calc-pct] element
     shows the dollar value at the current contract price on hover.
     ============================================================ */
  let bubble;
  function ensureBubble() {
    if (!bubble) { bubble = document.createElement('div'); bubble.className = 'tt-bubble'; document.body.appendChild(bubble); }
    return bubble;
  }
  function showBubble(target, html) {
    const b = ensureBubble();
    b.innerHTML = html;
    const r = target.getBoundingClientRect();
    b.style.left = Math.min(r.left, window.innerWidth - 340) + 'px';
    b.style.top = (r.bottom + 6) + 'px';
    b.classList.add('show');
  }
  function hideBubble() { if (bubble) bubble.classList.remove('show'); }

  TSI.initDefinedTerms = function (root, definitions) {
    root = root || document;
    root.querySelectorAll('[data-term]').forEach(function (el) {
      el.classList.add('term');
      const key = el.getAttribute('data-term');
      el.addEventListener('mouseenter', function () {
        const def = (definitions && definitions[key]) || el.getAttribute('data-def') || 'See Article 1 — Definitions.';
        showBubble(el, '<span class="tt-term">' + TSI.escapeHTML(el.textContent) + '</span>' + TSI.escapeHTML(def));
      });
      el.addEventListener('mouseleave', hideBubble);
      el.addEventListener('click', function () {
        const a1 = document.getElementById('article-1') || document.getElementById('definitions');
        if (a1) a1.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  TSI.initCalcFields = function (root, contractPrice) {
    root = root || document;
    root.querySelectorAll('[data-calc-pct]').forEach(function (el) {
      el.classList.add('calc');
      el.addEventListener('mouseenter', function () {
        const pct = Number(el.getAttribute('data-calc-pct'));
        const base = Number(el.getAttribute('data-calc-base') || contractPrice || 0);
        const dollars = base * pct / 100;
        const label = el.getAttribute('data-calc-label') || 'at current contract price';
        showBubble(el,
          '<span class="tt-term">' + TSI.fmtPct(pct) + ' ' + TSI.escapeHTML(label) + '</span>' +
          TSI.fmtMoney(dollars) + '  (' + TSI.fmtPct(pct) + ' of ' + TSI.fmtMoney(base) + ')');
      });
      el.addEventListener('mouseleave', hideBubble);
    });
  };

  window.addEventListener('scroll', hideBubble, true);

  /* ── View toggling (working / clean) on the document root ── */
  TSI.setView = function (view, docRoot) {
    docRoot = docRoot || document.querySelector('[data-view]') || document.body;
    docRoot.setAttribute('data-view', view);
  };

  /* ── Export: strip internal markup, return clean HTML ─────
     Removes every editorial-annotation element and working-only
     block, per the internal markup convention. */
  TSI.stripInternal = function (htmlOrNode) {
    let node;
    if (typeof htmlOrNode === 'string') {
      const tmp = document.createElement('div');
      tmp.innerHTML = htmlOrNode;
      node = tmp;
    } else {
      node = htmlOrNode.cloneNode(true);
    }
    node.querySelectorAll('.draft-note, .int-note, .atty-note, .open-issue, .working-only, .no-print, .stub-flag')
      .forEach(function (el) { el.remove(); });
    return node.innerHTML;
  };

  /* ── Small helpers ──────────────────────────────────────── */
  TSI.el = function (tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    if (html != null) e.innerHTML = html;
    return e;
  };

  TSI.pct = function (done, total) { return total ? Math.round(done / total * 100) : 0; };

  /* ── Inline autocomplete ────────────────────────────────────
     Attach a filtering dropdown to a text input. Used by the Mill
     visits sheet for mill / attendee / owner cells. One shared menu
     element is reused across all inputs.

     opts: {
       source():[items]         fresh each open, so new adds appear
       label(item):string       text shown / inserted
       meta(item):string?       muted right-side hint (org, location)
       onPick(item)             chosen item, or {name:q,__new:true}
       allowAdd:bool            offer "Add \"q\"" when nothing matches
       minChars:number          default 0 (show all on focus)
     } */
  let acMenu, acState = null;
  function acEnsure() {
    if (!acMenu) {
      acMenu = document.createElement('div');
      acMenu.className = 'ac-menu';
      acMenu.style.display = 'none';
      document.body.appendChild(acMenu);
      document.addEventListener('mousedown', function (e) {
        if (acState && e.target !== acState.input && !acMenu.contains(e.target)) acClose();
      });
      window.addEventListener('scroll', function () { if (acState) acPosition(); }, true);
    }
    return acMenu;
  }
  function acPosition() {
    const r = acState.input.getBoundingClientRect();
    acMenu.style.left = Math.min(r.left, window.innerWidth - 300) + 'px';
    acMenu.style.top = (r.bottom + 2) + 'px';
    acMenu.style.minWidth = Math.max(r.width, 180) + 'px';
  }
  function acClose() { if (acMenu) acMenu.style.display = 'none'; acState = null; }
  function acRender() {
    const s = acState, q = s.input.value.trim().toLowerCase();
    const items = s.opts.source().filter(function (it) {
      return !q || s.opts.label(it).toLowerCase().indexOf(q) !== -1 ||
        (s.opts.meta && (s.opts.meta(it) || '').toLowerCase().indexOf(q) !== -1);
    }).slice(0, 40);
    let html = items.map(function (it, i) {
      const meta = s.opts.meta ? s.opts.meta(it) : '';
      return '<div class="ac-item" data-i="' + i + '">' + TSI.escapeHTML(s.opts.label(it)) +
        (meta ? '<span class="ac-meta">' + TSI.escapeHTML(meta) + '</span>' : '') + '</div>';
    }).join('');
    const exact = items.some(function (it) { return s.opts.label(it).toLowerCase() === q; });
    const rawQ = s.input.value.trim();
    if (s.opts.allowAdd && rawQ && !exact) {
      html += '<div class="ac-item ac-add" data-add="1">Add “' + TSI.escapeHTML(rawQ) + '”</div>';
    }
    if (!html) html = '<div class="ac-empty">No matches</div>';
    acMenu.innerHTML = html;
    s.items = items; s.active = -1;
    acMenu.style.display = 'block';
    acPosition();
    acMenu.querySelectorAll('.ac-item').forEach(function (el) {
      el.addEventListener('mousedown', function (ev) {
        ev.preventDefault();
        if (el.dataset.add) acPickAdd(); else acPickIndex(+el.dataset.i);
      });
    });
  }
  function acHighlight() {
    acMenu.querySelectorAll('.ac-item').forEach(function (el, i) { el.classList.toggle('active', i === acState.active); });
    const el = acMenu.querySelectorAll('.ac-item')[acState.active];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
  function acPickIndex(i) { const it = acState.items[i]; const cb = acState.opts.onPick; acClose(); if (it) cb(it); }
  function acPickAdd() { const q = acState.inputVal(); const cb = acState.opts.onPick; acClose(); if (q) cb({ name: q, __new: true }); }

  TSI.autocomplete = function (input, opts) {
    input.addEventListener('focus', function () {
      acEnsure(); acState = { input: input, opts: opts, items: [], active: -1, inputVal: function () { return input.value.trim(); } };
      acRender();
    });
    input.addEventListener('input', function () {
      if (!acState || acState.input !== input) { acEnsure(); acState = { input: input, opts: opts, items: [], active: -1, inputVal: function () { return input.value.trim(); } }; }
      acRender();
    });
    input.addEventListener('keydown', function (e) {
      if (!acState || acMenu.style.display === 'none') return;
      const n = acMenu.querySelectorAll('.ac-item').length;
      if (e.key === 'ArrowDown') { e.preventDefault(); acState.active = Math.min(acState.active + 1, n - 1); acHighlight(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); acState.active = Math.max(acState.active - 1, 0); acHighlight(); }
      else if (e.key === 'Enter') {
        const active = acMenu.querySelectorAll('.ac-item')[acState.active];
        if (active) { e.preventDefault(); if (active.dataset.add) acPickAdd(); else acPickIndex(+active.dataset.i); }
      } else if (e.key === 'Escape') { acClose(); }
    });
    input.addEventListener('blur', function () { setTimeout(function () { if (acState && acState.input === input) acClose(); }, 120); });
  };

  /* ── Clause variant resolution ──────────────────────────────
     Resolve the file for a stub given the project format
     (standard | lite) and stance (balanced | pro-tsi), falling
     back gracefully to what actually exists on disk. Availability
     is declared in the registry (liteVariants / proTsiVariants) so
     we never fetch a missing path. */
  TSI.resolveStub = function (meta, reg, format, stance) {
    const id = meta.id;
    const lite = format === 'lite' && (reg.liteVariants || []).indexOf(id) !== -1;
    const pro  = stance === 'pro-tsi' && (reg.proTsiVariants || []).indexOf(id) !== -1;
    let dir = 'stubs/';
    if (lite) dir += 'lite/';
    if (pro)  dir += 'pro-tsi/';
    return {
      file: dir + id + '.html',
      resolvedFormat: lite ? 'lite' : 'standard',
      resolvedStance: pro ? 'pro-tsi' : 'balanced',
      // requested a variant we don't carry for this clause:
      fellBackStance: stance === 'pro-tsi' && !pro,
      fellBackFormat: format === 'lite' && !lite
    };
  };

  window.TSI = TSI;
})();
