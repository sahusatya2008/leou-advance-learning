"use client";

import { parseJson } from "@/lib/apiClient";
import { Suspense, use, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Loader2, ChevronLeft, ChevronRight, Trash2, ArrowUp, ArrowDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssessmentKind } from "@/generated/prisma/enums";
import { KINDS } from "@/lib/assessmentConstants";
import { cn } from "@/lib/utils";

export type AssessmentAttemptMode = "SCHEDULED" | "FLEXIBLE";

export type AssessmentInitial = {
  id?: string;
  batchId: string;
  kind: AssessmentKind;
  subjectId?: string;
  topic?: string;
  attemptMode?: AssessmentAttemptMode;
  maxAttempts?: number | null;
  title: string;
  instructions?: string;
  durationMinutes: number;
  startsAt?: string;
  endsAt?: string;
  shuffleQuestions: boolean;
  proctoring?: { webcamOn?: boolean; fullscreenLock?: boolean; blockPaste?: boolean; maxTabSwitches?: number };
  questions?: { questionId: string; marks: number; stem: string; type: string; subject: string }[];
};

export type AssessmentTopicOption = { name: string; assignmentRate: number; mockRate: number; testRate: number };

export type BatchOption = {
  id: string;
  name: string;
  classRoom: { id: string; name: string };
  subjects: { id: string; name: string; topics: AssessmentTopicOption[] }[];
};

type Picked = { questionId: string; marks: number; stem: string; type: string; subject: string };

export default function AssessmentForm({
  classes,
  batches,
  initial,
  trigger,
}: {
  classes: { id: string; name: string; subjects: { id: string; name: string }[] }[];
  batches: BatchOption[];
  initial?: AssessmentInitial;
  trigger?: React.ReactNode;
}) {
  const editing = !!initial;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [classRoomId, setClassRoomId] = useState(() => {
    const b = batches.find((x) => x.id === initial?.batchId);
    return b?.classRoom.id ?? classes[0]?.id ?? "";
  });
  const [batchId, setBatchId] = useState(() => {
    if (initial?.batchId) return initial.batchId;
    const clsId = classes[0]?.id ?? "";
    return batches.find((b) => b.classRoom.id === clsId)?.id ?? "";
  });
  const [kind, setKind] = useState<AssessmentKind>(initial?.kind ?? "ASSIGNMENT");
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? "");
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [attemptMode, setAttemptMode] = useState<AssessmentAttemptMode>(initial?.attemptMode ?? "SCHEDULED");
  const [maxAttempts, setMaxAttempts] = useState<number | null>(initial?.maxAttempts ?? null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [durationMinutes, setDurationMinutes] = useState(initial?.durationMinutes ?? 60);
  const [hasWindow, setHasWindow] = useState(!!(initial?.startsAt || initial?.endsAt));
  const [startsAt, setStartsAt] = useState(initial?.startsAt ?? "");
  const [endsAt, setEndsAt] = useState(initial?.endsAt ?? "");
  const [shuffleQuestions, setShuffleQuestions] = useState(initial?.shuffleQuestions ?? false);
  const [proctoring, setProctoring] = useState(initial?.proctoring ?? { webcamOn: false, fullscreenLock: false, blockPaste: false, maxTabSwitches: 3 });

  const [picked, setPicked] = useState<Picked[]>(initial?.questions ?? []);

  const allTopicOptions = useMemo(() => {
    const set = new Set<string>();
    for (const b of batches) for (const s of b.subjects) for (const t of s.topics) set.add(t.name);
    return [...set].sort();
  }, [batches]);

  const batchesForClass = useMemo(() => batches.filter((b) => b.classRoom.id === classRoomId), [batches, classRoomId]);
  const effectiveBatchId = batchId || batchesForClass[0]?.id || "";
  const currentBatch = useMemo(() => batches.find((b) => b.id === effectiveBatchId), [batches, effectiveBatchId]);
  const batchSubjects = currentBatch?.subjects ?? [];
  const pricingTopics = subjectId ? batchSubjects.find((s) => s.id === subjectId)?.topics ?? [] : [];
  const isFlexible = attemptMode === "FLEXIBLE";
  const totalMarks = picked.reduce((s, p) => s + p.marks, 0);
  const allSubjects = [...new Map(classes.flatMap((c) => c.subjects).map((s) => [s.id, s])).values()];

  const buildPayload = () => ({
    batchId: effectiveBatchId,
    kind,
    subjectId: subjectId || null,
    topic: topic || null,
    attemptMode,
    maxAttempts: isFlexible ? maxAttempts : null,
    title,
    instructions: instructions.trim() ? instructions : null,
    durationMinutes,
    startsAt: isFlexible ? null : hasWindow && startsAt ? new Date(startsAt).toISOString() : null,
    endsAt: isFlexible ? null : hasWindow && endsAt ? new Date(endsAt).toISOString() : null,
    shuffleQuestions,
    proctoring: kind === "TEST" ? proctoring : null,
    questions: picked.map((p) => ({ questionId: p.questionId, marks: p.marks })),
  });

  const submit = async () => {
    if (!picked.length) return toast.error("Add at least one question.");
    if (subjectId && !topic) return toast.error("Choose the chapter / topic for the selected subject.");
    setSaving(true);
    try {
      const url = editing ? `/api/admin/assessments/${initial!.id}` : "/api/admin/assessments";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Could not save assessment.");
      } else {
        toast.success(editing ? "Assessment updated." : "Assessment created.");
        setOpen(false);
        setStep(0);
        setPicked([]);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setStep(0);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Assessment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Assessment" : "Create Assessment"}</DialogTitle>
          <DialogDescription>
            Step {step + 1} of 3 · {step === 0 ? "Basic details" : step === 1 ? "Pick questions" : "Review & create"}
          </DialogDescription>
        </DialogHeader>

        {step === 0 && (
          <div className="space-y-4">
            <Grid2>
              <Item label="Kind">
                <Tabs value={kind} onValueChange={(v) => setKind(v as AssessmentKind)}>
                  <TabsList className="grid w-full grid-cols-3">
                    {KINDS.map((k) => (
                      <TabsTrigger key={k} value={k}>{k[0] + k.slice(1).toLowerCase()}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </Item>
              <Item label="Class">
                <Select
                  value={classRoomId}
                  onValueChange={(v) => {
                    setClassRoomId(v);
                    // Keep the batch in sync so “Next” never hangs on a stale empty batch.
                    setBatchId(batches.find((b) => b.classRoom.id === v)?.id ?? "");
                    setSubjectId("");
                    setTopic("");
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Item>
              <Item label="Batch">
                <Select
                  value={effectiveBatchId}
                  onValueChange={(v) => {
                    setBatchId(v);
                    setSubjectId("");
                    setTopic("");
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                  <SelectContent>
                    {batchesForClass.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Item>
            </Grid2>

            <Grid2>
              <Item label="Subject (scope)">
                <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setTopic(""); }}>
                  <SelectTrigger><SelectValue placeholder="Subject-wide" /></SelectTrigger>
                  <SelectContent>
                    {batchSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className={cn("text-xs text-muted-foreground", subjectId && pricingTopics.length === 0 && "text-amber-500")}>
                  {effectiveBatchId
                    ? subjectId
                      ? pricingTopics.length
                        ? `${pricingTopics.length} admin-priced chapter(s)/topic(s)`
                        : "No admin-priced chapters/topics for this subject yet"
                      : "Leave as subject-wide (all subscribed topics)"
                    : "Pick a batch first"}
                </p>
              </Item>
              <Item label="Chapter / topic">
                <Select
                  value={topic}
                  onValueChange={setTopic}
                  disabled={!subjectId || pricingTopics.length === 0}
                >
                  <SelectTrigger><SelectValue placeholder={!subjectId ? "Select a subject" : "Select a topic" } /></SelectTrigger>
                  <SelectContent>
                    {pricingTopics.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name} — assign ₹{t.assignmentRate} · mock ₹{t.mockRate} · test ₹{t.testRate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Students subscribe by topic — this decides who can attempt it.
                </p>
              </Item>
            </Grid2>

            <Item label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mock Test — Chapter 4" />
            </Item>
            <Item label="Instructions">
              <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} placeholder="Optional instructions shown to students…" />
            </Item>

            {kind === "TEST" ? (
              <Item label="Attempt mode">
                <p className="py-1 text-sm text-muted-foreground">
                  Real tests are always <span className="font-medium text-foreground">scheduled</span> — a fixed window and a single attempt per student. Results release per subscribed chapter / topic after grading.
                </p>
              </Item>
            ) : (
              <Item label="Attempt mode">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAttemptMode("SCHEDULED")}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      attemptMode === "SCHEDULED" ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                    )}
                  >
                    <p className="text-sm font-medium">Scheduled</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Fixed start / end window · one attempt</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttemptMode("FLEXIBLE");
                      setHasWindow(false);
                    }}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      attemptMode === "FLEXIBLE" ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                    )}
                  >
                    <p className="text-sm font-medium">Flexible</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Attempt any time · multiple tries</p>
                  </button>
                </div>
                {attemptMode === "FLEXIBLE" && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      className="w-24"
                      value={maxAttempts ?? ""}
                      placeholder="∞"
                      onChange={(e) => setMaxAttempts(e.target.value === "" ? null : Number(e.target.value))}
                    />
                    <p className="text-sm text-muted-foreground">
                      max attempts (leave empty for unlimited) · publishes immediately
                    </p>
                  </div>
                )}
              </Item>
            )}

            <Grid2>
              <Item label="Duration (minutes)">
                <Input type="number" min={1} max={600} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value) || 60)} />
              </Item>
              <Item label="Shuffle questions">
                <div className="flex h-10 items-center">
                  <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
                </div>
              </Item>
            </Grid2>

            <Item label="Time window">
              {isFlexible ? (
                <p className="py-3 text-sm text-muted-foreground">
                  No window for flexible assessments — students can attempt any time until you close it. Each attempt still has its own {durationMinutes}-minute timer.
                </p>
              ) : (
                <>
                  <label className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                    <Checkbox checked={hasWindow} onCheckedChange={(v) => setHasWindow(!!v)} />
                    Restrict to a start / end window (leave off = open from publish)
                  </label>
                  {hasWindow && (
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                      <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                    </div>
                  )}
                </>
              )}
            </Item>

            {kind === "TEST" && (
              <Item label="Proctoring (real test)">
                <div className="space-y-2 rounded-lg border border-border p-3">
                  {(
                    [
                      ["webcamOn", "Require webcam", "Periodic photos during the attempt"],
                      ["fullscreenLock", "Fullscreen lock", "Exit fullscreen counts as a violation"],
                      ["blockPaste", "Block paste", "Disable copy/paste while answering"],
                    ] as const
                  ).map(([key, labelText, hint]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{labelText}</p>
                        <p className="text-xs text-muted-foreground">{hint}</p>
                      </div>
                      <Switch
                        checked={!!proctoring[key]}
                        onCheckedChange={(v) => setProctoring((prev) => ({ ...(prev ?? {}), [key]: v }))}
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Max tab switches</p>
                      <p className="text-xs text-muted-foreground">Allowed before submitting is locked</p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      className="w-20"
                      value={proctoring.maxTabSwitches ?? 3}
                      onChange={(e) => setProctoring((prev) => ({ ...(prev ?? {}), maxTabSwitches: Number(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </Item>
            )}
          </div>
        )}

        {step === 1 && (
          <QuestionPicker
            classes={classes}
            subjects={allSubjects}
            topicOptions={allTopicOptions}
            picked={picked}
            setPicked={setPicked}
          />
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-4">
              <Fact label="Kind" value={kind} />
              <Fact label="Subject" value={batchSubjects.find((s) => s.id === subjectId)?.name ?? "Subject-wide"} />
              <Fact label="Chapter / topic" value={topic || "All topics"} />
              <Fact label="Attempt mode" value={isFlexible ? `Flexible${maxAttempts ? ` · max ${maxAttempts}` : " · unlimited"}` : "Scheduled · 1 attempt"} />
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-border p-4 text-sm">
              <Fact label="Questions" value={String(picked.length)} />
              <Fact label="Total marks" value={String(totalMarks)} />
              <Fact label="Duration" value={`${durationMinutes} min`} />
            </div>
            <ul className="space-y-2">
              {picked.map((p, i) => (
                <li key={p.questionId} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="w-6 text-muted-foreground">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate">{p.stem}</span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">{p.type}</span>
                  <span className="text-xs text-muted-foreground">{p.marks} pts</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          )}
          {step < 2 ? (
            <Button
              onClick={() => {
                if (step === 0 && effectiveBatchId) setStep(1);
                else if (step === 1) setStep(2);
              }}
              disabled={step === 0 && !effectiveBatchId}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => void submit()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create assessment"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuestionPicker({
  classes,
  subjects,
  topicOptions,
  picked,
  setPicked,
}: {
  classes: { id: string; name: string; subjects: { id: string; name: string }[] }[];
  subjects: { id: string; name: string }[];
  topicOptions: string[];
  picked: Picked[];
  setPicked: React.Dispatch<React.SetStateAction<Picked[]>>;
}) {
  const [classRoomId, setClassRoomId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [marks, setMarks] = useState<Record<string, number>>({});

  const pickedIds = new Set(picked.map((p) => p.questionId));

  const toggle = (question: { id: string; type: string; stem: string; subject: { name: string } }) => {
    const m = marks[question.id] ?? 1;
    setPicked((prev) =>
      pickedIds.has(question.id)
        ? prev.filter((p) => p.questionId !== question.id)
        : [...prev, { questionId: question.id, marks: m, stem: question.stem, type: question.type, subject: question.subject.name }]
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    setPicked((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="pl-9" />
          </div>
          <select value={classRoomId} onChange={(e) => { setClassRoomId(e.target.value); setSubjectId(""); setTopic(""); }} className="h-10 rounded-lg border border-border bg-card px-3 text-sm">
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopic(""); }} className="h-10 rounded-lg border border-border bg-card px-3 text-sm">
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm">
            <option value="">All chapters</option>
            {topicOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm">
            <option value="">All types</option>
            {["MCQ", "SHORT", "LONG", "CODING", "SQL", "ORAL", "UPLOAD"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <Suspense fallback={<p className="py-8 text-center text-sm text-muted-foreground">Loading questions…</p>}>
          <QuestionList classRoomId={classRoomId} subjectId={subjectId} topic={topic} type={type} q={q} pickedIds={pickedIds} toggle={toggle} marks={marks} setMarks={setMarks} />
        </Suspense>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Selected · {picked.length}</p>
        <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {picked.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nothing selected yet.</p>}
          {picked.map((p, i) => (
            <div key={p.questionId} className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
              <div className="flex flex-col">
                <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => move(i, -1)}><ArrowUp className="h-3 w-3" /></Button>
                <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => move(i, 1)}><ArrowDown className="h-3 w-3" /></Button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{p.stem}</p>
                <p className="text-xs text-muted-foreground">{p.subject} · {p.type} · {p.marks} pts</p>
              </div>
              <Input
                type="number"
                min={1}
                className="w-16 text-sm"
                value={p.marks}
                onChange={(e) =>
                  setPicked((prev) => prev.map((x, j) => (j === i ? { ...x, marks: Number(e.target.value) || 1 } : x)))
                }
              />
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setPicked((prev) => prev.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type QuestionSummary = {
  id: string;
  type: string;
  stem: string;
  topic: string | null;
  subject: { id: string; name: string };
  classRoom: { id: string; name: string } | null;
};

const questionCache = new Map<string, Promise<QuestionSummary[]>>();

function QuestionList({
  classRoomId,
  subjectId,
  topic,
  type,
  q,
  pickedIds,
  toggle,
  marks,
  setMarks,
}: {
  classRoomId: string;
  subjectId: string;
  topic: string;
  type: string;
  q: string;
  pickedIds: Set<string>;
  toggle: (question: QuestionSummary) => void;
  marks: Record<string, number>;
  setMarks: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  const promise = useMemo(() => {
    const key = "light:bank";
    if (!questionCache.has(key)) {
      const p = fetch(`/api/admin/questions?light=1`)
        .then((r) => parseJson<{ questions?: QuestionSummary[] }>(r))
        .then((b) => b?.questions ?? [])
        .catch((e) => {
          // The cache stores the *promise*, so a rejected one stayed behind and
          // poisoned the question bank for the whole browser session: one
          // transient network blip meant no questions could ever load again
          // without a hard reload. Evict it so the next attempt can retry.
          questionCache.delete(key);
          throw e;
        });
      questionCache.set(key, p);
    }
    return questionCache.get(key)!;
  }, []);
  const all = use(promise);
  const filtered = all.filter(
    (x) =>
      (!classRoomId || x.classRoom?.id === classRoomId) &&
      (!subjectId || x.subject.id === subjectId) &&
      (!topic || x.topic === topic) &&
      (!type || x.type === type) &&
      (!q || x.stem.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
      <p className="px-1 text-xs text-muted-foreground">
        {filtered.length} matching · {all.length} in the question bank
      </p>
      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No questions match these filters. Add questions in the Question Bank first, or clear the filters.
        </p>
      )}
      {filtered.map((question) => (
        <div key={question.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
          <Checkbox checked={pickedIds.has(question.id)} onCheckedChange={() => toggle(question)} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{question.stem}</p>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="rounded bg-secondary px-1.5 py-0.5">{question.type}</span>
              {question.topic && (
                <span className="rounded bg-secondary px-1.5 py-0.5">{question.topic}</span>
              )}
              {question.subject.name && (
                <span className="rounded bg-secondary px-1.5 py-0.5">{question.subject.name}</span>
              )}
              {question.classRoom?.name && <span>· {question.classRoom.name}</span>}
            </p>
          </div>
          {pickedIds.has(question.id) && (
            <Input
              type="number"
              min={1}
              className="w-16 text-sm"
              value={marks[question.id] ?? 1}
              onChange={(e) => {
                const v = Number(e.target.value) || 1;
                setMarks((prev) => ({ ...prev, [question.id]: v }));
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{children}</div>;
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}