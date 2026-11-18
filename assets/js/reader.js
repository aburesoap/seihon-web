/*!
 * Seihon reader
 * This file is serialized (Function.prototype.toString) into every book that
 * Seihon builds, so SeihonReader() must stay fully self-contained:
 * no references to anything outside of its own body.
 * MIT License (c) 2026 aburesoap
 */

/* eslint-disable no-unused-vars */
const SEIHON_READER_CSS = String.raw`
:root{
  --bg:#f4f5f7;--surface:#ffffff;--surface-2:#eef0f3;--text:#1b1f24;--muted:#5d6672;--line:#d7dbe1;
  --blue:#2160c4;--blue-soft:#e3ecfa;--red:#d9431e;--green:#1d8a5a;--page:#ffffff;--shade:rgba(20,24,30,.5);--on-accent:#ffffff;
  color-scheme:light;
}
:root[data-theme="dark"]{
  --bg:#121417;--surface:#1c1f24;--surface-2:#262a31;--text:#e7e9ed;--muted:#9aa3ae;--line:#343a43;
  --blue:#6e9df0;--blue-soft:#1f2c44;--red:#ff7650;--green:#4cc38a;--page:#ffffff;--shade:rgba(0,0,0,.6);--on-accent:#0f1114;
  color-scheme:dark;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%;overflow:hidden;background:var(--bg);color:var(--text);
  font-family:"IBM Plex Sans JP",system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;
  -webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent}
button{font:inherit;color:inherit}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#app{position:fixed;inset:0}
.stage{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;touch-action:pan-y pinch-zoom;user-select:none;-webkit-user-select:none;cursor:default}
.spread{display:flex;align-items:center;justify-content:center}
.spread.rtl{flex-direction:row-reverse}
.pg{position:relative;background:var(--page);overflow:hidden;flex:none;container-type:size}
.spread.two .pg::after{content:"";position:absolute;top:0;bottom:0;width:7%;pointer-events:none}
.spread.two .pg.l::after{right:0;background:linear-gradient(to left,rgba(0,0,0,.16),rgba(0,0,0,0))}
.spread.two .pg.r::after{left:0;background:linear-gradient(to right,rgba(0,0,0,.16),rgba(0,0,0,0))}
.pg img{display:block;width:100%;height:100%;object-fit:contain;-webkit-user-drag:none;pointer-events:none}
.pg .pn{position:absolute;bottom:1.2%;font-size:11px;line-height:1;padding:3px 6px;color:#444;background:rgba(255,255,255,.75);pointer-events:none}
.pg.l .pn{left:1.5%}.pg.r .pn{right:1.5%}.pg.c .pn{left:50%;transform:translateX(-50%)}
.ribbon{position:absolute;top:0;width:clamp(14px,4.5%,26px);height:clamp(30px,9%,54px);background:var(--green);
  clip-path:polygon(0 0,100% 0,100% 100%,50% 78%,0 100%);pointer-events:none}
.pg.l .ribbon{left:8%}.pg.r .ribbon,.pg.c .ribbon{right:8%}
.colophon{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:9cqw 8cqw;color:#1b1f24;font-size:max(11px,3.3cqw);line-height:1.6}
.colophon h2{margin:0 0 .8em;font-size:1.5em;font-weight:700;border-bottom:2px solid #1b1f24;padding-bottom:.4em}
.colophon dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:.35em 1.2em}
.colophon dt{color:#5d6672;white-space:nowrap}
.colophon dd{margin:0;overflow-wrap:anywhere}
.colophon a{color:#2160c4;pointer-events:auto}
.colophon .tag{all:unset;cursor:pointer;color:#1d8a5a;font-weight:500;pointer-events:auto;border-bottom:1px dashed currentColor}
.colophon .note{margin-top:1em;white-space:pre-wrap;color:#333}
.colophon .made{margin-top:2em;font-size:.75em;color:#8a929c}
.colophon .made a{color:inherit}
.bar{position:absolute;left:0;right:0;z-index:5;display:flex;align-items:center;gap:6px;padding:8px 10px;
  background:var(--surface);border-color:var(--line);border-style:solid;border-width:0;transition:transform .2s ease,opacity .2s ease}
.top{top:0;border-bottom-width:1px;padding-top:max(8px,env(safe-area-inset-top))}
.bottom{bottom:0;border-top-width:1px;padding-bottom:max(8px,env(safe-area-inset-bottom))}
.ui-hidden .top{transform:translateY(-100%);opacity:0;pointer-events:none}
.ui-hidden .bottom{transform:translateY(100%);opacity:0;pointer-events:none}
.title{flex:1;min-width:0;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 6px}
.btn{display:inline-flex;align-items:center;gap:6px;border:1px solid transparent;background:transparent;padding:7px 10px;cursor:pointer;font-size:14px;line-height:1;white-space:nowrap}
.btn:hover{background:var(--surface-2)}
.btn:focus-visible,.tab:focus-visible,.item:focus-visible,input:focus-visible{outline:2px solid var(--blue);outline-offset:1px}
.btn svg{width:18px;height:18px;flex:none}
.btn.on{color:var(--red)}
.btn .lbl{font-size:13px}
@media (max-width:560px){.btn .lbl{display:none}}
.count{font-variant-numeric:tabular-nums;font-size:13px;color:var(--muted);min-width:88px;text-align:center}
input[type=range]{flex:1;accent-color:var(--blue);min-width:0;height:28px}
.drawer{position:absolute;top:0;bottom:0;left:0;z-index:10;width:min(380px,88vw);background:var(--surface);border-right:1px solid var(--line);
  display:flex;flex-direction:column;transform:translateX(-102%);transition:transform .2s ease}
.drawer.open{transform:none}
.veil{position:absolute;inset:0;z-index:9;background:var(--shade);opacity:0;pointer-events:none;transition:opacity .2s}
.veil.open{opacity:1;pointer-events:auto}
.dhead{display:flex;align-items:center;padding:10px 10px 0 16px;gap:8px}
.dhead h2{flex:1;margin:0;font-size:16px;font-weight:700}
.tabs{display:flex;border-bottom:1px solid var(--line);padding:0 8px;margin-top:6px}
.tab{flex:1;border:0;background:none;padding:10px 4px;cursor:pointer;font-size:14px;color:var(--muted);border-bottom:3px solid transparent;margin-bottom:-1px}
.tab[aria-selected=true]{color:var(--blue);border-bottom-color:var(--blue);font-weight:500}
.list{flex:1;overflow:auto;padding:6px 0;margin:0;list-style:none}
.item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:none;padding:11px 16px;cursor:pointer;font-size:14px}
.item:hover{background:var(--surface-2)}
.item .t{flex:1;min-width:0;overflow-wrap:anywhere}
.item .p{color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
.item.cur{box-shadow:inset 3px 0 0 var(--blue);background:var(--blue-soft)}
.dot{width:8px;height:8px;flex:none;background:var(--green)}
.dot.mine{background:var(--red)}
.row{display:flex;align-items:center}
.row .item{flex:1}
.del{border:0;background:none;color:var(--muted);cursor:pointer;padding:10px 14px;font-size:13px}
.del:hover{color:var(--red)}
.empty{padding:20px 16px;color:var(--muted);font-size:14px;line-height:1.7}
.toast{position:absolute;left:50%;bottom:76px;transform:translateX(-50%);z-index:20;background:var(--text);color:var(--bg);padding:8px 14px;font-size:13px;opacity:0;transition:opacity .2s;pointer-events:none}
.toast.show{opacity:1}
.center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:20px}
.lock{width:min(380px,100%);background:var(--surface);border:1px solid var(--line);padding:28px 24px}
.lock h1{font-size:18px;margin:0 0 6px}
.lock p{margin:0 0 18px;color:var(--muted);font-size:14px;line-height:1.6}
.lock input{width:100%;font:inherit;font-size:16px;padding:10px 12px;border:1px solid var(--line);background:var(--bg);color:var(--text)}
.lock .go{margin-top:12px;width:100%;justify-content:center;background:var(--blue);color:var(--on-accent);padding:11px;font-size:15px}
.lock .go:hover{filter:brightness(1.08);background:var(--blue)}
.lock .err{color:var(--red);font-size:13px;min-height:1.5em;margin-top:8px}
.lock .tools{display:flex;justify-content:flex-end;gap:4px;margin:-14px -10px 6px 0}
.msg{color:var(--muted);font-size:14px}
`;

function SeihonReader() {
  'use strict';
  var d = document;
  var META = JSON.parse(d.getElementById('seihon-meta').textContent);
  var root = d.documentElement;

  /* ---------- i18n ---------- */
  var T = {
    ja: {
      toc: '目次', tocShort: '目次', markers: '注目', mine: 'しおり', index: '目次・しおり',
      bookmark: 'しおり', bookmarkAdd: 'しおりを挟みました', bookmarkDel: 'しおりを外しました',
      theme: 'テーマ', light: 'ライト', dark: 'ダーク', lang: 'English', langLabel: 'Language',
      close: '閉じる', prev: '前へ', next: '次へ', page: 'ページ', remove: '外す',
      noToc: '目次はありません。', noMarkers: '製本者の注目マーカーはありません。',
      noMine: 'しおりはまだありません。上のしおりボタンで、表示中のページに挟めます。',
      locked: 'この本は鍵がかかっています', lockedHelp: 'パスワードを入力して開いてください。',
      password: 'パスワード', open: '開く', wrong: 'パスワードが違います。', loading: '読み込み中…',
      noCrypto: 'このブラウザ環境では復号できません（HTTPS またはファイルとして開いてください）。',
      broken: '本のデータを読み込めませんでした。',
      colophon: '奥付', author: '著者', circle: '発行', date: '発行日', contact: '連絡先',
      feedback: '感想', hashtag: 'ハッシュタグ', copied: 'コピーしました', made: 'Seihon で製本',
      slider: 'ページ移動', cover: '表紙'
    },
    en: {
      toc: 'Contents', tocShort: 'Contents', markers: 'Highlights', mine: 'Bookmarks', index: 'Contents & bookmarks',
      bookmark: 'Bookmark', bookmarkAdd: 'Bookmark added', bookmarkDel: 'Bookmark removed',
      theme: 'Theme', light: 'Light', dark: 'Dark', lang: '日本語', langLabel: '言語',
      close: 'Close', prev: 'Previous', next: 'Next', page: 'Page', remove: 'Remove',
      noToc: 'No table of contents.', noMarkers: 'No highlights from the author.',
      noMine: 'No bookmarks yet. Use the bookmark button above to bookmark the current page.',
      locked: 'This book is locked', lockedHelp: 'Enter the password to open it.',
      password: 'Password', open: 'Open', wrong: 'Wrong password.', loading: 'Loading…',
      noCrypto: 'This browser context cannot decrypt the book (open it over HTTPS or as a local file).',
      broken: 'Could not load the book data.',
      colophon: 'Colophon', author: 'Author', circle: 'Publisher', date: 'Published', contact: 'Contact',
      feedback: 'Feedback', hashtag: 'Hashtag', copied: 'Copied', made: 'Bound with Seihon',
      slider: 'Go to page', cover: 'Cover'
    }
  };

  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };

  var lang = LS.get('seihon.reader.lang');
  if (lang !== 'ja' && lang !== 'en') lang = /^ja\b/i.test(navigator.language || '') ? 'ja' : 'en';
  function t(k) { return T[lang][k] || k; }

  var theme = LS.get('seihon.reader.theme');
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.dataset.theme = theme;
  root.lang = lang;

  /* ---------- tiny DOM helper ---------- */
  function h(tag, attrs) {
    var el = d.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' ? d.createTextNode(c) : c);
    }
    return el;
  }

  var ICON = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12v18l-6-5-6 5z"/></svg>',
    markOn: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M6 3h12v18l-6-5-6 5z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>'
  };

  var app = d.getElementById('app');

  /* ---------- payload ---------- */
  function b64Bytes(s) {
    var bin = atob(s), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function loadPayload() {
    var s = d.getElementById('seihon-payload').textContent.trim();
    return fetch('data:application/octet-stream;base64,' + s)
      .then(function (r) { return r.arrayBuffer(); })
      .then(function (b) { return new Uint8Array(b); })
      .catch(function () { return b64Bytes(s); });
  }
  function decrypt(bytes, pass) {
    var enc = META.enc;
    var subtle = window.crypto && crypto.subtle;
    if (!subtle) return Promise.reject(new Error('nocrypto'));
    return subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return subtle.deriveKey({ name: 'PBKDF2', salt: b64Bytes(enc.salt), iterations: enc.iter, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      })
      .then(function (key) { return subtle.decrypt({ name: 'AES-GCM', iv: b64Bytes(enc.iv) }, key, bytes); })
      .then(function (b) { return new Uint8Array(b); });
  }
  function unpack(buf) {
    var len = new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(0);
    var book = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + len)));
    book.base = 4 + len;
    book.bytes = buf;
    return book;
  }

  /* ---------- state ---------- */
  var B = null;           // book
  var pages = [];         // [{w,h,kind:'img'|'blank'|'colophon',...}]
  var views = [];         // [[pageIndex,...]]
  var vi = 0;             // current view index
  var urls = {};
  var bmKey = 'seihon.bm.' + (META.id || 'book');
  var myMarks = [];
  try { myMarks = JSON.parse(LS.get(bmKey) || '[]').filter(function (x) { return typeof x === 'number'; }); } catch (e) { myMarks = []; }
  var el = {};
  var drawerTab = 'toc';

  function isRtl() { return B.settings.dir === 'rtl'; }
  function spreadMode() {
    var v = B.settings.view;
    if (v === 'spread') return true;
    if (v === 'single') return false;
    return window.innerWidth >= 700 && window.innerWidth > window.innerHeight * 1.05;
  }
  function buildViews() {
    var n = pages.length, out = [], i = 0;
    if (!spreadMode()) { for (; i < n; i++) out.push([i]); return out; }
    if (B.settings.coverSingle && n) { out.push([0]); i = 1; }
    for (; i < n; i += 2) out.push(i + 1 < n ? [i, i + 1] : [i]);
    return out;
  }
  function viewOf(p) {
    for (var i = 0; i < views.length; i++) if (views[i].indexOf(p) >= 0) return i;
    return 0;
  }
  function urlFor(i) {
    if (urls[i]) return urls[i];
    var p = pages[i];
    var blob = new Blob([B.bytes.subarray(B.base + p.o, B.base + p.o + p.l)], { type: p.t || 'image/webp' });
    urls[i] = URL.createObjectURL(blob);
    return urls[i];
  }
  function markerFor(i) {
    for (var k = 0; k < B.markers.length; k++) if (B.markers[k].page === i) return B.markers[k];
    return null;
  }

  /* ---------- rendering ---------- */
  function colophonEl() {
    var c = B.colophon, dl = h('dl');
    function row(label, node) { if (node) { dl.appendChild(h('dt', { text: label })); dl.appendChild(h('dd', null, node)); } }
    function linky(v) {
      v = String(v || '').trim();
      if (!v) return null;
      if (/^https?:\/\//i.test(v)) return h('a', { href: v, target: '_blank', rel: 'noopener noreferrer', text: v });
      return d.createTextNode(v);
    }
    row(t('author'), linky(c.author));
    row(t('circle'), linky(c.circle));
    row(t('date'), linky(c.date));
    (c.links || []).forEach(function (l) { row(l.label || t('contact'), linky(l.value)); });
    row(t('feedback'), linky(c.feedback));
    if (c.hashtag) {
      var tags = String(c.hashtag).split(/[\s,、]+/).filter(Boolean).map(function (x) { return x.charAt(0) === '#' ? x : '#' + x; });
      var wrap = h('span');
      tags.forEach(function (tg, i) {
        if (i) wrap.appendChild(d.createTextNode(' '));
        wrap.appendChild(h('button', { class: 'tag', type: 'button', text: tg, onclick: function (e) { e.stopPropagation(); copy(tg); } }));
      });
      row(t('hashtag'), wrap);
    }
    return h('div', { class: 'colophon' },
      h('h2', { text: c.title || B.title || t('colophon') }),
      dl,
      c.note ? h('div', { class: 'note', text: c.note }) : null,
      h('div', { class: 'made' }, h('a', { href: 'https://aburesoap.github.io/seihon/', target: '_blank', rel: 'noopener noreferrer', text: t('made') }))
    );
  }

  function render() {
    var v = views[vi] || [];
    var stage = el.stage;
    // Fit pages between the bars while they are shown; use the full screen when hidden.
    var hidden = root.classList.contains('ui-hidden');
    stage.style.top = hidden ? '0px' : el.top.offsetHeight + 'px';
    stage.style.bottom = hidden ? '0px' : el.bottom.offsetHeight + 'px';
    var W = stage.clientWidth - 16, H = stage.clientHeight - 16;
    var ratio = 0;
    v.forEach(function (p) { ratio += pages[p].w / pages[p].h; });
    var ph = Math.max(50, Math.min(H, W / ratio));
    var two = v.length === 2;
    var sp = h('div', { class: 'spread' + (isRtl() ? ' rtl' : '') + (two ? ' two' : '') });
    v.forEach(function (p, k) {
      var pg = pages[p];
      // Physical side on screen: in a two-page spread the first page (reading
      // order) sits on the left in ltr books and on the right in rtl books.
      var side = !two ? 'c' : ((k === 0) !== isRtl() ? 'l' : 'r');
      var box = h('div', { class: 'pg ' + side });
      box.style.height = Math.floor(ph) + 'px';
      box.style.width = Math.floor(ph * pg.w / pg.h) + 'px';
      if (pg.kind === 'img') box.appendChild(h('img', { src: urlFor(p), alt: t('page') + ' ' + (p + 1), draggable: 'false' }));
      else if (pg.kind === 'colophon') box.appendChild(colophonEl());
      var m = markerFor(p);
      if (m) box.appendChild(h('div', { class: 'ribbon', title: m.label || '' }));
      if (B.settings.pageNumbers && pg.kind !== 'colophon') box.appendChild(h('div', { class: 'pn', text: String(p + 1) }));
      sp.appendChild(box);
    });
    stage.textContent = '';
    stage.appendChild(sp);
    // preload neighbours
    [vi - 1, vi + 1, vi + 2].forEach(function (j) {
      (views[j] || []).forEach(function (p) { if (pages[p].kind === 'img') { var im = new Image(); im.src = urlFor(p); } });
    });
    updateChrome();
  }

  function pageLabel() {
    var v = views[vi] || [0];
    var a = v[0] + 1, b = v[v.length - 1] + 1;
    return (a === b ? a : Math.min(a, b) + '–' + Math.max(a, b)) + ' / ' + pages.length;
  }
  function updateChrome() {
    el.count.textContent = pageLabel();
    el.slider.max = String(Math.max(0, views.length - 1));
    el.slider.value = String(vi);
    el.slider.setAttribute('aria-valuetext', pageLabel());
    var on = isMarkedView();
    el.bm.classList.toggle('on', on);
    el.bm.setAttribute('aria-pressed', on ? 'true' : 'false');
    el.bm.querySelector('.ic').innerHTML = on ? ICON.markOn : ICON.mark;
    if (el.drawer.classList.contains('open')) fillList();
  }

  function go(n) {
    n = Math.max(0, Math.min(views.length - 1, n));
    if (n === vi && el.stage.firstChild) return;
    vi = n;
    render();
  }
  function goPage(p) { go(viewOf(p)); }
  function next() { go(vi + 1); }
  function prev() { go(vi - 1); }
  // Physical direction helpers: "left" means the page to the left on screen.
  function goLeft() { if (isRtl()) next(); else prev(); }
  function goRight() { if (isRtl()) prev(); else next(); }

  function relayout() {
    var cur = (views[vi] || [0])[0];
    views = buildViews();
    vi = viewOf(cur);
    render();
  }

  /* ---------- bookmarks ---------- */
  function isMarkedView() {
    return (views[vi] || []).some(function (p) { return myMarks.indexOf(p) >= 0; });
  }
  function saveMarks() { LS.set(bmKey, JSON.stringify(myMarks)); }
  function toggleMark() {
    var v = views[vi] || [];
    if (isMarkedView()) {
      myMarks = myMarks.filter(function (p) { return v.indexOf(p) < 0; });
      toast(t('bookmarkDel'));
    } else {
      myMarks.push(Math.min.apply(null, v));
      myMarks.sort(function (a, b) { return a - b; });
      toast(t('bookmarkAdd'));
    }
    saveMarks();
    updateChrome();
  }

  var toastTimer = 0;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 1600);
  }
  function copy(text) {
    var done = function () { toast(t('copied') + ': ' + text); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = h('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text; d.body.appendChild(ta); ta.select();
    try { d.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
  }

  /* ---------- drawer ---------- */
  function openDrawer() {
    el.drawer.classList.add('open'); el.veil.classList.add('open');
    el.drawer.removeAttribute('inert'); el.drawer.setAttribute('aria-hidden', 'false');
    fillList();
    setTimeout(function () { var s = el.drawer.querySelector('.tab[aria-selected=true]'); if (s) s.focus(); }, 50);
  }
  function closeDrawer() {
    el.drawer.classList.remove('open'); el.veil.classList.remove('open');
    el.drawer.setAttribute('inert', ''); el.drawer.setAttribute('aria-hidden', 'true');
  }
  function fillList() {
    var list = el.list;
    list.textContent = '';
    [].forEach.call(el.drawer.querySelectorAll('.tab'), function (b) { b.setAttribute('aria-selected', b.dataset.k === drawerTab ? 'true' : 'false'); });
    var cur = views[vi] || [];
    function item(title, p, dot, extra) {
      var b = h('button', { class: 'item' + (cur.indexOf(p) >= 0 ? ' cur' : ''), type: 'button', onclick: function () { goPage(p); closeDrawer(); } },
        dot ? h('span', { class: 'dot' + (dot === 'mine' ? ' mine' : '') }) : null,
        h('span', { class: 't', text: title }),
        h('span', { class: 'p', text: 'p.' + (p + 1) }));
      if (!extra) return h('li', null, b);
      return h('li', { class: 'row' }, b, extra);
    }
    var rows = [];
    if (drawerTab === 'toc') {
      B.toc.forEach(function (e) { rows.push(item(e.title || (t('page') + ' ' + (e.page + 1)), e.page)); });
      if (!rows.length) rows.push(h('li', { class: 'empty', text: t('noToc') }));
    } else if (drawerTab === 'markers') {
      B.markers.forEach(function (m) { rows.push(item(m.label || (t('page') + ' ' + (m.page + 1)), m.page, 'marker')); });
      if (!rows.length) rows.push(h('li', { class: 'empty', text: t('noMarkers') }));
    } else {
      myMarks.forEach(function (p) {
        if (p >= pages.length) return;
        var tocTitle = '';
        B.toc.forEach(function (e) { if (e.page <= p) tocTitle = e.title; });
        rows.push(item((tocTitle ? tocTitle + ' · ' : '') + t('page') + ' ' + (p + 1), p, 'mine',
          h('button', { class: 'del', type: 'button', text: t('remove'), 'aria-label': t('remove') + ' p.' + (p + 1),
            onclick: function () { myMarks = myMarks.filter(function (x) { return x !== p; }); saveMarks(); updateChrome(); fillList(); } })));
      });
      if (!rows.length) rows.push(h('li', { class: 'empty', text: t('noMine') }));
    }
    rows.forEach(function (r) { list.appendChild(r); });
  }

  /* ---------- chrome ---------- */
  function setTheme(v) { theme = v; root.dataset.theme = v; LS.set('seihon.reader.theme', v); buildChrome(); }
  function setLang(v) { lang = v; root.lang = v; LS.set('seihon.reader.lang', v); buildChrome(); }

  function buildChrome() {
    var keepOpen = el.drawer && el.drawer.classList.contains('open');
    var stage = el.stage || h('div', { class: 'stage', role: 'region', 'aria-label': B.title || 'Seihon' });
    app.textContent = '';
    el.stage = stage;
    function btn(icon, label, onclick, extra) {
      var b = h('button', Object.assign({ class: 'btn', type: 'button', title: label, 'aria-label': label, onclick: onclick }, extra || {}),
        h('span', { class: 'ic', html: icon }), h('span', { class: 'lbl', text: label }));
      return b;
    }
    el.bm = btn(ICON.mark, t('bookmark'), toggleMark, { 'aria-pressed': 'false' });
    var top = h('div', { class: 'bar top' },
      btn(ICON.menu, t('tocShort'), openDrawer, { 'aria-haspopup': 'dialog' }),
      h('div', { class: 'title', text: B.title || '' }),
      el.bm,
      btn(theme === 'dark' ? ICON.sun : ICON.moon, theme === 'dark' ? t('light') : t('dark'), function () { setTheme(theme === 'dark' ? 'light' : 'dark'); }),
      btn(ICON.globe, t('lang'), function () { setLang(lang === 'ja' ? 'en' : 'ja'); }, { lang: lang === 'ja' ? 'en' : 'ja' })
    );
    el.count = h('div', { class: 'count', 'aria-live': 'polite' });
    el.slider = h('input', { type: 'range', min: '0', step: '1', 'aria-label': t('slider'), dir: isRtl() ? 'rtl' : 'ltr' });
    el.slider.addEventListener('input', function () { go(parseInt(el.slider.value, 10) || 0); });
    var bottom = h('div', { class: 'bar bottom' },
      btn(ICON.left, isRtl() ? t('next') : t('prev'), goLeft),
      el.slider,
      btn(ICON.right, isRtl() ? t('prev') : t('next'), goRight),
      el.count
    );
    [].forEach.call(bottom.querySelectorAll('.lbl'), function (l) { l.classList.add('sr-only'); });
    el.list = h('ul', { class: 'list' });
    function tab(k, label) {
      return h('button', { class: 'tab', type: 'button', role: 'tab', 'data-k': k, text: label, onclick: function () { drawerTab = k; fillList(); } });
    }
    el.drawer = h('div', { class: 'drawer', role: 'dialog', 'aria-label': t('index'), 'aria-hidden': 'true', inert: '' },
      h('div', { class: 'dhead' }, h('h2', { text: t('index') }), btn(ICON.close, t('close'), closeDrawer)),
      h('div', { class: 'tabs', role: 'tablist' }, tab('toc', t('toc')), tab('markers', t('markers')), tab('mine', t('mine'))),
      el.list);
    el.drawer.querySelector('.dhead .lbl').classList.add('sr-only');
    el.veil = h('div', { class: 'veil', onclick: closeDrawer });
    el.toast = h('div', { class: 'toast', role: 'status' });
    el.top = top; el.bottom = bottom;
    app.appendChild(stage); app.appendChild(top); app.appendChild(bottom);
    app.appendChild(el.veil); app.appendChild(el.drawer); app.appendChild(el.toast);
    if (keepOpen) { el.drawer.classList.add('open'); el.veil.classList.add('open'); el.drawer.removeAttribute('inert'); }
    updateChrome();
  }

  function bindInput() {
    var sx = 0, sy = 0, st = 0, down = false;
    el.stage.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      down = true; sx = e.clientX; sy = e.clientY; st = Date.now();
    });
    el.stage.addEventListener('pointercancel', function () { down = false; });
    el.stage.addEventListener('pointerup', function (e) {
      if (!down) return;
      down = false;
      if (e.target.closest && e.target.closest('a,button')) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2 && Date.now() - st < 900) {
        // Finger moving right reveals the page on the left.
        if (dx > 0) goLeft(); else goRight();
        return;
      }
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        var r = el.stage.getBoundingClientRect();
        var fx = (e.clientX - r.left) / r.width;
        if (fx < 0.3) goLeft();
        else if (fx > 0.7) goRight();
        else { root.classList.toggle('ui-hidden'); render(); }
      }
    });
    d.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'range') return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var k = e.key;
      if (k === 'Escape') { closeDrawer(); return; }
      if (el.drawer.classList.contains('open')) return;
      if (e.target && e.target.type === 'range') return;
      if (k === 'ArrowLeft') { goLeft(); e.preventDefault(); }
      else if (k === 'ArrowRight') { goRight(); e.preventDefault(); }
      else if (k === 'PageDown' || (k === ' ' && !e.shiftKey) || k === 'ArrowDown') { next(); e.preventDefault(); }
      else if (k === 'PageUp' || (k === ' ' && e.shiftKey) || k === 'ArrowUp') { prev(); e.preventDefault(); }
      else if (k === 'Home') { go(0); e.preventDefault(); }
      else if (k === 'End') { go(views.length - 1); e.preventDefault(); }
    });
    var rt = 0;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(relayout, 80); });
    if (window.matchMedia && !LS.get('seihon.reader.theme')) {
      var mq = matchMedia('(prefers-color-scheme: dark)');
      var onMq = function () { if (!LS.get('seihon.reader.theme')) { theme = mq.matches ? 'dark' : 'light'; root.dataset.theme = theme; buildChrome(); } };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
    }
  }

  function start(book) {
    B = book;
    B.toc = B.toc || []; B.markers = B.markers || [];
    if (B.title) d.title = B.title;
    pages = B.pages.map(function (p) { return Object.assign({ kind: p.blank ? 'blank' : 'img' }, p); });
    if (B.colophon) {
      var ref = pages[0] || { w: 1, h: 1.414 };
      pages.push({ kind: 'colophon', w: ref.w, h: ref.h });
    }
    views = buildViews();
    vi = 0;
    buildChrome();
    bindInput();
    render();
  }

  /* ---------- boot ---------- */
  function showMessage(msg) { app.textContent = ''; app.appendChild(h('div', { class: 'center' }, h('p', { class: 'msg', text: msg }))); }

  function lockScreen(bytes) {
    function draw(errMsg) {
      app.textContent = '';
      var input = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': t('password'), placeholder: t('password'), required: true });
      var err = h('div', { class: 'err', role: 'alert', text: errMsg || '' });
      var go2 = h('button', { class: 'btn go', type: 'submit', text: t('open') });
      var form = h('form', { class: 'lock', onsubmit: function (e) {
        e.preventDefault();
        go2.disabled = true; err.textContent = t('loading');
        decrypt(bytes, input.value).then(function (buf) {
          start(unpack(buf));
        }).catch(function (ex) {
          go2.disabled = false;
          err.textContent = ex && ex.message === 'nocrypto' ? t('noCrypto') : t('wrong');
          input.select();
        });
      } },
        h('div', { class: 'tools' },
          h('button', { class: 'btn', type: 'button', 'aria-label': theme === 'dark' ? t('light') : t('dark'), html: theme === 'dark' ? ICON.sun : ICON.moon,
            onclick: function () { theme = theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = theme; LS.set('seihon.reader.theme', theme); draw(err.textContent); } }),
          h('button', { class: 'btn', type: 'button', text: t('lang'), onclick: function () { lang = lang === 'ja' ? 'en' : 'ja'; root.lang = lang; LS.set('seihon.reader.lang', lang); draw(); } })),
        h('h1', { text: META.title || t('locked') }),
        h('p', { text: (META.title ? t('locked') + '。' : '') + t('lockedHelp') }),
        input, go2, err);
      if (lang === 'en' && META.title) form.querySelector('p').textContent = t('locked') + '. ' + t('lockedHelp');
      app.appendChild(h('div', { class: 'center' }, form));
      input.focus();
    }
    draw();
  }

  showMessage(t('loading'));
  loadPayload().then(function (bytes) {
    if (META.enc) lockScreen(bytes);
    else start(unpack(bytes));
  }).catch(function (e) {
    console.error(e);
    showMessage(t('broken'));
  });
}
