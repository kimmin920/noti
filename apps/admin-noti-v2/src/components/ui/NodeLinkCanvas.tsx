"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AppIcon } from "@/components/icons/AppIcon";

export type NodeLinkPortSide = "left" | "right";
export type NodeLinkNodeStatus = "success" | "pending" | "neutral" | "danger";

export type NodeLinkNode = {
  id: string;
  x: number;
  y: number;
  anchorX?: "left" | "right";
  label: ReactNode;
  meta?: ReactNode;
  description?: ReactNode;
  status?: NodeLinkNodeStatus;
  width?: number;
  portLeft?: boolean;
  portRight?: boolean;
  portLeftColor?: string;
  portRightColor?: string;
  className?: string;
};

export type NodeLinkEdge = {
  id?: string;
  source: string;
  target: string;
  sourceSide?: NodeLinkPortSide;
  targetSide?: NodeLinkPortSide;
  color?: string;
  dashed?: boolean;
};

type ComputedPath = {
  key: string;
  d: string;
  color: string;
  dashed: boolean;
};

type NodeLinkCanvasProps = {
  nodes: NodeLinkNode[];
  edges: NodeLinkEdge[];
  height?: number | string;
  className?: string;
  renderNode?: (node: NodeLinkNode) => ReactNode;
};

const STATUS_ICON: Record<NodeLinkNodeStatus, ReactNode> = {
  success: <AppIcon name="check" className="icon icon-14" />,
  pending: <AppIcon name="clock" className="icon icon-14" />,
  neutral: <AppIcon name="info" className="icon icon-14" />,
  danger: <AppIcon name="warn" className="icon icon-14" />,
};

const STATUS_CLASS: Record<NodeLinkNodeStatus, string> = {
  success: "success",
  pending: "pending",
  neutral: "neutral",
  danger: "danger",
};

export function NodeLinkCanvas({
  nodes,
  edges,
  height = 360,
  className,
  renderNode,
}: NodeLinkCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const [paths, setPaths] = useState<ComputedPath[]>([]);

  const nodeIds = useMemo(() => nodes.map((node) => node.id).join("|"), [nodes]);

  const setNodeRef = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) {
      nodeRefs.current.set(id, element);
    } else {
      nodeRefs.current.delete(id);
    }
  }, []);

  const calculatePaths = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const rects = new Map<string, DOMRect>();
    for (const node of nodes) {
      const element = nodeRefs.current.get(node.id);
      if (element) {
        rects.set(node.id, element.getBoundingClientRect());
      }
    }

    setPaths(
      edges.flatMap((edge, index) => {
        const source = rects.get(edge.source);
        const target = rects.get(edge.target);
        if (!source || !target) return [];

        const sourceSide = edge.sourceSide ?? "right";
        const targetSide = edge.targetSide ?? "left";
        const sx = sourceSide === "right" ? source.right - canvasRect.left : source.left - canvasRect.left;
        const sy = source.top - canvasRect.top + source.height / 2;
        const tx = targetSide === "right" ? target.right - canvasRect.left : target.left - canvasRect.left;
        const ty = target.top - canvasRect.top + target.height / 2;
        const straight = Math.abs(sy - ty) < 4;
        const direction = sourceSide === "right" ? 1 : -1;
        const targetDirection = targetSide === "left" ? -1 : 1;
        const curve = Math.max(56, Math.min(96, Math.abs(tx - sx) / 2));
        const d = straight
          ? `M${sx},${sy} L${tx},${ty}`
          : `M${sx},${sy} C${sx + curve * direction},${sy} ${tx + curve * targetDirection},${ty} ${tx},${ty}`;

        return [{
          key: edge.id ?? `${edge.source}-${edge.target}-${index}`,
          d,
          color: edge.color ?? "var(--accent-emphasis)",
          dashed: Boolean(edge.dashed),
        }];
      }),
    );
  }, [edges, nodes]);

  useLayoutEffect(() => {
    calculatePaths();
    const frame = window.requestAnimationFrame(calculatePaths);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(calculatePaths) : null;

    if (canvasRef.current) {
      resizeObserver?.observe(canvasRef.current);
    }
    for (const element of nodeRefs.current.values()) {
      resizeObserver?.observe(element);
    }

    window.addEventListener("resize", calculatePaths);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", calculatePaths);
      resizeObserver?.disconnect();
    };
  }, [calculatePaths, nodeIds]);

  return (
    <div
      ref={canvasRef}
      className={`node-link-canvas${className ? ` ${className}` : ""}`}
      style={height === undefined ? undefined : { height }}
    >
      <svg className="node-link-edge-svg" aria-hidden="true">
        {paths.map((path) => (
          <path
            key={path.key}
            d={path.d}
            fill="none"
            stroke={path.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={path.dashed ? "6 6" : undefined}
          />
        ))}
      </svg>

      {nodes.map((node) => (
        <div
          key={node.id}
          className="node-link-node-position"
          style={node.anchorX === "right" ? { right: node.x, top: node.y } : { left: node.x, top: node.y }}
        >
          <div
            ref={(element) => setNodeRef(node.id, element)}
            className={`node-link-node-wrap${node.className ? ` ${node.className}` : ""}`}
            style={{ "--node-link-width": `${node.width ?? 260}px` } as CSSProperties}
          >
            {node.portLeft ? <Port side="left" color={node.portLeftColor} /> : null}
            {renderNode ? renderNode(node) : <DefaultNode node={node} />}
            {node.portRight ? <Port side="right" color={node.portRightColor} /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function DefaultNode({ node }: { node: NodeLinkNode }) {
  const status = node.status ?? "neutral";

  return (
    <div className="node-link-node">
      <span className={`node-link-status ${STATUS_CLASS[status]}`}>{STATUS_ICON[status]}</span>
      <span className="node-link-label">{node.label}</span>
      {node.meta ? <span className="node-link-meta">{node.meta}</span> : null}
    </div>
  );
}

function Port({ side, color }: { side: NodeLinkPortSide; color?: string }) {
  return (
    <>
      <span className={`node-link-port-socket ${side}`} />
      <span className={`node-link-port-dot ${side}`} style={color ? { background: color } : undefined} />
    </>
  );
}
