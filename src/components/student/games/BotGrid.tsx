"use client";

import { useId } from "react";
import type { Direction, ParsedWorld } from "@/lib/games/types";

/**
 * The stage. Draws one frame of a level: walls, cores, the portal and the bot.
 *
 * Pure and stateless — the player hands it a position and it renders. The bot
 * group carries a CSS transform transition, so when the player advances a frame
 * the bot *slides* to the next tile (and rotates in place for a turn) instead of
 * teleporting. Nothing here knows about code or runs; it is only a picture.
 */

const CELL = 56;

export type BotPose = { x: number; y: number; dir: Direction };

export function BotGrid({
  world,
  bot,
  collected,
  trail,
  accent,
  bump = 0,
}: {
  world: ParsedWorld;
  bot: BotPose;
  collected: Set<string>;
  trail?: string[];
  accent: [string, string];
  /** Changes to force the bot to re-pop (e.g. a crash shake). */
  bump?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const w = world.width * CELL;
  const h = world.height * CELL;
  const cx = bot.x * CELL + CELL / 2;
  const cy = bot.y * CELL + CELL / 2;

  const trailSet = new Set(trail ?? []);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full select-none"
      style={{ aspectRatio: `${world.width} / ${world.height}` }}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Game board"
    >
      <defs>
        <radialGradient id={`core-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
        <radialGradient id={`portal-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent[1]} stopOpacity="0.95" />
          <stop offset="70%" stopColor={accent[0]} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent[0]} stopOpacity="0" />
        </radialGradient>
        <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* floor */}
      <rect x={0} y={0} width={w} height={h} rx={10} fill="#0a0f1f" />

      {/* tiles */}
      {Array.from({ length: world.height }).map((_, y) =>
        Array.from({ length: world.width }).map((__, x) => {
          const k = `${x},${y}`;
          const isWall = world.walls.has(k);
          return (
            <rect
              key={k}
              x={x * CELL + 3}
              y={y * CELL + 3}
              width={CELL - 6}
              height={CELL - 6}
              rx={7}
              fill={isWall ? "#1b2338" : "#0e1730"}
              stroke={isWall ? "#2b3858" : "#16203c"}
              strokeWidth={1}
            />
          );
        })
      )}

      {/* start tile marker */}
      <circle cx={world.start.x * CELL + CELL / 2} cy={world.start.y * CELL + CELL / 2} r={CELL * 0.32} fill="none" stroke="#233150" strokeWidth={1.5} strokeDasharray="4 4" />

      {/* trail */}
      {trailSet.size > 0 &&
        [...trailSet].map((k) => {
          const [x, y] = k.split(",").map(Number);
          return <circle key={`t-${k}`} cx={x * CELL + CELL / 2} cy={y * CELL + CELL / 2} r={2.5} fill={accent[0]} opacity={0.3} />;
        })}

      {/* cores */}
      {[...world.gems].map((k) => {
        const [x, y] = k.split(",").map(Number);
        const taken = collected.has(k);
        const gcx = x * CELL + CELL / 2;
        const gcy = y * CELL + CELL / 2;
        return (
          <g key={`g-${k}`} style={{ opacity: taken ? 0.12 : 1, transition: "opacity 300ms ease" }} filter={taken ? undefined : `url(#glow-${uid})`}>
            <rect
              x={gcx - CELL * 0.16}
              y={gcy - CELL * 0.16}
              width={CELL * 0.32}
              height={CELL * 0.32}
              rx={4}
              fill={`url(#core-${uid})`}
              transform={`rotate(45 ${gcx} ${gcy})`}
            />
          </g>
        );
      })}

      {/* portal */}
      {world.goal && (
        <g>
          <circle cx={world.goal.x * CELL + CELL / 2} cy={world.goal.y * CELL + CELL / 2} r={CELL * 0.46} fill={`url(#portal-${uid})`} />
          <circle cx={world.goal.x * CELL + CELL / 2} cy={world.goal.y * CELL + CELL / 2} r={CELL * 0.26} fill="none" stroke={accent[1]} strokeWidth={2.5} />
          <circle cx={world.goal.x * CELL + CELL / 2} cy={world.goal.y * CELL + CELL / 2} r={CELL * 0.13} fill={accent[1]}>
            <animate attributeName="r" values={`${CELL * 0.1};${CELL * 0.17};${CELL * 0.1}`} dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;1;0.7" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* bot */}
      <g
        key={bump}
        style={{
          transform: `translate(${cx}px, ${cy}px) rotate(${bot.dir * 90}deg)`,
          transformBox: "view-box",
          transformOrigin: "0px 0px",
          transition: "transform 110ms linear",
        }}
      >
        <circle r={CELL * 0.4} fill={accent[1]} opacity={0.18} filter={`url(#glow-${uid})`} />
        <rect x={-CELL * 0.3} y={-CELL * 0.3} width={CELL * 0.6} height={CELL * 0.6} rx={9} fill="#0b1226" stroke={accent[1]} strokeWidth={2} />
        <circle r={CELL * 0.12} fill={accent[1]} filter={`url(#glow-${uid})`} />
        <polygon points={`0,${-CELL * 0.34} ${-CELL * 0.11},${-CELL * 0.15} ${CELL * 0.11},${-CELL * 0.15}`} fill={accent[0]} />
      </g>
    </svg>
  );
}
