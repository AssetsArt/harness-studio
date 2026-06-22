import { useEffect, useRef, useState } from "react";
import { AppWindow, Check, Copy, Download, ExternalLink, FileDown, Monitor, MessageSquarePlus, Smartphone, Tablet, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FrameKind, Prototype, Spec, StoreState } from "../../lib/types";
import { LIGHT, MONO, useTheme } from "../../lib/theme";
import { alpha, cn } from "../../lib/utils";
import { designSheet, resolveScreenHtml } from "../../lib/prototype";
import { exportPrototypePdf } from "../../lib/exportPdf";
import { buildPrototypePreview } from "../../lib/previewDoc";
import { previewHref, sendFeedback } from "../../lib/useArta";
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
  { key: "ipad", label: "iPad", Icon: Tablet },
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
  // Phone / tablet frames — they get the centered canvas layout. iPad included.
  const isMobile = frame === "ios" || frame === "android" || frame === "ipad";

  // Full-screen with the chrome on top: content is edge-to-edge (no safe-area bands)
  // and the iOS-style status bar (real time) + notch + home indicator float OVER it —
  // no on/off toggle. A screen can hide the chrome with `chrome: false` in state.
  const chrome = cur.chrome ?? prototype.chrome ?? true;

  // The device-frame outer node — the snapshot captures THIS (bezel + chrome + content),
  // so the agent sees the same framed device the dev sees, not a bare content card.
  const frameNodeRef = useRef<HTMLDivElement>(null);

  // Comment-on-element mode: click an element in the prototype to attach feedback.
  const [annotate, setAnnotate] = useState(false);
  const [target, setTarget] = useState<AnnotateTarget | null>(null);
  useEffect(() => {
    setAnnotate(false);
    setTarget(null);
  }, [cur.id]);

  // Export every freeform screen's full-length screenshot as one PDF. When it's built we
  // surface it in a modal (below) with an Open button — the dev opens it with a real click,
  // so nothing is auto-opened (no popup-block) and the result is never silently dropped.
  // `exporting` doubles as the button label while it runs.
  const [exporting, setExporting] = useState<string | null>(null);
  const [pdfResult, setPdfResult] = useState<{ url: string; pages: number } | null>(null);
  const runExport = async () => {
    if (exporting) return;
    try {
      setExporting("Rendering…");
      const res = await exportPrototypePdf(prototype, (p) =>
        setExporting(p.done < p.total ? `Rendering ${p.done + 1}/${p.total}…` : "Building PDF…")
      );
      setExporting(null);
      setPdfResult(res);
    } catch (e) {
      setExporting(null);
      onError(`PDF export failed — ${(e as Error).message}`);
    }
  };

  // Open the live, chrome-less preview (the whole prototype, clickable, no editor UI) in a
  // new tab — the shareable /preview URL, scoped to the active project.
  const openPreview = () => window.open(previewHref(), "_blank", "noopener");

  // Export the prototype as ONE self-contained, interactive HTML file (all screens +
  // data-to navigation + mock store) the dev can open anywhere or hand off. Built client-side
  // from the in-memory prototype — same builder the /preview route serves.
  const exportHtml = () => {
    try {
      const html = buildPrototypePreview(prototype);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "prototype-preview.html";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      onError(`Preview export failed — ${(e as Error).message}`);
    }
  };

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
          </div>
        )}

        {freeform && (
          <div className="shrink-0 border-t px-3 py-3" style={{ borderColor: c.border }}>
            <button
              onClick={openPreview}
              className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-2 text-[12px] font-semibold transition-colors"
              style={{ color: c.text, background: c.panel2, border: `1px solid ${c.accent}` }}
              title="Open the whole prototype as a clickable, chrome-less page (the shareable /preview URL)"
            >
              <ExternalLink size={14} color={c.accent} />
              Open preview
            </button>
            <p className="mt-1.5 text-[10.5px] leading-snug" style={{ fontFamily: MONO, color: c.faint }}>
              Clickable prototype, no editor — opens the shareable <span style={{ color: c.dim }}>/preview</span> page.
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                onClick={runExport}
                disabled={!!exporting}
                className="flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11.5px] font-semibold transition-colors disabled:cursor-default disabled:opacity-60"
                style={{ color: c.text, background: c.panel2, border: `1px solid ${c.border2}` }}
                title="Capture every screen's full-length screenshot into one PDF"
              >
                <FileDown size={13} color={c.accent} />
                {exporting ?? "PDF"}
              </button>
              <button
                onClick={exportHtml}
                className="flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11.5px] font-semibold transition-colors"
                style={{ color: c.text, background: c.panel2, border: `1px solid ${c.border2}` }}
                title="Export the prototype as one self-contained, interactive HTML file — opens anywhere"
              >
                <Download size={13} color={c.accent} />
                HTML
              </button>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-snug" style={{ fontFamily: MONO, color: c.faint }}>
              Export: <span style={{ color: c.dim }}>PDF</span> (all screens to save) · <span style={{ color: c.dim }}>HTML</span> (one interactive file to share).
            </p>
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
            rootRef={frameNodeRef}
          >
            <FreeformDevice
              screenId={cur.id}
              screenIds={screens.map((s) => s.id)}
              title={cur.title}
              html={resolveScreenHtml(prototype, cur)}
              css={cur.css}
              designSystem={designSheet(prototype)}
              store={store}
              storeVersion={storeVersion}
              captureNodeRef={frameNodeRef}
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
            onCommentMore={() => {
              setTarget(null);
              setAnnotate(true); // back to click-an-element mode for the next note
            }}
          />
        )}
      </div>

      <SpecRail spec={spec} open={specOpen} onToggle={onToggleSpec} />
        </div>
      )}

      {/* PDF export result — a modal the dev opens with a real click (no auto-opened tab). */}
      {pdfResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,.55)" }}
          onClick={() => setPdfResult(null)}
        >
          <div
            className="w-[360px] max-w-full rounded-2xl p-6"
            style={{ background: c.panel, border: `1px solid ${c.border2}`, boxShadow: "0 24px 64px rgba(0,0,0,.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: c.accentSoft }}>
                <FileDown size={20} color={c.accent2} />
              </div>
              <div>
                <div className="text-[15px] font-semibold" style={{ color: c.text }}>PDF พร้อมแล้ว</div>
                <div className="text-[12px]" style={{ color: c.dim }}>
                  {pdfResult.pages} หน้า · ทุกหน้าจอแบบเต็มความยาว
                </div>
              </div>
              <button onClick={() => setPdfResult(null)} className="ml-auto" style={{ color: c.faint }} title="ปิด">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <a
                href={pdfResult.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold"
                style={{ background: c.accent, color: "#fff" }}
              >
                <ExternalLink size={15} /> เปิด PDF
              </a>
              <a
                href={pdfResult.url}
                download="arta-prototype.pdf"
                className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium"
                style={{ background: c.panel2, color: c.text, border: `1px solid ${c.border2}` }}
              >
                <Download size={15} /> ดาวน์โหลด
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Compose feedback anchored to a clicked element, so the note reaches the agent
// with the exact target ("this button on cart"), not as a vague description. The
// viewer is read-only and CAN'T message the AI itself — saving queues the note in
// .arta/feedback.json; the dev then runs `/arta:arta feedback` in chat to have the AI
// drain it. So the button SAVES (not "sends"), and the saved state surfaces that command.
const FEEDBACK_CMD = "/arta:arta feedback";
function AnnotationComposer({
  target,
  screen,
  onClose,
  onCommentMore,
}: {
  target: AnnotateTarget;
  screen: string;
  onClose: () => void;
  onCommentMore: () => void;
}) {
  const { c } = useTheme();
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    const ok = await sendFeedback({ text: t, tab: "prototype", screen, element: target });
    if (ok) setSaved(true); // don't auto-close — show the "what next" step
  };

  const copyCmd = () => {
    navigator.clipboard
      ?.writeText(FEEDBACK_CMD)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <div
      className="absolute left-1/2 top-4 z-20 w-[340px] -translate-x-1/2 rounded-xl p-3 shadow-2xl"
      style={{ background: c.panel, border: `1px solid ${c.accent}` }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.6px]" style={{ color: c.faint }}>
          {saved ? "Comment saved" : "Comment on"}
        </span>
        {!saved && (
          <code
            className="rounded px-1.5 py-0.5 text-[11px]"
            style={{ fontFamily: MONO, background: c.panel2, color: c.accent }}
          >
            {target.selector}
          </code>
        )}
        <button onClick={onClose} className="ml-auto" style={{ color: c.faint }}>
          <X size={14} />
        </button>
      </div>

      {saved ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: c.green }}>
            <Check size={13} /> Saved to this project
          </div>
          <p className="text-[11.5px] leading-[1.5]" style={{ color: c.dim }}>
            The viewer can’t message the AI itself. Run this in chat so it picks up your
            comments:
          </p>
          <div
            className="flex items-center gap-2 rounded-lg p-1 pl-2.5"
            style={{ background: c.bg, border: `1px solid ${c.border}` }}
          >
            <code className="flex-1 truncate text-[12px]" style={{ fontFamily: MONO, color: c.text }}>
              {FEEDBACK_CMD}
            </code>
            <button
              onClick={copyCmd}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold"
              style={{ background: c.invBg, color: c.invFg }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <button
              onClick={() => onCommentMore()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium"
              style={{ border: `1px solid ${c.border2}`, color: c.text, background: c.panel2 }}
            >
              <MessageSquarePlus size={12} /> Comment more
            </button>
            <button
              onClick={onClose}
              className="ml-auto rounded-lg px-3 py-1.5 text-[12px] font-medium"
              style={{ color: c.dim }}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
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
              ⌘↵ to save
            </span>
            <button
              onClick={submit}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50"
              style={{ background: c.invBg, color: c.invFg }}
              disabled={!text.trim()}
            >
              <MessageSquarePlus size={12} />
              Save comment
            </button>
          </div>
        </>
      )}
    </div>
  );
}
