import type { Prototype, Screen } from "./types";
import { resolveScreenHtml, designSheet } from "./prototype";
import { BASE_CSS, HEAD_LIBS } from "./screenDoc";

// Build ONE self-contained, clickable preview of the WHOLE prototype — no Arta editor
// chrome. Every screen body is embedded as data; a single <iframe> renders the active
// screen (its srcdoc rebuilt on navigation), so each screen is the SAME isolated, full-
// height document the live editor / PDF / headless capture use (faithful render, no
// dead-band, per-screen CSS isolated). `data-to` clicks switch the screen; the mock store
// (data-inc/dec/set/bind/show) persists in the parent across navigations. The result is
// served live at /preview AND downloadable as a shareable file — both from this one builder.
//
// Node-safe: imports only from ./prototype, ./screenDoc, ./types (no React / DOM libs).

const FRAMES: Record<string, { w: number; h: number; device: boolean }> = {
  ios: { w: 390, h: 844, device: true },
  android: { w: 392, h: 844, device: true },
  ipad: { w: 810, h: 1080, device: true },
  web: { w: 1280, h: 800, device: false },
  desktop: { w: 1280, h: 800, device: false },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The runtime injected INTO each screen's iframe: wire data-to navigation (→ tell the parent
// to switch screens), the mock store (mutate on data-inc/dec/set, reflect on data-bind/
// data-show), data-nav active state, and lucide icons. A trimmed sibling of the editor's
// in-frame runtime (no annotate / error-forwarding — a preview is for viewing).
const IFRAME_RUNTIME = `
(function(){
  var store = window.__STORE__ || {};
  var screenId = window.__SCREEN__;
  var SCREENS = window.__SCREENS__ || [];
  function up(msg){ parent.postMessage(Object.assign({ source:'arta-frame' }, msg), '*'); }
  function num(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function safeSel(s){ try { return document.querySelector(s); } catch(_){ return null; } }
  function icons(){ try { window.lucide && window.lucide.createIcons && window.lucide.createIcons(); } catch(_){} }
  window.addEventListener('load', function(){ icons(); setTimeout(icons, 200); });
  function markNav(){
    if(!screenId) return;
    document.querySelectorAll('[data-nav]').forEach(function(el){
      el.classList.toggle('is-active', el.getAttribute('data-nav') === screenId);
    });
  }
  function render(){
    document.querySelectorAll('[data-bind]').forEach(function(el){
      var k = el.getAttribute('data-bind');
      el.textContent = (store[k] !== undefined && store[k] !== null) ? store[k] : '';
    });
    document.querySelectorAll('[data-show]').forEach(function(el){
      var c = el.getAttribute('data-show'), vis;
      if(c.indexOf('==') > -1){ var p = c.split('=='); vis = String(store[p[0].trim()]) === p[1].trim(); }
      else { var v = store[c.trim()]; vis = !!v && v !== '0' && v !== 0; }
      el.style.display = vis ? '' : 'none';
    });
  }
  function mutate(el){
    var changed = false;
    var set = el.getAttribute('data-set');
    if(set){ set.split(';').forEach(function(pair){
      var i = pair.indexOf('='); if(i < 0) return;
      var k = pair.slice(0,i).trim(), v = pair.slice(i+1).trim();
      store[k] = (v !== '' && !isNaN(+v)) ? +v : v; changed = true;
    }); }
    var inc = el.getAttribute('data-inc');
    if(inc){ inc.split(',').forEach(function(k){ k = k.trim(); store[k] = num(store[k]) + 1; }); changed = true; }
    var dec = el.getAttribute('data-dec');
    if(dec){ dec.split(',').forEach(function(k){ k = k.trim(); store[k] = Math.max(0, num(store[k]) - 1); }); changed = true; }
    if(changed){ render(); up({ type:'store', store: store }); }
  }
  document.addEventListener('click', function(e){
    var a = e.target.closest('a[href]');
    if(a && !a.hasAttribute('data-to') && !a.hasAttribute('data-set') && !a.hasAttribute('data-inc') && !a.hasAttribute('data-dec')){
      var href = a.getAttribute('href') || '';
      if(href.charAt(0) === '#'){ if(href === '#' || !safeSel(href)) e.preventDefault(); return; }
      e.preventDefault();
      var seg = href.replace(/[?#].*$/, '').replace(/^[a-z]+:\\/\\/[^/]+/i, '').replace(/^[./]+/, '').replace(/\\/+$/, '').replace(/\\.html?$/i, '');
      var id = seg.split('/').pop();
      if(id && SCREENS.indexOf(id) > -1) up({ type:'nav', to: id });
      return;
    }
    var t = e.target.closest('[data-to],[data-set],[data-inc],[data-dec]');
    if(!t) return;
    e.preventDefault();
    if(t.hasAttribute('data-set') || t.hasAttribute('data-inc') || t.hasAttribute('data-dec')) mutate(t);
    var to = t.getAttribute('data-to');
    if(to) up({ type:'nav', to: to });
  });
  document.addEventListener('submit', function(e){ e.preventDefault(); });
  markNav(); render(); icons();
})();
`;

// Chrome for the preview shell: a neutral stage, the device centred, a slim screen switcher.
const PREVIEW_CSS = `
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:#0b0b0c;color:#e7e7ea;font-family:'Geist','Noto Sans Thai',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
.pv-stage{position:fixed;inset:0;bottom:52px;display:flex;align-items:center;justify-content:center;padding:24px;overflow:auto}
.pv-device{background:#fff;box-shadow:0 24px 64px rgba(0,0,0,.5);overflow:hidden;flex:0 0 auto;max-width:100%}
.pv-device--phone{border-radius:44px;border:1px solid #2a2a2e}
.pv-device--flat{border-radius:12px;border:1px solid #2a2a2e}
#pv{display:block;border:0;width:100%;height:100%;background:#fff}
.pv-bar{position:fixed;left:0;right:0;bottom:0;height:52px;display:flex;align-items:center;gap:6px;padding:0 12px;background:#151517;border-top:1px solid #2a2a2e;overflow-x:auto;scrollbar-width:none}
.pv-bar::-webkit-scrollbar{display:none}
.pv-title{font-size:12px;color:#8a8a90;margin-right:8px;white-space:nowrap;font-weight:600}
.pv-tab{flex:0 0 auto;font:inherit;font-size:12px;color:#a8a8ae;background:transparent;border:1px solid transparent;border-radius:8px;padding:5px 10px;cursor:pointer;white-space:nowrap}
.pv-tab:hover{color:#fff;background:#222226}
.pv-tab.is-active{color:#0b0b0c;background:#e7e7ea}
.pv-empty{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#8a8a90;font-size:14px}
`;

function safeData(value: unknown): string {
  // JSON.stringify escapes quotes/newlines; also break any </script so an embedded screen
  // body (or HEAD_LIBS, which contains </script>) can't close the parent <script> tag.
  return JSON.stringify(value).replace(/<\/(script)/gi, "<\\/$1");
}

export function buildPrototypePreview(proto: Prototype, opts: { name?: string } = {}): string {
  const screens = (proto.screens || []).filter((s): s is Screen => !!s && !!s.id);
  const name = opts.name || "Prototype";
  if (!screens.length) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(name)} — preview</title><style>${PREVIEW_CSS}</style></head><body><div class="pv-empty">No screens to preview yet.</div></body></html>`;
  }
  const start = proto.start && screens.some((s) => s.id === proto.start) ? proto.start : screens[0].id;

  const screensMap: Record<string, string> = {};
  const cssMap: Record<string, string> = {};
  const metaMap: Record<string, { frame: string; title: string }> = {};
  for (const s of screens) {
    try { screensMap[s.id] = resolveScreenHtml(proto, s); } catch { screensMap[s.id] = ""; }
    cssMap[s.id] = typeof s.css === "string" ? s.css : "";
    metaMap[s.id] = { frame: s.frame || proto.frame || "web", title: s.title || s.id };
  }
  const sheet = designSheet(proto);

  const tabs = screens
    .map((s) => `<button class="pv-tab" data-goto="${esc(s.id)}">${esc(s.title || s.id)}</button>`)
    .join("");

  // The parent shell: render the active screen into one iframe (srcdoc rebuilt on nav), hold
  // the store, relay nav/store from the iframe, and keep the URL hash in sync for deep-links.
  const PARENT = `
(function(){
  var SHEET = ${safeData(sheet)};
  var BASE = ${safeData(BASE_CSS)};
  var HEAD = ${safeData(HEAD_LIBS)};
  var RT = ${safeData(IFRAME_RUNTIME)};
  var SCREENS = ${safeData(screensMap)};
  var CSS = ${safeData(cssMap)};
  var META = ${safeData(metaMap)};
  var FRAMES = ${safeData(FRAMES)};
  var START = ${safeData(start)};
  var IDS = Object.keys(SCREENS);
  var store = ${safeData(proto.store || {})};
  var current = null;

  function buildDoc(id){
    var inject = '<scr'+'ipt>window.__STORE__='+JSON.stringify(store)+';window.__SCREEN__='+JSON.stringify(id)+';window.__SCREENS__='+JSON.stringify(IDS)+';</scr'+'ipt>';
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
      + '<style>'+BASE+'\\n'+SHEET+'\\n'+(CSS[id]||'')+'</style>'+HEAD+inject+'<scr'+'ipt>'+RT+'</scr'+'ipt>'
      + '</head><body>'+(SCREENS[id]||'')+'</body></html>';
  }
  function applyFrame(id){
    var f = (META[id]||{}).frame || 'web';
    var dim = FRAMES[f] || FRAMES.web;
    var dev = document.getElementById('pv-device');
    var ifr = document.getElementById('pv');
    dev.className = 'pv-device ' + (dim.device ? 'pv-device--phone' : 'pv-device--flat');
    var availW = window.innerWidth - 48, availH = window.innerHeight - 52 - 48;
    var scale = Math.min(1, availW / dim.w);
    var w = Math.round(dim.w * scale);
    var h = dim.device ? Math.min(dim.h * scale, availH) : availH;
    dev.style.width = w + 'px'; dev.style.height = Math.round(h) + 'px';
    ifr.style.width = dim.w + 'px'; ifr.style.height = Math.round(h / scale) + 'px';
    ifr.style.transform = 'scale(' + scale + ')'; ifr.style.transformOrigin = 'top left';
  }
  function markTabs(id){
    document.querySelectorAll('.pv-tab').forEach(function(b){ b.classList.toggle('is-active', b.getAttribute('data-goto') === id); });
  }
  function show(id){
    if(!SCREENS[id]) id = START;
    current = id;
    applyFrame(id);
    document.getElementById('pv').srcdoc = buildDoc(id);
    if(location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    markTabs(id);
  }
  window.addEventListener('message', function(e){
    var d = e.data; if(!d || d.source !== 'arta-frame') return;
    if(d.type === 'nav' && d.to){ show(d.to); }
    else if(d.type === 'store'){ store = d.store || store; }
  });
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-goto]'); if(!b) return;
    show(b.getAttribute('data-goto'));
  });
  window.addEventListener('resize', function(){ if(current) applyFrame(current); });
  window.addEventListener('hashchange', function(){ var id = location.hash.slice(1); if(id && SCREENS[id] && id !== current) show(id); });
  show(location.hash.slice(1) || START);
})();
`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} — preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${PREVIEW_CSS}</style>
</head><body>
<div class="pv-stage"><div class="pv-device" id="pv-device"><iframe id="pv" title="prototype"></iframe></div></div>
<div class="pv-bar"><span class="pv-title">${esc(name)}</span>${tabs}</div>
<script>${PARENT}</script>
</body></html>`;
}
