"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import type { ChainLinkView } from "@/lib/types";

interface ChainRingProps {
  chain: ChainLinkView[];
  myId?: string;
}

export function ChainRing({ chain, myId }: ChainRingProps) {
  const n = chain.length;
  // Sequential animation state: how many arrows are currently drawn (0 to n)
  const [drawnArrows, setDrawnArrows] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying || drawnArrows >= n) return;

    const timer = setTimeout(() => {
      setDrawnArrows((prev) => {
        const next = prev + 1;
        if (next >= n) {
          setIsPlaying(false);
        }
        return next;
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [drawnArrows, n, isPlaying]);

  const handleReplay = () => {
    setDrawnArrows(0);
    setIsPlaying(true);
  };

  const handleShowAll = () => {
    setDrawnArrows(n);
    setIsPlaying(false);
  };

  if (n === 0) return null;

  // Geometry configuration based on participant count (4 to 20)
  const cx = 180;
  const cy = 180;

  // Adjust radius and node size to prevent overlap at 360px width
  let rRadius = 120;
  let nodeR = 20;
  let fontSize = 11;

  if (n <= 6) {
    rRadius = 110;
    nodeR = 22;
    fontSize = 12;
  } else if (n <= 10) {
    rRadius = 122;
    nodeR = 17;
    fontSize = 11;
  } else if (n <= 14) {
    rRadius = 132;
    nodeR = 14;
    fontSize = 9.5;
  } else {
    // 15~20 people
    rRadius = 140;
    nodeR = 11;
    fontSize = 8.5;
  }

  // Calculate coordinates for each participant (givers in position order)
  const nodes = chain.map((link, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = cx + rRadius * Math.cos(angle);
    const y = cy + rRadius * Math.sin(angle);
    const isMe = link.giver.id === myId;
    return {
      index: i,
      id: link.giver.id,
      name: link.giver.name,
      x,
      y,
      isMe,
    };
  });

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Animation Controls */}
      <div className="flex w-full items-center justify-between px-1">
        <span className="text-xs font-semibold text-ink-soft">
          연결 진행: {drawnArrows}/{n}
        </span>
        <div className="flex gap-2">
          {drawnArrows < n && (
            <button
              type="button"
              onClick={handleShowAll}
              className="text-xs font-semibold text-ink-soft hover:text-ink underline"
            >
              전체 보기
            </button>
          )}
          <Button
            variant="secondary"
            onClick={handleReplay}
            className="!min-h-8 !py-1 text-xs"
          >
            다시 재생 🔄
          </Button>
        </div>
      </div>

      {/* SVG Ring Visualization */}
      <div className="relative flex w-full max-w-[340px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface p-2 shadow-xs">
        <svg
          viewBox="0 0 360 360"
          className="h-[320px] w-[320px] touch-none select-none"
        >
          <defs>
            {/* Arrowhead marker */}
            <marker
              id="chain-arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--color-brand, #d9573b)" />
            </marker>

            {/* Inactive arrowhead marker */}
            <marker
              id="chain-arrow-inactive"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 2 L 6 5 L 0 8 z" fill="var(--color-line, #e6dccf)" />
            </marker>
          </defs>

          {/* Background circle guideline */}
          <circle
            cx={cx}
            cy={cy}
            r={rRadius}
            fill="none"
            stroke="var(--color-line, #e6dccf)"
            strokeDasharray="4 4"
            strokeWidth="1"
            opacity="0.6"
          />

          {/* Arrows from node i to node (i + 1) % n */}
          {nodes.map((fromNode, i) => {
            const toNode = nodes[(i + 1) % n];
            const isDrawn = i < drawnArrows;

            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return null;

            const ux = dx / dist;
            const uy = dy / dist;

            // Trim start & end so arrows don't collide with node circles
            const x1 = fromNode.x + ux * (nodeR + 2);
            const y1 = fromNode.y + uy * (nodeR + 2);
            const x2 = toNode.x - ux * (nodeR + 8);
            const y2 = toNode.y - uy * (nodeR + 8);

            return (
              <line
                key={`arrow-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isDrawn ? "var(--color-brand, #d9573b)" : "transparent"}
                strokeWidth={isDrawn ? (fromNode.isMe ? 3 : 2) : 1}
                markerEnd={isDrawn ? "url(#chain-arrow)" : undefined}
                className="transition-all duration-500 ease-out"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node, i) => {
            const isParticipating = i < drawnArrows || i <= drawnArrows;
            const displayName =
              node.name.length > 4 ? `${node.name.slice(0, 3)}…` : node.name;

            return (
              <g
                key={`node-${node.id}`}
                className="transition-transform duration-300"
              >
                {/* Outer halo if current user */}
                {node.isMe && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={nodeR + 4}
                    fill="none"
                    stroke="var(--color-brand, #d9573b)"
                    strokeWidth="2"
                    strokeDasharray="2 2"
                    className="animate-spin"
                    style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                  />
                )}

                {/* Node circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={nodeR}
                  fill={
                    node.isMe
                      ? "var(--color-brand, #d9573b)"
                      : isParticipating
                        ? "var(--color-surface, #ffffff)"
                        : "var(--color-surface-2, #f3ece2)"
                  }
                  stroke={
                    node.isMe
                      ? "var(--color-brand, #d9573b)"
                      : isParticipating
                        ? "var(--color-brand, #d9573b)"
                        : "var(--color-line, #e6dccf)"
                  }
                  strokeWidth={node.isMe ? 2.5 : 1.5}
                />

                {/* Name Label */}
                <text
                  x={node.x}
                  y={node.y}
                  dy=".35em"
                  textAnchor="middle"
                  fontSize={fontSize}
                  fontWeight={node.isMe ? "bold" : "600"}
                  fill={
                    node.isMe
                      ? "var(--color-brand-ink, #ffffff)"
                      : "var(--color-ink, #2a2118)"
                  }
                  className="pointer-events-none select-none"
                >
                  {displayName}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Text Summary Loop: A → B → ... → A */}
      <div className="w-full rounded-xl bg-surface-2/60 p-3">
        <span className="mb-1.5 block text-xs font-semibold text-ink-soft">
          🔄 순환 고리 요약
        </span>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink">
          {chain.map((link) => (
            <span key={link.position} className="inline-flex items-center gap-1">
              <span
                className={`font-semibold ${
                  link.giver.id === myId
                    ? "rounded-md bg-brand px-1.5 py-0.5 text-brand-ink font-bold"
                    : "text-ink"
                }`}
              >
                {link.giver.name}
              </span>
              <span className="text-brand font-bold">→</span>
            </span>
          ))}
          {/* Loop close: back to first giver */}
          <span
            className={`font-semibold ${
              chain[0].giver.id === myId
                ? "rounded-md bg-brand px-1.5 py-0.5 text-brand-ink font-bold"
                : "text-ink"
            }`}
          >
            {chain[0].giver.name}
          </span>
        </div>
      </div>
    </div>
  );
}
