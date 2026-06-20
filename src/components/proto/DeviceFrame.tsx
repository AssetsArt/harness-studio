import { BatteryFull, Signal, Wifi } from "lucide-react";
import type { FrameKind } from "../../lib/types";
import { LIGHT, MONO, useTheme } from "../../lib/theme";

interface Props {
  frame: FrameKind;
  url: string;
  title: string;
  /** Colour painted into the phone safe areas (status bar + home indicator);
   *  defaults to white. Status-bar contents auto-contrast against it. */
  safeArea?: string;
  /** Show the device chrome (status bar + home indicator) on phone frames.
   *  Default true; false renders Full / full-bleed with no safe area. */
  chrome?: boolean;
  children: React.ReactNode;
}

const BEZEL = "#0b0b0c";

// Is this CSS colour dark enough to want light status-bar contents on top? Uses a
// throwaway canvas to normalise ANY CSS colour (hex/rgb/hsl/named) to rgb, then
// measures relative luminance. Defaults to "light" (dark text) on anything odd.
function isDarkColor(color: string): boolean {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return false;
    ctx.fillStyle = "#ffffff";
    ctx.fillStyle = color; // invalid input leaves the previous (white) value
    const norm = ctx.fillStyle as string;
    let r = 255,
      g = 255,
      b = 255;
    if (norm[0] === "#") {
      const h = norm.length === 4 ? norm.slice(1).replace(/./g, "$&$&") : norm.slice(1);
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    } else {
      const m = norm.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const p = m[1].split(",").map((s) => parseFloat(s));
        [r, g, b] = p;
      }
    }
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
  } catch {
    return false;
  }
}

// Wraps the freeform iframe in a believable device frame so the same HTML can be
// previewed as desktop web, a native desktop app, or an iOS / Android phone.
export function DeviceFrame({ frame, url, title, safeArea, chrome = true, children }: Props) {
  if (frame === "ios")
    return (
      <IosFrame title={title} safeArea={safeArea} chrome={chrome}>
        {children}
      </IosFrame>
    );
  if (frame === "android")
    return (
      <AndroidFrame title={title} safeArea={safeArea} chrome={chrome}>
        {children}
      </AndroidFrame>
    );
  if (frame === "ipad")
    return (
      <IpadFrame title={title} safeArea={safeArea} chrome={chrome}>
        {children}
      </IpadFrame>
    );
  if (frame === "desktop") return <DesktopFrame title={title}>{children}</DesktopFrame>;
  return <WebFrame url={url}>{children}</WebFrame>;
}

function TrafficLights() {
  return (
    <div className="flex gap-1.5">
      <span className="h-3 w-3 rounded-full" style={{ background: "#ff5f57" }} />
      <span className="h-3 w-3 rounded-full" style={{ background: "#febc2e" }} />
      <span className="h-3 w-3 rounded-full" style={{ background: "#28c840" }} />
    </div>
  );
}

function WebFrame({ url, children }: { url: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <div
      className="flex h-full w-full max-w-[1180px] flex-col overflow-hidden rounded-[12px]"
      style={{ background: LIGHT.bg, border: `1px solid ${c.border}`, boxShadow: "0 24px 64px rgba(0,0,0,.5)" }}
    >
      <div
        className="flex shrink-0 items-center gap-3 border-b px-3.5 py-2.5"
        style={{ borderColor: LIGHT.border, background: LIGHT.muted }}
      >
        <TrafficLights />
        <div
          className="flex h-7 flex-1 items-center rounded-md px-3 text-[12px]"
          style={{ background: LIGHT.bg, border: `1px solid ${LIGHT.border}`, color: LIGHT.mutedFg, fontFamily: MONO }}
        >
          {url}
        </div>
      </div>
      {children}
    </div>
  );
}

function DesktopFrame({ title, children }: { title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <div
      className="flex h-full w-full max-w-[1180px] flex-col overflow-hidden rounded-[12px]"
      style={{ background: LIGHT.bg, border: `1px solid ${c.border}`, boxShadow: "0 24px 64px rgba(0,0,0,.5)" }}
    >
      <div
        className="relative flex shrink-0 items-center border-b px-3.5 py-2.5"
        style={{ borderColor: LIGHT.border, background: LIGHT.muted }}
      >
        <TrafficLights />
        <div
          className="pointer-events-none absolute inset-x-0 text-center text-[12px] font-medium"
          style={{ color: LIGHT.mutedFg }}
        >
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

// Shared phone / tablet shell: dark bezel + rounded screen, sized to fit the canvas.
// `maxH` caps the height so the device keeps a believable aspect — phones stay ~820,
// the taller tablet (iPad portrait) gets more room before the canvas height clamps it.
function Phone({
  radius,
  screenRadius,
  pad,
  width,
  maxH = 820,
  screenBg,
  statusBar,
  bottom,
  children,
}: {
  radius: number;
  screenRadius: number;
  pad: number;
  width: number;
  maxH?: number;
  screenBg: string;
  statusBar: React.ReactNode;
  bottom: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex flex-col"
      style={{
        width,
        height: `min(${maxH}px, 100%)`,
        background: BEZEL,
        borderRadius: radius,
        padding: pad,
        boxShadow: "0 30px 70px rgba(0,0,0,.55)",
      }}
    >
      {/* screenBg fills the safe-area bands (status bar + home indicator); the
          content iframe in the middle is opaque and paints over it. */}
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ background: screenBg, borderRadius: screenRadius }}
      >
        {statusBar}
        <div className="relative min-h-0 flex-1">{children}</div>
        {bottom}
      </div>
    </div>
  );
}

function StatusIcons({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1.5" style={{ color }}>
      <Signal size={14} />
      <Wifi size={14} />
      <BatteryFull size={18} />
    </div>
  );
}

function IosFrame({
  safeArea,
  chrome = true,
  children,
}: {
  title: string;
  safeArea?: string;
  chrome?: boolean;
  children: React.ReactNode;
}) {
  const dark = safeArea ? isDarkColor(safeArea) : false;
  const fg = dark ? "#f5f5f7" : LIGHT.fg;
  return (
    <Phone
      width={384}
      radius={52}
      screenRadius={42}
      pad={11}
      screenBg={safeArea || LIGHT.bg}
      // Full / full-bleed: no status bar, no home indicator — content fills the screen.
      statusBar={
        chrome ? (
          <div className="relative flex h-11 shrink-0 items-center justify-between px-7 pt-1">
            <span className="text-[14px] font-semibold" style={{ color: fg }}>
              9:41
            </span>
            {/* Dynamic Island — a physical cutout, always black */}
            <span className="absolute left-1/2 top-2 h-[26px] w-[96px] -translate-x-1/2 rounded-full bg-black" />
            <StatusIcons color={fg} />
          </div>
        ) : null
      }
      bottom={
        chrome ? (
          <div className="flex h-6 shrink-0 items-end justify-center pb-2">
            <span
              className="h-[5px] w-[134px] rounded-full"
              style={{ background: dark ? "rgba(255,255,255,.85)" : "rgba(0,0,0,.85)" }}
            />
          </div>
        ) : null
      }
    >
      {children}
    </Phone>
  );
}

function AndroidFrame({
  safeArea,
  chrome = true,
  children,
}: {
  title: string;
  safeArea?: string;
  chrome?: boolean;
  children: React.ReactNode;
}) {
  const dark = safeArea ? isDarkColor(safeArea) : false;
  const fg = dark ? "#f5f5f7" : LIGHT.fg;
  return (
    <Phone
      width={392}
      radius={40}
      screenRadius={30}
      pad={9}
      screenBg={safeArea || LIGHT.bg}
      statusBar={
        chrome ? (
          <div className="relative flex h-8 shrink-0 items-center justify-between px-4">
            <span className="text-[12px] font-medium" style={{ color: fg }}>
              9:41
            </span>
            {/* punch-hole camera — a physical cutout, always black */}
            <span className="absolute left-1/2 top-2.5 h-3 w-3 -translate-x-1/2 rounded-full bg-black" />
            <div className="flex items-center gap-1.5" style={{ color: fg }}>
              <Signal size={13} />
              <Wifi size={13} />
              <BatteryFull size={16} />
            </div>
          </div>
        ) : null
      }
      bottom={
        chrome ? (
          <div className="flex h-6 shrink-0 items-center justify-center pb-1.5">
            <span
              className="h-[4px] w-[118px] rounded-full"
              style={{ background: dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.55)" }}
            />
          </div>
        ) : null
      }
    >
      {children}
    </Phone>
  );
}

// Tablet shell (iPad portrait): a uniform slim bezel, gently rounded corners, and —
// unlike the phones — NO notch / Dynamic Island (just a status bar). Renders the page
// at a tablet width so `md:` / `lg:` breakpoints kick in. safeArea + chrome behave the
// same as the phones (chrome:false = full-bleed, no status bar / home indicator).
function IpadFrame({
  safeArea,
  chrome = true,
  children,
}: {
  title: string;
  safeArea?: string;
  chrome?: boolean;
  children: React.ReactNode;
}) {
  const dark = safeArea ? isDarkColor(safeArea) : false;
  const fg = dark ? "#f5f5f7" : LIGHT.fg;
  return (
    <Phone
      width={810}
      maxH={1120}
      radius={30}
      screenRadius={18}
      pad={16}
      screenBg={safeArea || LIGHT.bg}
      statusBar={
        chrome ? (
          <div className="relative flex h-8 shrink-0 items-center justify-between px-6 pt-1">
            <span className="text-[13px] font-semibold" style={{ color: fg }}>
              9:41
            </span>
            <StatusIcons color={fg} />
          </div>
        ) : null
      }
      bottom={
        chrome ? (
          <div className="flex h-6 shrink-0 items-end justify-center pb-2">
            <span
              className="h-[5px] w-[180px] rounded-full"
              style={{ background: dark ? "rgba(255,255,255,.85)" : "rgba(0,0,0,.85)" }}
            />
          </div>
        ) : null
      }
    >
      {children}
    </Phone>
  );
}
