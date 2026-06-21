import { useState } from "react";
import { Moon, Sun, SlidersHorizontal, ChevronDown, Check } from "lucide-react";
import type { Meta } from "../lib/types";
import type { Project } from "../lib/useArta";
import { MONO, useTheme, ACCENT_PRESETS } from "../lib/theme";

export function Topbar({
  meta,
  projects = [],
  activeProject = "",
  onSelectProject,
}: {
  meta: Meta;
  projects?: Project[];
  activeProject?: string;
  onSelectProject?: (id: string) => void;
}) {
  const { c, mode, toggleMode } = useTheme();

  return (
    <div
      className="flex h-12 shrink-0 items-center gap-[14px] px-[14px]"
      style={{ borderBottom: `1px solid ${c.border}`, background: c.bg }}
    >
      <div className="flex items-center gap-[9px] whitespace-nowrap">
        <ArtaMark size={22} frame={c.text} dot={c.accent} />
        <span className="text-[14px] font-semibold tracking-[-0.2px]" style={{ color: c.text }}>
          Arta
        </span>
        <span
          className="text-[10px] leading-none"
          style={{ fontFamily: MONO, color: c.faint }}
          title="Arta plugin version"
        >
          v{__ARTA_VERSION__}
        </span>
        <span style={{ color: c.borderStrong }}>/</span>
        {projects.length > 1 ? (
          <ProjectSwitcher
            projects={projects}
            activeProject={activeProject}
            fallbackName={meta.name}
            onSelect={onSelectProject}
          />
        ) : (
          <span className="text-[14px] font-medium" style={{ color: c.dim }}>
            {meta.name}
          </span>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <Settings />
        <button
          onClick={toggleMode}
          className="flex h-7 items-center gap-1.5 rounded-[7px] px-[9px] text-[12px]"
          style={{ border: `1px solid ${c.border2}`, background: c.panel, color: c.dim }}
          title="Toggle theme"
        >
          {mode === "dark" ? <Moon size={13} /> : <Sun size={13} />}
          <span>{mode === "dark" ? "Dark" : "Light"}</span>
        </button>
        <div
          className="flex h-7 items-center gap-[7px] rounded-[7px] pl-2 pr-2.5"
          style={{ border: `1px solid ${c.border2}`, background: c.panel }}
        >
          <span
            className="h-[7px] w-[7px] rounded-full"
            style={{ background: c.green, animation: "livePulse 2.2s ease-out infinite" }}
          />
          <span className="text-[11px] font-semibold tracking-[0.4px]" style={{ color: c.text }}>
            LIVE
          </span>
          <span className="text-[11px]" style={{ fontFamily: MONO, color: c.faint }}>
            agent
          </span>
        </div>
      </div>
    </div>
  );
}

// The Arta mark — a solid "A" wedge inside a rounded canvas frame, with a live-agent
// accent dot. Monochrome: `frame` colours the frame + A (so it inverts with the theme),
// `dot` follows the accent preset. Mirrors public/favicon.svg + docs/arta-mark.svg.
function ArtaMark({ size = 22, frame, dot }: { size?: number; frame: string; dot: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" role="img" aria-label="Arta" className="block shrink-0">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke={frame} strokeWidth="1.8" />
      <path d="M12 6.6 L16.6 16 L13.9 16 L12 11.9 L10.1 16 L7.4 16 Z" fill={frame} />
      <circle cx="17.4" cy="6.6" r="1.7" fill={dot} />
    </svg>
  );
}

// The project switcher — shown only when one viewer hosts more than one canvas.
// Each `/arta` run in another project registers it, so the list builds itself; the
// pick is persisted in localStorage by useArta.
function ProjectSwitcher({
  projects,
  activeProject,
  fallbackName,
  onSelect,
}: {
  projects: Project[];
  activeProject: string;
  fallbackName: string;
  onSelect?: (id: string) => void;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const active = projects.find((p) => p.id === activeProject);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 items-center gap-1.5 rounded-[7px] pl-1.5 pr-1 text-[14px] font-medium transition-colors"
        style={{ color: c.dim, background: open ? c.panel2 : "transparent" }}
        title="Switch project"
      >
        <span className="max-w-[180px] truncate">{active?.name || fallbackName}</span>
        <ChevronDown size={13} style={{ color: c.faint }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 z-20 mt-2 max-h-[60vh] w-60 overflow-auto rounded-xl p-1.5"
            style={{ background: c.panel, border: `1px solid ${c.border2}`, boxShadow: c.shadow }}
          >
            <div
              className="px-2 pb-1.5 pt-1 text-[9.5px] font-medium uppercase tracking-[0.6px]"
              style={{ fontFamily: MONO, color: c.faint }}
            >
              Projects · {projects.length}
            </div>
            {projects.map((p) => {
              const on = p.id === activeProject;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelect?.(p.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors"
                  style={{ color: on ? c.text : c.dim, background: on ? c.panel2 : "transparent" }}
                >
                  <span className="flex-1 truncate">{p.name}</span>
                  {on && <Check size={13} style={{ color: c.accent }} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Settings() {
  const { c, accent, setAccent, grid, setGrid } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
        style={{ color: open ? c.text : c.faint, background: open ? c.panel2 : "transparent" }}
        title="View settings"
      >
        <SlidersHorizontal size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 z-20 mt-2 w-56 rounded-xl p-3.5"
            style={{ background: c.panel, border: `1px solid ${c.border2}`, boxShadow: c.shadow }}
          >
            <div
              className="mb-2.5 text-[9.5px] font-medium uppercase tracking-[0.6px]"
              style={{ fontFamily: MONO, color: c.faint }}
            >
              Accent
            </div>
            <div className="mb-4 flex gap-2">
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setAccent(p)}
                  className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                  style={{
                    background: p,
                    outline: accent === p ? `2px solid ${c.text}` : "none",
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => setGrid(!grid)}
              className="flex w-full items-center justify-between text-[12.5px]"
              style={{ color: c.dim }}
            >
              <span>Canvas grid</span>
              <span
                className="flex h-[18px] w-8 items-center rounded-full px-0.5 transition-colors"
                style={{ background: grid ? c.accent : c.borderStrong }}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full transition-transform"
                  style={{ background: "#fff", transform: grid ? "translateX(13px)" : "translateX(0)" }}
                />
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
