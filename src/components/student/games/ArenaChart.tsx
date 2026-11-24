"use client";

import type { ArenaOp } from "@/lib/games/types";

/**
 * The Algo Arena stage: the array drawn as a bar chart, replayed op by op.
 *
 * Pure and stateless like the other stages — the player hands it the array to
 * show and the indices the current operation touched, and it renders. Bar
 * heights animate, so a swap is visible as two bars trading places.
 */

const MAX_BAR = 208;

export function arenaHighlight(op: ArenaOp): number[] {
  if (op.op === "c" || op.op === "s") return [op.i, op.j];
  return [op.i];
}

export function ArenaChart({
  values,
  highlighted,
  accent,
}: {
  values: number[];
  highlighted: number[];
  accent: [string, string];
}) {
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  const hi = new Set(highlighted);

  return (
    <div className="rounded-2xl border border-border bg-background/50 p-4">
      <div className="flex items-end justify-center gap-1.5" style={{ height: MAX_BAR + 44 }}>
        {values.map((v, i) => {
          const active = hi.has(i);
          const h = Math.max(8, (Math.abs(v) / max) * MAX_BAR);
          return (
            <div key={i} className="flex max-w-16 flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[10px] font-medium tabular-nums text-muted-foreground">{v}</span>
              <div
                className="w-full rounded-t-md"
                style={{
                  height: h,
                  background: active
                    ? `linear-gradient(180deg, ${accent[1]}, ${accent[0]})`
                    : `linear-gradient(180deg, ${accent[0]}, ${accent[1]}44)`,
                  boxShadow: active ? `0 0 16px ${accent[1]}` : `inset 0 0 0 1px ${accent[0]}33`,
                  transition: "height 120ms ease, background 120ms ease, box-shadow 120ms ease",
                }}
              />
              <span className="mt-1 text-[10px] tabular-nums text-muted-foreground/60">{i}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
