import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { useEffect, useRef, useState } from "react";
import { Plus, Minus, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatExactMoney } from "@/shared/format/money";
import { entityKey, linkKey, linkLabel, type ExplorerEntity, type ExplorerLink } from "./useNetworkExplorer";
import { companyNodeScopes, graphRanks } from "./graph-layout";
import { companyScopeLabels, explorerNodePresentation } from "./graph-presentation";

const companyNode = explorerNodePresentation.company;
const organizationNode = explorerNodePresentation.organization;
const fieldNode = explorerNodePresentation.field;

function fitVisibleGraph(cy: Core) {
  const visible = cy.elements().filter((element) => !element.hasClass("hidden"));
  if (visible.length) cy.fit(visible, 56);
}

export function ExplorerGraph({
  root,
  entities,
  links,
  selected,
  selectedRelation,
  onSelect,
  onSelectLink,
  onClear,
  entityVisibility = "all",
  sizeMetric = "amount",
}: {
  entityVisibility?: "all" | "organization" | "company";
  sizeMetric?: "amount" | "count";
  root?: ExplorerEntity;
  entities: ExplorerEntity[];
  links: ExplorerLink[];
  selected?: ExplorerEntity;
  selectedRelation?: string;
  onSelect: (entity: ExplorerEntity) => void;
  onSelectLink?: (link: ExplorerLink) => void;
  onClear?: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<Core | null>(null);
  const [hoveredNode, setHoveredNode] = useState<{
    name: string;
    scope?: string;
    value?: number;
    partial: boolean;
    x: number;
    y: number;
  } | null>(null);
  const current = useRef({ entities, links, onSelect, onSelectLink, onClear });
  useEffect(() => {
    current.current = { entities, links, onSelect, onSelectLink, onClear };
  }, [entities, links, onSelect, onSelectLink, onClear]);
  useEffect(() => {
    if (!container.current) return;
    const stage = container.current;
    const wheel = (event: WheelEvent) => {
      const cy = instance.current;
      if (!cy || event.deltaY === 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1;
      const delta = Math.max(-120, Math.min(120, event.deltaY * unit));
      const bounds = stage.getBoundingClientRect();
      cy.zoom({
        level: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * Math.exp(-delta * 0.0025))),
        renderedPosition: { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      });
    };
    // Capture before the renderer: page-scroll suppression and initial wheel sampling
    // must not swallow the first notches of an ordinary mouse wheel.
    stage.addEventListener("wheel", wheel, { capture: true, passive: false });
    const cy = cytoscape({
      container: container.current,
      elements: [],
      minZoom: 0.05,
      maxZoom: 3,
      desktopTapThreshold: 14,
      touchTapThreshold: 20,
      boxSelectionEnabled: false,
      selectionType: "single",
      style: [
        {
          selector: "node",
          style: {
            shape: "ellipse",
            width: "data(diameter)",
            height: "data(diameter)",
            "background-color": companyNode.backgroundColor,
            "border-color": companyNode.borderColor,
            "border-width": 1.5,
            label: "data(label)",
            color: "#e2e8f0",
            "font-size": 13,
            "min-zoomed-font-size": 8,
            "font-weight": 500,
            "line-height": 1.3,
            "text-wrap": "wrap",
            "text-max-width": "128px",
            "text-valign": "bottom",
            "text-margin-y": 10,
            "text-outline-color": "#0b1220",
            "text-outline-width": 2,
            "overlay-opacity": 0,
            "underlay-color": companyNode.underlayColor,
            "underlay-opacity": 0.13,
            "underlay-padding": 8,
          },
        },
        {
          selector: 'node[kind = "organization"]',
          style: {
            width: "data(diameter)",
            height: "data(diameter)",
            "background-color": organizationNode.backgroundColor,
            "border-color": organizationNode.borderColor,
            "underlay-color": organizationNode.underlayColor,
          },
        },
        {
          selector: 'node[kind = "field"]',
          style: {
            "background-color": fieldNode.backgroundColor,
            "border-color": fieldNode.borderColor,
            "underlay-color": fieldNode.underlayColor,
          },
        },
        {
          selector: 'node[center = "true"]',
          style: {
            "border-width": 2.5,
            "text-max-width": "160px",
            "font-size": 15,
            "font-weight": 650,
            "underlay-opacity": 0.22,
            "underlay-padding": 15,
          },
        },
        {
          selector: 'node[center = "true"][kind = "field"]',
          style: { width: 64, height: 64 },
        },
        {
          selector: "node:selected, node.endpoint",
          style: {
            "border-color": "#ffffff",
            "border-width": 3,
            "underlay-color": "#ffffff",
            "underlay-opacity": 0.12,
            "underlay-padding": 12,
          },
        },
        {
          selector: "edge",
          style: {
            width: "data(lineWidth)",
            "line-color": "data(color)",
            label: "data(label)",
            "font-size": 10,
            "min-zoomed-font-size": 8,
            color: "#a8b8cc",
            "text-rotation": "none",
            "text-background-color": "#0b1220",
            "text-background-opacity": 0.8,
            "text-background-padding": "3px",
            "text-events": "yes",
            "control-point-step-size": 64,
            opacity: 0.8,
            "curve-style": "bezier",
            "overlay-opacity": 0,
          },
        },
        {
          selector: 'edge[kind = "participation"], edge[kind = "competition"]',
          style: { "line-style": "dashed" },
        },
        {
          selector: "edge:selected",
          style: {
            width: "data(selectedWidth)",
            "line-color": "#f8fafc",
            color: "#ffffff",
            "font-weight": 700,
            "z-index": 10,
          },
        },
        { selector: ".hidden", style: { display: "none" } },
        { selector: "node[metricKnown = 'false'][center = 'false']", style: { "background-opacity": 0.3 } },
        {
          selector: 'node[scope = "co_bidder"]',
          style: {
            "background-color": companyNode.backgroundColor,
            "background-opacity": 1,
            "border-color": companyNode.borderColor,
            "underlay-color": companyNode.underlayColor,
          },
        },
        { selector: ".muted", style: { opacity: 0.25 } },
        { selector: ".focus", style: { "line-color": "#7dd3fc", width: "data(selectedWidth)", opacity: 1 } },
      ],
    });
    instance.current = cy;
    cy.on("tap", "node", (event) => {
      const entity = current.current.entities.find((item) => entityKey(item) === event.target.id());
      if (entity) current.current.onSelect(entity);
    });
    cy.on("tap", "edge", (event) => {
      const link = current.current.links.find((item) => linkKey(item) === event.target.id());
      if (link) {
        if (current.current.onSelectLink) current.current.onSelectLink(link);
        else current.current.onSelect(link.target);
      }
    });
    cy.on("tap", (event) => {
      if (event.target === cy) current.current.onClear?.();
    });
    cy.on("mouseover", "node", (event) => {
      const node = event.target;
      const position = node.renderedPosition();
      setHoveredNode({
        name: node.data("name"),
        scope: node.data("scopeLabel"),
        value: node.data("metricValue"),
        partial: node.data("metricPartial") === "true",
        x: position.x,
        y: position.y,
      });
    });
    cy.on("mouseout", "node", () => setHoveredNode(null));
    const observer = new ResizeObserver(() => {
      cy.resize();
      fitVisibleGraph(cy);
    });
    observer.observe(container.current);
    return () => {
      stage.removeEventListener("wheel", wheel, true);
      observer.disconnect();
      instance.current = null;
      cy.destroy();
    };
  }, []);
  const linkValues = links.map((link) => {
    if ((link.kind ?? "contract") !== "contract") return undefined;
    const value =
      sizeMetric === "amount"
        ? link.relationship.total_attributed_contract_amount
        : link.relationship.contract_event_count;
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
  });
  const totals = new Map<string, number>();
  const partialAmounts = new Set<string>();
  links.forEach((link, index) => {
    if ((link.kind ?? "contract") !== "contract") return;
    const value = linkValues[index];
    for (const entity of [link.source, link.target]) {
      const key = entityKey(entity);
      if (sizeMetric === "amount" && (value == null || link.relationship.amount_completeness !== "complete"))
        partialAmounts.add(key);
      if (value != null) totals.set(key, (totals.get(key) ?? 0) + value);
    }
  });
  const nodeMax = Math.max(1, ...totals.values());
  const edgeMax = Math.max(1, ...linkValues.map((value) => value ?? 0));
  const weight = (value: number | undefined, max: number) => (value == null ? 0 : Math.sqrt(value / max));
  // The visible circle area follows the contract amount. Keep only a small clickable minimum.
  const diameter = (value: number | undefined) =>
    value == null ? 18 : Math.max(18, 104 * Math.sqrt(value / nodeMax));
  const ranks = graphRanks(root, entities, links);
  const scopes = companyNodeScopes(root, entities, links);
  const elements: ElementDefinition[] = [
    ...entities.map((entity) => {
      const scope = scopes.get(entityKey(entity));
      const typeLabel = (scope ? companyScopeLabels[scope] : undefined) ??
        explorerNodePresentation[entity.type].label;
      return {
        data: {
          id: entityKey(entity),
          rank: ranks.get(entityKey(entity)) ?? 0,
          name: entity.name,
          label: `${typeLabel}\n${entity.name.length > 18 ? `${entity.name.slice(0, 17)}…` : entity.name}`,
          scope,
          scopeLabel: scope ? companyScopeLabels[scope] : undefined,
          diameter: diameter(totals.get(entityKey(entity))),
          metricValue: totals.get(entityKey(entity)),
          metricPartial: partialAmounts.has(entityKey(entity)) ? "true" : "false",
          metricKnown: totals.has(entityKey(entity)) ? "true" : "false",
          kind: entity.type,
          center: root && entityKey(entity) === entityKey(root) ? "true" : "false",
        },
      };
    }),
    ...links.map((link, index) => ({
      data: {
        id: linkKey(link),
        label: linkLabel(link),
        lineWidth: 1.2 + 3 * weight(linkValues[index], edgeMax),
        selectedWidth: 2.4 + 3 * weight(linkValues[index], edgeMax),
        kind: link.kind ?? "contract",
        color: {
          contract: "#5e9caa",
          award: "#5e9caa",
          participation: "#7dd3fc",
          competition: "#a78bfa",
          field: "#7dd3fc",
        }[link.kind ?? "contract"],
        source: entityKey(link.source),
        target: entityKey(link.target),
      },
    })),
  ];
  // Selection changes only restyle the graph; they must not rebuild its layout.
  const graphIdentity = JSON.stringify(elements);
  useEffect(() => {
    const cy = instance.current;
    if (!cy) return;
    cy.elements().remove();
    cy.add(JSON.parse(graphIdentity));
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const layout = cy.layout({
      name: "concentric",
      animate: false,
      fit: false,
      padding: 72,
      nodeDimensionsIncludeLabels: false,
      avoidOverlap: true,
      minNodeSpacing: 16,
      concentric: (node) => node.data("rank"),
      levelWidth: () => 0.5,
      startAngle: -Math.PI / 2,
      clockwise: true,
    });
    layout.run();
    cy.nodes().filter((node) => node.data("center") === "true").lock();
    fitVisibleGraph(cy);
    const stage = container.current;
    let hovered = false;
    const enter = () => {
      hovered = true;
    };
    const leave = () => {
      hovered = false;
    };
    const rememberPosition = (event: cytoscape.EventObject) => {
      const anchor = anchors.find((item) => item.node.id() === event.target.id());
      if (anchor) anchor.position = { ...event.target.position() };
    };
    const anchors = cy.nodes().map((node, index) => ({ node, index, position: { ...node.position() } }));
    let frame = 0;
    let last = 0;
    let elapsed = 0;
    const drift = (time: number) => {
      frame = requestAnimationFrame(drift);
      if (time - last < 50) return;
      const delta = Math.min(100, time - last);
      last = time;
      if (hovered || document.hidden || cy.elements(":selected").length) return;
      elapsed += delta;
      cy.batch(() => {
        for (const { node, index, position } of anchors) {
          if (node.grabbed() || node.hasClass("hidden") || node.data("center") === "true") continue;
          node.position({
            x: position.x + Math.sin(elapsed / 2800 + index * 1.7) * 3,
            y: position.y + Math.sin(elapsed / 3400 + index * 2.1) * 4,
          });
        }
      });
    };
    if (!reduceMotion) {
      stage?.addEventListener("pointerenter", enter);
      stage?.addEventListener("pointerleave", leave);
      cy.on("dragfree", "node", rememberPosition);
      frame = requestAnimationFrame(drift);
    }
    return () => {
      cancelAnimationFrame(frame);
      stage?.removeEventListener("pointerenter", enter);
      stage?.removeEventListener("pointerleave", leave);
      cy.off("dragfree", "node", rememberPosition);
      layout.stop();
    };
  }, [graphIdentity]);
  useEffect(() => {
    const cy = instance.current;
    if (!cy) return;
    cy.elements().unselect();
    cy.elements().removeClass("focus muted endpoint");
    if (selectedRelation) {
      const edge = cy.getElementById(selectedRelation);
      edge.select();
      const endpoints = edge.connectedNodes();
      endpoints.addClass("endpoint");
      cy.elements().difference(edge.union(endpoints)).addClass("muted");
      return;
    }
    if (selected) {
      const node = cy.getElementById(entityKey(selected));
      node.select();
      const edges = node.connectedEdges();
      edges.addClass("focus");
      edges.connectedNodes().difference(node).addClass("endpoint");
      cy.elements().difference(node.union(edges).union(edges.connectedNodes())).addClass("muted");
    }
  }, [selected, selectedRelation, graphIdentity]);
  useEffect(() => {
    const cy = instance.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass("hidden");
      if (entityVisibility !== "all") {
        cy.nodes()
          .filter((node) => node.data("kind") !== entityVisibility && node.data("center") !== "true")
          .addClass("hidden");
        cy.edges()
          .filter((edge) => edge.source().hasClass("hidden") || edge.target().hasClass("hidden"))
          .addClass("hidden");
      }
    });
    fitVisibleGraph(cy);
  }, [entityVisibility, graphIdentity]);
  return (
    <div
      className="relative h-full w-full bg-[#0b1220]"
      style={{ backgroundImage: "radial-gradient(ellipse at 50% 45%, #162840 0%, #0b1220 65%)" }}
      role="group"
      aria-label="기관·업체 거래 관계"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(circle, #94a3b8 0.65px, transparent 0.85px), radial-gradient(circle, #64748b 0.5px, transparent 0.8px)",
          backgroundSize: "93px 89px, 137px 127px",
          backgroundPosition: "17px 31px, 61px 13px",
        }}
      />
      <div ref={container} className="relative h-full w-full" />
      {hoveredNode && (
        <div
          className="pointer-events-none absolute z-20 max-w-60 rounded-lg border border-slate-600 bg-[#132033]/95 px-3 py-2 text-xs text-slate-100 shadow-lg"
          style={{ left: hoveredNode.x, top: hoveredNode.y, transform: "translate(12px, -110%)" }}
          role="status"
        >
          {hoveredNode.scope && <div className="text-[10px] font-semibold text-sky-300">{hoveredNode.scope}</div>}
          <div className="font-semibold">{hoveredNode.name}</div>
          <div className="mt-1 text-slate-300">
            표시된 관계의 {sizeMetric === "amount" ? "계약금액" : "계약 건수"}: {hoveredNode.value == null
              ? "확인되지 않음"
              : sizeMetric === "amount"
                ? formatExactMoney(hoveredNode.value)
                : `${hoveredNode.value.toLocaleString("ko-KR")}건`}
          </div>
          {hoveredNode.partial && <div className="mt-1 text-amber-300">일부 계약 금액 미확인</div>}
        </div>
      )}
      <div className="absolute right-3 bottom-3 flex gap-1 rounded-lg border border-slate-700 bg-[#132033]/95 p-1 shadow-sm backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-slate-300 hover:bg-slate-700 hover:text-white"
          aria-label="확대"
          onClick={() => {
            const cy = instance.current;
            if (cy)
              cy.zoom({
                level: Math.min(cy.maxZoom(), cy.zoom() * 1.2),
                renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
              });
          }}
        >
          <Plus />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-slate-300 hover:bg-slate-700 hover:text-white"
          aria-label="축소"
          onClick={() => {
            const cy = instance.current;
            if (cy)
              cy.zoom({
                level: Math.max(cy.minZoom(), cy.zoom() / 1.2),
                renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
              });
          }}
        >
          <Minus />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-slate-300 hover:bg-slate-700 hover:text-white"
          aria-label="전체 관계 보기"
          onClick={() => instance.current && fitVisibleGraph(instance.current)}
        >
          <Maximize />
        </Button>
      </div>
    </div>
  );
}
