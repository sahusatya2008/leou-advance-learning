import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Terminal, MessagesSquare, CircleDashed } from "lucide-react";

/** Terminal transcripts are written once per session but capped at write time,
 * so a long-lived attempt still reads back bounded. */
const TIMELINE_EVENTS_TAKEN = 200;

const EVENT_STYLE: Record<string, string> = {
  ATTEMPT_STARTED: "bg-indigo-500/15 text-indigo-300",
  ATTEMPT_FINISHED: "bg-emerald-500/15 text-emerald-300",
  ATTEMPT_REOPENED: "bg-amber-500/15 text-amber-300",
  CODE_SAVED: "bg-secondary text-muted-foreground",
  CODE_RUN: "bg-emerald-500/15 text-emerald-300",
  TERMINAL_INPUT: "bg-cyan-500/15 text-cyan-300",
  TERMINAL_OUTPUT: "bg-amber-500/15 text-amber-300",
};

const STATUS_STYLE: Record<string, string> = {
  IN_PROGRESS: "bg-amber-500/15 text-amber-300",
  FINISHED: "bg-emerald-500/15 text-emerald-300",
};

const DOUBT_STYLE: Record<string, string> = {
  OPEN: "bg-red-500/15 text-red-300",
  ANSWERED: "bg-cyan-500/15 text-cyan-300",
  SATISFIED: "bg-emerald-500/15 text-emerald-300",
};

function snippet(text: string, max = 140) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/** Terminal-ish payloads recorded on an event, in display order. */
function payloads(detail: unknown): { label: string; text: string }[] {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return [];
  const d = detail as Record<string, unknown>;
  const blocks: { label: string; text: string }[] = [];
  const push = (key: string, label: string) => {
    const v = d[key];
    if (typeof v === "string" && v.trim()) blocks.push({ label, text: v });
  };
  push("input", "Typed");
  push("output", "Output");
  push("stdout", "stdout");
  push("stderr", "stderr");
  return blocks;
}

function exitLabel(detail: unknown): string | null {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const code = (detail as Record<string, unknown>).exitCode;
  return typeof code === "number" && code >= 0 ? `exit ${code}` : null;
}

export default async function PracticalActivity({ studentUserId }: { studentUserId: string }) {
  const user = await prisma.user.findUnique({
    where: { id: studentUserId },
    select: { studentProfile: { select: { id: true, batches: { select: { batchId: true } } } } },
  });
  const profile = user?.studentProfile;
  if (!profile) return null;
  const batchIds = profile.batches.map((b) => b.batchId);

  const [attempts, doubts, availableSets] = await Promise.all([
    prisma.practicalAttempt.findMany({
      where: { studentId: profile.id },
      orderBy: { lastActivityAt: "desc" },
      include: {
        assignment: {
          include: {
            batch: { select: { name: true } },
            subject: { select: { name: true } },
            questions: { orderBy: { order: "asc" }, select: { questionId: true } },
          },
        },
        question: { select: { stem: true, topic: true } },
        // Latest first, then reversed for display; the cap keeps one attempt
        // from dragging an unbounded timeline into the page.
        events: { orderBy: { createdAt: "desc" }, take: TIMELINE_EVENTS_TAKEN },
        _count: { select: { events: true } },
      },
    }),
    prisma.practicalDoubt.findMany({
      where: { studentId: profile.id },
      orderBy: { lastActivityAt: "desc" },
      take: 50,
      include: {
        assignment: { select: { title: true } },
        question: { select: { stem: true } },
        _count: { select: { messages: true, recordings: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { authorRole: true, body: true, codeExcerpt: true, terminalExcerpt: true, createdAt: true },
        },
      },
    }),
    prisma.practicalAssignment.findMany({
      where: { status: "PUBLISHED", ...(batchIds.length ? { batchId: { in: batchIds } } : { id: "__none__" }) },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        topic: true,
        subject: { select: { name: true } },
        batch: { select: { name: true } },
        _count: { select: { questions: true } },
      },
    }),
  ]);

  // Group attempts by set, keeping the syllabus order of questions.
  const groups: {
    key: string;
    assignment: (typeof attempts)[number]["assignment"];
    attempts: typeof attempts;
  }[] = [];
  const bySet = new Map<string, (typeof groups)[number]>();
  for (const a of attempts) {
    let g = bySet.get(a.assignmentId);
    if (!g) {
      g = { key: a.assignmentId, assignment: a.assignment, attempts: [] };
      bySet.set(a.assignmentId, g);
      groups.push(g);
    }
    g.attempts.push(a);
  }
  for (const g of groups) {
    const order = new Map(g.assignment.questions.map((q, i) => [q.questionId, i]));
    g.attempts.sort((x, y) => (order.get(x.questionId) ?? 0) - (order.get(y.questionId) ?? 0));
  }

  const attemptedSetIds = new Set(attempts.map((a) => a.assignmentId));
  const untouched = availableSets.filter((s) => !attemptedSetIds.has(s.id));
  const finished = attempts.filter((a) => a.status === "FINISHED").length;
  const runs = attempts.reduce((n, a) => n + a.events.filter((e) => e.type === "CODE_RUN").length, 0);
  const inputs = attempts.reduce((n, a) => n + a.events.filter((e) => e.type === "TERMINAL_INPUT").length, 0);
  const lastActivity = attempts[0]?.lastActivityAt ?? null;

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4" /> Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MiniStat label="Sets attempted" value={String(groups.length)} />
            <MiniStat label="Questions attempted" value={String(attempts.length)} />
            <MiniStat label="Marked done" value={String(finished)} />
            <MiniStat label="Runs" value={String(runs)} />
            <MiniStat label="Terminal inputs" value={String(inputs)} />
            <MiniStat label="Last activity" value={lastActivity ? lastActivity.toLocaleDateString() : "—"} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4" /> Attempts by set ({groups.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">No practical attempts yet.</p>
          )}
          {groups.map((g) => (
            <div key={g.key} className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{g.assignment.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.assignment.subject.name} · {g.assignment.topic} · {g.assignment.batch.name}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {g.attempts.length} question{g.attempts.length === 1 ? "" : "s"}
                </Badge>
              </div>

              {g.attempts.map((a) => (
                <details key={a.id} className="group rounded-lg border border-border bg-card/60">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Badge className={STATUS_STYLE[a.status] ?? "bg-secondary text-muted-foreground"}>
                        {a.status.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {a.language ?? "—"}
                      </Badge>
                      <span className="min-w-0 truncate text-xs text-muted-foreground">
                        {snippet(a.question.stem)}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {a.lastActivityAt.toLocaleString()}
                    </span>
                  </summary>

                  <div className="space-y-3 border-t border-border p-3">
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                      <span>Started {a.startedAt.toLocaleString()}</span>
                      <span>
                        {a.finishedAt ? `Done ${a.finishedAt.toLocaleString()}` : "Not marked done yet"}
                      </span>
                      <span>
                        {a._count.events} event{a._count.events === 1 ? "" : "s"}
                        {a._count.events > a.events.length ? ` (last ${a.events.length} shown)` : ""}
                      </span>
                    </div>

                    <details className="rounded-md border border-border bg-card/60">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
                        Saved code ({(a.code ?? "").length} characters)
                      </summary>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-border p-3 font-mono text-[11px] leading-relaxed">
                        {a.code || "(empty)"}
                      </pre>
                    </details>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Activity timeline ({a.events.length})
                      </p>
                      {a.events.length === 0 && (
                        <p className="text-xs text-muted-foreground">No events recorded.</p>
                      )}
                      {[...a.events].reverse().map((e) => {
                        const exit = exitLabel(e.detail);
                        return (
                          <div key={e.id} className="rounded-md border border-border bg-card/50 px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <Badge className={EVENT_STYLE[e.type] ?? "bg-secondary text-muted-foreground"}>
                                  {e.type.replace(/_/g, " ")}
                                </Badge>
                                {exit && <span className="text-[11px] text-muted-foreground">{exit}</span>}
                                <span className="min-w-0 truncate text-xs text-muted-foreground">
                                  {e.summary ?? ""}
                                </span>
                              </div>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {e.createdAt.toLocaleString()}
                              </span>
                            </div>
                            {payloads(e.detail).map((p) => (
                              <pre
                                key={p.label}
                                className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2 font-mono text-[11px] leading-relaxed"
                              >
                                <span className="text-muted-foreground">[{p.label}] </span>
                                {p.text}
                              </pre>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessagesSquare className="h-4 w-4" /> Practical doubts ({doubts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {doubts.length === 0 && (
            <p className="text-sm text-muted-foreground">No doubt threads yet.</p>
          )}
          {doubts.map((d) => (
            <details key={d.id} className="rounded-lg border border-border bg-card/50">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge className={DOUBT_STYLE[d.status] ?? "bg-secondary text-muted-foreground"}>
                    {d.status.replace(/_/g, " ")}
                  </Badge>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {d.assignment.title} — {snippet(d.question.stem, 90)}
                  </span>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {d._count.messages} message{d._count.messages === 1 ? "" : "s"} ·{" "}
                  {d.lastActivityAt.toLocaleString()}
                </span>
              </summary>
              <div className="space-y-2 border-t border-border p-3">
                {[...d.messages].reverse().map((m, i) => (
                  <div key={i} className="rounded-md border border-border bg-card/50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={m.authorRole === "ADMIN" ? "default" : "secondary"} className="text-[10px]">
                        {m.authorRole}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">{m.createdAt.toLocaleString()}</span>
                    </div>
                    {m.body && <p className="mt-1 whitespace-pre-wrap break-words text-xs">{m.body}</p>}
                    {m.terminalExcerpt && (
                      <pre className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2 font-mono text-[11px] leading-relaxed">
                        <span className="text-muted-foreground">[terminal] </span>
                        {m.terminalExcerpt}
                      </pre>
                    )}
                    {m.codeExcerpt && (
                      <pre className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2 font-mono text-[11px] leading-relaxed">
                        <span className="text-muted-foreground">[code] </span>
                        {m.codeExcerpt}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CircleDashed className="h-4 w-4" /> Published sets not started ({untouched.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {untouched.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {availableSets.length === 0
                ? "No published practical sets are available to this student's batches."
                : "Every available set has at least one attempt."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {untouched.map((s) => (
                <Badge key={s.id} variant="outline" className="text-xs font-normal">
                  {s.title} · {s.subject.name} · {s._count.questions}Q
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold leading-tight">{value}</p>
    </div>
  );
}
