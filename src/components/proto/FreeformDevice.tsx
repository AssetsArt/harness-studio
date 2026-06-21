import { useCallback, useEffect, useMemo, useRef } from "react";
import { domToPng } from "modern-screenshot";
import type { StoreState } from "../../lib/types";
import { reportSnapshot } from "../../lib/useArta";
import { FONT_LINK } from "../../lib/prototype";

export interface AnnotateTarget {
  tag: string;
  text: string;
  selector: string;
}

interface Props {
  screenId: string;
  /** All screen ids in the prototype — injected so the frame can resolve a stray
   *  `<a href="screenId">` to a real nav instead of letting it reload the viewer. */
  screenIds: string[];
  title: string;
  html: string;
  css: string | undefined;
  designSystem: string | undefined;
  store: StoreState;
  storeVersion: number;
  /** The device-frame outer node to snapshot (bezel + chrome + content). When set, the
   *  snapshot captures the whole framed device — what the dev sees — instead of just the
   *  iframe body. Falls back to the iframe body if absent. */
  captureNodeRef?: React.RefObject<HTMLElement | null>;
  annotate: boolean;
  go: (to?: string) => void;
  onStore: (next: StoreState) => void;
  onError: (message: string) => void;
  onAnnotate: (target: AnnotateTarget) => void;
}

// Tiny runtime injected into each screen's iframe. It wires:
//   • navigation  — [data-to="screenId"] → tell the parent to change screen
//   • mock store  — [data-inc]/[data-dec]/[data-set] mutate, [data-bind]/[data-show] reflect
//   • annotate    — when the dev turns on comment mode, a click reports the element
//                   to the parent instead of acting (so feedback can point at it)
//   • errors      — window errors + console.error are forwarded up so the agent sees them
const RUNTIME = `
(function(){
  var store = window.__STORE__ || {};
  var screenId = window.__SCREEN__;
  var SCREENS = window.__SCREENS__ || [];
  var annotate = false;
  function up(msg){ parent.postMessage(Object.assign({ source:'arta-frame' }, msg), '*'); }
  function num(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function safeSel(s){ try { return document.querySelector(s); } catch(_){ return null; } }
  // The prototype navigates via data-to, never a real href. This frame is a srcdoc
  // iframe, so a relative href resolves against the VIEWER origin — clicking it would
  // load the whole Arta app INTO the frame (a viewer nested in itself). Warn once per
  // bad href so arta_get_view surfaces it and the agent switches to data-to.
  var _hrefWarned = {};
  function warnHref(h){
    if(_hrefWarned[h]) return; _hrefWarned[h] = 1;
    up({ type:'error', message: 'a link used href="' + h + '" to navigate — use data-to="screenId" instead; in the prototype an href reloads the viewer into itself.' });
  }
  // Render any <i data-lucide="name"> placeholders into SVGs (lucide loads from
  // the CDN injected in <head>). Idempotent — safe to call repeatedly. After it
  // runs, any <i data-lucide> still in the DOM had an UNKNOWN icon name (a typo /
  // hallucinated name like "chevron-up-down" vs "chevrons-up-down") and renders
  // BLANK. lucide only console.warns that, which is easy to miss — so surface each
  // bad name once as an error, so arta_get_view shows it and the agent can fix it.
  var _iconWarned = {};
  function icons(){
    var ready = !!(window.lucide && window.lucide.createIcons);
    if(ready){ try { window.lucide.createIcons(); } catch(_){} }
    if(!ready) return; // lucide not loaded yet — this re-runs on 'load'
    try {
      var names = [];
      document.querySelectorAll('i[data-lucide]').forEach(function(el){
        var n = el.getAttribute('data-lucide');
        if(n && !_iconWarned[n]){ _iconWarned[n] = 1; names.push(n); }
      });
      if(names.length) up({ type:'error', message: 'lucide icon name(s) not found, rendering blank: ' + names.join(', ') + ' — check exact names at lucide.dev/icons' });
    } catch(_){}
  }
  window.addEventListener('load', icons);
  window.addEventListener('error', function(e){ up({ type:'error', message: e.message + (e.filename ? (' @ ' + e.filename + ':' + e.lineno) : '') }); });
  window.addEventListener('unhandledrejection', function(e){ up({ type:'error', message: 'unhandled rejection: ' + ((e.reason && e.reason.message) || e.reason) }); });
  var _err = console.error; console.error = function(){ try { up({ type:'error', message: Array.prototype.map.call(arguments, String).join(' ') }); } catch(_){} _err.apply(console, arguments); };

  function markNav(){
    if(!screenId) return;
    document.querySelectorAll('[data-nav]').forEach(function(el){
      if(el.getAttribute('data-nav') === screenId) el.classList.add('is-active');
      else el.classList.remove('is-active');
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
  function describe(el){
    var sel = el.tagName.toLowerCase();
    if(el.id) sel += '#' + el.id;
    else if(el.className && typeof el.className === 'string') { var c0 = el.className.trim().split(/\\s+/)[0]; if(c0) sel += '.' + c0; }
    return { tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 80), selector: sel };
  }
  function init(){
    // Annotate clicks run in the capture phase so they pre-empt nav/mutate.
    document.addEventListener('click', function(e){
      if(!annotate) return;
      e.preventDefault(); e.stopPropagation();
      up({ type:'annotate', target: describe(e.target) });
    }, true);
    document.addEventListener('click', function(e){
      if(annotate) return;
      // Intercept raw <a href> nav before anything else (see warnHref). A bare data-*
      // anchor is handled below; only plain hrefs reach here.
      var a = e.target.closest('a[href]');
      if(a && !a.hasAttribute('data-to') && !a.hasAttribute('data-set') && !a.hasAttribute('data-inc') && !a.hasAttribute('data-dec')){
        var href = a.getAttribute('href') || '';
        if(href.charAt(0) === '#'){ if(href === '#' || !safeSel(href)) e.preventDefault(); return; }
        e.preventDefault();
        warnHref(href);
        // If the href names a real screen (e.g. href="/customer-status"), do that nav
        // so the agent's mistake still lands on the right screen; otherwise it's a safe
        // no-op (the destructive frame-reload is already prevented).
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
    window.addEventListener('message', function(e){
      var d = e.data;
      if(!d || d.source !== 'arta-parent') return;
      if(d.type === 'annotate'){ annotate = !!d.on; document.body.classList.toggle('arta-annotate', annotate); }
    });
    markNav();
    render();
    icons();
  }
  // Error capture is live immediately (this script is in <head>, before body
  // parses), so errors thrown by the screen's own markup are caught too. DOM
  // wiring waits until the body exists.
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
`;

const BASE_CSS = `
*{box-sizing:border-box}
/* Fill the device frame. A screen whose content is shorter than the viewport must
   still paint to the bottom edge — otherwise the area below it shows through as a
   dead WHITE band (the #1 recurring prototype defect). Two guarantees, neither
   relying on the AI remembering: html/body at full height gives min-h-full / h-full
   roots a definite parent to actually fill, and the body background defaults to the
   design's page colour (var(--color-bg)) — which propagates to the whole canvas — so
   any remaining gap is the screen's own bg, never raw white. The design system's own
   `+"`body{background:…}`"+` (loaded after this) still wins when it sets one. */
html,body{margin:0;padding:0;height:100%}
body{min-height:100%;font-family:'Geist','Noto Sans Thai',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;color:#18181b;background:var(--color-bg,#fff);-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
button{font-family:inherit;cursor:pointer}
[data-to],[data-inc],[data-dec],[data-set]{cursor:pointer}
body.arta-annotate *{cursor:crosshair !important}
body.arta-annotate *:hover{outline:2px solid #38bdf8 !important;outline-offset:-1px}
`;

// Real Tailwind + lucide in every freeform screen, so the AI writes utility
// classes and proper icons (<i data-lucide="name">) instead of emoji + inline CSS.
// Loaded via CDN and deferred so the body parses first (no blocking on the fetch);
// both run before DOMContentLoaded, so the runtime's icons() finds lucide ready.
const HEAD_LIBS =
  `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4" defer></script>` +
  // The bare `lucide` spec on jsDelivr resolves to the CJS build (no global, throws
  // "exports is not defined"); the UMD build is what exposes window.lucide.
  `<script src="https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js" defer></script>`;

export function FreeformDevice({
  screenId,
  screenIds,
  title,
  html,
  css,
  designSystem,
  store,
  storeVersion,
  captureNodeRef,
  annotate,
  go,
  onStore,
  onError,
  onAnnotate,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const storeRef = useRef<StoreState>(store);
  storeRef.current = store;
  const screenIdsRef = useRef(screenIds);
  screenIdsRef.current = screenIds;
  // Stable dep so the iframe only rebuilds when the screen LIST actually changes,
  // not on every render (screenIds is a fresh array each time).
  const screensKey = screenIds.join("");

  // Keep callbacks in refs so the single message listener never re-subscribes.
  const cbs = useRef({ go, onStore, onError, onAnnotate });
  cbs.current = { go, onStore, onError, onAnnotate };

  const srcDoc = useMemo(() => {
    const sheet = `${BASE_CSS}\n${designSystem ?? ""}\n${css ?? ""}`;
    const boot = `<script>window.__STORE__=${JSON.stringify(storeRef.current)};window.__SCREEN__=${JSON.stringify(screenId)};window.__SCREENS__=${JSON.stringify(screenIdsRef.current)}</script>`;
    // boot + runtime go in <head> so error capture is armed before the body
    // (and any screen-authored <script>) runs.
    return `<!doctype html><html><head><meta charset="utf-8">${FONT_LINK}<style>${sheet}</style>${boot}<script>${RUNTIME}</script>${HEAD_LIBS}</head><body>${html}</body></html>`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenId, html, css, designSystem, storeVersion, screensKey]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.source !== "arta-frame") return;
      if (d.type === "nav" && typeof d.to === "string") cbs.current.go(d.to);
      else if (d.type === "store" && d.store) cbs.current.onStore(d.store as StoreState);
      else if (d.type === "error" && d.message) cbs.current.onError(String(d.message));
      else if (d.type === "annotate" && d.target) cbs.current.onAnnotate(d.target as AnnotateTarget);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Push annotate mode into the frame whenever it toggles.
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({ source: "arta-parent", type: "annotate", on: annotate }, "*");
  }, [annotate, srcDoc]);

  // Capture the rendered screen → snapshot the agent can fetch. Runs after load
  // and (debounced) after store changes, so the picture stays current.
  //
  // modern-screenshot serialises the DOM into an SVG <foreignObject> and lets the
  // REAL browser engine paint it (fonts/flex/grid/shadow/gradient/transform all
  // resolve exactly as on screen) — unlike html2canvas, which reimplemented CSS in
  // JS and drifted from the live render. The screen lives in a same-origin iframe,
  // so we capture its own <html> in its own context for a faithful picture.
  const capture = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    // Prefer the device-frame outer node (bezel + status bar + home indicator + content)
    // so the snapshot is the SAME framed device the dev sees — not a bare content card.
    // modern-screenshot clones the same-origin iframe's content into it, and embeds the
    // @font-face from the PARENT document (the viewer loads all five families, see
    // index.html), so the fonts paint right. Falls back to the iframe body if the device
    // node isn't wired up.
    const node = captureNodeRef?.current ?? doc.body;
    if (!node) return;
    const shoot = () => {
      // 1) Framed device — the SAME viewport the dev sees (bezel + chrome + content).
      domToPng(node, {
        scale: 2, // crisp text for the agent to read back
        height: Math.min(node.scrollHeight, 2400),
        // No forced background — capture the device's real bg (dark bezel stays dark).
      })
        .then((dataUrl) => reportSnapshot(screenId, dataUrl))
        .catch(() => {});
      // 2) Full content — the WHOLE screen at its content length (not clipped to the
      // device viewport), so a long/scrolling screen can be reviewed end to end. Only
      // when it actually scrolls; otherwise the framed shot already shows everything
      // (arta_get_screenshot{full} falls back to it).
      const root = doc.documentElement;
      const viewportH = root.clientHeight || 0;
      const fullH = Math.max(root.scrollHeight, doc.body?.scrollHeight || 0);
      if (fullH > viewportH + 8) {
        const bg = doc.defaultView?.getComputedStyle(doc.body).backgroundColor || "#fff";
        domToPng(root, { scale: 2, height: Math.min(fullH, 8000), backgroundColor: bg })
          .then((dataUrl) => reportSnapshot(screenId, dataUrl, true))
          .catch(() => {});
      }
    };
    // Wait for web fonts before capturing — otherwise the snapshot can freeze a system
    // fallback (e.g. Fraunces → Georgia/Times). Both the iframe's fonts (the content) and
    // the parent's (the embedded @font-face the capture relies on, + the chrome text) must
    // be ready; `fonts.ready` resolves immediately if already loaded. Shoot on settle so
    // it can't hang.
    const waits = [doc.fonts?.ready, node.ownerDocument?.fonts?.ready].filter(
      (p): p is Promise<FontFaceSet> => typeof (p as Promise<unknown>)?.then === "function"
    );
    if (waits.length) Promise.all(waits).then(shoot, shoot);
    else shoot();
  }, [screenId, captureNodeRef]);

  useEffect(() => {
    const t = window.setTimeout(capture, 700);
    return () => window.clearTimeout(t);
  }, [store, capture]);

  return (
    <iframe
      ref={frameRef}
      title={title}
      srcDoc={srcDoc}
      onLoad={() => window.setTimeout(capture, 450)}
      sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
      className="h-full w-full border-0 bg-white"
    />
  );
}
