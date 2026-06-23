import { useState } from "react";
import { Moon, Palette, Sun } from "lucide-react";
import type { Prototype } from "../../lib/types";
import { MONO, useTheme, type DarkTokens } from "../../lib/theme";
import { darkVars, designSheet, expandFragment, tokensFromCss, FONT_LINK } from "../../lib/prototype";

// A lightweight, render-only preview of one component fragment — same Tailwind +
// lucide + token sheet as the real screens, but none of the store/snapshot wiring.
// `dark` previews the fragment in the prototype's dark theme: a `.dark` class on <html>
// (so a `.dark{--token}` block in the sheet + Tailwind `dark:` utilities both apply — the
// custom variant makes `dark:` class-based, mirroring the screen runtime) and a sensible
// dark canvas fallback so a fragment that only used `dark:` utilities still sits on a dark
// surface. Body bg/fg are token-driven so the system's own dark tokens win when set.
function Preview({ html, sheet, h = 132, dark = false }: { html: string; sheet: string; h?: number; dark?: boolean }) {
  const bg = dark ? "#0b0b0c" : "#fff";
  const fg = dark ? "#fafafa" : "#18181b";
  const srcDoc =
    `<!doctype html><html${dark ? ' class="dark" style="color-scheme:dark"' : ""}><head><meta charset="utf-8">` +
    FONT_LINK +
    `<style>*{box-sizing:border-box}html,body{margin:0}body{font-family:'Geist',system-ui,-apple-system,sans-serif;color:var(--color-fg,${fg});background:var(--color-bg,${bg});padding:16px}img{max-width:100%}</style>` +
    `<style>${sheet}</style>` +
    `<style type="text/tailwindcss">@custom-variant dark (&:where(.dark, .dark *));</style>` +
    `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4" defer></script>` +
    `<script src="https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js" defer></script>` +
    `<script>window.addEventListener('load',function(){try{lucide.createIcons()}catch(e){}})</script>` +
    `</head><body>${html}</body></html>`;
  return (
    <iframe
      title="component"
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-same-origin"
      style={{ width: "100%", height: h, border: "none", background: bg }}
    />
  );
}

function SectionHead({ title, count, c }: { title: string; count?: number; c: DarkTokens }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: c.faint }}>
        {title}
      </span>
      {count != null && <span style={{ fontFamily: MONO, fontSize: 11, color: c.faint }}>{count}</span>}
    </div>
  );
}

export function DesignSystemView({ prototype }: { prototype: Prototype }) {
  const { c } = useTheme();
  const [dark, setDark] = useState(false);
  const t = prototype.tokens || {};
  const components = prototype.components || {};
  const sheet = designSheet(prototype);
  // The prototype's dark-theme token overrides + whether it supports a dark theme at all
  // (a `.dark{}` block, or any component fragment using Tailwind `dark:` utilities). When it
  // does, offer a light/dark toggle that re-renders the swatches + component previews in the
  // chosen theme — so the dark side of the system is inspectable here, not only in a screen.
  const dv = darkVars(prototype.designSystem);
  const hasDark = Object.keys(dv).length > 0 || /\.dark\b/.test(prototype.designSystem || "") || /dark:/.test(JSON.stringify(components));
  const showDark = hasDark && dark;
  // The tab reads structured tokens, but the AI often authors the system as raw CSS
  // (arta_set_design_system) with a `:root` block and never sets structured tokens — which
  // used to leave this tab blank despite a real design system. Fall back to the tokens
  // recovered from that CSS per-category, so the tab reflects the system either way.
  const derived = tokensFromCss(prototype.designSystem);
  const pick = <T,>(structured: T[] | undefined, fallback: T[] | undefined): T[] =>
    structured && structured.length ? structured : fallback || [];

  const colors = pick(t.colors, derived.colors);
  const typography = pick(t.typography, derived.typography);
  const spacing = pick(t.spacing, derived.spacing);
  const radii = pick(t.radii, derived.radii);
  const shadows = pick(t.shadows, derived.shadows);
  const fonts = pick(t.fonts, derived.fonts);
  const compEntries = Object.entries(components);

  const noTokens =
    !colors.length && !typography.length && !spacing.length && !radii.length && !shadows.length && !fonts.length && !compEntries.length;
  // A design system authored as CSS that has no parseable `:root` vars (e.g. only class
  // rules) still has *something* to show — the stylesheet itself. Only truly-nothing is empty.
  const css = (prototype.designSystem || "").trim();
  const empty = noTokens && !css;

  if (empty) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2.5 text-center" style={{ color: c.faint, fontFamily: MONO }}>
          <Palette size={28} />
          <div className="max-w-[320px] text-[13px] leading-relaxed">
            No design system yet — colours, type, spacing and components appear here as the AI defines a design system (`arta_set_design_tokens` / `arta_set_design_system`).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ background: c.bg }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 24px", display: "flex", flexDirection: "column", gap: 34 }}>
        {hasDark && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginBottom: -18 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: c.faint }}>Theme</span>
            <div style={{ display: "inline-flex", border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden", background: c.panel }}>
              <button
                onClick={() => setDark(false)}
                title="Light"
                style={{ display: "grid", placeItems: "center", width: 36, height: 28, border: "none", cursor: "pointer", background: !dark ? c.accent : "transparent", color: !dark ? "#fff" : c.faint }}
              >
                <Sun size={14} />
              </button>
              <button
                onClick={() => setDark(true)}
                title="Dark"
                style={{ display: "grid", placeItems: "center", width: 36, height: 28, border: "none", cursor: "pointer", background: dark ? c.accent : "transparent", color: dark ? "#fff" : c.faint }}
              >
                <Moon size={14} />
              </button>
            </div>
          </div>
        )}
        {colors.length > 0 && (
          <section>
            <SectionHead title="Colors" count={colors.length} c={c} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
              {colors.map((col) => {
                const dvVal = dv["color-" + col.name];
                const val = showDark && dvVal ? dvVal : col.value;
                return (
                  <div key={col.name} style={{ border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden", background: c.panel }}>
                    <div style={{ height: 60, background: val, borderBottom: `1px solid ${c.border}` }} />
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ fontFamily: MONO, fontSize: 12, color: c.text }}>{col.name}</div>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: c.faint }}>
                        {val}
                        {showDark && dvVal && <span style={{ color: c.accent }}> · dark</span>}
                      </div>
                      {col.description && <div style={{ fontSize: 11, color: c.dim, marginTop: 3, lineHeight: 1.45 }}>{col.description}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {typography.length > 0 && (
          <section>
            <SectionHead title="Typography" count={typography.length} c={c} />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {typography.map((ty) => (
                <div key={ty.name} style={{ borderBottom: `1px solid ${c.borderSoft}`, paddingBottom: 16 }}>
                  <div
                    style={{
                      color: c.text,
                      fontFamily: ty.family || undefined,
                      fontSize: ty.size || undefined,
                      fontWeight: ty.weight as number | undefined,
                      lineHeight: ty.lineHeight || undefined,
                      letterSpacing: ty.letterSpacing || undefined,
                    }}
                  >
                    {ty.sample || "The quick brown fox jumps over the lazy dog"}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: c.faint, marginTop: 7 }}>
                    {ty.name}
                    {ty.size ? ` · ${ty.size}` : ""}
                    {ty.weight ? ` · ${ty.weight}` : ""}
                    {ty.lineHeight ? ` · lh ${ty.lineHeight}` : ""}
                    {ty.family ? ` · ${ty.family}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {fonts.length > 0 && (
          <section>
            <SectionHead title="Fonts" count={fonts.length} c={c} />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {fonts.map((f) => (
                <div key={f.name}>
                  <div style={{ fontFamily: f.value, fontSize: 22, color: c.text }}>Aa — {f.name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: c.faint, marginTop: 4 }}>{f.value}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {spacing.length > 0 && (
          <section>
            <SectionHead title="Spacing" count={spacing.length} c={c} />
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {spacing.map((s) => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: s.value, height: 14, background: c.accent, borderRadius: 3, flexShrink: 0, minWidth: 2 }} />
                  <span style={{ fontFamily: MONO, fontSize: 12, color: c.text }}>{s.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: c.faint }}>{s.value}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {radii.length > 0 && (
          <section>
            <SectionHead title="Radius" count={radii.length} c={c} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {radii.map((r) => (
                <div key={r.name} style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                  <div style={{ width: 64, height: 64, background: c.panel2, border: `1px solid ${c.borderStrong}`, borderRadius: r.value }} />
                  <span style={{ fontFamily: MONO, fontSize: 11.5, color: c.text }}>{r.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: c.faint }}>{r.value}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {shadows.length > 0 && (
          <section>
            <SectionHead title="Shadow" count={shadows.length} c={c} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
              {shadows.map((s) => (
                <div key={s.name} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ width: 96, height: 60, background: "#ffffff", border: "1px solid rgba(0,0,0,.06)", borderRadius: 10, boxShadow: s.value }} />
                  <span style={{ fontFamily: MONO, fontSize: 11.5, color: c.text }}>{s.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {compEntries.length > 0 && (
          <section>
            <SectionHead title="Components" count={compEntries.length} c={c} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
              {compEntries.map(([name, frag]) => (
                <div key={name} style={{ border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden", background: c.panel }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: `1px solid ${c.border}` }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: c.text, flex: 1 }}>{name}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: c.faint }}>{`{{>${name}}}`}</span>
                  </div>
                  <Preview html={expandFragment(prototype, frag)} sheet={sheet} dark={showDark} />
                </div>
              ))}
            </div>
          </section>
        )}

        {noTokens && css && (
          <section>
            <SectionHead title="Stylesheet" c={c} />
            <p style={{ fontSize: 12, color: c.dim, marginBottom: 12, lineHeight: 1.5, maxWidth: 560 }}>
              This design system is authored as CSS without structured tokens or a{" "}
              <span style={{ fontFamily: MONO }}>:root</span> variable block. Define tokens
              with <span style={{ fontFamily: MONO }}>arta_set_design_tokens</span> (or a{" "}
              <span style={{ fontFamily: MONO }}>:root</span> block) to see colours, type and
              spacing rendered here.
            </p>
            <pre
              style={{
                margin: 0,
                padding: "14px 16px",
                background: c.panel,
                border: `1px solid ${c.border}`,
                borderRadius: 10,
                overflowX: "auto",
                fontFamily: MONO,
                fontSize: 12,
                lineHeight: 1.6,
                color: c.text,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {css}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}
