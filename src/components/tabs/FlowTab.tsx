import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { stringify as toYaml } from "yaml";
import { Copy, Download, Filter, Layers, X } from "lucide-react";
import type {
  ApiDoc,
  ApiOperation,
  ApiParameter,
  ApiSchema,
  HttpMethod,
} from "../../lib/types";
import { HTTP_METHODS } from "../../lib/types";
import { MONO, useTheme, type DarkTokens } from "../../lib/theme";
import { alpha } from "../../lib/utils";

// ── colours per HTTP method ─────────────────────────────────────────────────
function methodColor(m: string, c: DarkTokens): string {
  switch (m.toLowerCase()) {
    case "get": return c.green;
    case "post": return c.accent;
    case "put": return c.amber;
    case "patch": return "#a78bfa";
    case "delete": return c.red;
    default: return c.dim;
  }
}

function MethodBadge({ method, c }: { method: string; c: DarkTokens }) {
  const col = methodColor(method, c);
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        color: col,
        background: alpha(col, 0.14),
        border: `1px solid ${alpha(col, 0.4)}`,
        borderRadius: 5,
        padding: "1px 6px",
      }}
    >
      {method.toUpperCase()}
    </span>
  );
}

// ── flattened view of the OpenAPI paths ─────────────────────────────────────
interface Op {
  id: string;
  path: string;
  method: HttpMethod;
  op: ApiOperation;
}
function flattenOps(api: ApiDoc): Op[] {
  const out: Op[] = [];
  const paths = api.paths || {};
  for (const path of Object.keys(paths)) {
    const item = paths[path] || {};
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (op) out.push({ id: `${method.toUpperCase()} ${path}`, path, method, op });
    }
  }
  return out;
}

// ── React Flow nodes ─────────────────────────────────────────────────────────
const ROUTE_W = 244;
const ROUTE_H = 66;
const MW_W = 156;
const MW_H = 46;

type RouteData = { method: string; path: string; summary?: string; mw: number; params: number; body: boolean };
type RouteNode = Node<RouteData, "route">;
type MwNode = Node<{ name: string }, "middleware">;

function RouteNodeView({ data, selected }: NodeProps<RouteNode>) {
  const { c } = useTheme();
  const col = methodColor(data.method, c);
  return (
    <div
      style={{
        width: ROUTE_W,
        background: c.card,
        border: `1px solid ${selected ? col : c.border}`,
        boxShadow: selected ? `0 0 0 1px ${col}, 0 4px 16px ${alpha(col, 0.18)}` : "0 1px 2px rgba(0,0,0,0.4)",
        borderRadius: 10,
        padding: "9px 12px",
        fontFamily: MONO,
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: col, border: "none", width: 7, height: 7 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <MethodBadge method={data.method} c={c} />
        <span style={{ color: c.text, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {data.path}
        </span>
      </div>
      {data.summary && (
        <div style={{ color: c.dim, fontSize: 11, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {data.summary}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 5, color: c.faint, fontSize: 10 }}>
        {data.mw > 0 && <span>⋯ {data.mw} mw</span>}
        {data.params > 0 && <span>{data.params} params</span>}
        {data.body && <span>body</span>}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: col, border: "none", width: 7, height: 7 }} />
    </div>
  );
}

function MiddlewareNodeView({ data, selected }: NodeProps<MwNode>) {
  const { c } = useTheme();
  return (
    <div
      style={{
        width: MW_W,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: c.panel2,
        border: `1px dashed ${selected ? c.accent : alpha(c.dim, 0.5)}`,
        borderRadius: 999,
        padding: "10px 14px",
        fontFamily: MONO,
        fontSize: 12,
        color: c.text,
        cursor: "pointer",
      }}
    >
      <Filter size={13} color={c.dim} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.name}</span>
      <Handle type="source" position={Position.Right} style={{ background: c.dim, border: "none", width: 7, height: 7 }} />
    </div>
  );
}

const nodeTypes = { route: RouteNodeView, middleware: MiddlewareNodeView };

// ── graph build + dagre layout ───────────────────────────────────────────────
function buildGraph(api: ApiDoc, c: DarkTokens): { nodes: Node[]; edges: Edge[] } {
  const ops = flattenOps(api);
  // middleware registry — declared, plus any referenced by operations.
  const declared = (api["x-middleware"] || []).map((m) => m.name);
  const referenced = ops.flatMap((o) => o.op["x-middleware"] || []);
  const mwNames = Array.from(new Set([...declared, ...referenced]));

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 26, ranksep: 110, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  mwNames.forEach((m) => g.setNode(`mw:${m}`, { width: MW_W, height: MW_H }));
  ops.forEach((o) => g.setNode(o.id, { width: ROUTE_W, height: ROUTE_H }));
  const edgeDefs: { from: string; to: string }[] = [];
  ops.forEach((o) => {
    (o.op["x-middleware"] || []).forEach((m) => {
      g.setEdge(`mw:${m}`, o.id);
      edgeDefs.push({ from: `mw:${m}`, to: o.id });
    });
  });
  dagre.layout(g);

  const nodes: Node[] = [];
  mwNames.forEach((m) => {
    const p = g.node(`mw:${m}`);
    nodes.push({
      id: `mw:${m}`,
      type: "middleware",
      position: { x: (p?.x ?? 0) - MW_W / 2, y: (p?.y ?? 0) - MW_H / 2 },
      data: { name: m },
    });
  });
  ops.forEach((o) => {
    const p = g.node(o.id);
    nodes.push({
      id: o.id,
      type: "route",
      position: { x: (p?.x ?? 0) - ROUTE_W / 2, y: (p?.y ?? 0) - ROUTE_H / 2 },
      data: {
        method: o.method,
        path: o.path,
        summary: o.op.summary,
        mw: (o.op["x-middleware"] || []).length,
        params: (o.op.parameters || []).length,
        body: !!o.op.requestBody,
      },
    });
  });

  const edges: Edge[] = edgeDefs.map((e, i) => ({
    id: `me${i}`,
    source: e.from,
    target: e.to,
    type: "smoothstep",
    style: { stroke: alpha(c.dim, 0.55), strokeWidth: 1.4, strokeDasharray: "5 4" },
    markerEnd: { type: MarkerType.ArrowClosed, color: alpha(c.dim, 0.6), width: 14, height: 14 },
  }));

  return { nodes, edges };
}

// ── schema rendering (read-only) ─────────────────────────────────────────────
function schemaLabel(s?: ApiSchema): string {
  if (!s) return "any";
  if (s.$ref) return s.$ref.split("/").pop() || "ref";
  if (s.type === "array") return `${schemaLabel(s.items)}[]`;
  return (s.type || "object") + (s.format ? ` (${s.format})` : "");
}

function SchemaView({ schema, c, depth = 0 }: { schema?: ApiSchema; c: DarkTokens; depth?: number }) {
  if (!schema) return <span style={{ color: c.faint }}>—</span>;
  if (schema.properties) {
    const req = new Set(schema.required || []);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: depth ? 12 : 0, borderLeft: depth ? `1px solid ${c.borderSoft}` : "none" }}>
        {Object.keys(schema.properties).map((k) => {
          const f = schema.properties![k];
          return (
            <div key={k} style={{ fontFamily: MONO, fontSize: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ color: c.text }}>{k}</span>
                <span style={{ color: c.accent, fontSize: 11 }}>{schemaLabel(f)}</span>
                {req.has(k) && <span style={{ color: c.amber, fontSize: 10 }}>required</span>}
              </div>
              {f.description && <div style={{ color: c.faint, fontSize: 11 }}>{f.description}</div>}
              {f.properties && <SchemaView schema={f} c={c} depth={depth + 1} />}
              {f.items?.properties && <SchemaView schema={f.items} c={c} depth={depth + 1} />}
            </div>
          );
        })}
      </div>
    );
  }
  return <span style={{ color: c.accent, fontFamily: MONO, fontSize: 12 }}>{schemaLabel(schema)}</span>;
}

function CodeBlock({ value, c }: { value: unknown; c: DarkTokens }) {
  return (
    <pre
      style={{
        margin: 0,
        background: c.bg,
        border: `1px solid ${c.borderSoft}`,
        borderRadius: 8,
        padding: 12,
        fontFamily: MONO,
        fontSize: 11.5,
        color: c.dim,
        overflow: "auto",
        maxHeight: 220,
      }}
    >
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ── Postman-style inspector ───────────────────────────────────────────────────
const TABS = ["Params", "Headers", "Body", "Responses"] as const;
type Tab = (typeof TABS)[number];

function ParamTable({ params, c }: { params: ApiParameter[]; c: DarkTokens }) {
  if (!params.length) return <div style={{ color: c.faint, fontSize: 12, fontFamily: MONO }}>None</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {params.map((p, i) => (
        <div key={i} style={{ padding: "8px 0", borderTop: i ? `1px solid ${c.borderSoft}` : "none", fontFamily: MONO }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ color: c.text, fontSize: 12.5 }}>{p.name}</span>
            <span style={{ color: c.accent, fontSize: 11 }}>{schemaLabel(p.schema)}</span>
            {p.required && <span style={{ color: c.amber, fontSize: 10 }}>required</span>}
          </div>
          {p.description && <div style={{ color: c.faint, fontSize: 11, marginTop: 2 }}>{p.description}</div>}
          {p.example !== undefined && <div style={{ color: c.dim, fontSize: 11, marginTop: 2 }}>e.g. {String(p.example)}</div>}
        </div>
      ))}
    </div>
  );
}

function Inspector({ op, path, method, c, onClose }: { op: ApiOperation; path: string; method: string; c: DarkTokens; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("Params");
  const params = op.parameters || [];
  const pathQuery = params.filter((p) => p.in === "path" || p.in === "query");
  const headers = params.filter((p) => p.in === "header");
  const body = op.requestBody;
  const bodyMedia = body?.content ? Object.entries(body.content) : [];
  const responses = op.responses ? Object.entries(op.responses) : [];
  const mw = op["x-middleware"] || [];

  return (
    <aside
      className="flex h-full flex-col"
      style={{ width: 400, borderLeft: `1px solid ${c.border}`, background: c.panel }}
    >
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${c.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MethodBadge method={method} c={c} />
          <span style={{ fontFamily: MONO, fontSize: 13, color: c.text, flex: 1, wordBreak: "break-all" }}>{path}</span>
          <button onClick={onClose} style={{ color: c.dim, background: "transparent", border: "none", cursor: "pointer", padding: 2 }}>
            <X size={16} />
          </button>
        </div>
        {op.summary && <div style={{ color: c.dim, fontSize: 12, marginTop: 6 }}>{op.summary}</div>}
        {mw.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {mw.map((m) => (
              <span key={m} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: MONO, fontSize: 10.5, color: c.dim, background: c.panel2, border: `1px solid ${c.borderSoft}`, borderRadius: 999, padding: "2px 8px" }}>
                <Filter size={10} /> {m}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 2, padding: "0 8px", borderBottom: `1px solid ${c.border}` }}>
        {TABS.map((t) => {
          const count =
            t === "Params" ? pathQuery.length : t === "Headers" ? headers.length : t === "Responses" ? responses.length : bodyMedia.length;
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                fontFamily: MONO,
                fontSize: 12,
                padding: "10px 10px",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${active ? c.accent : "transparent"}`,
                color: active ? c.text : c.faint,
                cursor: "pointer",
              }}
            >
              {t}
              {count > 0 && <span style={{ color: c.faint, marginLeft: 5 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {tab === "Params" && <ParamTable params={pathQuery} c={c} />}
        {tab === "Headers" && <ParamTable params={headers} c={c} />}
        {tab === "Body" && (
          bodyMedia.length === 0 ? (
            <div style={{ color: c.faint, fontSize: 12, fontFamily: MONO }}>No request body</div>
          ) : (
            bodyMedia.map(([ct, media]) => (
              <div key={ct} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                <div style={{ fontFamily: MONO, fontSize: 11, color: c.faint }}>
                  {ct}
                  {body?.required && <span style={{ color: c.amber, marginLeft: 8 }}>required</span>}
                </div>
                <SchemaView schema={media.schema} c={c} />
                {media.example !== undefined && <CodeBlock value={media.example} c={c} />}
              </div>
            ))
          )
        )}
        {tab === "Responses" && (
          responses.length === 0 ? (
            <div style={{ color: c.faint, fontSize: 12, fontFamily: MONO }}>None</div>
          ) : (
            responses.map(([code, res]) => {
              const ok = code.startsWith("2");
              const col = ok ? c.green : code.startsWith("4") || code.startsWith("5") ? c.red : c.amber;
              const media = res.content ? Object.entries(res.content) : [];
              return (
                <div key={code} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: col }}>{code}</span>
                    <span style={{ color: c.dim, fontSize: 12 }}>{res.description}</span>
                  </div>
                  {media.map(([ct, m]) => (
                    <div key={ct} style={{ marginTop: 8 }}>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: c.faint, marginBottom: 6 }}>{ct}</div>
                      <SchemaView schema={m.schema} c={c} />
                      {m.example !== undefined && <CodeBlock value={m.example} c={c} />}
                    </div>
                  ))}
                </div>
              );
            })
          )
        )}
      </div>
    </aside>
  );
}

// ── OpenAPI export ────────────────────────────────────────────────────────────
function toOpenApi(api: ApiDoc): Record<string, unknown> {
  return {
    openapi: "3.0.3",
    info: api.info || { title: "API", version: "1.0.0" },
    ...(api.servers ? { servers: api.servers } : {}),
    ...(api["x-middleware"] ? { "x-middleware": api["x-middleware"] } : {}),
    paths: api.paths || {},
  };
}

function ExportModal({ api, c, onClose }: { api: ApiDoc; c: DarkTokens; onClose: () => void }) {
  const [fmt, setFmt] = useState<"json" | "yaml">("yaml");
  const [copied, setCopied] = useState(false);
  const doc = useMemo(() => toOpenApi(api), [api]);
  const text = useMemo(() => (fmt === "json" ? JSON.stringify(doc, null, 2) : toYaml(doc)), [doc, fmt]);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };
  return (
    <div
      onClick={onClose}
      className="absolute inset-0 z-50 flex items-center justify-center p-8"
      style={{ background: alpha("#000000", 0.6) }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-[760px] flex-col overflow-hidden rounded-xl"
        style={{ background: c.panel, border: `1px solid ${c.border}` }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${c.border}` }}>
          <span style={{ fontFamily: MONO, fontSize: 13, color: c.text, flex: 1 }}>Export · OpenAPI 3</span>
          <div style={{ display: "flex", border: `1px solid ${c.border}`, borderRadius: 7, overflow: "hidden" }}>
            {(["yaml", "json"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFmt(f)}
                style={{ fontFamily: MONO, fontSize: 11.5, padding: "5px 11px", border: "none", cursor: "pointer", background: fmt === f ? c.accent : "transparent", color: fmt === f ? "#06121b" : c.dim }}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <button onClick={copy} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 11.5, padding: "5px 11px", borderRadius: 7, border: `1px solid ${c.border}`, background: c.card, color: c.text, cursor: "pointer" }}>
            <Copy size={13} /> {copied ? "Copied" : "Copy"}
          </button>
          <button onClick={onClose} style={{ color: c.dim, background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <pre style={{ margin: 0, flex: 1, overflow: "auto", padding: 16, fontFamily: MONO, fontSize: 12, color: c.dim, background: c.bg }}>{text}</pre>
      </div>
    </div>
  );
}

// ── the tab ───────────────────────────────────────────────────────────────────
export function FlowTab({ api }: { api: ApiDoc }) {
  const { c } = useTheme();
  const { nodes: laidNodes, edges: laidEdges } = useMemo(() => buildGraph(api, c), [api, c]);
  const [nodes, setNodes, onNodesChange] = useNodesState(laidNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(laidEdges);
  const [sel, setSel] = useState<{ path: string; method: HttpMethod } | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setNodes(laidNodes);
    setEdges(laidEdges);
  }, [laidNodes, laidEdges, setNodes, setEdges]);

  const ops = useMemo(() => flattenOps(api), [api]);
  const sig = useMemo(() => ops.map((o) => o.id).join("|") + "#" + (api["x-middleware"] || []).length, [ops, api]);

  // keep the selection valid as the model changes
  useEffect(() => {
    if (sel && !ops.some((o) => o.path === sel.path && o.method === sel.method)) setSel(null);
  }, [ops, sel]);

  const selected = sel ? ops.find((o) => o.path === sel.path && o.method === sel.method) : undefined;

  if (!ops.length) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2.5 text-center" style={{ color: c.faint, fontFamily: MONO }}>
          <Layers size={28} />
          <div className="max-w-[300px] text-[13px] leading-relaxed">
            No API routes yet — they appear here (OpenAPI 3) as the AI designs the endpoints.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full">
      <div className="relative min-w-0 flex-1">
        <ReactFlow
          key={sig}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, n) => {
            if (n.type === "route") {
              const d = n.data as RouteData;
              setSel({ path: d.path, method: d.method as HttpMethod });
            }
          }}
          onPaneClick={() => setSel(null)}
          nodeTypes={nodeTypes}
          colorMode="dark"
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={1.8}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
          style={{ background: c.bg }}
        >
          <Background color={c.border} gap={22} size={1} />
          <Controls showInteractive={false} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden" }} />
          <MiniMap pannable zoomable nodeColor={(n) => (n.type === "route" ? methodColor((n.data as RouteData).method, c) : c.dim)} maskColor={alpha(c.bg, 0.6)} style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 8 }} />
        </ReactFlow>

        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
          <span style={{ fontFamily: MONO, fontSize: 11, color: c.faint }}>
            {ops.length} routes · {(api["x-middleware"] || []).length} middleware
          </span>
          <button
            onClick={() => setExporting(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 11.5, padding: "6px 11px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.card, color: c.text, cursor: "pointer" }}
          >
            <Download size={13} /> Export OpenAPI 3
          </button>
        </div>

        {exporting && <ExportModal api={api} c={c} onClose={() => setExporting(false)} />}
      </div>

      {selected && sel && (
        <Inspector op={selected.op} path={sel.path} method={sel.method} c={c} onClose={() => setSel(null)} />
      )}
    </div>
  );
}
