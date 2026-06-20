import { useCallback, useEffect, useRef, useState } from "react";
import type { HarnessState } from "./types";
import { nowLabel } from "./utils";

export interface ChangeEntry {
  kind: string;
  label: string;
  id?: string;
  at: string;
}

interface HarnessLive {
  data: HarnessState | null;
  error: string | null;
  updatedAt: string;
  flashing: boolean;
  /** Recent edits the AI made, newest first — for the "what changed" feed. */
  changes: ChangeEntry[];
  /** Replace state locally (the Edit-state drawer) and flash, like the design. */
  applyLocal: (next: HarnessState) => void;
}

// The client half of the live loop: fetch the initial state, then listen for
// `harness:update` events the Vite plugin fires whenever .arta/state.json
// changes on disk (i.e. whenever the AI writes to it). Each update flashes the
// canvas cyan — the visible "the agent just wrote in" signal.
export function useHarness(): HarnessLive {
  const [data, setData] = useState<HarnessState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>(nowLabel());
  const [flashing, setFlashing] = useState(false);
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const flashTimer = useRef<number | undefined>(undefined);

  const flash = useCallback(() => {
    setFlashing(true);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashing(false), 720);
  }, []);

  const ingest = useCallback(
    (raw: string) => {
      try {
        const parsed = JSON.parse(raw) as HarnessState;
        if (!parsed || !parsed.meta) throw new Error('missing "meta"');
        setData(parsed);
        setError(null);
        setUpdatedAt(nowLabel());
        flash();
      } catch (e) {
        setError(`state.json is invalid — ${(e as Error).message}`);
      }
    },
    [flash]
  );

  useEffect(() => {
    let alive = true;
    fetch("/__harness/state")
      .then((r) => r.json())
      .then((res: { ok: boolean; state: HarnessState | null; error?: string }) => {
        if (!alive) return;
        if (res.ok && res.state) {
          setData(res.state);
          setUpdatedAt(nowLabel());
        } else if (!res.ok) {
          setError(res.error || "could not read state.json");
        }
      })
      .catch(() => alive && setError("dev server unreachable"));

    if (import.meta.hot) {
      import.meta.hot.on("harness:update", (raw: string) => ingest(raw));
      import.meta.hot.on("harness:change", (c: Omit<ChangeEntry, "at">) =>
        setChanges((prev) => [{ ...c, at: nowLabel() }, ...prev].slice(0, 30))
      );
    }
    return () => {
      alive = false;
      window.clearTimeout(flashTimer.current);
    };
  }, [ingest]);

  const applyLocal = useCallback(
    (next: HarnessState) => {
      setData(next);
      setError(null);
      setUpdatedAt(nowLabel());
      flash();
    },
    [flash]
  );

  return { data, error, updatedAt, flashing, changes, applyLocal };
}

// Fire-and-forget reporters so the MCP server can see what the dev is doing.
export function reportRuntime(body: Record<string, unknown>): void {
  fetch("/__harness/runtime", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function sendFeedback(body: Record<string, unknown>): Promise<boolean> {
  return fetch("/__harness/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((r) => r.ok)
    .catch(() => false);
}

export function reportSnapshot(screen: string, dataUrl: string): void {
  fetch("/__harness/snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ screen, dataUrl }),
  }).catch(() => {});
}
