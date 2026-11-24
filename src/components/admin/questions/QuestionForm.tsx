"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CODING_LANGUAGES } from "@/lib/questionConstants";
import type { QuestionType, QuestionDifficulty, SqlDialect } from "@/generated/prisma/enums";

export type QuestionInitial = {
  id?: string;
  type: QuestionType;
  stem: string;
  explanation?: string;
  imageUrl?: string;
  difficulty: QuestionDifficulty;
  classRoomId: string;
  subjectId: string;
  topic?: string;
  isPractical?: boolean;
  tags?: string[];
  allowedLanguages?: string[];
  starterCode?: Record<string, string>;
  solutionCode?: string;
  sqlDialect?: SqlDialect;
  sqlSchemaSql?: string;
  sqlSeedSql?: string;
  sqlExpectedResult?: string;
  sqlComparisonMode?: string;
  options?: { text: string; imageUrl?: string; isCorrect: boolean }[];
  testCases?: { input: string; expected: string; isHidden: boolean; weight: number }[];
};

export default function QuestionForm({
  classes,
  topicsBySubject,
  question,
  trigger,
}: {
  classes: { id: string; name: string; hasStreams: boolean; subjects: { id: string; name: string }[] }[];
  topicsBySubject?: { subjectId: string; topics: string[] }[];
  question?: QuestionInitial;
  trigger?: React.ReactNode;
}) {
  const editing = !!question;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<QuestionType>(question?.type ?? "MCQ");
  const [classRoomId, setClassRoomId] = useState(question?.classRoomId ?? "");
  const [subjectId, setSubjectId] = useState(question?.subjectId ?? "");
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(question?.difficulty ?? "MEDIUM");
  const [topic, setTopic] = useState(question?.topic ?? "");
  // Concepts such as "while loop" are typed as free text and split here; the
  // service lower-cases and de-duplicates whatever comes out.
  const [tagText, setTagText] = useState((question?.tags ?? []).join(", "));
  const [isPractical, setIsPractical] = useState(question?.isPractical ?? false);
  const [stem, setStem] = useState(question?.stem ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [imageUrl, setImageUrl] = useState(question?.imageUrl ?? "");

  const [options, setOptions] = useState(
    question?.options ?? [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
    ]
  );
  const [langs, setLangs] = useState<string[]>(question?.allowedLanguages ?? []);
  const [starterCode, setStarterCode] = useState<Record<string, string>>(question?.starterCode ?? {});
  const [solutionCode, setSolutionCode] = useState(question?.solutionCode ?? "");
  const [testCases, setTestCases] = useState(
    question?.testCases ?? [{ input: "1", expected: "", isHidden: false, weight: 1 }]
  );
  const [sqlDialect, setSqlDialect] = useState<SqlDialect | "">(question?.sqlDialect ?? "PostgreSQL");
  const [sqlSchemaSql, setSqlSchemaSql] = useState(question?.sqlSchemaSql ?? "");
  const [sqlSeedSql, setSqlSeedSql] = useState(question?.sqlSeedSql ?? "");
  const [sqlExpectedResult, setSqlExpectedResult] = useState(question?.sqlExpectedResult ?? "");
  const [sqlComparisonMode, setSqlComparisonMode] = useState(question?.sqlComparisonMode ?? "UNORDERED");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const subjects = useMemo(
    () => classes.find((c) => c.id === classRoomId)?.subjects ?? [],
    [classes, classRoomId]
  );

  const topicChoices = useMemo(() => {
    const base = topicsBySubject?.find((t) => t.subjectId === subjectId)?.topics ?? [];
    const set = new Set(base);
    if (topic && !set.has(topic)) set.add(topic);
    return [...set];
  }, [topicsBySubject, subjectId, topic]);

  const buildPayload = () => {
    const base: Record<string, unknown> = {
      type,
      classRoomId,
      subjectId,
      difficulty,
      topic: topic.trim() ? topic.trim() : null,
      isPractical,
      tags: tagText.split(",").map((t) => t.trim()).filter(Boolean),
      stem,
      explanation: explanation.trim() ? explanation : null,
      imageUrl: imageUrl.trim() ? imageUrl : null,
    };
    if (type === "MCQ") base.options = options;
    if (type === "CODING") {
      base.allowedLanguages = langs;
      base.starterCode = starterCode;
      base.solutionCode = solutionCode;
      base.testCases = testCases;
    }
    if (type === "SQL") {
      base.sqlDialect = sqlDialect || null;
      base.sqlSchemaSql = sqlSchemaSql;
      base.sqlSeedSql = sqlSeedSql;
      base.sqlComparisonMode = sqlComparisonMode || null;
      if (sqlExpectedResult.trim()) {
        try {
          base.sqlExpectedResult = JSON.parse(sqlExpectedResult);
        } catch {
          base.sqlExpectedResult = null;
        }
      }
    }
    return base;
  };

  const submit = async () => {
    setSaving(true);
    try {
      const url = editing ? `/api/admin/questions/${question!.id}` : "/api/admin/questions";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Could not save question.");
      } else {
        toast.success(editing ? "Question updated." : "Question created.");
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("kind", "question");
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Upload failed.");
        return;
      }
      setImageUrl(body.url);
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const toggleLang = (lang: string) => {
    setLangs((prev) => {
      if (prev.includes(lang)) return prev.filter((l) => l !== lang);
      return [...prev, lang];
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Question
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Question" : "Create Question"}</DialogTitle>
          <DialogDescription>
            Fill in the question details. Coding and SQL questions carry their own templates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Type">
              <Select value={type} onValueChange={(v) => setType(v as QuestionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MCQ">MCQ</SelectItem>
                  <SelectItem value="SHORT">Short answer</SelectItem>
                  <SelectItem value="LONG">Long answer</SelectItem>
                  <SelectItem value="CODING">Coding</SelectItem>
                  <SelectItem value="SQL">SQL</SelectItem>
                  <SelectItem value="ORAL">Oral</SelectItem>
                  <SelectItem value="UPLOAD">Photo / upload</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Class">
              <Select value={classRoomId} onValueChange={(v) => { setClassRoomId(v); setSubjectId(""); setTopic(""); }}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Subject">
              <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setTopic(""); }} disabled={!classRoomId}>
                <SelectTrigger><SelectValue placeholder={classRoomId ? "Select subject" : "Pick class first"} /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Chapter / topic">
            <Select value={topic} onValueChange={(v) => setTopic(v === "no-topic" ? "" : v)} disabled={!subjectId}>
              <SelectTrigger><SelectValue placeholder={subjectId ? "Select chapter" : "Pick subject first"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no-topic">— No specific chapter —</SelectItem>
                {topicChoices.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Practical tagging is per-question and only meaningful once a chapter
              is chosen, so it follows the chapter select directly. */}
          <label
            className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors ${
              isPractical && topic.trim()
                ? "border-primary/50 bg-primary/5"
                : "border-border"
            } ${!topic.trim() ? "opacity-60" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={isPractical}
              disabled={!topic.trim()}
              onChange={(e) => setIsPractical(e.target.checked)}
            />
            <span className="leading-snug">
              <span className="font-medium">Practical question</span>
              <span className="block text-xs text-muted-foreground">
                {topic.trim()
                  ? "Include this question in the guided practical set students work through for this chapter."
                  : "Pick a chapter first — a practical question always belongs to one."}
              </span>
            </span>
          </label>

          <Field label="Concept tags" hint="Comma separated, e.g. while-loop, loop">
            <Input
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              placeholder="while-loop, loop"
            />
          </Field>

          <Field label="Difficulty">
            <div className="flex gap-2">
              {(["EASY", "MEDIUM", "HARD"] as QuestionDifficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    difficulty === d ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Question text">
            <Textarea value={stem} onChange={(e) => setStem(e.target.value)} rows={3} placeholder="The full question (markdown allowed)…" />
          </Field>

          <Field label="Question image (optional)">
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="" className="h-20 w-20 rounded-lg border object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-destructive text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                  Upload
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = "";
                }}
              />
            </div>
          </Field>

          {type === "MCQ" && (
            <div className="space-y-3">
              <Label>Options</Label>
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox
                    checked={o.isCorrect}
                    onCheckedChange={(v) =>
                      setOptions((prev) => prev.map((p, j) => (j === i ? { ...p, isCorrect: !!v } : p)))
                    }
                    title="Correct"
                  />
                  <Input
                    value={o.text}
                    placeholder={`Option ${i + 1}`}
                    onChange={(e) =>
                      setOptions((prev) => prev.map((p, j) => (j === i ? { ...p, text: e.target.value } : p)))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive"
                    disabled={options.length <= 2}
                    onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOptions((prev) => [...prev, { text: "", isCorrect: false }])}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add option
              </Button>
            </div>
          )}

          {type === "CODING" && (
            <div className="space-y-5">
              <Field label="Allowed languages">
                <div className="flex flex-wrap gap-2">
                  {CODING_LANGUAGES.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => toggleLang(l)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        langs.includes(l) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              {langs.map((l) => (
                <Field key={l} label={`Starter code — ${l}`}>
                  <Textarea
                    value={starterCode[l] ?? ""}
                    onChange={(e) => setStarterCode((prev) => ({ ...prev, [l]: e.target.value }))}
                    rows={5}
                    className="font-mono text-xs"
                    placeholder="// function signature & scaffold"
                  />
                </Field>
              ))}
              <Field label="Reference solution">
                <Textarea
                  value={solutionCode}
                  onChange={(e) => setSolutionCode(e.target.value)}
                  rows={5}
                  className="font-mono text-xs"
                  placeholder="// fully working solution (auto-grading reference)"
                />
              </Field>
              <div className="space-y-2">
                <Label>Test cases</Label>
                {testCases.map((t, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
                    <Input
                      value={t.input}
                      placeholder="stdin input"
                      className="font-mono text-xs"
                      onChange={(e) =>
                        setTestCases((prev) => prev.map((p, j) => (j === i ? { ...p, input: e.target.value } : p)))
                      }
                    />
                    <Input
                      value={t.expected}
                      placeholder="expected stdout"
                      className="font-mono text-xs"
                      onChange={(e) =>
                        setTestCases((prev) => prev.map((p, j) => (j === i ? { ...p, expected: e.target.value } : p)))
                      }
                    />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Checkbox
                        checked={t.isHidden}
                        onCheckedChange={(v) =>
                          setTestCases((prev) => prev.map((p, j) => (j === i ? { ...p, isHidden: !!v } : p)))
                        }
                      />
                      hidden
                    </label>
                    <Input
                      type="number"
                      value={t.weight}
                      className="w-16 font-mono text-xs"
                      onChange={(e) =>
                        setTestCases((prev) => prev.map((p, j) => (j === i ? { ...p, weight: Number(e.target.value) || 1 } : p)))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => setTestCases((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTestCases((prev) => [...prev, { input: "", expected: "", isHidden: false, weight: 1 }])}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add test case
                </Button>
              </div>
            </div>
          )}

          {type === "SQL" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Dialect">
                  <Select value={sqlDialect} onValueChange={(v) => setSqlDialect(v as SqlDialect)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["PostgreSQL", "MySQL", "SQLite"] as SqlDialect[]).map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Result comparison">
                  <Select value={sqlComparisonMode} onValueChange={setSqlComparisonMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNORDERED">Rows unordered</SelectItem>
                      <SelectItem value="EXACT_ORDER">Exact order</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Schema SQL (DDL)">
                <Textarea
                  value={sqlSchemaSql}
                  onChange={(e) => setSqlSchemaSql(e.target.value)}
                  rows={6}
                  className="font-mono text-xs"
                  placeholder="CREATE TABLE students (id INT PRIMARY KEY, name VARCHAR(50));"
                />
              </Field>
              <Field label="Seed SQL (optional)">
                <Textarea
                  value={sqlSeedSql}
                  onChange={(e) => setSqlSeedSql(e.target.value)}
                  rows={4}
                  className="font-mono text-xs"
                  placeholder="INSERT INTO students VALUES (1, 'Aarav');"
                />
              </Field>
              <Field label="Expected result (JSON array of rows)">
                <Textarea
                  value={sqlExpectedResult}
                  onChange={(e) => setSqlExpectedResult(e.target.value)}
                  rows={5}
                  className="font-mono text-xs"
                  placeholder='[{"id": 1, "name": "Aarav"}]'
                />
              </Field>
            </div>
          )}

          {["SHORT", "LONG", "ORAL", "UPLOAD"].includes(type) && (
            <Field label="Reference / expected answer (optional)">
              <Textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={3}
                placeholder="What a good answer should include…"
              />
            </Field>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Create question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}