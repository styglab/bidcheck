import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useEffect, useRef } from "react";
import "@xyflow/react/dist/style.css";
import type { ProcurementRelationship } from "@/features/organizations/api";
import type { CompanyCompetitorsResponse } from "./api";
import { formatCompactMoney } from "@/shared/format/money";

export type RelationshipNode = Node<
  {
    label: string;
    detail: string;
    category?: string;
    targetPosition?: "left" | "right";
    kind: "company" | "organization" | "competitor";
    active: boolean;
    select?: () => void;
  },
  "relationship"
>;
function RelationshipCard({ data }: NodeProps<RelationshipNode>) {
  const color = data.kind === "competitor" ? "#c4b5fd" : "#7dd3fc";
  const content = (
    <>
      <span className="block text-[10px] font-medium" style={{ color }}>
        {data.category ??
          (data.kind === "company"
            ? "중심 업체"
            : data.kind === "organization"
              ? "거래기관"
              : "관측 공동 참여")}
      </span>
      <strong className="mt-1 block max-w-44 truncate text-sm text-white">{data.label}</strong>
      <span className="mt-1 block text-[11px] text-slate-300">{data.detail}</span>
    </>
  );
  return (
    <div className="relative">
      <Handle
        type="target"
        position={
          data.targetPosition === "left"
            ? Position.Left
            : data.targetPosition === "right"
              ? Position.Right
              : data.kind === "organization"
                ? Position.Right
                : Position.Left
        }
        style={{ opacity: 0 }}
      />
      {data.select ? (
        <button
          onClick={data.select}
          type="button"
          aria-pressed={data.active}
          aria-label={`${data.label} 관계 선택`}
          className="w-52 rounded-xl border px-4 py-3 text-left shadow-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-300"
          style={{
            background: data.active ? "#1e3a5f" : "#172235",
            borderColor: data.active ? color : "#334155",
          }}
        >
          {content}
        </button>
      ) : (
        <div className="w-52 rounded-xl border border-sky-400/60 bg-sky-950 px-4 py-4 shadow-xl">
          {content}
        </div>
      )}
      <Handle id="trade" type="source" position={Position.Left} style={{ opacity: 0 }} />
      <Handle id="competition" type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}
const nodeTypes = { relationship: RelationshipCard };

export function CompanyRelationshipNetwork({
  name,
  organizations,
  competitors,
  selected,
  onSelect,
}: {
  name: string;
  organizations: ProcurementRelationship[];
  competitors: CompanyCompetitorsResponse["items"];
  selected?: string;
  onSelect: (key: string) => void;
}) {
  const nodes: RelationshipNode[] = [
    {
      id: "company",
      type: "relationship",
      position: { x: 350, y: 210 },
      data: { kind: "company", label: name, detail: "선택 기간·분야 기준", active: true },
    },
  ];
  const edges: Edge[] = [];
  organizations.slice(0, 5).forEach((item, index) => {
    const key = `organization:${item.organization_code}`;
    nodes.push({
      id: key,
      type: "relationship",
      position: { x: 0, y: index * 105 },
      data: {
        kind: "organization",
        label: item.organization_name ?? item.organization_code ?? "기관 확인 필요",
        detail: `계약 ${item.contract_event_count}건 · ${formatCompactMoney(item.total_attributed_contract_amount)}`,
        active: selected === key,
        select: () => onSelect(key),
      },
    });
    edges.push({
      id: key,
      source: "company",
      sourceHandle: "trade",
      target: key,
      type: "smoothstep",
      style: { stroke: "#38bdf8", strokeWidth: selected === key ? 3 : 1.5 },
    });
  });
  competitors.slice(0, 5).forEach((item, index) => {
    const key = `competitor:${item.company_number}`;
    nodes.push({
      id: key,
      type: "relationship",
      position: { x: 700, y: index * 105 },
      data: {
        kind: "competitor",
        label: item.company_name,
        detail: `공동 참여 ${item.co_participation_count}건`,
        active: selected === key,
        select: () => onSelect(key),
      },
    });
    edges.push({
      id: key,
      source: "company",
      sourceHandle: "competition",
      target: key,
      type: "smoothstep",
      style: { stroke: "#a78bfa", strokeDasharray: "5 4", strokeWidth: selected === key ? 3 : 1.5 },
    });
  });
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-[#0b1220] text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/70 px-5 py-4">
        <div>
          <h3 className="font-semibold">업체·기관 관계</h3>
          <p className="mt-1 text-xs text-slate-400">
            노드를 선택해 관계를 확인하세요. 드래그로 이동하고 확대·축소할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="text-sky-300">━ 계약 거래</span>
          <span className="text-violet-300">┄ 공동 입찰 참여</span>
        </div>
      </div>
      <RelationshipCanvas nodes={nodes} edges={edges} />
      {!organizations.length && !competitors.length && (
        <p className="px-5 pb-5 text-sm text-slate-300">현재 조건에서 확인된 관계가 없습니다.</p>
      )}
      <p className="border-t border-slate-700/70 px-5 py-3 text-xs text-slate-400">
        중심 업체 1개 · 주요 기관 최대 5개 · 관측 경쟁업체 최대 5개. 선은 확인된 관계만 나타냅니다.
      </p>
    </div>
  );
}

export function RelationshipCanvas({
  nodes,
  edges,
  height = 470,
}: {
  nodes: RelationshipNode[];
  edges: Edge[];
  height?: number | string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const flow = useRef<ReactFlowInstance<RelationshipNode, Edge> | null>(null);
  const identity = nodes.map((node) => node.id).join("|");
  useEffect(() => {
    if (!viewport.current) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        void flow.current?.fitView({ padding: 0.15, maxZoom: 1 });
      });
    });
    observer.observe(viewport.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [identity]);
  return (
    <div ref={viewport} style={{ height }} role="group" aria-label="업체 관계 네트워크">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
        fitView
        minZoom={0.15}
        maxZoom={1.5}
        colorMode="dark"
        style={{ background: "#0b1220" }}
        onInit={(instance) => {
          flow.current = instance;
        }}
        preventScrolling={false}
        ariaLabelConfig={{
          "controls.zoomIn.ariaLabel": "확대",
          "controls.zoomOut.ariaLabel": "축소",
          "controls.fitView.ariaLabel": "전체 관계 보기",
        }}
      >
        <Background variant={BackgroundVariant.Dots} color="#334155" gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
