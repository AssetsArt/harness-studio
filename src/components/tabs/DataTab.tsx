import { useEffect, useMemo } from "react";
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
import { Database, Table as TableIcon } from "lucide-react";
import type { DataModel, Field } from "../../lib/types";
import { MONO, useTheme, type DarkTokens } from "../../lib/theme";
import { alpha } from "../../lib/utils";
import { Tag } from "../ui/panel";

// Node geometry — kept in sync between what we tell dagre and what the node renders.
const NODE_W = 264;
const HEADER_H = 40;
const ROW_H = 30;
const entityHeight = (fields: number) => HEADER_H + fields * ROW_H + 4;

type EntityNodeData = { name: string; fields: Field[] };
type EntityNode = Node<EntityNodeData, "entity">;

// One ER table: a header (table name) over a list of typed fields, with PK/FK
// tags and a required dot. Hidden handles on the sides let relationship edges
// attach. Reads the theme directly (it renders inside ThemeProvider).
function EntityNodeView({ data }: NodeProps<EntityNode>) {
  const { c } = useTheme();
  const handle = { background: c.accent, border: "none", width: 7, height: 7 };
  return (
    <div
      style={{
        width: NODE_W,
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        overflow: "hidden",
        fontFamily: MONO,
        boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
      }}
    >
      <Handle type="target" position={Position.Left} style={handle} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 14px",
          background: c.panel2,
          borderBottom: `1px solid ${c.border}`,
          color: c.text,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <TableIcon size={14} color={c.accent} />
        {data.name}
      </div>
      {data.fields.map((f, fi) => (
        <div
          key={fi}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 14px",
            height: ROW_H,
            fontSize: 12.5,
            borderTop: fi ? `1px solid ${c.borderSoft}` : "none",
          }}
        >
          <span
            title={f.required ? "required" : "optional"}
            style={{
              width: 6,
              height: 6,
              flexShrink: 0,
              borderRadius: 99,
              background: f.required ? c.amber : "transparent",
              border: f.required ? "none" : `1px solid ${c.border}`,
            }}
          />
          <span style={{ flex: 1, color: c.text }}>{f.name}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {f.pk && <Tag label="PK" color={c.yellow} />}
            {f.fk && <Tag label="FK" color={c.accent} />}
            <span style={{ color: c.dim }}>{f.type}</span>
          </span>
        </div>
      ))}
      <Handle type="source" position={Position.Right} style={handle} />
    </div>
  );
}

const nodeTypes = { entity: EntityNodeView };

// Lay the entities out left-to-right with dagre, and turn relationships into
// labelled, arrow-headed edges. Positions are centre-based from dagre, so we
// shift to top-left for React Flow.
function buildGraph(dm: DataModel, c: DarkTokens): { nodes: EntityNode[]; edges: Edge[] } {
  const entities = dm.entities || [];
  const rels = dm.relationships || [];
  const names = new Set(entities.map((e) => e.name));

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 36, ranksep: 96, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  entities.forEach((e) => g.setNode(e.name, { width: NODE_W, height: entityHeight(e.fields?.length || 0) }));
  rels.forEach((r) => {
    if (names.has(r.from) && names.has(r.to)) g.setEdge(r.from, r.to);
  });
  dagre.layout(g);

  const nodes: EntityNode[] = entities.map((e) => {
    const fields = e.fields || [];
    const h = entityHeight(fields.length);
    const p = g.node(e.name);
    return {
      id: e.name,
      type: "entity",
      position: { x: (p?.x ?? 0) - NODE_W / 2, y: (p?.y ?? 0) - h / 2 },
      data: { name: e.name, fields },
    };
  });

  const edges: Edge[] = rels
    .filter((r) => names.has(r.from) && names.has(r.to))
    .map((r, i) => ({
      id: `e${i}`,
      source: r.from,
      target: r.to,
      type: "smoothstep",
      label: r.label ? `${r.type} · ${r.label}` : r.type,
      labelStyle: { fill: c.dim, fontFamily: MONO, fontSize: 10 },
      labelBgStyle: { fill: c.card, fillOpacity: 0.95 },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 5,
      style: { stroke: alpha(c.accent, 0.7), strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: alpha(c.accent, 0.7), width: 16, height: 16 },
    }));

  return { nodes, edges };
}

export function DataTab({ dataModel }: { dataModel: DataModel }) {
  const { c } = useTheme();
  const { nodes: laidNodes, edges: laidEdges } = useMemo(() => buildGraph(dataModel, c), [dataModel, c]);
  const [nodes, setNodes, onNodesChange] = useNodesState<EntityNode>(laidNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(laidEdges);

  // Re-seed when the canvas changes (the AI live-edits the model); a structural
  // change remounts via `sig` so fitView re-frames, while same-shape edits just
  // refresh node contents and keep any manual drag.
  useEffect(() => {
    setNodes(laidNodes);
    setEdges(laidEdges);
  }, [laidNodes, laidEdges, setNodes, setEdges]);

  const sig = useMemo(
    () =>
      (dataModel.entities || []).map((e) => `${e.name}:${e.fields?.length || 0}`).join("|") +
      "#" +
      (dataModel.relationships?.length || 0),
    [dataModel]
  );

  if (!(dataModel.entities || []).length) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2.5 text-center" style={{ color: c.faint, fontFamily: MONO }}>
          <Database size={28} />
          <div className="max-w-[280px] text-[13px] leading-relaxed">
            No entities yet — the data model appears here as the AI defines it.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        key={sig}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.8}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        style={{ background: c.bg }}
      >
        <Background color={c.border} gap={22} size={1} />
        <Controls
          showInteractive={false}
          style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden" }}
        />
        <MiniMap
          pannable
          zoomable
          nodeColor={() => c.panel2}
          nodeStrokeColor={() => alpha(c.accent, 0.5)}
          maskColor={alpha(c.bg, 0.6)}
          style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 8 }}
        />
      </ReactFlow>
    </div>
  );
}
