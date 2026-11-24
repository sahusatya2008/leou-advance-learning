"use client";

// Points @monaco-editor/react at the vendored copy instead of the CDN. Must
// precede the first <Editor> mount, which is what triggers loader.init().
import "@/lib/monaco";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Clock,
  Send,
  Play,
  Loader2,
  CheckCircle2,
  FileUp,
  Trash2,
  Code2,
  Table2,
  FileText,
  AlertTriangle,
  Mic,
  Square,
  AudioLines,
  ScanSearch,
  Sparkles,
  CircleCheck,
  CircleX,
  CircleHelp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
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
import { shouldAutoSubmit } from "@/lib/assessmentTime";
import type { SnsaiReport } from "@/lib/snsai/types";

/**
 * Browser speech recognition.
 *
 * There is no type in lib.dom for it, and the API is still prefixed in most
 * browsers, so the shape is declared here rather than pulled from a dependency.
 * The audio file is kept either way: this only turns speech into text.
 */
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const Editor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-lg bg-secondary/50" /> }
);

type AttemptQuestion = {
  assessmentQuestionId: string;
  order: number;
  marks: number;
  stem: string;
  imageUrl: string | null;
  type: string;
  subjectName: string;
  options: { id: string; text: string | null; imageUrl: string | null }[];
  allowedLanguages: string[];
  starterCode: Record<string, string>;
  headerTemplate: string | null;
  testCases: { input: string; expected: string }[];
  sqlDialect: string | null;
  sqlSchemaSql: string | null;
  sqlSeedSql: string | null;
};

type RunLog = { status: string; stdout: string; stderr: string; exitCode?: number; timedOut?: boolean; timeMs?: number };

/** What the Check endpoint returns for one question. */
type CheckedAnswer = {
  assessmentQuestionId: string;
  questionId: string;
  type: string;
  marks: number;
  maxMarks: number;
  status: "checked" | "skipped";
  skipReason?: string;
  report?: SnsaiReport;
};
type CheckSummary = {
  checked: number;
  skipped: number;
  correct: number;
  mostlyCorrect: number;
  partial: number;
  incorrect: number;
  unanswered: number;
  awaitingTeacher: number;
  marks: number;
  maxMarks: number;
  totalMs: number;
  hiddenCasesDeferred: boolean;
};

const MONACO_LANG: Record<string, string> = {
  python: "python",
  node: "javascript",
  java: "java",
  c: "c",
  cpp: "cpp",
  rust: "rust",
};

export default function AttemptView({
  submissionId,
  title,
  kind,
  totalMarks,
  deadline,
  questions,
  answers,
  instructions,
}: {
  submissionId: string;
  title: string;
  kind: AssessmentKind;
  totalMarks: number;
  deadline: string | null;
  questions: AttemptQuestion[];
  answers: Record<string, unknown>;
  instructions?: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const untimed = deadline === null;
  const [remaining, setRemaining] = useState(() =>
    deadline === null ? null : Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000))
  );
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ pastDeadline: boolean; submittedAt?: string } | null>(null);
  const [answersState, setAnswersState] = useState<Record<string, unknown>>(answers);

  const [codeByQ, setCodeByQ] = useState<Record<string, { language: string; code: string }>>(() => {
    const init: Record<string, { language: string; code: string }> = {};
    for (const q of questions) {
      if (q.type !== "CODING") continue;
      const existing = (answers[q.assessmentQuestionId] ?? {}) as { language?: string; code?: string };
      init[q.assessmentQuestionId] = {
        language: existing.language ?? (q.allowedLanguages[0] ?? "python"),
        code: existing.code ?? q.starterCode[existing.language ?? q.allowedLanguages[0] ?? "python"] ?? q.starterCode[Object.keys(q.starterCode)[0]] ?? "",
      };
    }
    return init;
  });
  const [sqlByQ, setSqlByQ] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of questions) {
      if (q.type !== "SQL") continue;
      init[q.assessmentQuestionId] = ((answers[q.assessmentQuestionId] ?? {}) as { query?: string }).query ?? "";
    }
    return init;
  });
  const [logsByQ, setLogsByQ] = useState<Record<string, RunLog[]>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [textByQ, setTextByQ] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of questions) {
      if (q.type !== "SHORT" && q.type !== "LONG") continue;
      init[q.assessmentQuestionId] = ((answers[q.assessmentQuestionId] ?? {}) as { text?: string }).text ?? "";
    }
    return init;
  });
  const [recordingQ, setRecordingQ] = useState<string | null>(null);
  const [recBlobByQ, setRecBlobByQ] = useState<Record<string, Blob>>({});
  const [recUrlByQ, setRecUrlByQ] = useState<Record<string, string>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [transcriptByQ, setTranscriptByQ] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of questions) {
      if (q.type !== "ORAL") continue;
      init[q.assessmentQuestionId] = ((answers[q.assessmentQuestionId] ?? {}) as { transcript?: string }).transcript ?? "";
    }
    return init;
  });
  const [listeningQ, setListeningQ] = useState<string | null>(null);
  const [interimByQ, setInterimByQ] = useState<Record<string, string>>({});
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [reports, setReports] = useState<Record<string, CheckedAnswer>>({});
  const [checking, setChecking] = useState<string | null>(null);
  const [checkSummary, setCheckSummary] = useState<CheckSummary | null>(null);


  const q = questions[current];

  const answered = useMemo(() => {
    const set = new Set<string>();
    for (const key of Object.keys(answersState)) {
      const payload = answersState[key] as { optionIds?: unknown[]; text?: string; fileUrls?: string[]; code?: string; runs?: unknown[]; query?: string; language?: string } | null;
      if (!payload) continue;
      if (q && ["MCQ"].includes(q.type) && Array.isArray(payload) && (payload as unknown as unknown[]).length > 0) set.add(key);
      else if (payload.optionIds?.length) set.add(key);
      else if (payload.text?.trim()) set.add(key);
      else if (payload.fileUrls?.length) set.add(key);
      else if (payload.code?.trim()) set.add(key);
      else if (payload.query?.trim()) set.add(key);
    }
    return set;
  }, [answersState, q]);

  const save = async (assessmentQuestionId: string, payload: unknown) => {
    setSaving(assessmentQuestionId);
    setAnswersState((prev) => ({ ...prev, [assessmentQuestionId]: payload }));
    try {
      const res = await fetch(`/api/student/attempt/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentQuestionId, payload }),
      });
      if (!res.ok) {
        toast.error((await res.json().catch(() => ({}))).error ?? "Could not save.");
        return;
      }
      setSaved((prev) => ({ ...prev, [assessmentQuestionId]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [assessmentQuestionId]: false })), 1800);
    } finally {
      setSaving(null);
    }
  };

  /**
   * Save without dropping the other half of the answer.
   *
   * An ORAL answer is a recording and a transcript, and they are stored in the
   * same payload. Replacing the whole object — which is what `save` does, and
   * what the file-delete button used to do — silently deleted the transcript
   * the moment a recording was removed. Merging keeps both.
   */
  const saveMerged = async (assessmentQuestionId: string, patch: Record<string, unknown>) => {
    const prev = (answersState[assessmentQuestionId] ?? {}) as Record<string, unknown>;
    await save(assessmentQuestionId, { ...prev, ...patch });
  };

  /**
   * Flush what is on screen before checking.
   *
   * The text areas and code editors keep their value in local state and only
   * write on blur. Without this, a student who typed an answer and pressed
   * Check without clicking away would be told their answer was blank — and
   * would be right, technically, which is the worst outcome.
   */
  const flushCurrentEdits = async () => {
    if (!q) return;
    const id = q.assessmentQuestionId;
    if (q.type === "SHORT" || q.type === "LONG") {
      const text = textByQ[id] ?? "";
      if (text !== (((answersState[id] ?? {}) as { text?: string }).text ?? "")) {
        await save(id, { text });
      }
    } else if (q.type === "CODING") {
      const cur = codeByQ[id];
      const prev = (answersState[id] ?? {}) as { language?: string; code?: string; runs?: RunLog[] };
      if (cur && (cur.code !== (prev.code ?? "") || cur.language !== (prev.language ?? ""))) {
        await save(id, { language: cur.language, code: cur.code, runs: prev.runs ?? [] });
      }
    } else if (q.type === "SQL") {
      const query = sqlByQ[id] ?? "";
      if (query !== (((answersState[id] ?? {}) as { query?: string }).query ?? "")) {
        await save(id, { query });
      }
    } else if (q.type === "ORAL") {
      const transcript = transcriptByQ[id] ?? "";
      if (transcript !== (((answersState[id] ?? {}) as { transcript?: string }).transcript ?? "")) {
        await saveMerged(id, { transcript });
      }
    }
  };

  const runCheck = async (assessmentQuestionIds?: string[]) => {
    const key = assessmentQuestionIds ? "all" : (q?.assessmentQuestionId ?? "all");
    if (checking) return;
    setChecking(key);
    try {
      await flushCurrentEdits();
      const res = await fetch(`/api/student/attempt/${submissionId}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assessmentQuestionIds ? { assessmentQuestionIds } : {}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        answers?: CheckedAnswer[];
        summary?: CheckSummary;
      };
      if (!res.ok || !body.answers) {
        toast.error(body.error ?? "Could not check your answer.");
        return;
      }
      setReports((prev) => {
        const next = { ...prev };
        for (const row of body.answers ?? []) next[row.assessmentQuestionId] = row;
        return next;
      });
      if (body.summary) setCheckSummary(body.summary);
      const skipped = (body.answers ?? []).filter((a) => a.status === "skipped").length;
      toast.success(
        skipped > 0
          ? `Checked ${(body.answers?.length ?? 0) - skipped} question(s). ${skipped} could not be checked.`
          : `Checked ${body.answers?.length ?? 0} question(s).`
      );
    } catch {
      toast.error("Could not check your answer.");
    } finally {
      setChecking(null);
    }
  };

  const toggleListening = (assessmentQuestionId: string) => {
    if (listeningQ === assessmentQuestionId) {
      recognitionRef.current?.stop();
      setListeningQ(null);
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      // Not every browser has it. The typed box above is the real fallback, so
      // say where to type rather than leaving a button that does nothing.
      toast.error("This browser cannot listen. Type your answer in the box above — it is checked the same way.");
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = "en-IN";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let finalText = "";
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (finalText) {
          setTranscriptByQ((prev) => {
            const next = (prev[assessmentQuestionId] ?? "") + finalText;
            // Persist as the student speaks, so a refresh cannot lose a long answer.
            void saveMerged(assessmentQuestionId, { transcript: next });
            return { ...prev, [assessmentQuestionId]: next };
          });
        } else if (interim) {
          setInterimByQ((prev) => ({ ...prev, [assessmentQuestionId]: interim }));
        }
      };
      rec.onerror = (e) => {
        // "no-speech" and "aborted" are ordinary; only a real failure is worth telling the student about.
        if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
          toast.error("Speech recognition stopped. You can type your answer instead.");
        }
        setListeningQ(null);
        setInterimByQ((prev) => ({ ...prev, [assessmentQuestionId]: "" }));
      };
      rec.onend = () => {
        setListeningQ(null);
        setInterimByQ((prev) => ({ ...prev, [assessmentQuestionId]: "" }));
      };
      recognitionRef.current = rec;
      rec.start();
      setListeningQ(assessmentQuestionId);
      setInterimByQ((prev) => ({ ...prev, [assessmentQuestionId]: "" }));
    } catch {
      toast.error("Speech recognition is not available. You can type your answer instead.");
    }
  };

  const doSubmit = async () => {    if (submitting) return;
    // Nothing is submitted on the student's behalf: an attempt with no answers
    // is never closed automatically (and cannot be closed at all).
    if (answered.size === 0) {
      toast.error("Answer at least one question before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/student/attempt/${submissionId}/submit`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Could not submit.");
        return;
      }
      setDone({ pastDeadline: body.pastDeadline === true, submittedAt: body.submittedAt });
    } finally {
      setSubmitting(false);
    }
  };

  const autoSubmitRef = useRef(false);
  const doSubmitRef = useRef(doSubmit);
  useEffect(() => {
    doSubmitRef.current = doSubmit;
  });
  useEffect(() => {
    // Assignments are never closed for the student: when the clock runs out the
    // paper stays open until they press Submit. Timed tests keep submitting
    // themselves at the deadline the way an exam hall would.
    if (done || untimed || autoSubmitRef.current) return;
    if (!shouldAutoSubmit(kind, remaining ?? 0)) return;
    autoSubmitRef.current = true;
    void doSubmitRef.current();
  }, [remaining, kind, done, untimed]);

  useEffect(() => {
    // Countdown only. When it reaches zero the attempt stays open and the
    // student must press Submit — the paper is never auto-submitted for them.
    if (untimed) return;
    const id = setInterval(() => {
      setRemaining((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);
    return () => clearInterval(id);
  }, [untimed]);

  const live = useRef<{
    q: AttemptQuestion | null;
    textByQ: Record<string, string>;
    codeByQ: Record<string, { language: string; code: string }>;
    sqlByQ: Record<string, string>;
    answersState: Record<string, unknown>;
  }>({ q, textByQ, codeByQ, sqlByQ, answersState });

  useEffect(() => {
    const id = setInterval(() => {
      const { q: cq, textByQ: texts, codeByQ: codes, sqlByQ: sqls, answersState: saved } = live.current;
      if (!cq) return;
      const aqId = cq.assessmentQuestionId;
      const prev = (saved[aqId] ?? {}) as { text?: string; code?: string; query?: string; language?: string; runs?: RunLog[] } | undefined;
      let payload: unknown;
      if (cq.type === "SHORT" || cq.type === "LONG") {
        const value = texts[aqId] ?? "";
        if (value === prev?.text) return;
        payload = { text: value };
      } else if (cq.type === "CODING") {
        const c = codes[aqId];
        if (!c || (c.code === prev?.code && c.language === prev?.language)) return;
        payload = { language: c.language, code: c.code, runs: prev?.runs ?? [] };
      } else if (cq.type === "SQL") {
        const value = sqls[aqId] ?? "";
        if (value === prev?.query) return;
        payload = { query: value };
      } else {
        return;
      }
      void save(aqId, payload);
    }, 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    live.current = { q, textByQ, codeByQ, sqlByQ, answersState };
  }, [q, textByQ, codeByQ, sqlByQ, answersState]);

  const uploadBlob = async (blob: Blob, fileName: string) => {
    const fd = new FormData();
    fd.append("kind", "answer");
    fd.append("file", blob, fileName);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Upload failed.");
    return body.url as string;
  };

  const appendFile = async (aqId: string, url: string) => {
    const existing = ((answersState[aqId] ?? {}) as { fileUrls?: string[] }).fileUrls ?? [];
    await save(aqId, { fileUrls: [...existing, url] });
  };

  const startRecording = async (aqId: string) => {
    if (recordingQ) return toast.error("Finish the current recording first.");
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
      return toast.error("Recording isn't supported in this browser — upload an audio file instead.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];
        setRecUrlByQ((prev) => {
          if (prev[aqId]) URL.revokeObjectURL(prev[aqId]);
          const next = { ...prev };
          delete next[aqId];
          next[aqId] = URL.createObjectURL(blob);
          return next;
        });
        setRecBlobByQ((prev) => ({ ...prev, [aqId]: blob }));
        recorderRef.current = null;
        setRecordingQ(null);
        if (blob.size === 0) return toast.error("No audio captured.");
        try {
          const url = await uploadBlob(blob, "recording.webm");
          await appendFile(aqId, url);
          toast.success("Recording uploaded.");
        } catch (e) {
          toast.error((e as Error).message ?? "Upload failed.");
        }
      };
      recorderRef.current = mr;
      streamRef.current = stream;
      mr.start();
      setRecordingQ(aqId);
    } catch {
      toast.error("Microphone access was denied.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  };

  if (done) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold">Submitted</h1>
        <p className="text-sm text-muted-foreground">
          Your work for “{title}” has been submitted{done.pastDeadline ? " just after the time limit" : ""}.
          Your teacher&apos;s evaluation will appear in Results once released.
        </p>
        <Button onClick={() => router.push("/dashboard/classes")}>Back to My Classes</Button>
      </div>
    );
  }

  const persistCodingRun = (aqId: string, log: RunLog) => {
    const entry = codeByQ[aqId];
    const prev = (answersState[aqId] ?? {}) as { runs?: RunLog[] } | undefined;
    const runs = [...(prev?.runs ?? []), log].slice(-10);
    void save(aqId, {
      language: entry?.language ?? "python",
      code: entry?.code ?? "",
      runs,
    });
  };

  const runSql = async (assessmentQuestionId: string) => {
    const query = sqlByQ[assessmentQuestionId] ?? "";
    if (!query.trim()) return toast.error("Enter a query first.");
    setRunning(assessmentQuestionId);
    try {
      const res = await fetch("/api/student/attempt/sql-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentQuestionId, query }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLogsByQ((prev) => ({ ...prev, [assessmentQuestionId]: [...(prev[assessmentQuestionId] ?? []), { status: "error", stdout: "", stderr: body.error ?? "SQL error" }].slice(-10) }));
        return toast.error(body.error ?? "SQL run failed.");
      }
      setLogsByQ((prev) => ({ ...prev, [assessmentQuestionId]: [...(prev[assessmentQuestionId] ?? []), { status: "ok", stdout: JSON.stringify({ columns: body.columns, rows: body.rows }), stderr: "" }].slice(-10) }));
      await save(assessmentQuestionId, { query, resultSummary: { columns: body.columns, rowCount: body.rowCount } });
    } finally {
      setRunning(null);
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append("kind", "answer");
      fd.append("file", f);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) return toast.error(body.error ?? "Upload failed.");
      urls.push(body.url);
    }
    await save(q.assessmentQuestionId, { fileUrls: [...(((answersState[q.assessmentQuestionId] ?? {}) as { fileUrls?: string[] }).fileUrls ?? []), ...urls] });
    toast.success("Uploaded.");
  };

  const secs = remaining ?? 0;
  const hh = Math.floor(secs / 3600);
  const mm = Math.floor((secs % 3600) / 60);
  const ss = secs % 60;
  const timeText = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const timeUp = !untimed && secs <= 0;
  const urgent = !untimed && secs < 300;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline">{kind}</Badge>
            {untimed ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-4 w-4" />
                No time limit
              </span>
            ) : (
              <span className={`flex items-center gap-1.5 font-mono text-sm ${urgent ? "text-red-400" : "text-foreground"}`}>
                <Clock className="h-4 w-4" />
                {timeText}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {answered.size} of {questions.length} answered · {totalMarks} pts
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:flex lg:flex-col">
          {questions.map((item, i) => {
            const isAnswered = answered.has(item.assessmentQuestionId);
            const active = i === current;
            return (
              <button
                key={item.assessmentQuestionId}
                onClick={() => setCurrent(i)}
                className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-sm transition-colors lg:px-3 ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : isAnswered
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-border hover:bg-secondary"
                }`}
              >
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-semibold ${isAnswered ? "bg-emerald-500/20" : "bg-secondary"}`}>
                  {isAnswered ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="hidden truncate text-xs lg:inline">{item.type}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full"
            disabled={checking !== null}
            onClick={() => void runCheck()}
          >
            {checking === "all" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Check all answers
          </Button>
          {checkSummary && (
            <p className="text-center text-xs text-muted-foreground">
              {checkSummary.correct} correct · {checkSummary.mostlyCorrect} nearly · {checkSummary.partial} partial ·{" "}
              {checkSummary.incorrect} to fix
              <br />
              <span className="text-foreground">
                {checkSummary.marks} of {checkSummary.maxMarks} marks so far
              </span>
            </p>
          )}
          {checkSummary?.hiddenCasesDeferred && (
            <p className="text-center text-xs text-amber-300/90">
              Some test cases are held back until you submit.
            </p>
          )}
          <Button
            variant={timeUp ? "destructive" : urgent ? "destructive" : "default"}
            className="w-full"
            disabled={submitting || answered.size === 0}
            onClick={() => void doSubmit()}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {timeUp ? "Submit now" : "Submit"}
          </Button>
          {answered.size === 0 && (
            <p className="text-center text-xs text-amber-300">
              Answer at least one question to enable submission.
            </p>
          )}
        </div>
      </aside>

      <main className="space-y-4">
        {timeUp && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Time is up. Nothing has been submitted — review your answers and press
              &quot;Submit now&quot; to send your work.
            </span>
          </div>
        )}
        {instructions && (
          <p className="rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">{instructions}</p>
        )}

        {q && (
          <CardShell>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{q.type}</Badge>
              <span className="text-xs text-muted-foreground">{q.subjectName}</span>
              <span className="ml-auto text-xs font-medium">{q.marks} pts</span>
            </div>

            <div className="space-y-1 whitespace-pre-wrap text-sm leading-relaxed">{q.stem}</div>
            {q.imageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={q.imageUrl} alt="" className="mt-3 max-h-64 rounded-lg border border-border object-contain" />
            )}

            <div className="mt-4 space-y-3">
              {q.type === "MCQ" && (
                <div className="space-y-2">
                  <McqEditor q={q} answers={answersState} onSave={(aqId, p) => void save(aqId, p)} />
                  <p className="text-xs text-muted-foreground">If more than one option is correct, select all that apply.</p>
                </div>
              )}

              {(q.type === "SHORT" || q.type === "LONG") && (
                <Textarea
                  rows={q.type === "LONG" ? 10 : 6}
                  placeholder="Type your answer here…"
                  value={textByQ[q.assessmentQuestionId] ?? ""}
                  onChange={(e) => setTextByQ((prev) => ({ ...prev, [q.assessmentQuestionId]: e.target.value }))}
                  onBlur={(e) => void save(q.assessmentQuestionId, { text: e.target.value })}
                />
              )}

              {q.type === "ORAL" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/30 p-3">
                    <AudioLines className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {recordingQ === q.assessmentQuestionId
                        ? "Recording…"
                        : recBlobByQ[q.assessmentQuestionId]
                          ? "Recording captured. Submit when ready."
                          : "Record your spoken answer, or upload an audio file below."}
                    </span>
                    <div className="ml-auto flex gap-2">
                      {recordingQ !== q.assessmentQuestionId ? (
                        <Button size="sm" variant={recBlobByQ[q.assessmentQuestionId] ? "secondary" : "default"} onClick={() => void startRecording(q.assessmentQuestionId)}>
                          <Mic className="mr-1.5 h-4 w-4" />
                          {recBlobByQ[q.assessmentQuestionId] ? "Re-record" : "Start recording"}
                        </Button>
                      ) : (
                        <Button size="sm" variant="destructive" onClick={stopRecording}>
                          <Square className="mr-1.5 h-4 w-4" /> Stop
                        </Button>
                      )}
                      {recBlobByQ[q.assessmentQuestionId] && recUrlByQ[q.assessmentQuestionId] && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={recUrlByQ[q.assessmentQuestionId]} download="recording.webm">Preview</a>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* SNSAI can only read a spoken answer if it has words, so the
                      transcript is what actually gets checked. Recording and
                      transcript are both kept. */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-sm">Your answer in words</Label>
                      <Button
                        size="sm"
                        variant={listeningQ === q.assessmentQuestionId ? "destructive" : "outline"}
                        onClick={() => toggleListening(q.assessmentQuestionId)}
                      >
                        {listeningQ === q.assessmentQuestionId ? (
                          <>
                            <Square className="mr-1.5 h-3.5 w-3.5" /> Stop dictation
                          </>
                        ) : (
                          <>
                            <Mic className="mr-1.5 h-3.5 w-3.5" /> Dictate
                          </>
                        )}
                      </Button>
                    </div>
                    <Textarea
                      rows={6}
                      placeholder="Speak or type your answer here. This is what your teacher and SNSAI will read."
                      value={transcriptByQ[q.assessmentQuestionId] ?? ""}
                      onChange={(e) => setTranscriptByQ((prev) => ({ ...prev, [q.assessmentQuestionId]: e.target.value }))}
                      onBlur={(e) => void saveMerged(q.assessmentQuestionId, { transcript: e.target.value })}
                    />
                    {listeningQ === q.assessmentQuestionId && (
                      <p className="text-xs text-muted-foreground">
                        Listening… {interimByQ[q.assessmentQuestionId] || "say something"}
                      </p>
                    )}
                    {(transcriptByQ[q.assessmentQuestionId] ?? "").trim().length === 0 &&
                      (recBlobByQ[q.assessmentQuestionId] || ((answersState[q.assessmentQuestionId] ?? {}) as { fileUrls?: string[] }).fileUrls?.length) && (
                        <p className="text-xs text-amber-300/90">
                          There is a recording but no transcript. SNSAI can only check the words, so add a
                          transcript or type the answer as well.
                        </p>
                      )}
                  </div>
                </div>
              )}

              {q.type === "UPLOAD" && (
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground hover:bg-secondary/50">
                    <FileUp className="h-5 w-5" />
                    Upload photos / files
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => void uploadFiles(e.target.files)}
                    />
                  </label>
                  {(((answersState[q.assessmentQuestionId] ?? {}) as { fileUrls?: string[] }).fileUrls ?? []).map((url) => (
                    <div key={url} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{url.split("/").pop()}</span>
                      <Button
                        variant="ghost" size="sm" className="ml-auto h-7 w-7 p-0 text-destructive"
                        onClick={() => {
                          const urls = ((answersState[q.assessmentQuestionId] ?? {}) as { fileUrls?: string[] }).fileUrls ?? [];
                          void saveMerged(q.assessmentQuestionId, { fileUrls: urls.filter((u) => u !== url) });
                        }}
                      ><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}

              {q.type === "ORAL" && (
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground hover:bg-secondary/50">
                    <FileUp className="h-5 w-5" />
                    Upload an audio recording
                    <input
                      type="file"
                      multiple
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => void uploadFiles(e.target.files)}
                    />
                  </label>
                  {(((answersState[q.assessmentQuestionId] ?? {}) as { fileUrls?: string[] }).fileUrls ?? []).map((url) => (
                    <div key={url} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{url.split("/").pop()}</span>
                      <Button
                        variant="ghost" size="sm" className="ml-auto h-7 w-7 p-0 text-destructive"
                        onClick={() => {
                          const urls = ((answersState[q.assessmentQuestionId] ?? {}) as { fileUrls?: string[] }).fileUrls ?? [];
                          void saveMerged(q.assessmentQuestionId, { fileUrls: urls.filter((u) => u !== url) });
                        }}
                      ><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}

              {q.type === "CODING" && (
                <CodingEditor
                  q={q}
                  codeByQ={codeByQ}
                  setCodeByQ={setCodeByQ}
                  onSaveCode={(lang, code) => {
                    const prev = (answersState[q.assessmentQuestionId] ?? {}) as { runs?: RunLog[] } | undefined;
                    void save(q.assessmentQuestionId, { language: lang, code, runs: prev?.runs ?? [] });
                  }}
                  onRunRequest={() => {
                    const e = codeByQ[q.assessmentQuestionId];
                    return {
                      language: e?.language ?? q.allowedLanguages[0] ?? "python",
                      code: e?.code ?? "",
                    };
                  }}
                  onCompleteRun={(log) => persistCodingRun(q.assessmentQuestionId, log)}
                />
              )}

              {q.type === "SQL" && (
                <SqlEditor
                  q={q}
                  sqlByQ={sqlByQ}
                  setSqlByQ={setSqlByQ}
                  logsByQ={logsByQ}
                  running={running === q.assessmentQuestionId}
                  onRun={() => void runSql(q.assessmentQuestionId)}
                />
              )}
            </div>

            {reports[q.assessmentQuestionId] && (
              <CheckReport row={reports[q.assessmentQuestionId]} />
            )}

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {saving === q.assessmentQuestionId ? "Saving…" : saved[q.assessmentQuestionId] ? "Saved" : " "}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={checking !== null}
                  onClick={() => void runCheck([q.assessmentQuestionId])}
                >
                  {checking === q.assessmentQuestionId ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Check this answer
                </Button>
                <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
                  Previous
                </Button>
                {current < questions.length - 1 ? (
                  <Button size="sm" onClick={() => setCurrent((c) => c + 1)}>Next</Button>
                ) : (
                  <SubmitDialog
                    title={title}
                    onConfirm={() => void doSubmit()}
                    submitting={submitting}
                    answered={answered.size}
                    total={questions.length}
                    canSubmit={answered.size > 0}
                  />
                )}
              </div>
            </div>
          </CardShell>
        )}
      </main>
    </div>
  );
}

const VERDICT_STYLE: Record<string, { label: string; cls: string; Icon: typeof CircleCheck }> = {
  correct: { label: "Correct", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200", Icon: CircleCheck },
  mostly_correct: { label: "Nearly there", cls: "border-sky-500/40 bg-sky-500/10 text-sky-200", Icon: CircleCheck },
  partial: { label: "Partly right", cls: "border-amber-500/40 bg-amber-500/10 text-amber-200", Icon: CircleHelp },
  incorrect: { label: "Needs work", cls: "border-red-500/40 bg-red-500/10 text-red-200", Icon: CircleX },
  unanswered: { label: "Not answered", cls: "border-border bg-secondary/40 text-muted-foreground", Icon: CircleHelp },
  needs_teacher: { label: "Your teacher will mark this", cls: "border-border bg-secondary/40 text-muted-foreground", Icon: CircleHelp },
};

/**
 * One Check result.
 *
 * It has to be honest about what it is: a study aid, not a grade. So it leads
 * with the points found, then what to fix, then the reference — and never
 * presents the mark as final.
 */
function CheckReport({ row }: { row: CheckedAnswer }) {
  if (row.status === "skipped" || !row.report) {
    return (
      <div className="mt-4 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Could not check this one</p>
        <p className="mt-1">{row.skipReason ?? "There is nothing to check this answer against yet."}</p>
      </div>
    );
  }

  const r = row.report;
  const style = VERDICT_STYLE[r.verdict] ?? VERDICT_STYLE.unanswered;
  const Icon = style.Icon;

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${style.cls}`}>
          <Icon className="h-3.5 w-3.5" />
          {style.label}
        </span>
        <span className="text-sm font-semibold">
          {r.marks} of {r.maxMarks} marks
        </span>
        <span className="ml-auto text-xs text-muted-foreground">Study aid — your real mark comes on submit</span>
      </div>

      <p className="text-sm">{r.headline}</p>

      {r.criteria.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What a full answer needs</p>
          <ul className="space-y-1">
            {r.criteria.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {c.hit ? (
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                )}
                <span className={c.hit ? "" : "text-muted-foreground"}>{c.expected}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.faults.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">How to fix it</p>
          {r.faults.map((f, i) => (
            <div key={i} className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
              <p className="text-sm font-medium">{f.message}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{f.teach}</p>
            </div>
          ))}
        </div>
      )}

      {r.teaching.length > 0 && (
        <details className="rounded-lg border border-border bg-secondary/20 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">How this answer should be built</summary>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            {r.teaching.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </details>
      )}

      {r.reference.trim().length > 0 && (
        <details className="rounded-lg border border-border bg-secondary/20 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">Show the reference answer</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{r.reference}</p>
        </details>
      )}

      {r.nextStep.trim().length > 0 && (
        <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">Next: {r.nextStep}</p>
      )}
    </div>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {  return <section className="rounded-xl border border-border bg-card p-5">{children}</section>;
}

function McqEditor({
  q,
  answers,
  onSave,
}: {
  q: AttemptQuestion;
  answers: Record<string, unknown>;
  onSave: (aqId: string, payload: { optionIds: string[] }) => void;
}) {
  const selected = ((answers[q.assessmentQuestionId] ?? {}) as { optionIds?: string[] }).optionIds ?? [];
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    onSave(q.assessmentQuestionId, { optionIds: next });
  };
  return (
    <div className="space-y-2">
      {q.options.map((o) => {
        const active = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
              active ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/50"
            }`}
          >
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${active ? "border-primary bg-primary" : "border-border"}`}>
              {active && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
            </span>
            {o.text && <span className="whitespace-pre-wrap">{o.text}</span>}
            {o.imageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={o.imageUrl} alt="" className="max-h-24 rounded border object-contain" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function CodingEditor({
  q,
  codeByQ,
  setCodeByQ,
  onSaveCode,
  onRunRequest,
  onCompleteRun,
}: {
  q: AttemptQuestion;
  codeByQ: Record<string, { language: string; code: string }>;
  setCodeByQ: React.Dispatch<React.SetStateAction<Record<string, { language: string; code: string }>>>;
  onSaveCode: (language: string, code: string) => void;
  onRunRequest: () => { language: string; code: string };
  onCompleteRun: (log: RunLog) => void;
}) {
  const entry = codeByQ[q.assessmentQuestionId] ?? { language: q.allowedLanguages[0] ?? "python", code: "" };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={entry.language}
          onValueChange={(l) => {
            const next = { language: l, code: codeByQ[q.assessmentQuestionId]?.code ?? q.starterCode[l] ?? "" };
            setCodeByQ((prev) => ({ ...prev, [q.assessmentQuestionId]: next }));
            onSaveCode(l, next.code);
          }}
        >
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {q.allowedLanguages.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Code2 className="h-3.5 w-3.5" /> auto-saved as you type
        </span>
        {q.headerTemplate && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Code2 className="h-3.5 w-3.5" /> signature pinned — don&apos;t rename it
          </span>
        )}
      </div>

      {q.headerTemplate && (
        <pre className="overflow-x-auto rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 font-mono text-xs text-amber-200">
          {q.headerTemplate}
        </pre>
      )}

      <div onBlurCapture={() => onSaveCode(entry.language, codeByQ[q.assessmentQuestionId]?.code ?? entry.code)}>
        <Editor
          height="220px"
          language={MONACO_LANG[entry.language] ?? "plaintext"}
          theme="vs-dark"
          value={entry.code}
          onChange={(v) => {
            const code = v ?? "";
            setCodeByQ((prev) => ({ ...prev, [q.assessmentQuestionId]: { ...entry, code } }));
          }}
        />
      </div>

      {q.testCases.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Visible test cases</Label>
          {q.testCases.map((t, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <code className="rounded bg-secondary px-2 py-1">in: {t.input || "—"}</code>
              <code className="rounded bg-secondary px-2 py-1">out: {t.expected}</code>
            </div>
          ))}
        </div>
      )}

      <CodingTerminal questionId={q.assessmentQuestionId} onRunRequest={onRunRequest} onComplete={onCompleteRun} />
    </div>
  );
}

type TermLine = { kind: "cmd" | "out" | "err" | "in" | "meta"; text: string };

const CMD_LABEL: Record<string, string> = {
  python: "python3 -u main.py",
  node: "node main.js",
  java: "java Main",
  c: "./main",
  cpp: "./main",
  rust: "./main",
};

function CodingTerminal({
  questionId,
  onRunRequest,
  onComplete,
}: {
  questionId: string;
  onRunRequest: () => { language: string; code: string };
  onComplete: (log: RunLog) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "starting" | "running" | "exited" | "error">("idle");
  // Trailing partial lines of each stream: shown immediately (so an input
  // prompt without a newline is visible) and completed in place by the next
  // chunk rather than spawning a second, broken line.
  const [view, setView] = useState<{ lines: TermLine[]; outTail: string; errTail: string }>({
    lines: [],
    outTail: "",
    errTail: "",
  });
  const [input, setInput] = useState("");
  const [awaiting, setAwaiting] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const pollInFlightRef = useRef<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);
  const outLenRef = useRef(0);
  const errLenRef = useRef(0);
  const lastOutRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const push = (add: TermLine[]) => setView((v) => ({ ...v, lines: [...v.lines, ...add].slice(-400) }));

  // The runner returns the whole cumulative buffer each poll, so only bytes we
  // have not displayed yet may be appended — otherwise old output replays.
  const consume = (raw: unknown, kind: "out" | "err") => {
    const text = typeof raw === "string" ? raw : "";
    const lenRef = kind === "out" ? outLenRef : errLenRef;
    if (text.length <= lenRef.current) return;
    const seg = text.slice(lenRef.current);
    lenRef.current = text.length;
    lastOutRef.current = Date.now();
    setView((v) => {
      const merged = (kind === "out" ? v.outTail : v.errTail) + seg;
      const parts = merged.split("\n");
      const rest = parts.pop() ?? "";
      const add: TermLine[] = [];
      for (const ln of parts) if (ln !== "") add.push({ kind, text: ln });
      const lines = add.length ? [...v.lines, ...add].slice(-400) : v.lines;
      return kind === "out"
        ? { lines, outTail: rest, errTail: v.errTail }
        : { lines, outTail: v.outTail, errTail: rest };
    });
  };

  const stopPolling = () => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopPolling();
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [view, phase]);

  const finish = (log: RunLog) => {
    stopPolling();
    setExitCode(log.exitCode ?? 0);
    setPhase("exited");
    onComplete(log);
  };

  const run = async () => {
    if (phase === "starting" || phase === "running") return;
    // Kill any poller/in-flight fetch from a previous run first: otherwise a
    // late response from the old session lands in the fresh terminal and the
    // whole previous transcript appears again.
    stopPolling();
    abortRef.current?.abort();
    pollInFlightRef.current = false;
    const { language, code } = onRunRequest();
    if (!code.trim()) return toast.error("Write some code first.");
    setPhase("starting");
    setAwaiting(false);
    setExitCode(null);
    outLenRef.current = 0;
    errLenRef.current = 0;
    lastOutRef.current = Date.now();
    setView({ lines: [{ kind: "cmd", text: `$ ${CMD_LABEL[language] ?? language}` }], outTail: "", errTail: "" });
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const res = await fetch("/api/student/attempt/run-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentQuestionId: questionId, language, code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhase("error");
        push([{ kind: "meta", text: body.error ?? "Could not start the run." }]);
        return;
      }
      sessionIdRef.current = body.sessionId as string;
      setPhase("running");
      const sessionId = sessionIdRef.current;
      pollRef.current = window.setInterval(() => {
        // Skip a tick while the previous poll is still in flight. Without this
        // two overlapping responses could land out of order, and the slower one
        // would append already-seen output or overwrite newer state.
        if (pollInFlightRef.current) return;
        pollInFlightRef.current = true;
        void (async () => {
          try {
            const r = await fetch(`/api/student/attempt/run-session/${sessionId}`, { method: "GET", signal: abort.signal });
            if (abort.signal.aborted || sessionIdRef.current !== sessionId) return;
            const b = await r.json().catch(() => ({}));
            if (!r.ok) {
              push([{ kind: "meta", text: b.error ?? "session closed" }]);
              setPhase("error");
              stopPolling();
              return;
            }
            const stdout = typeof b.stdout === "string" ? b.stdout : "";
            const stderr = typeof b.stderr === "string" ? b.stderr : "";
            consume(stdout, "out");
            consume(stderr, "err");
            setAwaiting(b.status === "running" && Date.now() - lastOutRef.current > 1500);
            if (b.status === "exited") {
              finish({
                status: b.exitCode === 0 ? "ok" : "error",
                stdout: stdout,
                stderr: stderr,
                exitCode: b.exitCode ?? 0,
                timedOut: !!b.timedOut,
                timeMs: b.timeMs ?? 0,
              });
            }
          } catch {
            /* aborted or transient — keep polling */
          } finally {
            pollInFlightRef.current = false;
          }
        })();
      }, 400);
    } catch {
      setPhase("error");
      push([{ kind: "meta", text: "Could not start the run." }]);
    }
  };

  const sendInput = async () => {
    const value = input.trim();
    if (!value || phase !== "running" || !sessionIdRef.current) return;
    push([{ kind: "in", text: value }]);
    setInput("");
    try {
      const r = await fetch(`/api/student/attempt/run-session/${sessionIdRef.current}/input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: value }),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        if (!r.ok && b.status === 409) toast.error(b.error ?? "Program already exited.");
      }
    } catch {
      /* ignore */
    }
  };

  const stop = async () => {
    if (phase !== "running" || !sessionIdRef.current) return;
    try {
      await fetch(`/api/student/attempt/run-session/${sessionIdRef.current}`, { method: "POST" });
    } catch {
      /* ignore */
    }
    stopPolling();
    setPhase("exited");
    push([{ kind: "meta", text: "process stopped" }]);
  };

  const rendered: TermLine[] = [
    ...view.lines,
    ...(view.outTail ? [{ kind: "out" as const, text: view.outTail }] : []),
    ...(view.errTail ? [{ kind: "err" as const, text: view.errTail }] : []),
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-[#0b0f14] font-mono text-xs">
      <div className="flex items-center gap-1.5 border-b border-border/50 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-2 text-[10px] text-muted-foreground">terminal</span>
        <div className="ml-auto">
          <Button
            size="sm"
            variant={phase === "running" ? "destructive" : "default"}
            className="h-7 gap-1.5 px-2.5 text-xs"
            disabled={phase === "starting"}
            onClick={() => (phase === "running" ? void stop() : void run())}
          >
            {phase === "starting" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : phase === "running" ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {phase === "starting" ? "Running…" : phase === "running" ? "Stop" : "Run"}
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-64 space-y-1 overflow-y-auto px-3 py-2">
        {rendered.length === 0 && (
          <div className="text-muted-foreground">
            Press <span className="text-primary">Run</span> — the command, output and input prompts all live here.
          </div>
        )}
        {rendered.map((l, i) => (
          <div
            key={i}
            className={l.kind === "cmd" ? "text-sky-300" : l.kind === "err" ? "text-red-400" : l.kind === "out" ? "text-green-200" : l.kind === "in" ? "text-amber-200" : "text-muted-foreground"}
          >
            {l.kind === "in" ? `> ${l.text}` : l.text}
          </div>
        ))}
        {phase === "running" && <div className="animate-pulse text-muted-foreground">▌</div>}
        {phase === "exited" && exitCode != null && (
          <div className="text-muted-foreground">[process exited · code {exitCode}]</div>
        )}
      </div>

      {phase === "running" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendInput();
          }}
          className="flex items-center gap-2 border-t border-border/50 px-3 py-2"
        >
          <span className={`shrink-0 ${awaiting ? "font-semibold text-emerald-300" : "text-muted-foreground"}`}>
            {awaiting ? "·  awaiting input" : "❯"}
          </span>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-transparent text-green-200 outline-none placeholder:text-muted-foreground/60"
            placeholder={awaiting ? "enter a value and press Enter…" : "type here — sent to your program when it reads input"}
          />
        </form>
      )}
    </div>
  );
}

function SqlEditor({
  q,
  sqlByQ,
  setSqlByQ,
  logsByQ,
  running,
  onRun,
}: {
  q: AttemptQuestion;
  sqlByQ: Record<string, string>;
  setSqlByQ: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  logsByQ: Record<string, RunLog[]>;
  running: boolean;
  onRun: () => void;
}) {
  const logs = logsByQ[q.assessmentQuestionId] ?? [];
  const last = logs[logs.length - 1];
  const result = last?.status === "ok" ? (JSON.parse(last.stdout) as { columns: string[]; rows: unknown[][] } | null) : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{q.sqlDialect ?? "PostgreSQL"}</Badge>
        <Button size="sm" variant="outline" onClick={onRun} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          {running ? "Running…" : "Run query"}
        </Button>
      </div>
      <Editor
        height="160px"
        language="sql"
        theme="vs-dark"
        value={sqlByQ[q.assessmentQuestionId] ?? ""}
        onChange={(v) => setSqlByQ((prev) => ({ ...prev, [q.assessmentQuestionId]: v ?? "" }))}
      />
      <div className="flex items-center gap-2">
        <Table2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {q.sqlSchemaSql ? "Schema preloaded into a sandbox copy." : "No schema defined for this question."}
        </span>
      </div>
      {result && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                {result.columns.map((c) => (
                  <th key={c} className="px-3 py-2 font-mono font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.length === 0 && (
                <tr><td className="px-3 py-2 text-muted-foreground" colSpan={result.columns.length || 1}>0 rows returned</td></tr>
              )}
              {result.rows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-1.5 font-mono">{String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Terminal logs={logs.filter((l) => l.status === "error")} />
    </div>
  );
}

function Terminal({ logs }: { logs: RunLog[] }) {
  return (
    <div className="rounded-lg border border-border bg-[#0b0f14] font-mono text-xs">
      <div className="flex items-center gap-1.5 border-b border-border/50 px-3 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-2 text-[10px] text-muted-foreground">runner</span>
      </div>
      {logs.length === 0 && <div className="px-3 py-3 text-muted-foreground">Press Run to execute…</div>}
      <div className="max-h-56 space-y-2 overflow-y-auto px-3 py-2">
        {logs.map((l, i) => (
          <div key={i}>
            <div className="text-muted-foreground">
              {l.status === "ok" ? `✓ exit ${l.exitCode ?? 0}` : <span className="text-red-400">✗ {l.exitCode != null ? `exit ${l.exitCode}` : "error"}</span>}
              {l.timedOut && <span className="text-amber-400"> · timed out</span>}
              {l.timeMs != null && ` · ${l.timeMs}ms`}
            </div>
            {l.stderr && <pre className="whitespace-pre-wrap text-red-400">{l.stderr.slice(0, 3000)}</pre>}
            {l.status !== "ok" && (l.stdout || !l.stderr) && <pre className="whitespace-pre-wrap text-green-300">{l.stdout.slice(0, 3000)}</pre>}
            {l.status === "error" && !l.stderr && !l.stdout && <pre className="text-red-400">{l.stdout.slice(0, 3000)}</pre>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SubmitDialog({
  title,
  onConfirm,
  submitting,
  answered,
  total,
  canSubmit,
}: {
  title: string;
  onConfirm: () => void;
  submitting: boolean;
  answered: number;
  total: number;
  canSubmit: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant={submitting ? "outline" : "default"} disabled={submitting || !canSubmit}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Submit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit “{title}”?</DialogTitle>
          <DialogDescription className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>
              {answered} of {total} answered. Once submitted you can&apos;t change answers — the{" "}
              {total - answered} unanswered question{total - answered === 1 ? "" : "s"} will be
              graded as unanswered.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={onConfirm} disabled={submitting || !canSubmit}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}