/*!
 * Seihon builder
 * Everything runs in the browser: files are never uploaded anywhere.
 * MIT License (c) 2026 aburesoap
 */
/* global SEIHON_I18N, SEIHON_READER_CSS, SeihonReader */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
};

const PBKDF2_ITER = 310000;
const THUMB_EDGE = 360;
const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif|bmp)$/i;

/* ------------------------------------------------------------------ */
/* state                                                               */
/* ------------------------------------------------------------------ */
let uid = 1;
const nextId = () => 'p' + (uid++);

const state = {
  pages: [],      // {id, kind:'image'|'pdf'|'blank', file, pageNo, w, h, thumb, loading}
  files: [],      // {id, name, size, order, file, pdf}
  added: 0,
  sort: { key: null, asc: true },
  toc: [],        // {id, pageId, title}
  markers: [],    // {id, pageId, label}
  links: [],      // {id, label, value}
  bookId: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
  busy: false
};

/* ------------------------------------------------------------------ */
/* i18n & preferences                                                  */
/* ------------------------------------------------------------------ */
let lang = LS.get('seihon.builder.lang');
if (lang !== 'ja' && lang !== 'en') lang = /^ja\b/i.test(navigator.language || '') ? 'ja' : 'en';
let side = LS.get('seihon.builder.side') === 'right' ? 'right' : 'left';
let theme = document.documentElement.dataset.theme;

function t(key, vars) {
  let s = SEIHON_I18N[lang][key] ?? SEIHON_I18N.ja[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}

function applyI18n() {
  document.documentElement.lang = lang;
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  renderGrid();
  renderLists();
  updateSummary();
}

function applyPrefs() {
  document.documentElement.dataset.theme = theme;
  $('#layout').classList.toggle('side-right', side === 'right');
  $$('[data-pref]').forEach(b => {
    const cur = { lang, side, theme }[b.dataset.pref];
    b.setAttribute('aria-pressed', String(b.dataset.value === cur));
  });
}

$$('[data-pref]').forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.value;
  if (b.dataset.pref === 'lang') { lang = v; LS.set('seihon.builder.lang', v); applyI18n(); }
  if (b.dataset.pref === 'side') { side = v; LS.set('seihon.builder.side', v); }
  if (b.dataset.pref === 'theme') { theme = v; LS.set('seihon.builder.theme', v); }
  applyPrefs();
}));

// Follow the OS theme until the user picks one explicitly.
if (!LS.get('seihon.builder.theme') && window.matchMedia) {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener?.('change', () => {
    if (LS.get('seihon.builder.theme')) return;
    theme = mq.matches ? 'dark' : 'light';
    applyPrefs();
  });
}

/* ------------------------------------------------------------------ */
/* vertical tabs                                                       */
/* ------------------------------------------------------------------ */
const tabs = $$('.rail [role="tab"]');
function selectTab(btn, focus) {
  tabs.forEach(b => {
    const on = b === btn;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    $('#' + b.getAttribute('aria-controls')).hidden = !on;
  });
  if (focus) btn.focus();
  if (btn.dataset.tab === 'export') updateSummary();
}
tabs.forEach((b, i) => {
  b.addEventListener('click', () => selectTab(b));
  b.addEventListener('keydown', e => {
    const prev = ['ArrowUp', 'ArrowLeft'].includes(e.key), nxt = ['ArrowDown', 'ArrowRight'].includes(e.key);
    if (!prev && !nxt && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    let j = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (nxt ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[j], true);
  });
});

/* ------------------------------------------------------------------ */
/* settings                                                            */
/* ------------------------------------------------------------------ */
const radio = name => ($(`input[name="${name}"]:checked`) || {}).value;
function settings() {
  return {
    dir: radio('dir') === 'ltr' ? 'ltr' : 'rtl',
    view: radio('view') || 'auto',
    coverSingle: $('#f-cover').checked,
    pageNumbers: $('#f-pnum').checked
  };
}
$$('input[name="dir"], #f-cover').forEach(i => i.addEventListener('change', () => { renderGrid(); updateSummary(); }));
$$('input[name="view"], #f-pnum, #f-title, #c-on').forEach(i => i.addEventListener('input', updateSummary));
$('#c-on').addEventListener('change', syncColophon);
function syncColophon() {
  const on = $('#c-on').checked;
  const f = $('#colophon-fields');
  f.inert = !on;
  f.style.opacity = on ? '' : '.45';
}
$('#e-enc').addEventListener('change', () => { $('#enc-fields').hidden = !$('#e-enc').checked; });

/* ------------------------------------------------------------------ */
/* toast                                                               */
/* ------------------------------------------------------------------ */
let toastTimer = 0;
function toast(msg, isErr) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('err', !!isErr);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), isErr ? 4200 : 2200);
}

/* ------------------------------------------------------------------ */
/* file loading                                                        */
/* ------------------------------------------------------------------ */
let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('../vendor/pdfjs/pdf.min.mjs').then(m => {
      m.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
      return m;
    });
  }
  return pdfjsPromise;
}

const isPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isImage = f => (f.type.startsWith('image/') && !/svg|heic|heif/.test(f.type)) || IMAGE_RE.test(f.name);

async function addFiles(list) {
  const files = [...list];
  if (!files.length) return;
  let count = 0;
  for (const f of files) {
    if (!isPdf(f) && !isImage(f)) { toast(t('unsupported', { name: f.name }), true); continue; }
    const rec = { id: nextId(), name: f.name, size: f.size, order: state.added++, file: f, pdf: null };
    state.files.push(rec);
    try {
      count += isPdf(f) ? await addPdf(rec) : addImage(rec);
    } catch (err) {
      console.error(err);
      const pw = err && err.name === 'PasswordException';
      toast(t(pw ? 'pdfPassword' : 'unsupported', { name: f.name }), true);
      dropFile(rec);
    }
  }
  if (count) {
    state.sort.key = null;
    toast(t('added', { n: count }));
  }
  renderGrid();
  renderLists();
  updateSummary();
}

function addImage(rec) {
  const page = { id: nextId(), kind: 'image', file: rec, pageNo: 1, w: 0, h: 0, thumb: null, loading: true };
  state.pages.push(page);
  enqueueThumb(page);
  return 1;
}

async function addPdf(rec) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await rec.file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  rec.pdf = doc;
  const newPages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i);
    const vp = pg.getViewport({ scale: 1 });
    newPages.push({ id: nextId(), kind: 'pdf', file: rec, pageNo: i, w: vp.width, h: vp.height, thumb: null, loading: true });
  }
  state.pages.push(...newPages);
  newPages.forEach(enqueueThumb);
  return newPages.length;
}

function dropFile(rec) {
  state.files = state.files.filter(f => f !== rec);
  if (rec.pdf) { try { rec.pdf.destroy(); } catch { /* ignore */ } }
}

/* thumbnails are generated in a small queue so huge PDFs don't freeze the UI */
const thumbQueue = [];
let thumbActive = 0;
function enqueueThumb(page) { thumbQueue.push(page); pumpThumbs(); }
function pumpThumbs() {
  while (thumbActive < 2 && thumbQueue.length) {
    const page = thumbQueue.shift();
    if (!state.pages.includes(page)) continue;
    thumbActive++;
    makeThumb(page)
      .catch(err => {
        console.error(err);
        toast(t('unsupported', { name: page.file.name }), true);
        removePages([page.id]);
      })
      .finally(() => { thumbActive--; pumpThumbs(); });
  }
}

async function makeThumb(page) {
  const canvas = await renderPage(page, THUMB_EDGE, true);
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.8);
  if (!state.pages.includes(page)) return;
  page.thumb = URL.createObjectURL(blob);
  page.loading = false;
  updateCard(page);
}

/** Render one page to a canvas whose long edge is at most `edge` px. */
async function renderPage(page, edge, isThumb) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (page.kind === 'image') {
    const bmp = await createImageBitmap(page.file.file);
    page.w = bmp.width; page.h = bmp.height;
    const scale = Math.min(1, edge / Math.max(bmp.width, bmp.height));
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    if (isThumb) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close && bmp.close();
  } else if (page.kind === 'pdf') {
    const pg = await page.file.pdf.getPage(page.pageNo);
    const base = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: edge / Math.max(base.width, base.height) });
    canvas.width = Math.max(1, Math.round(vp.width));
    canvas.height = Math.max(1, Math.round(vp.height));
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
  }
  return canvas;
}

function canvasToBlob(canvas, type, q) {
  return new Promise(res => canvas.toBlob(res, type, q));
}

/* ------------------------------------------------------------------ */
/* page operations                                                     */
/* ------------------------------------------------------------------ */
const pageIndex = id => state.pages.findIndex(p => p.id === id);
const pageLabel = p => p.kind === 'blank' ? t('blank') : p.kind === 'pdf' ? `${p.file.name} p${p.pageNo}` : p.file.name;

function blankPage() { return { id: nextId(), kind: 'blank', file: null, pageNo: 0, w: 0, h: 0, thumb: null, loading: false }; }

function addBlank(afterId) {
  const p = blankPage();
  const i = afterId ? pageIndex(afterId) : -1;
  if (i >= 0) state.pages.splice(i + 1, 0, p); else state.pages.push(p);
  refreshAll();
  focusCard(p.id);
}

function removePages(ids) {
  const set = new Set(ids);
  state.pages.filter(p => set.has(p.id)).forEach(p => { if (p.thumb) URL.revokeObjectURL(p.thumb); });
  state.pages = state.pages.filter(p => !set.has(p.id));
  state.toc = state.toc.filter(e => !set.has(e.pageId));
  state.markers = state.markers.filter(m => !set.has(m.pageId));
  // release PDFs that no longer have pages
  state.files.filter(f => !state.pages.some(p => p.file === f)).forEach(dropFile);
  refreshAll();
}

function movePage(id, to) {
  const from = pageIndex(id);
  if (from < 0) return;
  const [p] = state.pages.splice(from, 1);
  if (from < to) to--;
  to = Math.max(0, Math.min(state.pages.length, to));
  state.pages.splice(to, 0, p);
  state.sort.key = null;
  refreshAll();
  focusCard(id);
}

function toggleMarker(pageId) {
  const i = state.markers.findIndex(m => m.pageId === pageId);
  if (i >= 0) state.markers.splice(i, 1);
  else state.markers.push({ id: nextId(), pageId, label: '' });
  refreshAll();
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
function sortBy(key) {
  if (state.sort.key === key) state.sort.asc = !state.sort.asc;
  else state.sort = { key, asc: true };
  const sign = state.sort.asc ? 1 : -1;
  // Blank pages travel with the page right before them.
  const lead = [], groups = [];
  for (const p of state.pages) {
    if (p.kind === 'blank') (groups.length ? groups[groups.length - 1].blanks : lead).push(p);
    else groups.push({ p, blanks: [] });
  }
  const primary = {
    name: (a, b) => collator.compare(a.file.name, b.file.name),
    added: (a, b) => a.file.order - b.file.order,
    size: (a, b) => a.file.size - b.file.size || collator.compare(a.file.name, b.file.name)
  }[key];
  groups.sort((x, y) => {
    const a = x.p, b = y.p;
    return sign * primary(a, b) || a.file.order - b.file.order || a.pageNo - b.pageNo;
  });
  state.pages = [...lead, ...groups.flatMap(g => [g.p, ...g.blanks])];
  refreshAll();
}

function refreshAll() { renderGrid(); renderLists(); updateSummary(); }

/* ------------------------------------------------------------------ */
/* page grid                                                           */
/* ------------------------------------------------------------------ */
const grid = $('#grid');
const ICONS = {
  marker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12v18l-6-5-6 5z"/></svg>',
  markerOn: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M6 3h12v18l-6-5-6 5z"/></svg>',
  blank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h9l3 3v15H6zM12 10v7M8.5 13.5h7"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  kids.forEach(c => c != null && e.append(c));
  return e;
}

function thumbContent(p) {
  if (p.kind === 'blank') return el('div', { class: 'blank-page', text: t('blank') });
  if (p.loading || !p.thumb) return el('div', { class: 'spinner', role: 'img', 'aria-label': t('loading') });
  return el('img', { src: p.thumb, alt: '', draggable: 'false' });
}

function renderGrid() {
  const { dir, coverSingle } = settings();
  const has = state.pages.length > 0;
  $('#workspace').classList.toggle('has-pages', has);
  $('#grid-hint').hidden = !has;
  $('#btn-clear').hidden = !has;
  $('#page-count').textContent = has ? t('pageCount', { n: state.pages.length }) : '';
  $$('.sort button').forEach(b => {
    const on = b.dataset.sort === state.sort.key;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
    b.querySelector('i').textContent = on ? (state.sort.asc ? '↑' : '↓') : '';
  });

  const focusedId = document.activeElement?.closest?.('.card')?.dataset.id;
  grid.textContent = '';
  grid.style.direction = dir;
  const items = (coverSingle && has) ? [null, ...state.pages] : [...state.pages];
  items.forEach((p, i) => {
    const pairA = i % 2 === 0;
    // Physical side of the gutter (binding side) for this slot.
    const gutterRight = (dir === 'ltr') === pairA;
    const slot = el('div', { class: `slot ${pairA ? 'pair-a' : 'pair-b'} ${gutterRight ? 'gr out-l' : 'gl out-r'}` });
    if (!p) {
      slot.classList.add('empty');
      slot.append(el('div', { class: 'thumb', 'aria-hidden': 'true' }));
      grid.append(slot);
      return;
    }
    const n = state.pages.indexOf(p) + 1;
    const marked = state.markers.some(m => m.pageId === p.id);
    const card = el('div', {
      class: 'card' + (marked ? ' marked' : ''),
      tabindex: '0',
      'data-id': p.id,
      role: 'group',
      'aria-label': `${t('pageSel')} ${n}: ${pageLabel(p)}`
    });
    const thumb = el('div', { class: 'thumb' }, thumbContent(p));
    if (coverSingle && n === 1) thumb.append(el('span', { class: 'badge', text: t('cover') }));
    card.append(
      thumb,
      el('div', { class: 'meta' },
        el('span', { class: 'handle', title: t('actDrag'), 'aria-hidden': 'true', text: '⠿' }),
        el('span', { class: 'no', text: String(n) }),
        el('span', { class: 'name', title: pageLabel(p), text: pageLabel(p) }),
        el('div', { class: 'acts' },
          el('button', { type: 'button', class: 'mk', title: t('actMarker'), 'aria-label': t('actMarker'), 'aria-pressed': String(marked), html: marked ? ICONS.markerOn : ICONS.marker, onclick: () => toggleMarker(p.id) }),
          el('button', { type: 'button', title: t('actBlankAfter'), 'aria-label': t('actBlankAfter'), html: ICONS.blank, onclick: () => addBlank(p.id) }),
          el('button', { type: 'button', class: 'del', title: t('actDelete'), 'aria-label': t('actDelete'), html: ICONS.del, onclick: () => removePages([p.id]) })
        )
      )
    );
    slot.append(card);
    grid.append(slot);
  });
  if (focusedId) focusCard(focusedId);
}

function updateCard(p) {
  const card = grid.querySelector(`.card[data-id="${p.id}"]`);
  if (!card) return;
  const thumb = card.querySelector('.thumb');
  const badge = thumb.querySelector('.badge');
  thumb.textContent = '';
  thumb.append(thumbContent(p));
  if (badge) thumb.append(badge);
}

function focusCard(id) {
  const c = grid.querySelector(`.card[data-id="${id}"]`);
  if (c) c.focus({ preventScroll: false });
}

// spreads per row follow the available width
new ResizeObserver(entries => {
  const w = entries[0].contentRect.width;
  const per = Math.max(1, Math.floor(w / 300));
  grid.style.setProperty('--spreads', per);
}).observe(grid);

// keyboard on cards
grid.addEventListener('keydown', e => {
  const card = e.target.closest('.card');
  if (!card || e.target !== card) return;
  const id = card.dataset.id;
  const i = pageIndex(id);
  const rtl = settings().dir === 'rtl';
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    const nextP = state.pages[i + 1] || state.pages[i - 1];
    removePages([id]);
    if (nextP) focusCard(nextP.id);
  } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && (e.altKey || e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    // physical left/right → reading order
    const forward = (e.key === 'ArrowRight') !== rtl;
    movePage(id, forward ? i + 2 : i - 1);
    toast(t('moved'));
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const forward = (e.key === 'ArrowRight') !== rtl;
    const target = state.pages[i + (forward ? 1 : -1)];
    if (target) focusCard(target.id);
  } else if (e.key === 'm' || e.key === 'M') {
    toggleMarker(id);
    focusCard(id);
  }
});

/* drag to reorder (pointer events: works with mouse, pen and touch) */
let drag = null;
grid.addEventListener('pointerdown', e => {
  const card = e.target.closest('.card');
  if (!card || e.button !== 0 || e.target.closest('.acts')) return;
  const onHandle = !!e.target.closest('.handle');
  if (e.pointerType !== 'mouse' && !onHandle) return;
  e.preventDefault();
  card.focus({ preventScroll: true });
  drag = { id: card.dataset.id, card, x: e.clientX, y: e.clientY, started: false, target: null, after: false, ghost: null, raf: 0, py: e.clientY };
});

window.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.started) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
    drag.started = true;
    drag.card.classList.add('dragging');
    document.body.classList.add('is-dragging');
    const img = drag.card.querySelector('.thumb img');
    drag.ghost = el('div', { class: 'drag-ghost' }, img ? el('img', { src: img.src, alt: '' }) : el('div', { class: 'thumb' }, el('div', { class: 'blank-page' })));
    document.body.append(drag.ghost);
    autoScroll();
  }
  drag.py = e.clientY;
  drag.ghost.style.left = (e.clientX + 12) + 'px';
  drag.ghost.style.top = (e.clientY + 12) + 'px';
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  const slot = hit && hit.closest && hit.closest('.grid .slot');
  if (!slot) return;
  const r = slot.getBoundingClientRect();
  const leftHalf = e.clientX < r.left + r.width / 2;
  const rtl = settings().dir === 'rtl';
  $$('.slot.drop-l, .slot.drop-r', grid).forEach(s => s.classList.remove('drop-l', 'drop-r'));
  slot.classList.add(leftHalf ? 'drop-l' : 'drop-r');
  const card = slot.querySelector('.card');
  drag.target = card ? card.dataset.id : '__start';
  drag.after = card ? (leftHalf === rtl) : false;
});

function endDrag(commit) {
  if (!drag) return;
  const d = drag;
  drag = null;
  cancelAnimationFrame(d.raf);
  if (!d.started) return;
  d.ghost && d.ghost.remove();
  document.body.classList.remove('is-dragging');
  d.card.classList.remove('dragging');
  $$('.slot.drop-l, .slot.drop-r', grid).forEach(s => s.classList.remove('drop-l', 'drop-r'));
  if (!commit || !d.target || d.target === d.id) return;
  const to = d.target === '__start' ? 0 : pageIndex(d.target) + (d.after ? 1 : 0);
  movePage(d.id, to);
}
window.addEventListener('pointerup', () => endDrag(true));
window.addEventListener('pointercancel', () => endDrag(false));
window.addEventListener('keydown', e => { if (e.key === 'Escape' && drag) endDrag(false); });

function autoScroll() {
  if (!drag || !drag.started) return;
  const ws = $('#workspace');
  const edge = 70, y = drag.py;
  const wsr = ws.getBoundingClientRect();
  const scrollsInside = ws.scrollHeight > ws.clientHeight + 1 && getComputedStyle(ws).overflowY !== 'visible';
  const top = scrollsInside ? wsr.top + 60 : 0;
  const bottom = scrollsInside ? wsr.bottom : window.innerHeight;
  let dy = 0;
  if (y < top + edge) dy = -Math.ceil((top + edge - y) / 6);
  else if (y > bottom - edge) dy = Math.ceil((y - (bottom - edge)) / 6);
  if (dy) { if (scrollsInside) ws.scrollTop += dy; else window.scrollBy(0, dy); }
  drag.raf = requestAnimationFrame(autoScroll);
}

/* ------------------------------------------------------------------ */
/* TOC / markers / links lists                                         */
/* ------------------------------------------------------------------ */
function pageSelect(pageId, onChange) {
  const s = el('select', { 'aria-label': t('pageSel') });
  state.pages.forEach((p, i) => {
    const o = el('option', { value: p.id, text: `p.${i + 1}` });
    if (p.id === pageId) o.selected = true;
    s.append(o);
  });
  s.addEventListener('change', () => onChange(s.value));
  return s;
}
const removeBtn = onclick => el('button', { type: 'button', class: 'icon-btn', title: t('remove'), 'aria-label': t('remove'), html: ICONS.del, onclick });

function sortedByPage(list) {
  return list.slice().sort((a, b) => pageIndex(a.pageId) - pageIndex(b.pageId));
}

function renderLists() {
  const has = state.pages.length > 0;
  $('#toc-add').disabled = !has;
  $('#marker-add').disabled = !has;

  const toc = $('#toc-list');
  toc.textContent = '';
  if (!has) toc.append(el('li', { class: 'empty', text: t('noPagesYet') }));
  state.toc.forEach(entry => {
    const input = el('input', { type: 'text', value: entry.title, placeholder: t('tocTitlePh'), 'aria-label': t('tocTitlePh') });
    input.addEventListener('input', () => { entry.title = input.value; });
    toc.append(el('li', {},
      pageSelect(entry.pageId, v => { entry.pageId = v; }),
      input,
      removeBtn(() => { state.toc = state.toc.filter(x => x !== entry); renderLists(); })));
  });

  const mk = $('#marker-list');
  mk.textContent = '';
  sortedByPage(state.markers).forEach(m => {
    const input = el('input', { type: 'text', value: m.label, placeholder: t('markerLabelPh'), 'aria-label': t('markerLabelPh') });
    input.addEventListener('input', () => { m.label = input.value; });
    mk.append(el('li', { class: 'marker-row' },
      pageSelect(m.pageId, v => {
        if (state.markers.some(x => x !== m && x.pageId === v)) { renderLists(); return; }
        m.pageId = v; renderGrid(); renderLists();
      }),
      input,
      removeBtn(() => { state.markers = state.markers.filter(x => x !== m); refreshAll(); })));
  });

  const links = $('#link-list');
  links.textContent = '';
  state.links.forEach(l => {
    const a = el('input', { type: 'text', class: 'lbl-in', value: l.label, placeholder: t('linkLabelPh'), 'aria-label': t('linkLabelPh'), list: 'link-presets' });
    const b = el('input', { type: 'text', value: l.value, placeholder: t('linkValuePh'), 'aria-label': t('linkValuePh') });
    a.addEventListener('input', () => { l.label = a.value; });
    b.addEventListener('input', () => { l.value = b.value; });
    links.append(el('li', {}, a, b, removeBtn(() => { state.links = state.links.filter(x => x !== l); renderLists(); })));
  });
}

$('#toc-add').addEventListener('click', () => {
  const last = state.toc[state.toc.length - 1];
  const idx = last ? Math.min(state.pages.length - 1, pageIndex(last.pageId) + 1) : 0;
  state.toc.push({ id: nextId(), pageId: state.pages[idx].id, title: '' });
  renderLists();
  $('#toc-list li:last-child input')?.focus();
});
$('#marker-add').addEventListener('click', () => {
  const free = state.pages.find(p => !state.markers.some(m => m.pageId === p.id));
  if (!free) return;
  state.markers.push({ id: nextId(), pageId: free.id, label: '' });
  refreshAll();
});
$('#link-add').addEventListener('click', () => {
  state.links.push({ id: nextId(), label: '', value: '' });
  renderLists();
  $('#link-list li:last-child input')?.focus();
});
document.body.append(el('datalist', { id: 'link-presets' },
  ...['X', 'Bluesky', 'pixiv', 'Instagram', 'Misskey', 'Web', 'Mail'].map(v => el('option', { value: v }))));

/* ------------------------------------------------------------------ */
/* toolbar, drop & paste                                               */
/* ------------------------------------------------------------------ */
const fileInput = $('#file-input');
$('#btn-add').addEventListener('click', () => fileInput.click());
const drop = $('#drop');
drop.tabIndex = 0;
drop.setAttribute('role', 'button');
drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
$('#btn-blank').addEventListener('click', () => addBlank());
$('#btn-clear').addEventListener('click', () => {
  if (confirm(t('confirmClear'))) removePages(state.pages.map(p => p.id));
});
$$('.sort button').forEach(b => b.addEventListener('click', () => { if (state.pages.length) sortBy(b.dataset.sort); }));

let dragDepth = 0;
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; $('#dragover').hidden = false; });
window.addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#dragover').hidden = true; });
window.addEventListener('drop', e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  $('#dragover').hidden = true;
  addFiles(e.dataTransfer.files);
});
window.addEventListener('paste', e => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) { e.preventDefault(); addFiles(files); }
});
window.addEventListener('beforeunload', e => {
  if (state.pages.length && !state.busy) { e.preventDefault(); e.returnValue = t('leaveWarn'); }
});

/* ------------------------------------------------------------------ */
/* export                                                              */
/* ------------------------------------------------------------------ */
function colophonData() {
  if (!$('#c-on').checked) return null;
  const v = id => $(id).value.trim();
  const c = {
    title: v('#c-title'),
    author: v('#c-author'),
    circle: v('#c-circle'),
    date: v('#c-date'),
    links: state.links.map(l => ({ label: l.label.trim(), value: l.value.trim() })).filter(l => l.value),
    feedback: v('#c-feedback'),
    hashtag: v('#c-hashtag'),
    note: $('#c-note').value.trim()
  };
  const any = c.author || c.circle || c.date || c.links.length || c.feedback || c.hashtag || c.note || c.title;
  if (!any) return null;
  if (!c.title) c.title = $('#f-title').value.trim();
  return c;
}

function updateSummary() {
  const s = settings();
  const n = state.pages.length;
  let txt = t('summary', {
    n,
    dir: t(s.dir),
    view: t({ spread: 'viewSpread', single: 'viewSingle', auto: 'viewAuto' }[s.view])
  });
  if (colophonData()) txt += ' ' + t('summaryColophon');
  $('#summary').textContent = txt;
}
['#c-title', '#c-author', '#c-circle', '#c-date', '#c-feedback', '#c-hashtag', '#c-note'].forEach(id => $(id).addEventListener('input', updateSummary));

function progress(ratio, text, kind) {
  const box = $('#progress');
  box.hidden = false;
  box.classList.toggle('ok', kind === 'ok');
  box.classList.toggle('err', kind === 'err');
  $('#progress-bar').style.width = Math.round(ratio * 100) + '%';
  $('#progress-text').textContent = text;
}

function bytesToB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}
function blobToB64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); res(s.slice(s.indexOf(',') + 1)); };
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jsonForScript = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const formatSize = b => b < 1024 * 1024 ? (b / 1024).toFixed(0) + ' KB' : (b / 1024 / 1024).toFixed(1) + ' MB';

function validate() {
  if (!state.pages.length) return t('errNoPages');
  if ($('#e-enc').checked) {
    if (!$('#e-pass').value) return t('errNoPass');
    if ($('#e-pass').value !== $('#e-pass2').value) return t('errPassMismatch');
    if (!(crypto && crypto.subtle)) return t('errNoCrypto');
  }
  return null;
}

async function buildBook() {
  const s = settings();
  const edge = parseInt($('#e-size').value, 10) || 1600;
  const q = parseFloat(radio('quality')) || 0.82;
  const title = $('#f-title').value.trim();
  const pages = state.pages.slice();
  const n = pages.length;
  const chunks = [];
  const meta = [];
  let offset = 0, fallback = false;

  for (let i = 0; i < n; i++) {
    progress(i / (n + 1), t('stepRender', { i: i + 1, n }));
    const p = pages[i];
    if (p.kind === 'blank') { meta.push({ blank: true, w: 0, h: 0 }); continue; }
    const canvas = await renderPage(p, edge, false);
    let blob = await canvasToBlob(canvas, 'image/webp', q);
    if (!blob || blob.type !== 'image/webp') { blob = await canvasToBlob(canvas, 'image/jpeg', q); fallback = true; }
    const buf = new Uint8Array(await blob.arrayBuffer());
    chunks.push(buf);
    meta.push({ w: canvas.width, h: canvas.height, o: offset, l: buf.length, t: blob.type });
    offset += buf.length;
    canvas.width = canvas.height = 0;
  }
  // Blank pages take the shape of the nearest real page.
  meta.forEach((m, i) => {
    if (!m.blank) return;
    let ref = null;
    for (let k = i - 1; k >= 0 && !ref; k--) if (!meta[k].blank) ref = meta[k];
    for (let k = i + 1; k < meta.length && !ref; k++) if (!meta[k].blank) ref = meta[k];
    m.w = ref ? ref.w : 1000; m.h = ref ? ref.h : 1414;
  });

  const idx = new Map(pages.map((p, i) => [p.id, i]));
  const book = {
    v: 1,
    title,
    settings: s,
    pages: meta,
    toc: state.toc.filter(e => idx.has(e.pageId)).map(e => ({ title: e.title.trim(), page: idx.get(e.pageId) })),
    markers: sortedByPage(state.markers).filter(m => idx.has(m.pageId)).map(m => ({ label: m.label.trim(), page: idx.get(m.pageId) })),
    colophon: colophonData()
  };
  const head = new TextEncoder().encode(JSON.stringify(book));
  const all = new Uint8Array(4 + head.length + offset);
  new DataView(all.buffer).setUint32(0, head.length);
  all.set(head, 4);
  let pos = 4 + head.length;
  for (const c of chunks) { all.set(c, pos); pos += c.length; }
  chunks.length = 0;

  let payload = all, enc = null;
  if ($('#e-enc').checked) {
    progress(n / (n + 1), t('stepEncrypt'));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode($('#e-pass').value), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    payload = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, all));
    enc = { alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iter: PBKDF2_ITER, salt: bytesToB64(salt), iv: bytesToB64(iv) };
  }

  progress(n / (n + 1), t('stepPack'));
  const b64 = await blobToB64(new Blob([payload]));
  const outer = { v: 1, id: state.bookId, title, enc };
  const htmlHead = '<!doctype html>\n<html lang="' + lang + '"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<meta name="generator" content="Seihon">' +
    '<title>' + escHtml(title || 'Seihon') + '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@400;500;700&display=swap">' +
    '<style>' + SEIHON_READER_CSS + '</style></head><body><div id="app"></div>' +
    '<noscript>JavaScript is required to read this book. / この本を読むにはJavaScriptが必要です。</noscript>' +
    '<script type="application/json" id="seihon-meta">' + jsonForScript(outer) + '</script>' +
    '<script type="application/octet-stream" id="seihon-payload">';
  const htmlTail = '</script><script>(' + SeihonReader.toString() + ')();</script></body></html>\n';
  const blob = new Blob([htmlHead, b64, htmlTail], { type: 'text/html' });
  return { blob, fallback };
}

function fileName() {
  const raw = $('#e-file').value.trim() || $('#f-title').value.trim() || 'seihon-book';
  return raw.replace(/\.html?$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120) + '.html';
}

async function run(preview) {
  if (state.busy) return;
  const err = validate();
  if (err) { progress(0, err, 'err'); toast(err, true); return; }
  let win = null;
  if (preview) {
    // Open the window synchronously so popup blockers see the user's click.
    win = window.open('', '_blank');
    if (!win) { toast(t('popupBlocked'), true); return; }
    try { win.document.title = 'Seihon'; win.document.body.textContent = t('previewOpening'); } catch { /* ignore */ }
  }
  state.busy = true;
  $('#btn-build').disabled = $('#btn-preview').disabled = true;
  try {
    if (thumbQueue.length || thumbActive) await waitThumbs();
    const { blob, fallback } = await buildBook();
    const url = URL.createObjectURL(blob);
    if (preview) {
      win.location.href = url;
    } else {
      const a = el('a', { href: url, download: fileName() });
      document.body.append(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    progress(1, t(fallback ? 'doneFallback' : 'done', { size: formatSize(blob.size) }), 'ok');
  } catch (e) {
    console.error(e);
    if (win) win.close();
    progress(1, t('failed', { msg: e && e.message ? e.message : String(e) }), 'err');
  } finally {
    state.busy = false;
    $('#btn-build').disabled = $('#btn-preview').disabled = false;
  }
}
function waitThumbs() {
  return new Promise(res => {
    const tick = () => (thumbQueue.length || thumbActive) ? setTimeout(tick, 150) : res();
    tick();
  });
}
$('#btn-build').addEventListener('click', () => run(false));
$('#btn-preview').addEventListener('click', () => run(true));

/* ------------------------------------------------------------------ */
/* boot                                                                */
/* ------------------------------------------------------------------ */
state.links.push({ id: nextId(), label: 'X', value: '' });
applyPrefs();
syncColophon();
applyI18n();

// Expose a tiny hook for automated tests.
window.__seihon = { state, addFiles, buildBook, sortBy, movePage };
