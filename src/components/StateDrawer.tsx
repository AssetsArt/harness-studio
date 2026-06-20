import { useState } from "react";
import { Braces, Check, X } from "lucide-react";
import type { ArtaState } from "../lib/types";
import { TAB_ORDER } from "../lib/types";
import { MONO, useTheme } from "../lib/theme";
import { alpha } from "../lib/utils";

// Paste-a-new-state drawer. In the real loop the agent writes state.json and
// the viewer repaints from the file watcher; this drawer lets the dev simulate
// that locally (or hand-tweak), Apply → cyan flash, same as a live write.
export function StateDrawer({
  initial,
  onClose,
  onApply,
}: {
  initial: ArtaState | null;
  onClose: () => void;
  onApply: (next: ArtaState) => void;
}) {
  const { c } = useTheme();
  const [draft, setDraft] = useState(() => (initial ? JSON.stringify(initial, null, 2) : "{\n  \n}"));
  const [err, setErr] = useState("");

  const apply = () => {
    let parsed: ArtaState;
    try {
      parsed = JSON.parse(draft);
    } catch (e) {
      setErr("Invalid JSON — " + (e as Error).message);
      return;
    }
    if (!parsed || !parsed.meta) {
      setErr('State must include a "meta" object.');
      return;
    }
    if (parsed.meta.phase && !(TAB_ORDER as string[]).concat("spec", "dataModel").includes(parsed.meta.phase)) {
      setErr(`meta.phase should be one of: ${TAB_ORDER.join(", ")}`);
      return;
    }
    setErr("");
    onApply(parsed);
  };

  return (
    <div className="absolute inset-0 z-30 flex justify-end">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.5)", backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div
        className="hs-slide relative flex h-full w-[448px] max-w-[88%] flex-col"
        style={{ background: c.panel, borderLeft: `1px solid ${c.border}`, boxShadow: "-22px 0 55px rgba(0,0,0,.5)" }}
      >
        <div className="flex items-center gap-[9px] border-b px-[18px] py-4" style={{ borderColor: c.border }}>
          <Braces size={16} color={c.accent} />
          <span className="text-[13px]" style={{ fontFamily: MONO, color: c.text }}>
            state.json
          </span>
          <button
            onClick={onClose}
            className="ml-auto flex rounded-md p-1 transition-opacity hover:opacity-70"
            style={{ color: c.dim }}
          >
            <X size={17} />
          </button>
        </div>
        <div className="px-[18px] pt-[13px] text-[12px] leading-[1.5]" style={{ color: c.faint }}>
          Paste a new state object and Apply — simulates the agent writing to .arta/state.json.
        </div>
        <div className="flex min-h-0 flex-1 px-[18px] py-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="flex-1 resize-none rounded-[9px] p-[13px] text-[11.5px] leading-[1.55] outline-none"
            style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: MONO, whiteSpace: "pre" }}
          />
        </div>
        {err && (
          <div className="px-[18px] pb-2.5 text-[11px] leading-[1.4]" style={{ color: c.red, fontFamily: MONO }}>
            {err}
          </div>
        )}
        <div className="flex justify-end gap-2.5 border-t px-[18px] py-[13px]" style={{ borderColor: c.border }}>
          <button
            onClick={onClose}
            className="h-[38px] rounded-lg px-4 text-[13px] font-medium transition-opacity hover:opacity-80"
            style={{ border: `1px solid ${c.border2}`, background: c.bg, color: c.dim }}
          >
            Cancel
          </button>
          <button
            onClick={apply}
            className="inline-flex h-[38px] items-center gap-[7px] rounded-lg px-[18px] text-[13px] font-semibold transition-colors"
            style={{ border: `1px solid ${c.accent}`, background: c.accent, color: "#ffffff" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = alpha(c.accent, 0.85))}
            onMouseLeave={(e) => (e.currentTarget.style.background = c.accent)}
          >
            <Check size={15} color="#ffffff" />
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
