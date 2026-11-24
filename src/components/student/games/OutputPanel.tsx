"use client";

import type { OutputLevel, TestResult } from "@/lib/games/types";
import { CheckCircle2, CircleDashed, Terminal, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The Data Dojo stage: the problem statement plus the test table.
 *
 * Each row is one `solve(s)` call. Before a run the rows show what will be fed
 * in; after a run they show what came back and whether it matched.
 */
export function OutputPanel({ level, results }: { level: OutputLevel; results: TestResult[] | null }) {
  const byIndex = new Map((results ?? []).map((r, i) => [i, r]));
  const passed = (results ?? []).filter((r) => r.pass).length;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-background/40 p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" /> Problem
        </div>
        <p className="text-sm leading-relaxed text-foreground/90">{level.spec}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex items-center justify-between border-b border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground">
          <span>Tests</span>
          {results && (
            <span className={cn(passed === level.tests.length ? "text-emerald-400" : "text-amber-400")}>
              {passed}/{level.tests.length} passing
            </span>
          )}
        </div>
        <ul className="divide-y divide-border">
          {level.tests.map((t, i) => {
            const r = byIndex.get(i);
            const ok = r?.pass;
            return (
              <li key={i} className="flex items-start gap-3 px-3 py-2 text-sm">
                <span className="mt-0.5 shrink-0">
                  {!r ? (
                    <CircleDashed className="h-4 w-4 text-muted-foreground/50" />
                  ) : ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[12px]">
                    <span className="text-muted-foreground">
                      solve(<span className="text-foreground">{JSON.stringify(t.input)}</span>)
                    </span>
                    <span className="text-muted-foreground">
                      expected <span className="text-emerald-300">{t.expected}</span>
                    </span>
                    {r && !ok && (
                      <span className="text-muted-foreground">
                        got <span className={r.errored ? "text-red-300" : "text-amber-300"}>{r.got || "(nothing)"}</span>
                      </span>
                    )}
                  </div>
                  {t.note && <p className="mt-0.5 text-[11px] text-muted-foreground/70">{t.note}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
