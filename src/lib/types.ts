// The shape of .harness/state.json — the single object every view renders from.
// Kept permissive on purpose: the AI writes this file freely, and the viewer
// degrades gracefully when sections are missing or partial.

export type Phase = "prototype" | "data" | "flow" | "plan";

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

export type TaskStatus = "todo" | "doing" | "done";
export interface Task {
  title: string;
  status: TaskStatus;
}
export interface Milestone {
  name: string;
  tasks?: Task[];
}
export interface Plan {
  stack?: string[];
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

export interface Prototype {
  start?: string;
  /** Default device frame for all screens (web | desktop | ios | android). */
  frame?: FrameKind;
  /** Global CSS (tokens + component classes) injected into every freeform screen. */
  designSystem?: string;
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

export type StoreState = Record<string, string | number>;

export interface HarnessState {
  meta: Meta;
  spec?: Spec;
  plan?: Plan;
  dataModel?: DataModel;
  flow?: Flow;
  api?: ApiDoc;
  prototype?: Prototype;
}

export const TAB_ORDER: Phase[] = ["prototype", "data", "flow", "plan"];

// meta.phase is permissive (the AI may use legacy "spec"/"dataModel" labels);
// fold it onto the canonical four-tab order.
export function normalizePhase(phase: string | undefined): Phase {
  if (phase === "dataModel") return "data";
  if (phase === "spec") return "prototype";
  return phase && (TAB_ORDER as string[]).includes(phase) ? (phase as Phase) : "prototype";
}
