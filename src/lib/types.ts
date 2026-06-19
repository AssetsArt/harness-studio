// The shape of .harness/state.json — the single object every view renders from.
// Kept permissive on purpose: the AI writes this file freely, and the viewer
// degrades gracefully when sections are missing or partial.

export type Phase = "prototype" | "data" | "flow" | "architecture" | "plan";

export interface Meta {
  name: string;
  phase: Phase | "spec" | "dataModel" | string;
}

export interface Spec {
  goal?: string;
  users?: string[];
  userStories?: string[];
  scope?: { in?: string[]; out?: string[] };
  constraints?: string[];
}

export type TaskStatus = "todo" | "doing" | "done"; // legacy default ids
export type TaskPriority = "urgent" | "high" | "normal" | "low";
export interface Task {
  title: string;
  /** Status id — references a Plan.statuses[].id (or a legacy "todo"|"doing"|"done"). */
  status: string;
  priority?: TaskPriority;
}
export interface Milestone {
  name: string;
  tasks?: Task[];
}
/** A Kanban column (ClickUp-style). */
export interface PlanStatus {
  id: string;
  name: string;
  color?: string;
}
export interface Plan {
  stack?: string[];
  /** Kanban columns. If omitted, defaults to To do / In progress / Done. */
  statuses?: PlanStatus[];
  /** Milestones become the board's swimlanes (rows). */
  milestones?: Milestone[];
}

export interface Field {
  name: string;
  type: string;
  pk?: boolean;
  fk?: string;
  required?: boolean;
}
export interface Entity {
  name: string;
  fields?: Field[];
}
export interface Relationship {
  from: string;
  to: string;
  type: string;
  label?: string;
}
export interface DataModel {
  entities?: Entity[];
  relationships?: Relationship[];
}

// ── API layer (the Flow tab) — an OpenAPI-3-shaped document the AI authors and
// the viewer renders as a React Flow graph + a Postman-style inspector. Vendor
// extensions (x-*) are valid OpenAPI, so this exports cleanly.
export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "options" | "head";
export const HTTP_METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete", "options", "head"];

export interface ApiSchema {
  type?: string;
  format?: string;
  items?: ApiSchema;
  properties?: Record<string, ApiSchema>;
  required?: string[];
  enum?: unknown[];
  example?: unknown;
  description?: string;
  $ref?: string;
  [k: string]: unknown;
}
export interface ApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: ApiSchema;
  example?: unknown;
}
export interface ApiMediaType {
  schema?: ApiSchema;
  example?: unknown;
}
export interface ApiRequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, ApiMediaType>;
}
export interface ApiResponse {
  description?: string;
  content?: Record<string, ApiMediaType>;
}
export interface ApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  /** Middleware names applied to this operation (vendor extension). */
  "x-middleware"?: string[];
  /** Prototype screen ids that call this operation (vendor extension) — drives the
   *  screen→API layer in the Flow graph. */
  "x-screens"?: string[];
  parameters?: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses?: Record<string, ApiResponse>;
}
export type ApiPathItem = Partial<Record<HttpMethod, ApiOperation>>;
export interface ApiMiddleware {
  name: string;
  description?: string;
}
export interface ApiDoc {
  info?: { title?: string; version?: string; description?: string };
  servers?: { url: string; description?: string }[];
  /** Registry of middleware (vendor extension), referenced by operations' x-middleware. */
  "x-middleware"?: ApiMiddleware[];
  paths?: Record<string, ApiPathItem>;
}

export type FlowKind = "screen" | "api" | "entity";
export interface FlowNode {
  id: string;
  kind: FlowKind;
  label: string;
}
export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  op?: "read" | "write";
}
export interface Flow {
  nodes?: FlowNode[];
  edges?: FlowEdge[];
}

// Prototype components — a small wireframe vocabulary the AI composes.
export interface Component {
  type:
    | "nav"
    | "heading"
    | "text"
    | "input"
    | "select"
    | "button"
    | "row"
    | "card"
    | "table"
    | "list"
    | "badge"
    | "image"
    | "divider";
  text?: string;
  label?: string;
  placeholder?: string;
  variant?: "primary" | "default";
  to?: string;
  options?: string[];
  items?: ({ label: string; to?: string } | string)[];
  children?: Component[];
  columns?: string[];
  rows?: string[][];
  h?: number;
}
export type FrameKind = "web" | "desktop" | "ios" | "android";

export interface Screen {
  id: string;
  title: string;
  /** Device frame to render this screen in (overrides prototype.frame). */
  frame?: FrameKind;
  /** Background painted into the device safe areas (status bar + home indicator)
   *  for ios/android frames, so the screen reads edge-to-edge instead of leaving
   *  white bands. Any CSS color; status-bar text + the home pill auto-contrast.
   *  Overrides prototype.safeArea. */
  safeArea?: string;
  /** Show the device chrome (status bar + home indicator) on ios/android frames.
   *  Default true. Set false for a Full / full-bleed screen that draws edge-to-edge
   *  with no safe area — a splash, camera, media viewer, or a design that paints its
   *  own status bar. Overrides prototype.chrome. */
  chrome?: boolean;
  /** Browser-bar URL shown in the freeform device frame, e.g. "shop.demo/cart". */
  url?: string;
  /** Freeform mode: HTML for this screen. With a layout, this is just the body slot. */
  html?: string;
  /** Optional CSS scoped to this screen (injected after the design system). */
  css?: string;
  /** Per-screen template variables, override prototype.vars. */
  vars?: TemplateVars;
  /** Opt this screen out of the shared layout (render html on its own). */
  layout?: string | false;
  /** Constrained mode: the wireframe component vocabulary. */
  components?: Component[];
}

export type TemplateVars = Record<string, string | number>;

// ── Design system (the Prototype "Design system" sub-view) ───────────────────
// A structured, Figma-style design system: foundations (tokens) + a components
// gallery. Tokens compile to CSS custom properties injected into every screen, so
// the design system is the single source of truth the AI styles from.
export interface ColorToken {
  name: string;
  value: string; // any CSS color
  description?: string;
}
export interface TypeToken {
  name: string;
  /** Preview text; defaults to the name. */
  sample?: string;
  family?: string; // CSS font-family
  size?: string; // e.g. "24px", "1.5rem"
  weight?: number | string;
  lineHeight?: string;
  letterSpacing?: string;
}
/** A named scalar token (spacing / radius / shadow / font family). */
export interface ScaleToken {
  name: string;
  value: string;
  description?: string;
}
export interface DesignTokens {
  colors?: ColorToken[];
  typography?: TypeToken[];
  spacing?: ScaleToken[];
  radii?: ScaleToken[];
  shadows?: ScaleToken[];
  fonts?: ScaleToken[]; // value = the font stack
}

export interface Prototype {
  start?: string;
  /** Default device frame for all screens (web | desktop | ios | android). */
  frame?: FrameKind;
  /** Default safe-area background for ios/android frames (a screen's own
   *  `safeArea` overrides it). Set it to the screens' edge colour for a
   *  full-bleed look instead of white status-bar / home-indicator bands. */
  safeArea?: string;
  /** Default for showing the device chrome on ios/android (a screen's own
   *  `chrome` overrides it). Set false to render every screen Full / edge-to-edge
   *  with no status bar or home indicator. */
  chrome?: boolean;
  /** Global CSS (tokens + component classes) injected into every freeform screen. */
  designSystem?: string;
  /** Structured design tokens — rendered as a style guide and compiled to CSS
   *  custom properties (--color-*, --space-*, --radius-*, --shadow-*, --text-*,
   *  --font-*) injected into every screen. */
  tokens?: DesignTokens;
  /** Shared page shell wrapping every screen body. Use {{slot}} for the body and
   *  {{>name}} to include a shared component. */
  layout?: string;
  /** Reusable HTML fragments referenced as {{>name}} from layout or screens. */
  components?: Record<string, string>;
  /** Default template variables, referenced as {{name}}; screens can override. */
  vars?: TemplateVars;
  /** Initial values for the mock store (e.g. { cart: 0 }). */
  store?: Record<string, string | number>;
  screens?: Screen[];
}

// ── Architecture layer (the Architecture tab) — system-level design ──────────
export type ArchKind = "client" | "service" | "datastore" | "external" | "gateway" | "queue" | "cache" | "infra";
export interface ArchNode {
  id: string;
  name: string;
  kind: ArchKind;
  /** Tech/implementation, e.g. "Node/Express", "Postgres 16", "Redis". */
  tech?: string;
  /** What it's responsible for. */
  description?: string;
  /** Where it runs, e.g. "AWS ECS (Fargate)", "Vercel", "GKE". */
  deployment?: string;
  /** Optional grouping / zone (e.g. "VPC", "edge", "data tier"). */
  group?: string;
}
export interface ArchEdge {
  from: string;
  to: string;
  /** REST | gRPC | GraphQL | SQL | AMQP | WebSocket | … */
  protocol?: string;
  mode?: "sync" | "async";
  label?: string;
}
export type AdrStatus = "proposed" | "accepted" | "superseded" | "rejected";
export interface Adr {
  id?: string;
  title: string;
  status?: AdrStatus;
  context?: string;
  options?: string[];
  decision?: string;
  consequences?: string;
}
export interface Nfr {
  name: string;
  target?: string;
  note?: string;
}
export interface ThreatNote {
  boundary?: string;
  note: string;
}
export interface Architecture {
  /** System tech stack. */
  stack?: string[];
  /** C4-style components for the system diagram. */
  nodes?: ArchNode[];
  edges?: ArchEdge[];
  /** Architecture Decision Records. */
  decisions?: Adr[];
  /** Non-functional requirements. */
  nfrs?: Nfr[];
  /** Security / threat-model notes. */
  security?: ThreatNote[];
}

export type StoreState = Record<string, string | number>;

export interface HarnessState {
  meta: Meta;
  spec?: Spec;
  plan?: Plan;
  dataModel?: DataModel;
  flow?: Flow;
  api?: ApiDoc;
  architecture?: Architecture;
  prototype?: Prototype;
}

export const TAB_ORDER: Phase[] = ["prototype", "data", "flow", "architecture", "plan"];

// meta.phase is permissive (the AI may use legacy "spec"/"dataModel" labels);
// fold it onto the canonical four-tab order.
export function normalizePhase(phase: string | undefined): Phase {
  if (phase === "dataModel") return "data";
  if (phase === "spec") return "prototype";
  return phase && (TAB_ORDER as string[]).includes(phase) ? (phase as Phase) : "prototype";
}
