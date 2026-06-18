import { useCallback, useEffect, useMemo, useRef } from "react";
import html2canvas from "html2canvas";
import type { StoreState } from "../../lib/types";
import { reportSnapshot } from "../../lib/useHarness";

export interface AnnotateTarget {
  tag: string;
  text: string;
  selector: string;
}

interface Props {
  screenId: string;
  title: string;
  html: string;
  css: string | undefined;
  designSystem: string | undefined;
  store: StoreState;
  storeVersion: number;
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
  var annotate = false;
  function up(msg){ parent.postMessage(Object.assign({ source:'harness-frame' }, msg), '*'); }
  function num(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  // Render any <i data-lucide="name"> placeholders into SVGs (lucide loads from
  // the CDN injected in <head>). Idempotent — safe to call repeatedly.
  function icons(){ try { if(window.lucide && window.lucide.createIcons) window.lucide.createIcons(); } catch(_){} }
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
      if(!d || d.source !== 'harness-parent') return;
      if(d.type === 'annotate'){ annotate = !!d.on; document.body.classList.toggle('harness-annotate', annotate); }
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
html,body{margin:0;padding:0}
body{font-family:'Geist',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;color:#18181b;background:#fff;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
button{font-family:inherit;cursor:pointer}
[data-to],[data-inc],[data-dec],[data-set]{cursor:pointer}
body.harness-annotate *{cursor:crosshair !important}
body.harness-annotate *:hover{outline:2px solid #38bdf8 !important;outline-offset:-1px}
`;

const FONT_LINK = `<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">`;

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
  title,
  html,
  css,
  designSystem,
  store,
  storeVersion,
  annotate,
  go,
  onStore,
  onError,
  onAnnotate,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const storeRef = useRef<StoreState>(store);
  storeRef.current = store;

  // Keep callbacks in refs so the single message listener never re-subscribes.
  const cbs = useRef({ go, onStore, onError, onAnnotate });
  cbs.current = { go, onStore, onError, onAnnotate };

  const srcDoc = useMemo(() => {
    const sheet = `${BASE_CSS}\n${designSystem ?? ""}\n${css ?? ""}`;
    const boot = `<script>window.__STORE__=${JSON.stringify(storeRef.current)};window.__SCREEN__=${JSON.stringify(screenId)}</script>`;
    // boot + runtime go in <head> so error capture is armed before the body
    // (and any screen-authored <script>) runs.
    return `<!doctype html><html><head><meta charset="utf-8">${FONT_LINK}<style>${sheet}</style>${boot}<script>${RUNTIME}</script>${HEAD_LIBS}</head><body>${html}</body></html>`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenId, html, css, designSystem, storeVersion]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.source !== "harness-frame") return;
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
    frameRef.current?.contentWindow?.postMessage({ source: "harness-parent", type: "annotate", on: annotate }, "*");
  }, [annotate, srcDoc]);

  // Capture the rendered screen → snapshot the agent can fetch. Runs after load
  // and (debounced) after store changes, so the picture stays current.
  const capture = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc || !doc.body) return;
    html2canvas(doc.body, {
      backgroundColor: "#ffffff",
      logging: false,
      scale: 1,
      useCORS: true,
      width: doc.body.scrollWidth,
      height: Math.min(doc.body.scrollHeight, 2400),
    })
      .then((canvas) => reportSnapshot(screenId, canvas.toDataURL("image/png")))
      .catch(() => {});
  }, [screenId]);

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
