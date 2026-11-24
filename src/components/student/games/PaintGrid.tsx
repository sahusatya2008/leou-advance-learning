"use client";

import { useId } from "react";
import type { Direction, ParsedCanvas } from "@/lib/games/types";

/**
 * The paint stage. Draws the target picture faintly and stamps the turtle's ink
 * on top as the trace replays.
 *
 * Like `BotGrid` this is pure and stateless: the player hands it the set of
 * inked cells and the turtle's pose, and it renders. The turtle group carries a
 * transition so it slides between cells rather than jumping.
 */

const CELL = 52;

export type TurtlePose = { x: number; y: number; dir: Direction };

export function PaintGrid({
  canvas,
  turtle,
  inked,
  accent,
  bump = 0,
}: {
  canvas: ParsedCanvas;
  turtle: TurtlePose;
  inked: Set<string>;
  accent: [string, string];
  bump?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const w = canvas.width * CELL;
  const h = canvas.height * CELL;
  const cx = turtle.x * CELL + CELL / 2;
  const cy = turtle.y * CELL + CELL / 2;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full select-none"
      style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Canvas"
    >
      <defs>
        <filter id={`pglow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x={0} y={0} width={w} height={h} rx={10} fill="#0a0f1f" />

      {Array.from({ length: canvas.height }).map((_, y) =>
        Array.from({ length: canvas.width }).map((__, x) => {
          const k = `${x},${y}`;
          const required = canvas.required.has(k);
          const forbidden = canvas.forbidden.has(k);
          const filled = inked.has(k);
          return (
            <g key={k}>
              <rect x={x * CELL + 2} y={y * CELL + 2} width={CELL - 4} height={CELL - 4} rx={6} fill="#0e1730" stroke="#16203c" strokeWidth={1} />
              {required && !filled && (
                <rect
                  x={x * CELL + 5}
                  y={y * CELL + 5}
                  width={CELL - 10}
                  height={CELL - 10}
                  rx={5}
                  fill="none"
                  stroke="#2b3858"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
              )}
              {forbidden && (
                <rect x={x * CELL + 5} y={y * CELL + 5} width={CELL - 10} height={CELL - 10} rx={5} fill="none" stroke="#7f1d1d" strokeWidth={1.5} />
              )}
              {filled && (
                <rect
                  x={x * CELL + 3}
                  y={y * CELL + 3}
                  width={CELL - 6}
                  height={CELL - 6}
                  rx={5}
                  fill={accent[1]}
                  opacity={0.85}
                  filter={`url(#pglow-${uid})`}
                  style={{ transition: "opacity 200ms ease" }}
                />
              )}
            </g>
          );
        })
      )}

      {/* start marker */}
      <circle cx={canvas.start.x * CELL + CELL / 2} cy={canvas.start.y * CELL + CELL / 2} r={CELL * 0.32} fill="none" stroke="#233150" strokeWidth={1.5} strokeDasharray="4 4" />

      {/* turtle */}
      <g
        key={bump}
        style={{
          transform: `translate(${cx}px, ${cy}px) rotate(${turtle.dir * 90}deg)`,
          transformBox: "view-box",
          transformOrigin: "0px 0px",
          transition: "transform 110ms linear",
        }}
      >
        <circle r={CELL * 0.36} fill={accent[0]} opacity={0.18} filter={`url(#pglow-${uid})`} />
        <rect x={-CELL * 0.26} y={-CELL * 0.26} width={CELL * 0.52} height={CELL * 0.52} rx={8} fill="#0b1226" stroke={accent[0]} strokeWidth={2} />
        <polygon points={`0,${-CELL * 0.32} ${-CELL * 0.12},${-CELL * 0.12} ${CELL * 0.12},${-CELL * 0.12}`} fill={accent[1]} />
      </g>
    </svg>
  );
}
