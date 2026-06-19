import { useEffect, useState } from "react";
import { AppWindow, Maximize, Monitor, MessageSquarePlus, Send, Smartphone, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FrameKind, Prototype, Spec, StoreState } from "../../lib/types";
import { LIGHT, MONO, useTheme } from "../../lib/theme";
import { alpha, cn } from "../../lib/utils";
import { designSheet, resolveScreenHtml } from "../../lib/prototype";
import { sendFeedback } from "../../lib/useHarness";
import { ComponentRenderer } from "../proto/ComponentRenderer";
import { DeviceFrame } from "../proto/DeviceFrame";
import { FreeformDevice } from "../proto/FreeformDevice";
import type { AnnotateTarget } from "../proto/FreeformDevice";
import { SpecRail } from "./SpecRail";
import { DesignSystemView } from "./DesignSystemView";

interface Props {
  prototype: Prototype;
  spec: Spec;
  screen: string | undefined;
  go: (to?: string) => void;
  specOpen: boolean;
  onToggleSpec: () => void;
  store: StoreState;
  storeVersion: number;
  onStore: (next: StoreState) => void;
  onError: (message: string) => void;
}

const FRAMES: { key: FrameKind; label: string; Icon: LucideIcon }[] = [
  { key: "web", label: "Web", Icon: Monitor },
  { key: "desktop", label: "Desktop", Icon: AppWindow },
  { key: "ios", label: "iOS", Icon: Smartphone },
  { key: "android", label: "Android", Icon: Smartphone },
];

export function PrototypeTab({
  prototype,
  spec,
  screen,
  go,
  specOpen,
  onToggleSpec,
  store,
  storeVersion,
  onStore,
  onError,
}: Props) {
  const { c, grid } = useTheme();
  const [view, setView] = useState<"preview" | "design">("preview");
  const screens = prototype.screens || [];
  const cur = screens.find((s) => s.id === screen) || screens[0] || { id: "", title: "—" };
  const freeform = typeof cur.html === "string";

  const stateFrame: FrameKind = cur.frame || prototype.frame || "web";
  const [frameOverride, setFrameOverride] = useState<FrameKind | null>(null);
  useEffect(() => setFrameOverride(null), [stateFrame]);
  const frame = frameOverride ?? stateFrame;
  const isMobile = frame === "ios" || frame === "android";

  // Full / full-bleed toggle: hide the status bar + home indicator (no safe area).
  const stateChrome = cur.chrome ?? prototype.chrome ?? true;
  const [chromeOverride, setChromeOverride] = useState<boolean | null>(null);
  useEffect(() => setChromeOverride(null), [stateChrome]);
  const chrome = chromeOverride ?? stateChrome;

  // Comment-on-element mode: click an element in the prototype to attach feedback.
  const [annotate, setAnnotate] = useState(false);
  const [target, setTarget] = useState<AnnotateTarget | null>(null);
  useEffect(() => {
    setAnnotate(false);
    setTarget(null);
  }, [cur.id]);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* sub-view header: Preview | Design system */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 14px", minHeight: 46, borderBottom: `1px solid ${c.border}`, background: c.panel, flexShrink: 0 }}>
        <Monitor size={15} color={c.accent} />
        <span style={{ fontFamily: MONO, fontSize: 13, color: c.text }}>Prototype</span>
        <div style={{ display: "flex", gap: 2, background: c.panel2, border: `1px solid ${c.borderSoft}`, borderRadius: 8, padding: 2 }}>
          {(
            [
              ["preview", "Preview"],
              ["design", "Design system"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              style={{ fontFamily: MONO, fontSize: 11.5, padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer", background: view === id ? c.card : "transparent", color: view === id ? c.text : c.dim }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "design" ? (
        <DesignSystemView prototype={prototype} />
      ) : (
        <div className="flex min-h-0 flex-1">
          <div
            className="flex w-[216px] shrink-0 flex-col border-r"
            style={{ borderColor: c.border, background: c.panel }}
          >
        <div
          className="px-[15px] pb-[9px] pt-3.5 text-[10.5px] font-medium uppercase tracking-[0.6px]"
          style={{ fontFamily: MONO, color: c.faint }}
        >
          Screens
        </div>
        <div className="flex flex-1 flex-col gap-0.5 overflow-auto px-2">
          {screens.map((sc) => {
            const active = sc.id === cur.id;
            return (
              <button
                key={sc.id}
                onClick={() => go(sc.id)}
                className={cn(
                  "flex items-center gap-[9px] rounded-[7px] px-2.5 py-2 text-[13px] transition-colors",
                  !active && "hover:opacity-80"
                )}
                style={{
                  color: active ? c.text : c.dim,
                  background: active ? c.card : "transparent",
                  boxShadow: active ? `inset 0 0 0 1px ${c.border2}` : "none",
                }}
              >
                <AppWindow size={15} color={active ? c.accent : c.faint} />
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{sc.title}</span>
              </button>
            );
          })}
        </div>

        {freeform && (
          <div className="shrink-0 border-t px-3 py-3" style={{ borderColor: c.border }}>
            <div
              className="mb-2 text-[10px] font-medium uppercase tracking-[0.6px]"
              style={{ fontFamily: MONO, color: c.faint }}
            >
              Device frame
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {FRAMES.map(({ key, label, Icon }) => {
                const active = frame === key;
                return (
                  <button
                    key={key}
                    onClick={() => setFrameOverride(key)}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                    style={{
                      color: active ? c.text : c.dim,
                      background: active ? c.panel2 : "transparent",
                      border: `1px solid ${active ? alpha(c.accent, 0.4) : c.border}`,
                    }}
                  >
                    <Icon size={13} color={active ? c.accent : c.faint} />
                    {label}
                  </button>
                );
              })}
            </div>
            {isMobile && (
              <button
                onClick={() => setChromeOverride(!chrome)}
                className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                style={{
                  color: !chrome ? c.text : c.dim,
                  background: !chrome ? c.panel2 : "transparent",
                  border: `1px solid ${!chrome ? alpha(c.accent, 0.4) : c.border}`,
                }}
                title="Full-bleed — hide the status bar and home indicator (no safe area)"
              >
                <Maximize size={13} color={!chrome ? c.accent : c.faint} />
                Full screen{!chrome ? " · on" : ""}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div
        className={cn(
          "relative flex min-w-0 flex-1 overflow-auto",
          isMobile ? "items-center justify-center p-6" : freeform ? "items-stretch justify-center p-6" : "items-start justify-center px-6 py-10"
        )}
        style={{
          background: c.bg,
          backgroundImage: grid ? `radial-gradient(${c.gridDot} 1px, transparent 1px)` : "none",
          backgroundSize: "22px 22px",
        }}
      >
        {freeform && (
          <button
            onClick={() => {
              setAnnotate((a) => !a);
              setTarget(null);
            }}
            className="absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors"
            style={{
              color: annotate ? c.accent2 : c.dim,
              background: annotate ? c.accentSoft : c.panel,
              border: `1px solid ${annotate ? c.accent : c.border2}`,
            }}
            title="Click an element to comment on it"
          >
            <MessageSquarePlus size={13} />
            {annotate ? "Click an element…" : "Comment"}
          </button>
        )}

        {freeform ? (
          <DeviceFrame
            frame={frame}
            url={cur.url || `shop.demo/${cur.id || ""}`}
            title={cur.title}
            safeArea={cur.safeArea ?? prototype.safeArea}
            chrome={chrome}
          >
            <FreeformDevice
              screenId={cur.id}
              title={cur.title}
              html={resolveScreenHtml(prototype, cur)}
              css={cur.css}
              designSystem={designSheet(prototype)}
              store={store}
              storeVersion={storeVersion}
              annotate={annotate}
              go={go}
              onStore={onStore}
              onError={onError}
              onAnnotate={(t) => {
                setTarget(t);
                setAnnotate(false);
              }}
            />
          </DeviceFrame>
        ) : (
          <div
            className="flex min-h-[560px] w-[480px] flex-col overflow-hidden rounded-[14px]"
            style={{ background: LIGHT.bg, border: `1px solid ${c.border}`, boxShadow: "0 24px 64px rgba(0,0,0,.5)" }}
          >
            <div
              className="flex items-center gap-2 border-b px-[15px] py-[11px]"
              style={{ borderColor: LIGHT.border, background: LIGHT.muted }}
            >
              <AppWindow size={15} color={LIGHT.mutedFg} />
              <span className="text-[13px] font-medium" style={{ color: LIGHT.fg }}>
                {cur.title}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-4 px-[22px] pb-7 pt-6">
              {(cur.components || []).map((comp, i) => (
                <ComponentRenderer key={i} comp={comp} screen={cur.id} go={go} />
              ))}
            </div>
          </div>
        )}

        {target && (
          <AnnotationComposer
            target={target}
            screen={cur.id}
            onClose={() => setTarget(null)}
          />
        )}
      </div>

      <SpecRail spec={spec} open={specOpen} onToggle={onToggleSpec} />
        </div>
      )}
    </div>
  );
}

// Compose feedback anchored to a clicked element, so the note reaches the agent
// with the exact target ("this button on cart"), not as a vague description.
function AnnotationComposer({
  target,
  screen,
  onClose,
}: {
  target: AnnotateTarget;
  screen: string;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    const ok = await sendFeedback({ text: t, tab: "prototype", screen, element: target });
    if (ok) {
      setSent(true);
      setTimeout(onClose, 900);
    }
  };

  return (
    <div
      className="absolute left-1/2 top-4 z-20 w-[340px] -translate-x-1/2 rounded-xl p-3 shadow-2xl"
      style={{ background: c.panel, border: `1px solid ${c.accent}` }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.6px]" style={{ color: c.faint }}>
          Comment on
        </span>
        <code
          className="rounded px-1.5 py-0.5 text-[11px]"
          style={{ fontFamily: MONO, background: c.panel2, color: c.accent }}
        >
          {target.selector}
        </code>
        <button onClick={onClose} className="ml-auto" style={{ color: c.faint }}>
          <X size={14} />
        </button>
      </div>
      {target.text && (
        <div className="mb-2 truncate text-[11px]" style={{ color: c.dim }}>
          “{target.text}”
        </div>
      )}
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder="What should change here?"
        spellCheck={false}
        className="h-16 w-full resize-none rounded-lg p-2.5 text-[12px] leading-[1.5] outline-none"
        style={{ fontFamily: "var(--font-sans)", background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px]" style={{ color: c.faint }}>
          {sent ? "✓ sent to agent" : "⌘↵ to send"}
        </span>
        <button
          onClick={submit}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold"
          style={{ background: c.invBg, color: c.invFg }}
        >
          <Send size={12} />
          Send
        </button>
      </div>
    </div>
  );
}
