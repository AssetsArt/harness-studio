import type { Prototype, Screen } from "./types";
import { resolveScreenHtml, designSheet, FONT_LINK } from "./prototype";

// The shared building blocks for ONE freeform screen's standalone document. Kept free of any
// React / browser-only imports so it can run in Node too (the dev server renders screens for
// the headless-Chrome snapshot here, the same way the live iframe and the PDF export do — so
// all three paint identically). The live iframe layers its own interactive runtime on top of
// BASE_CSS + HEAD_LIBS; the static renders (export, headless) use buildScreenDoc below.

export const BASE_CSS = `
*{box-sizing:border-box;scrollbar-width:none}
/* Fill the device frame. A screen whose content is shorter than the viewport must
   still paint to the bottom edge — otherwise the area below it shows through as a
   dead WHITE band (the #1 recurring prototype defect). Two guarantees, neither
   relying on the AI remembering: html/body at full height gives min-h-full / h-full
   roots a definite parent to actually fill, and the body background defaults to the
   design's page colour (var(--color-bg)) — which propagates to the whole canvas — so
   any remaining gap is the screen's own bg, never raw white. The design system's own
   `+"`body{background:…}`"+` (loaded after this) still wins when it sets one. */
html,body{margin:0;padding:0;height:100%}
/* Kill horizontal scroll on every screen (the AI's long-word headings + image grids
   are the usual culprits). "clip" — never "hidden" — because clip does NOT create a
   scroll container, so it preserves position:sticky/fixed bars and the full-capture
   unclamp. This is an enforced floor: a screen can't accidentally ship a sideways
   scrollbar regardless of what the AI wrote. (hallmark slop-test gate 34.) */
html,body{overflow-x:clip}
/* Hide the scrollbar track inside the device on every frame — content still scrolls
   (wheel/touch), there is just no visible bar, the way a real phone or app looks. */
::-webkit-scrollbar{width:0;height:0}
body{min-height:100%;font-family:'Geist','Noto Sans Thai',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;color:#18181b;background:var(--color-bg,#fff);-webkit-font-smoothing:antialiased}
/* Long compound words ("AI-generated", uppercase brand names) overflow the viewport
   because their only break point is the hyphen — let the engine break inside the word
   as a last resort so a display heading never punches past the edge. (gate 51.) */
h1,h2,h3{overflow-wrap:anywhere}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
button{font-family:inherit;cursor:pointer}
/* Keyboard-focus ring fallback: every interactive element shows a visible ring even
   when the AI forgot one. Low specificity + appears INSTANTLY (no transition) so a
   keyboard user always gets an indicator; an explicit focus utility still overrides
   it (a single utility wins the cascade). Brand-tinted, falls through to a safe hue.
   (gate 26 — :focus-visible present on every control.) */
:focus-visible{outline:2px solid var(--color-primary,var(--color-brand,#6366f1));outline-offset:2px}
[data-to],[data-inc],[data-dec],[data-set]{cursor:pointer}
body.arta-annotate *{cursor:crosshair !important}
body.arta-annotate *:hover{outline:2px solid #38bdf8 !important;outline-offset:-1px}
/* ---- Rich-screen kit — primitives the recurring content patterns (category/card
   rails, image covers) need and that are fiddly in raw utilities. Opt-in via class;
   compose Tailwind on top (a single utility wins the cascade, so gap-*/rounded-*/h-*
   still override these defaults). ---- */
/* Horizontal rail: scrolls sideways, snaps, hides its bar, lets the next item PEEK
   past the edge (the "there's more" affordance). Children keep their own width. */
.hs-rail{display:flex;gap:.75rem;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.hs-rail::-webkit-scrollbar{display:none}
.hs-rail>*{flex:0 0 auto;scroll-snap-align:start}
/* Cover placeholder — a brand-tinted gradient surface for an image slot, NEVER a flat
   gray box (the loudest slop tell). Falls through the common brand token names, then a
   hex; lay a real <img> over it when there is one. */
.hs-cover{background-image:linear-gradient(135deg,color-mix(in oklab,var(--color-primary,var(--color-brand,#6366f1)) 26%,#fff),color-mix(in oklab,var(--color-accent,var(--color-primary,var(--color-brand,#ec4899))) 32%,#fff))}
`;

// Real Tailwind + lucide in every freeform screen, so the AI writes utility classes and
// proper icons (<i data-lucide="name">) instead of emoji + inline CSS. Loaded via CDN and
// deferred so the body parses first; both run before DOMContentLoaded.
export const HEAD_LIBS =
  `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4" defer></script>` +
  // The bare `lucide` spec on jsDelivr resolves to the CJS build (no global, throws
  // "exports is not defined"); the UMD build is what exposes window.lucide.
  `<script src="https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js" defer></script>`;

// A minimal init for a STATIC render (PDF export, headless snapshot): render lucide icons and
// reflect the mock store into data-bind/data-show — WITHOUT the live runtime's nav / parent
// postMessage wiring (a static render has no parent to talk to and must not navigate).
const RENDER_INIT = `<script>
(function(){
  function icons(){ try{ window.lucide && window.lucide.createIcons && window.lucide.createIcons(); }catch(_){} }
  function render(){ var s=window.__STORE__||{};
    document.querySelectorAll('[data-bind]').forEach(function(el){ var k=el.getAttribute('data-bind'); if(s[k]!=null) el.textContent=s[k]; });
    document.querySelectorAll('[data-show]').forEach(function(el){ var c=el.getAttribute('data-show'),v; if(c.indexOf('==')>-1){var p=c.split('==');v=String(s[p[0].trim()])===p[1].trim();}else{var x=s[c.trim()];v=!!x&&x!=='0'&&x!==0;} el.style.display=v?'':'none'; });
  }
  function boot(){ render(); icons(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', function(){ icons(); setTimeout(icons, 250); });
})();
</script>`;

// The full standalone HTML for one screen, used by the PDF export and the headless-Chrome
// snapshot. Mirrors the live iframe's document (same BASE_CSS + design system + screen CSS +
// Tailwind/lucide) so a static render paints exactly like the live one — minus interactivity.
export function buildScreenDoc(proto: Prototype, screen: Screen): string {
  const sheet = `${BASE_CSS}\n${designSheet(proto)}\n${screen.css ?? ""}`;
  const html = resolveScreenHtml(proto, screen);
  const boot = `<script>window.__STORE__=${JSON.stringify(proto.store ?? {})}</script>`;
  return `<!doctype html><html><head><meta charset="utf-8">${FONT_LINK}<style>${sheet}</style>${boot}${RENDER_INIT}${HEAD_LIBS}</head><body>${html}</body></html>`;
}
