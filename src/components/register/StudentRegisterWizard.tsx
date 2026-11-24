"use client";

import * as React from "react";
import { friendlyError, parseJson } from "@/lib/apiClient";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, GraduationCap, Loader2 } from "lucide-react";
import { STREAMS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FaceSampleCapture } from "@/components/face/FaceSampleCapture";
import { Badge } from "@/components/ui/badge";
import { FACE_CONFIG } from "@/lib/constants";
import { selectFaceGroup } from "@/lib/face";

type OptionsApi = {
  classes: {
    id: string;
    name: string;
    hasStreams: boolean;
    subjects: { id: string; name: string }[];
  }[];
};

type EmbedMeta = {
  ok: boolean;
  error?: string;
  embedding?: number[];
  det_score?: number;
  face_px?: number;
  liveness?: { is_real: boolean | null; score: number | null };
};

type EmbedApi = { results: EmbedMeta[] };

/**
 * How long to wait for the face service before giving up and saying so.
 *
 * The server side allows 120s, which is generous enough for a cold model load.
 * Waiting that long with no feedback is indistinguishable from a dead button,
 * so the browser gives up earlier and explains itself; the request is still
 * cheap to repeat, and the service is warm by then.
 */
const FACE_EMBED_TIMEOUT_MS = 90_000;

type WizardState = {
  fullName: string;
  classRoomId: string;
  stream: keyof typeof STREAMS | "";
  subjectIds: string[];
  schoolName: string;
  schoolStatus: "CURRENT" | "PAST";
  schoolClassHistory: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  face: string[];
};

const initial: WizardState = {
  fullName: "",
  classRoomId: "",
  stream: "",
  subjectIds: [],
  schoolName: "",
  schoolStatus: "CURRENT",
  schoolClassHistory: "",
  email: "",
  phone: "",
  username: "",
  password: "",
  face: [],
};

export function StudentRegisterWizard({
  endpoint = "/api/auth/register",
  title = "Student registration",
  description = "Create your account with AI face enrollment.",
  onSuccess,
}: {
  endpoint?: string;
  title?: string;
  description?: string;
  onSuccess?: (data: { studentId?: string }) => void;
}) {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(initial);
  const [options, setOptions] = useState<OptionsApi["classes"]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<null | { studentId: string }>(null);

  React.useEffect(() => {
    fetch("/api/enrollment/options")
      .then((r) => r.json())
      .then((d: OptionsApi) => setOptions(d.classes))
      .finally(() => setLoadingOptions(false));
  }, []);

  const set = <K extends keyof WizardState>(key: K, value: WizardState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const selectedClass = useMemo(
    () => options.find((c) => c.id === state.classRoomId),
    [options, state.classRoomId]
  );

  const canContinue =
    step === 1
      ? state.fullName.trim().length >= 3 &&
        !!state.classRoomId &&
        (!selectedClass?.hasStreams || !!state.stream) &&
        state.subjectIds.length > 0
      : step === 2
        ? state.schoolName.trim().length >= 2 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email) &&
          /^[0-9+\-\s]{7,15}$/.test(state.phone)
        : step === 3
          ? /^[a-zA-Z0-9_.]{4,32}$/.test(state.username) && state.password.length >= 8
          : step === 4
            ? state.face.length >= FACE_CONFIG.ENROLL_SAMPLES
            : false;

  function toggleSubject(id: string) {
    set(
      "subjectIds",
      state.subjectIds.includes(id)
        ? state.subjectIds.filter((s) => s !== id)
        : [...state.subjectIds, id]
    );
  }

  async function submit() {
    setSubmitting(true);
    setErrors([]);
    // Face recognition is a real inference step: each photo costs a second or
    // two, and the very first request after a restart also pays to load the
    // models. That used to be a bare spinner with no wording, so an admin who
    // waited a few seconds concluded the button had done nothing and pressed it
    // again. Say what is happening, and cap the wait so a wedged service ends in
    // an explanation rather than an indefinite freeze.
    setStatus(`Checking ${state.face.length} face sample${state.face.length === 1 ? "" : "s"} — this takes a few seconds…`);
    try {
      // 1) Send the captured stills to the Python service (InsightFace ArcFace
      //    + DeepFace anti-spoofing): it embeds each face and verifies liveness.
      const embedRes = await fetch("/api/face/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: state.face }),
        signal: AbortSignal.timeout(FACE_EMBED_TIMEOUT_MS),
      }).catch((e) => {
        if (e instanceof DOMException && e.name === "TimeoutError") {
          throw new Error(
            "The face service did not respond in time. It may still be starting up — wait a moment and try again."
          );
        }
        throw e;
      });
      const embedData = (await embedRes.json()) as EmbedApi;
      if (!embedRes.ok) {
        setErrors([(embedData as { error?: string }).error ?? "Face verification service unavailable."]);
        setStep(4);
        return;
      }
      const out = embedData.results;
      const okAll = out.length > 0 && out.every((r) => r.ok && Array.isArray(r.embedding));
      if (!okAll) {
        const reason = out.find((r) => !r.ok)?.error;
        setErrors([
          reason === "no_face"
            ? "No face was detected in one of the captures. Face the camera directly and try again."
            : reason === "multiple_faces"
              ? "More than one face was detected. Only the student should be in the frame."
              : "A capture could not be processed. Please retry in good lighting.",
        ]);
        setStep(4);
        return;
      }
      // Liveness (DeepFace anti-spoofing) is reported but not blocking here:
      // students may enroll with uploaded photos. It is strictly enforced at login.
      // Pick the one face the captures agree on. A single blurry or turned
      // frame no longer sinks the whole enrollment: the consistent majority is
      // kept and the outliers are dropped. Only a genuinely mixed set (no
      // majority, or two sizeable faces) is refused.
      const allEmbeddings = out.map((r) => r.embedding as number[]);
      const selection = selectFaceGroup(allEmbeddings, {
        selfMax: FACE_CONFIG.SELF_MAX_DISTANCE,
        minCore: FACE_CONFIG.ENROLL_SAMPLES,
      });
      if (!selection.ok || selection.kept.length < FACE_CONFIG.ENROLL_SAMPLES) {
        setErrors([
          "The captures did not lock onto one consistent face. Make sure only the student is in the frame, hold still in good light, and capture again.",
        ]);
        setStep(4);
        return;
      }
      const faceEmbeddings = selection.kept.map((k) => allEmbeddings[k]);
      // Keep the photos aligned with the embeddings we actually store, so the
      // saved face photo is a frame that was used, not one that was thrown out.
      const facePhotos = selection.kept.map((k) => state.face[k]);

      // 2) Register the account with the trained 512-d ArcFace embeddings.
      setStatus("Creating the account…");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: state.fullName,
          classRoomId: state.classRoomId,
          stream: state.stream || null,
          subjectIds: state.subjectIds,
          schoolName: state.schoolName,
          schoolStatus: state.schoolStatus,
          schoolClassHistory: state.schoolClassHistory,
          email: state.email,
          phone: state.phone,
          username: state.username,
          password: state.password,
          faceEmbeddings,
          facePhoto: facePhotos[0] ?? state.face[0],
        }),
      });
      const data = await parseJson<{ error?: string; errors?: string[]; studentId?: string }>(res);
      if (!res.ok) {
        const msgs: string[] = Array.isArray(data?.errors)
          ? data.errors
          : [data?.error ?? "Could not create the account."];
        setErrors(msgs);
        // Send the admin back to the step that owns the problem. A rejected
        // face sample used to be reported on the username/password step, so a
        // student who had entered perfectly good details was told to check
        // their username while the real complaint — too few face photos — was
        // shown three screens away, and the account simply never appeared.
        // The captured photos are kept in state, so returning to step 4 lets
        // them add the missing ones instead of starting over.
        const faceProblem = msgs.some((m) => /face|embedding|sample|photo|selfie/i.test(String(m)));
        setStep(faceProblem ? 4 : 3);
        return;
      }
      if (data?.studentId) setDone({ studentId: data.studentId });
      setStep(5);
    } catch (e) {
      // A thrown message is the specific one we raised (a slow or unreachable
      // face service); anything else is a genuine network fault. Reporting both
      // as "Network error" is what made this look like the button had done
      // nothing at all.
      setErrors([e instanceof Error && e.message ? e.message : "Network error. Please try again."]);
    } finally {
      setSubmitting(false);
      setStatus("");
    }
  }

  if (done) {
    return (
      <Card className="glass max-w-md w-full">
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-400" />
          <h2 className="text-xl font-bold">
            {onSuccess ? "Student created successfully" : "Registered successfully"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {onSuccess
              ? "The student account is active. They can now log in with their username, password and face."
              : "Your face has been enrolled and linked to your account. You can now log in with your username, password and face."}
          </p>
          {onSuccess ? (
            <Button className="mt-6 w-full" onClick={() => onSuccess(done)}>
              Done
            </Button>
          ) : (
            <Button className="mt-6 w-full" asChild>
              <a href="/login">Go to login</a>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-accent" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* stepper */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <React.Fragment key={n}>
              <div
                className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold transition-colors ${
                  step === n
                    ? "bg-primary text-primary-foreground"
                    : step > n
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {step > n ? <CheckCircle2 className="h-4 w-4" /> : n}
              </div>
              {n < 4 && <div className="h-px flex-1 bg-border" />}
            </React.Fragment>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Full name</Label>
              <Input
                value={state.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="e.g. Arya Sharma"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Class</Label>
              <Select
                value={state.classRoomId || undefined}
                onValueChange={(v) => {
                  set("classRoomId", v);
                  set("stream", "");
                  set("subjectIds", []);
                }}
                disabled={loadingOptions}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={loadingOptions ? "Loading classes…" : "Select your class"} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedClass?.hasStreams && (
              <div>
                <Label>Stream</Label>
                <Select
                  value={state.stream || undefined}
                  onValueChange={(v) => set("stream", v as WizardState["stream"])}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Choose your stream" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STREAMS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Subjects</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Select one or more subjects for this class.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {selectedClass?.subjects.map((s) => (
                  <label
                    key={s.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
                      state.subjectIds.includes(s.id)
                        ? "border-primary/60 bg-primary/10"
                        : "border-border hover:bg-secondary/40"
                    }`}
                  >
                    <Checkbox
                      checked={state.subjectIds.includes(s.id)}
                      onCheckedChange={() => toggleSubject(s.id)}
                    />
                    <span>{s.name}</span>
                  </label>
                ))}
                {selectedClass && selectedClass.subjects.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No subjects assigned to this class yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>School name</Label>
              <Input
                value={state.schoolName}
                onChange={(e) => set("schoolName", e.target.value)}
                placeholder="e.g. Delhi Public School"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>School status</Label>
              <div className="mt-1.5 flex gap-2">
                <Button
                  type="button"
                  variant={state.schoolStatus === "CURRENT" ? "default" : "outline"}
                  size="sm"
                  onClick={() => set("schoolStatus", "CURRENT")}
                >
                  Currently studying
                </Button>
                <Button
                  type="button"
                  variant={state.schoolStatus === "PAST" ? "default" : "outline"}
                  size="sm"
                  onClick={() => set("schoolStatus", "PAST")}
                >
                  Studied earlier
                </Button>
              </div>
            </div>
            {state.schoolStatus === "PAST" && (
              <div>
                <Label>Class studied in that school</Label>
                <Input
                  value={state.schoolClassHistory}
                  onChange={(e) => set("schoolClassHistory", e.target.value)}
                  placeholder="e.g. Class 10"
                  className="mt-1.5"
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Email ID</Label>
                <Input
                  type="email"
                  value={state.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Phone number</Label>
                <Input
                  value={state.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+91 …"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label>Username</Label>
              <Input
                value={state.username}
                onChange={(e) => set("username", e.target.value)}
                placeholder="4-32 characters (letters, numbers, _ .)"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={state.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1.5"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Capture{" "}
              <Badge variant="info">
                {state.face.length}/{FACE_CONFIG.ENROLL_SAMPLES}+
              </Badge>{" "}
              clear face samples — press <strong>Start scan</strong> to take them automatically, or
              upload face photos. The scan takes a few extra frames and keeps only the ones that
              agree, so one blurry shot never fails the enrollment. The Leou AI engine formats and
              trains every sample for secure face login (liveness is enforced at login with
              anti-spoofing).
              <span className="mt-1 block">
                Please capture these live, in good lighting, with only the student in the frame.
                Anti-spoof only runs at sign-in, so a photo of someone else can be enrolled here but
                will be refused when that person tries to log in.
              </span>
            </div>
            <FaceSampleCapture
              samples={FACE_CONFIG.ENROLL_SAMPLES}
              minSamples={FACE_CONFIG.ENROLL_SAMPLES}
              onComplete={(photos) => {
                set("face", photos);
              }}
            />
          </div>
        )}

        {/* Shown on every step, not just the credentials one. A rejected face
            sample sends the admin back to the capture step, so a panel that
            only rendered alongside the username form meant the one screen that
            needed explaining was the single screen that showed nothing - the
            spinner stopped, no message appeared, and the account silently
            failed to be created. */}
        {errors.length > 0 && (
          <div
            role="alert"
            aria-live="assertive"
            className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3"
          >
            {errors.map((e) => (
              <p key={e} className="text-sm text-destructive">
                {e}
              </p>
            ))}
          </div>
        )}

        {step === 5 && (
          <p className="text-sm text-muted-foreground">Processing…</p>
        )}

        {submitting && status && (
          <p
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            {status}
          </p>
        )}

        <div className="flex items-center justify-between pt-2">
          {step > 1 && step < 5 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            {step < 4 && (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {step === 4 && (
              <Button onClick={submit} disabled={submitting || state.face.length < FACE_CONFIG.ENROLL_SAMPLES}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create account
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}