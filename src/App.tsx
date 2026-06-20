import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { Phase, StoreState } from "./lib/types";
import { TAB_ORDER } from "./lib/types";
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
import { ArchitectureTab } from "./components/tabs/ArchitectureTab";
import { PlanTab } from "./components/tabs/PlanTab";

// Each tab is a real route (/prototype, /data, …) so navigation is free and
// non-linear — the dev (or the agent's dev) can jump back to any phase to refine
// it, with working browser back/forward and deep links. The route is the single
// source of truth for the active tab; meta.phase is just recorded metadata now.
const pathFor = (p: Phase) => `/${p}`;
function phaseFromPath(pathname: string): Phase {
  const seg = pathname.replace(/^\/+/, "").split("/")[0];
  return (TAB_ORDER as readonly string[]).includes(seg) ? (seg as Phase) : "prototype";
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

function AppInner() {
  const { c } = useTheme();
  const { data, error, updatedAt, flashing, changes, applyLocal } = useHarness();
  const navigate = useNavigate();
  const location = useLocation();

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

  const tab: Phase = phaseFromPath(location.pathname);
  const setTab = useCallback((p: Phase) => navigate(pathFor(p)), [navigate]);

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
          {error ? <span style={{ color: c.red }}>{error}</span> : "waiting for .arta/state.json …"}
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
      <Topbar meta={data.meta} />
      <TabBar tab={tab} setTab={setTab} />

      <div className={"relative flex min-h-0 flex-1" + (flashing ? " hs-flash" : "")}>
        <Routes>
          <Route
            path="/prototype"
            element={
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
            }
          />
          <Route path="/data" element={<DataTab dataModel={data.dataModel ?? {}} />} />
          <Route path="/flow" element={<FlowTab api={data.api ?? {}} screens={data.prototype?.screens ?? []} />} />
          <Route path="/architecture" element={<ArchitectureTab architecture={data.architecture ?? {}} />} />
          <Route path="/plan" element={<PlanTab plan={data.plan ?? {}} />} />
          <Route path="*" element={<Navigate to="/prototype" replace />} />
        </Routes>
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
            navigate("/prototype");
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
