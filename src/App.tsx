import { useCallback, useEffect, useMemo, useState } from "react";
import type { Phase, StoreState } from "./lib/types";
import { normalizePhase } from "./lib/types";
import { useHarness, reportRuntime } from "./lib/useHarness";
import { nowLabel } from "./lib/utils";
import { useTheme } from "./lib/theme";
import { Topbar } from "./components/Topbar";
import { TabBar } from "./components/TabBar";
import { StatusBar } from "./components/StatusBar";
import { StateDrawer } from "./components/StateDrawer";
import { PrototypeTab } from "./components/tabs/PrototypeTab";
import { DataTab } from "./components/tabs/DataTab";
import { FlowTab } from "./components/tabs/FlowTab";
import { PlanTab } from "./components/tabs/PlanTab";

export default function App() {
  const { c } = useTheme();
  const { data, error, updatedAt, flashing, changes, applyLocal } = useHarness();

  // UI state, separate from the canvas. A manual tab/screen pick is sticky and
  // overrides the phase; until then the viewer follows meta.phase.
  const [tabState, setTabState] = useState<Phase | null>(null);
  const [screenState, setScreenState] = useState<string | null>(null);
  const [specOpen, setSpecOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [errors, setErrors] = useState<{ screen?: string; message: string; at: string }[]>([]);

  // Mock store for the freeform prototype (e.g. cart count). Resets only when
  // the AI changes the declared initial store, so it survives clicks and edits
  // that don't touch it. storeVersion forces the device to re-seed on reset.
  const storeKey = useMemo(() => JSON.stringify(data?.prototype?.store ?? {}), [data?.prototype?.store]);
  const [store, setStore] = useState<StoreState>(() => ({ ...(data?.prototype?.store ?? {}) }));
  const [storeVersion, setStoreVersion] = useState(0);
  useEffect(() => {
    setStore({ ...(data?.prototype?.store ?? {}) });
    setStoreVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey]);

  const tab: Phase = tabState ?? normalizePhase(data?.meta.phase);
  const screens = data?.prototype?.screens ?? [];
  const screen = useMemo(() => {
    const wanted = screenState ?? data?.prototype?.start;
    return screens.find((s) => s.id === wanted)?.id ?? screens[0]?.id;
  }, [screenState, data, screens]);

  // Drop a stale manual screen pick when a live update removes that screen.
  useEffect(() => {
    if (screenState && !screens.some((s) => s.id === screenState)) setScreenState(null);
  }, [screens, screenState]);

  // Collect runtime errors from the prototype iframe so the agent can see them.
  const onError = useCallback(
    (message: string) =>
      setErrors((prev) => {
        if (prev[prev.length - 1]?.message === message) return prev;
        return [...prev, { screen, message, at: nowLabel() }].slice(-12);
      }),
    [screen]
  );

  // Tell the MCP server what the dev is looking at + any errors, so the AI can "see" it.
  useEffect(() => {
    if (!data) return;
    reportRuntime({
      tab,
      screen,
      phase: data.meta.phase,
      screens: screens.map((s) => ({ id: s.id, title: s.title })),
      store,
      errors,
      updatedAt,
    });
  }, [tab, screen, data, screens, store, errors, updatedAt]);

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: c.bg, color: c.faint }}>
        <div className="text-center font-mono text-[13px]">
          {error ? (
            <span style={{ color: c.red }}>{error}</span>
          ) : (
            "waiting for .harness/state.json …"
          )}
        </div>
      </div>
    );
  }

  const go = (to?: string) => {
    if (to) setScreenState(to);
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden text-[14px]"
      style={{ background: c.bg, color: c.text }}
    >
      <Topbar meta={data.meta} setTab={setTabState} />
      <TabBar tab={tab} setTab={setTabState} />

      <div className={"relative flex min-h-0 flex-1" + (flashing ? " hs-flash" : "")}>
        {tab === "prototype" && (
          <PrototypeTab
            prototype={data.prototype ?? {}}
            spec={data.spec ?? {}}
            screen={screen}
            go={go}
            specOpen={specOpen}
            onToggleSpec={() => setSpecOpen((o) => !o)}
            store={store}
            storeVersion={storeVersion}
            onStore={setStore}
            onError={onError}
          />
        )}
        {/* Data model is a full-bleed React Flow canvas (pan/zoom), so it fills the
            area directly instead of living in the scroll+padding wrapper. */}
        {tab === "data" && <DataTab dataModel={data.dataModel ?? {}} />}
        {(tab === "flow" || tab === "plan") && (
          <div className="w-full overflow-auto px-[30px] py-7">
            {tab === "flow" && <FlowTab flow={data.flow ?? {}} />}
            {tab === "plan" && <PlanTab plan={data.plan ?? {}} />}
          </div>
        )}
      </div>

      <StatusBar
        meta={data.meta}
        updatedAt={updatedAt}
        tab={tab}
        screen={screen}
        changes={changes}
        onEditState={() => setDrawerOpen(true)}
        onJump={(ch) => {
          if (ch.kind === "screen" && ch.id) {
            setTabState("prototype");
            setScreenState(ch.id);
          }
        }}
      />

      {drawerOpen && (
        <StateDrawer
          initial={data}
          onClose={() => setDrawerOpen(false)}
          onApply={(next) => {
            applyLocal(next);
            setDrawerOpen(false);
          }}
        />
      )}

      {error && (
        <div
          className="absolute bottom-9 left-1/2 z-40 -translate-x-1/2 rounded-lg px-3.5 py-2 text-[12px] font-mono shadow-xl"
          style={{ background: c.card, border: `1px solid ${c.red}`, color: c.red }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
