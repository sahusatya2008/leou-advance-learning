"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SERVICE_CONTACT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { fetchWithRetry, friendlyError, parseJson } from "@/lib/fetchWithRetry";
import { CheckCircle2, Loader2, Phone, Wallet, KeyRound, ChevronLeft, ChevronRight, ArrowRight, Lock, PenLine } from "lucide-react";

const inr = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");

type PricedTopic = { id: string; name: string; assignmentRate: number; mockRate: number; testRate: number };
type TutoringRateInfo = {
  hourlyRate: number | null;
  weeklyClasses: number | null;
  weeklyRate: number | null;
  monthlyDaysPerWeek: number | null;
  monthlyRate: number | null;
} | null;
type OptionSubject = {
  id: string;
  name: string;
  batchId?: string | null;
  batchName?: string | null;
  topics?: PricedTopic[];
  tutoring?: TutoringRateInfo;
};
type OptionClass = { id: string; name: string; hasStreams: boolean; subjects: OptionSubject[] };
type Options = { boards: { id: string; name: string }[]; classes: OptionClass[] };

function parseTopics(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
function hasTopic(value: string, name: string) {
  return parseTopics(value).some((t) => t.toLowerCase() === name.toLowerCase());
}
function toggleTopic(current: string, name: string): string {
  const parts = parseTopics(current);
  const next = parts.filter((t) => t.toLowerCase() !== name.toLowerCase());
  if (next.length === parts.length) next.push(name);
  return next.join(", ");
}

type KindQuote = { configured: boolean; items: { name: string; rate: number }[]; total: number; residual: string[] };
type SubjectQuote = {
  subjectId: string;
  subjectName: string;
  batchId: string | null;
  batchName: string | null;
  assignment: KindQuote;
  mock: KindQuote;
  test: KindQuote;
  tutoring: { configured: boolean; plan: string; hours: number | null; rate: number; total: number } | null;
};
type Quotation = {
  perSubject: SubjectQuote[];
  totals: { assignment: number; mock: number; test: number; tutoring: number; grand: number };
  warnings: string[];
  // Present only on a top-up: what the plan already costs, so the student can
  // see the base plan being taken off rather than trust that it happened.
  currentTotal?: number;
};

type ActivePlan = {
  subjects: string[];
  wantAssignments: boolean;
  assignmentTopics: string[];
  wantMockTests: boolean;
  mockTopics: string[];
  wantRealTests: boolean;
  testTopics: string[];
  wantTutoring: boolean;
  subjectTopics: Record<string, { assignment: string[]; mock: string[]; test: string[] }>;
  // The class/board the running plan was bought for, so a top-up opens on the
  // current selection instead of an empty "pick your class" screen.
  classRoomId?: string | null;
  boardId?: string | null;
};

type SubjectTopicsInput = Record<string, { assignment?: string | string[]; mock?: string | string[]; test?: string | string[] }>;

type SavedRequest = {
  id: string;
  status: "REQUESTED" | "BILLED" | "ACTIVATED";
  boardId: string;
  classRoomId: string;
  subjectIds: string[];
  wantAssignments: boolean;
  assignmentTopics: string;
  wantMockTests: boolean;
  mockTopics: string;
  wantRealTests: boolean;
  testTopics: string;
  sameTopicsForMockTests: boolean;
  wantTutoring: boolean;
  tutorSubjects: string[];
  tutorGoals: string;
  tutorPlan: string | null;
  tutorHours: number | null;
  amount: number | null;
  breakdown: Quotation | null;
  locked: boolean;
  subjectTopics: SubjectTopicsInput | null;
};

type ServiceState = {
  onboardingRequired: boolean;
  active: boolean;
  activatedAt: string | null;
  expiresAt: string | null;
  harderRedirect: boolean;
  softLock: boolean;
  profile: { classRoomId: string; fullName: string } | null;
  latestRequest: { id: string; status: string; amount: number | null } | null;
};

const STEP_LABELS = ["Your details", "Choose services", "Quotation & payment"];

/**
 * "initial" is a first purchase; "additional" tops up a plan that is already
 * running. Both walk the same screens because the student is doing the same
 * thing in both cases - deciding what they want - but the additional flow
 * bills only the difference and ends at Pay Now instead of a redeem code.
 * "renewal" renews the whole plan or, when renewalTarget names one live
 * activation, only that subscription (its old window is ended on approval).
 */
export function OnboardingWizard({
  mode = "initial",
  renewalTarget = null,
}: {
  mode?: "initial" | "additional" | "renewal";
  renewalTarget?: {
    activationId: string;
    boardId?: string;
    classRoomId?: string;
    subjectIds: string[];
    wantAssignments: boolean;
    wantMockTests: boolean;
    wantRealTests: boolean;
    sameTopicsForMockTests: boolean;
    wantTutoring: boolean;
    tutorSubjects: string[];
    tutorGoals: string;
    tutorPlan: string | null;
    tutorHours: number | null;
    subjectTopics: SubjectTopicsInput | null;
    assignmentTopics: string;
    mockTopics: string;
    testTopics: string;
  } | null;
}) {
  const isAdditional = mode === "additional";
  const isRenewal = mode === "renewal";
  // Both later modes edit an existing plan rather than buying the first one.
  const isEdit = isAdditional || isRenewal;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<Options | null>(null);
  const [state, setState] = useState<ServiceState | null>(null);
  const [saved, setSaved] = useState<SavedRequest | null>(null);
  // The student's current active plan (union across live requests). Needed by
  // additional/renewal modes to pre-fill the form and to lock already-availed
  // chapters so they cannot be dropped by accident.
  const [plan, setPlan] = useState<ActivePlan | null>(null);

  const [boardId, setBoardId] = useState("");
  const [classRoomId, setClassRoomId] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [wantAssignments, setWantAssignments] = useState(false);
  // Chapters per subject, e.g. { "<subjectId>": { assignment: "Ch 1, Ch 2", ... } }.
  // This is the authority for what the student selected for each subject - a
  // single flat list applied to every subject was exactly why one subject's
  // chapter could be billed (and later granted) in another subject by mistake.
  const [topicInputs, setTopicInputs] = useState<Record<string, { assignment: string; mock: string; test: string }>>({});
  const [wantMockTests, setWantMockTests] = useState(false);
  const [sameTopicsForMockTests, setSameTopicsForMockTests] = useState(false);
  const [wantRealTests, setWantRealTests] = useState(false);
  const [wantTutoring, setWantTutoring] = useState(false);
  const [tutorSubjects, setTutorSubjects] = useState<string[]>([]);
  const [tutorGoals, setTutorGoals] = useState("");
  const [tutorPlan, setTutorPlan] = useState<"HOURLY" | "WEEKLY" | "MONTHLY">("MONTHLY");
  const [tutorHours, setTutorHours] = useState(1);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Pricing detail that belongs with a failed submission. The server separates
  // "nothing new" from "new but unpriced"; without showing the reasons, both
  // collapse into one opaque sentence and the student cannot tell what to fix.
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([]);
  const [activated, setActivated] = useState<string | null>(null);
  // The id the last submit actually created or updated. `saved` can still be
  // pointing at an older request, and a top-up or renewal creates a brand new
  // one, so the student must be sent to pay against this instead.
  const [payRequestId, setPayRequestId] = useState<string | null>(null);
  // Payment-lock UX: the quotation is frozen on the server once this is true,
  // so the page shows a locked banner instead of edit/pay actions.
  const [requestLocked, setRequestLocked] = useState(false);
  // Step 3's "Pay now" opens a bill preview with Edit / Lock before any money
  // moves; this holds whether that preview is on screen.
  const [confirming, setConfirming] = useState(false);
  const [locking, setLocking] = useState(false);

  function setSubjectTopic(sid: string, key: "assignment" | "mock" | "test", value: string) {
    setTopicInputs((prev) => ({
      ...prev,
      [sid]: {
        assignment: prev[sid]?.assignment ?? "",
        mock: prev[sid]?.mock ?? "",
        test: prev[sid]?.test ?? "",
        [key]: value,
      },
    }));
  }
  function subjectTopic(sid: string, key: "assignment" | "mock" | "test"): string {
    return topicInputs[sid]?.[key] ?? "";
  }
  // For the legacy flat fields in the payload (the server trusts subjectTopics,
  // but the union keeps the model readable everywhere else).
  function topicUnion(key: "assignment" | "mock" | "test"): string {
    return subjectIds
      .map((sid) => subjectTopic(sid, key))
      .filter(Boolean)
      .join(", ");
  }
  // Rebuild per-subject topic strings from either the per-subject map the API
  // returns (a saved request or the active plan) or, when it is missing, the
  // flat legacy fields applied to every selected subject.
  function topicsForSubjects(
    subjectIds: string[],
    map: SubjectTopicsInput | null | undefined,
    fallback: { assignment: string; mock: string; test: string }
  ): Record<string, { assignment: string; mock: string; test: string }> {
    const out: Record<string, { assignment: string; mock: string; test: string }> = {};
    const join = (v: string | string[] | undefined): string =>
      Array.isArray(v) ? v.join(", ") : typeof v === "string" ? v : "";
    for (const sid of subjectIds) {
      const e = map?.[sid];
      out[sid] = e
        ? { assignment: join(e.assignment), mock: join(e.mock), test: join(e.test) }
        : { ...fallback };
    }
    return out;
  }
  // Chapters the student already paid for, per subject - in additional mode
  // these must stay un-clickable so they cannot quietly drop something live.
  const paidTopics = useMemo(() => {
    const map: Record<string, { assignment: Set<string>; mock: Set<string>; test: Set<string> }> = {};
    const src = (isEdit ? plan?.subjectTopics ?? {} : {}) as ActivePlan["subjectTopics"];
    for (const [sid, v] of Object.entries(src)) {
      const clean = (arr: string[] | undefined) => new Set((arr ?? []).map((t) => t.toLowerCase()));
      // Trust the per-subject map when the plan has one; otherwise nothing is
      // "already availed" at chapter level and behaviour stays lenient.
      map[sid] = { assignment: clean(v?.assignment), mock: clean(v?.mock), test: clean(v?.test) };
    }
    return map;
  }, [isEdit, plan]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [oRes, sRes] = await Promise.all([
          fetchWithRetry("/api/student/onboarding/options"),
          fetchWithRetry("/api/student/onboarding"),
        ]);
        const optionsJson = await parseJson<Options>(oRes);
        const stateJson = await parseJson<{ state: ServiceState; services?: ActivePlan; request?: SavedRequest }>(sRes);
        if (cancelled) return;
        setOptions(optionsJson);
        setState(stateJson.state);
        // In additional mode the tick-boxes must start from what the student
        // actually holds (the union across their live requests), not from the
        // most recent request - otherwise saving would look like a cancellation.
        // A subset renewal loads ONLY the subscription being renewed, not the
        // union of everything live - the diff is computed against that one
        // window, and the old window is retired when the renewal is approved.
        if (isRenewal && renewalTarget) {
          if (renewalTarget.boardId) setBoardId(renewalTarget.boardId);
          if (renewalTarget.classRoomId) setClassRoomId(renewalTarget.classRoomId);
          setSubjectIds(renewalTarget.subjectIds);
          setWantAssignments(renewalTarget.wantAssignments);
          setWantMockTests(renewalTarget.wantMockTests);
          setWantRealTests(renewalTarget.wantRealTests);
          setSameTopicsForMockTests(renewalTarget.sameTopicsForMockTests);
          setWantTutoring(renewalTarget.wantTutoring);
          setTutorSubjects(renewalTarget.tutorSubjects ?? []);
          setTutorGoals(renewalTarget.tutorGoals ?? "");
          if (renewalTarget.tutorPlan === "HOURLY" || renewalTarget.tutorPlan === "WEEKLY") setTutorPlan(renewalTarget.tutorPlan);
          if (renewalTarget.tutorHours) setTutorHours(renewalTarget.tutorHours);
          setTopicInputs(
            topicsForSubjects(
              renewalTarget.subjectIds,
              renewalTarget.subjectTopics,
              {
                assignment: renewalTarget.assignmentTopics,
                mock: renewalTarget.sameTopicsForMockTests ? renewalTarget.assignmentTopics : renewalTarget.mockTopics,
                test: renewalTarget.sameTopicsForMockTests ? renewalTarget.assignmentTopics : renewalTarget.testTopics,
              }
            )
          );
        } else if (isEdit && stateJson.services) {
          const a = stateJson.services as ActivePlan;
          setPlan(a);
          // Prefill the running plan's board/class. Without this the class Select
          // starts empty, its onValueChange fires setSubjectIds([]) when the
          // student re-picks it, and every already-availed subject ends up locked
          // AND unticked - unselectable, with no chapter editor to add to.
          if (a.boardId) setBoardId(a.boardId);
          if (a.classRoomId) setClassRoomId(a.classRoomId);
          if (a.subjects.length > 0) {
            setSubjectIds(a.subjects);
            setWantAssignments(a.wantAssignments);
            setWantMockTests(a.wantMockTests);
            setWantRealTests(a.wantRealTests);
            setWantTutoring(a.wantTutoring);
            // Every subject gets its own chapter lists; already-availed topics
            // stay populated and locked so a top-up cannot silently drop them.
            setTopicInputs(
              topicsForSubjects(
                a.subjects,
                a.subjectTopics,
                {
                  assignment: a.assignmentTopics.join(", "),
                  mock: a.mockTopics.join(", "),
                  test: a.testTopics.join(", "),
                }
              )
            );
          }
        } else if (stateJson.request) {
          const r: SavedRequest = stateJson.request;
          setSaved(r);
          setBoardId(r.boardId);
          setClassRoomId(r.classRoomId);
          setSubjectIds(r.subjectIds);
          setWantAssignments(r.wantAssignments);
          setSameTopicsForMockTests(r.sameTopicsForMockTests);
          setWantMockTests(r.wantMockTests);
          setWantRealTests(r.wantRealTests);
          setWantTutoring(r.wantTutoring);
          setTutorSubjects(r.tutorSubjects);
          setTutorGoals(r.tutorGoals);
          if (r.tutorPlan === "HOURLY" || r.tutorPlan === "WEEKLY") setTutorPlan(r.tutorPlan);
          if (r.tutorHours) setTutorHours(r.tutorHours);
          // Rebuild the per-subject editors; the flat fields are only a union
          // fallback for requests saved before the split.
          setTopicInputs(
            topicsForSubjects(
              r.subjectIds,
              r.subjectTopics,
              {
                assignment: r.assignmentTopics,
                mock: r.sameTopicsForMockTests ? r.assignmentTopics : r.mockTopics,
                test: r.sameTopicsForMockTests ? r.assignmentTopics : r.testTopics,
              }
            )
          );
          setRequestLocked(r.locked);
          // Land straight on the quotation when there is money still to pay.
          // Coming back to a step-1 form after submitting left the student with
          // no obvious route to the Pay Now button for their own request.
          if (r.breakdown && r.status !== "ACTIVATED") {
            setQuotation(r.breakdown);
            setSaved({ ...r, amount: r.amount ?? r.breakdown.totals.grand });
            // Record which request this quotation belongs to. Without this the
            // returning student lands on the quotation with no Pay Now button:
            // the card is gated on payRequestId, and only a fresh submit used to
            // set it, so anyone who closed the tab and came back was stuck.
            setPayRequestId(r.id);
            setStep(2);
          }
        } else if (stateJson.state?.profile?.classRoomId) {
          setClassRoomId(stateJson.state.profile.classRoomId);
        }

        // An unpaid top-up or renewal is just as unpayable without a button,
        // and the edit branch needs the request id recorded - a student who
        // submitted and came back should land on their quotation, not a plan
        // that looks like a cancellation.
        if (isEdit) {
          const pending = stateJson.request as SavedRequest | null;
          if (pending?.breakdown && pending.status !== "ACTIVATED") {
            setQuotation(pending.breakdown);
            setSaved({ ...pending, amount: pending.amount ?? pending.breakdown.totals.grand });
            setPayRequestId(pending.id);
            setRequestLocked(pending.locked);
            setStep(2);
          }
        }
      } catch {
        if (!cancelled) setError("Failed to load. Please refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, isRenewal, renewalTarget]);

  const classes = useMemo(() => options?.classes ?? [], [options]);
  const chosenClass = useMemo(() => classes.find((c) => c.id === classRoomId) ?? null, [classes, classRoomId]);
  const subjectOptions = useMemo(() => chosenClass?.subjects ?? [], [chosenClass]);
  const filteredTutorSubjects = useMemo(() => tutorSubjects.filter((s) => subjectIds.includes(s)), [tutorSubjects, subjectIds]);

  function chipsFor(sid: string, kind: "assignment" | "mock" | "test") {
    const s = subjectOptions.find((x) => x.id === sid);
    if (!s) return [];
    const topics = s.topics ?? [];
    return topics
      .map((t) => ({
        name: t.name,
        rate: kind === "assignment" ? t.assignmentRate : kind === "mock" ? t.mockRate : t.testRate,
      }))
      .filter((i) => i.name.trim().length > 0);
  }

  function toggleSubject(id: string) {
    // In additional mode a subject the student already holds cannot be unticked:
    // the form is a diff against the live plan, and removing one would read as a
    // cancellation. It can still be re-added if some other state change dropped
    // it, which is why only the removal is blocked.
    const held = isEdit && !!plan?.subjects.includes(id);
    setSubjectIds((prev) =>
      prev.includes(id) ? (held ? prev : prev.filter((s) => s !== id)) : [...prev, id]
    );
  }
  function toggleTutorSubject(id: string) {
    setTutorSubjects((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  // A chapter chip caches a human-readable name + rate for a topic text; the
  // per-subject chip lists below render each subject's chapters under its own
  // heading so selection can never spill into another subject.
  const paidByKind = (sid: string, key: "assignment" | "mock" | "test") => paidTopics[sid]?.[key] ?? new Set<string>();

  /** Chapter edits may add or remove anything EXCEPT a chapter the running plan
   * already pays for. The free-text box could otherwise delete one by hand, and
   * since a top-up bills (new selection - current plan), dropping a paid chapter
   * from the new selection would quietly subtract its rate from the amount the
   * student owes. Re-adding it keeps the delta exact and makes the removal
   * impossible to express. */
  function keepPaidTopics(sid: string, key: "assignment" | "mock" | "test", value: string): string {
    const paid = paidByKind(sid, key);
    if (paid.size === 0) return value;
    const list = value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const present = new Set(list.map((t) => t.toLowerCase()));
    for (const t of paid) if (!present.has(t)) list.push(t);
    return list.join(", ");
  }
  const editTopics = (sid: string, key: "assignment" | "mock" | "test", value: string) =>
    setSubjectTopic(sid, key, keepPaidTopics(sid, key, value));

  async function submitRequest(finalStep: 0 | 1 | 2) {
    setSubmitting(true);
    setError("");
    setSubmitWarnings([]);
    try {
      const endpoint = isAdditional
        ? "/api/student/onboarding/additional"
        : isRenewal
          ? "/api/student/onboarding/renewal"
          : "/api/student/onboarding/request";
      // The reconciliation endpoint updates the SAME request when the requestId
      // points at one the student already holds (the Edit-choices hop goes back
      // to step 1 and re-runs the quotation through submitRequest), so push it
      // along from the first submit onwards.
      const requestId = payRequestId && saved ? payRequestId : undefined;
      const body: Record<string, unknown> = {
        boardId,
        classRoomId,
        subjectIds,
        wantAssignments,
        wantMockTests,
        wantRealTests,
        sameTopicsForMockTests,
        wantTutoring,
        tutorSubjects: filteredTutorSubjects,
        tutorGoals,
        tutorPlan: wantTutoring ? tutorPlan : null,
        tutorHours: wantTutoring && tutorPlan === "HOURLY" ? tutorHours : null,
        // Per-subject chapter selection - the flat fields below are just the
        // union for backward-compatible readers.
        subjectTopics: Object.fromEntries(
          subjectIds.map((sid) => [
            sid,
            {
              assignment: subjectTopic(sid, "assignment"),
              mock: subjectTopic(sid, "mock"),
              test: subjectTopic(sid, "test"),
            },
          ])
        ),
        assignmentTopics: topicUnion("assignment"),
        mockTopics: topicUnion("mock"),
        testTopics: topicUnion("test"),
      };
      if (requestId) body.requestId = requestId;
      // A subset renewal pins exactly which live window it is taking over; the
      // server only ends (and re-opens) that one when the payment is approved.
      if (isRenewal && renewalTarget) body.renewsActivationIds = [renewalTarget.activationId];
      const res = await fetchWithRetry(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseJson<{
        error?: string;
        warnings?: string[];
        unpriced?: { subjectName: string; topic: string }[];
        requestId?: string;
        quotation?: Quotation;
      }>(res);
      if (!res.ok) {
        setSubmitWarnings(Array.isArray(data?.warnings) ? data.warnings : []);
        throw new Error(data?.error ?? "Something went wrong.");
      }
      // The quotation's own warnings render in the preview below; the added
      // chapters that carry no rate do not appear anywhere else, so they are
      // called out here.
      setSubmitWarnings(
        Array.isArray(data.unpriced) && data.unpriced.length
          ? [
              `No rate is configured yet, so these were not charged: ${data.unpriced
                .map((u: { subjectName: string; topic: string }) => `${u.subjectName} - ${u.topic}`)
                .join("; ")}. Ask an admin to set prices for them.`,
            ]
          : []
      );
      if (data.requestId) setPayRequestId(data.requestId);
      if (data.quotation) setQuotation(data.quotation);
      // A fresh selection is not yet locked, so the Edit choices hop remains
      // available in the preview until the student deliberately locks it.
      setRequestLocked(false);
      setStep(finalStep);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function lockQuotation() {
    if (!payRequestId) return;
    setLocking(true);
    setError("");
    try {
      const res = await fetchWithRetry("/api/student/onboarding/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: payRequestId, lock: true }),
      });
      const data = await parseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong.");
      setRequestLocked(true);
      // Go straight to the payment page - the lock is now authoritative and the
      // amount can no longer be edited under it.
      router.push(`/dashboard/payments/${payRequestId}/pay`);
    } catch (e) {
      setError(friendlyError(e));
      setLocking(false);
    }
  }

  async function activate(code: string) {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetchWithRetry("/api/student/onboarding/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await parseJson<{ error?: string; expiresAt?: string }>(res);
      if (!res.ok) throw new Error(data?.error ?? "Wrong code.");
      if (data?.expiresAt) setActivated(data.expiresAt);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your plan…
      </div>
    );
  }

  // Active service screen. In top-up and renewal modes this must NOT short-circuit:
  // the form itself is the diff against the live plan, so an active student still
  // needs it to buy more or renew before their month runs out.
  if (state?.active && !isEdit) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" /> Your services are active
            </CardTitle>
            <CardDescription>
              {state.expiresAt ? <>Active until <span className="font-medium text-foreground">{new Date(state.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span> (1 month from activation). Renew after that.</> : "Active."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const wantsSomething = wantAssignments || wantMockTests || wantRealTests || wantTutoring;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome aboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {saved && saved.status !== "REQUESTED"
            ? "Your services were allowed by the admin. Finish payment and activate with the 15-digit access code."
            : "Tell us what services you need. The admin will price your chapters/topics and issue a 15-digit payment access code."}
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
              i === step ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                i === step ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              {i + 1}
            </span>
            {label}
          </div>
        ))}
      </div>

      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>}

      {submitWarnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-700">
          {submitWarnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      {/* Step 1 */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your admission details</CardTitle>
            <CardDescription>Select your board, class and the subjects you study.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="board">Board</Label>
                <Select value={boardId} onValueChange={setBoardId}>
                  <SelectTrigger id="board">
                    <SelectValue placeholder="Choose board" />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.boards ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="classRoom">Class</Label>
                <Select
                  value={classRoomId}
                  onValueChange={(v) => {
                    setClassRoomId(v);
                    // Subjects the running plan already holds are kept (they are
                    // locked on the chips), so switching class can never silently
                    // orphan an availed subject and hide its chapter editor. The
                    // server still rejects a class that does not offer them.
                    setSubjectIds((prev) =>
                      isEdit ? prev.filter((s) => plan?.subjects.includes(s)) : []
                    );
                  }}
                >
                  <SelectTrigger id="classRoom">
                    <SelectValue placeholder="Choose class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subjects</Label>
              {subjectOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Pick your class above to see subjects.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {subjectOptions.map((s) => {
                    const locked = isEdit && !!plan?.subjects.includes(s.id);
                    // A locked subject is always part of the selection: it is
                    // shown ticked even if some other state change momentarily
                    // dropped it, so it can never end up disabled-but-unticked.
                    const on = locked || subjectIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSubject(s.id)}
                        title={locked ? "Already part of your current plan" : undefined}
                        disabled={locked}
                        aria-pressed={on}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary",
                          locked && "cursor-not-allowed border-primary/40 bg-primary/10 text-primary/70 opacity-70"
                        )}
                      >
                        {s.name}
                        {locked && <CheckCircle2 className="ml-1 inline h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button disabled={!boardId || !classRoomId || subjectIds.length === 0} onClick={() => setStep(1)}>
                Continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Choose your services</CardTitle>
            <CardDescription>
              Select the chapters/topics priced by your academy or add your own — the admin&apos;s rates determine your bill.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <ServiceToggle
                label="AI + human-verified assignments"
                description="Regular chapter assignments marked by the AI and verified by a teacher."
                checked={wantAssignments}
                onCheckedChange={setWantAssignments}
              />
              {wantAssignments && (
                <div className="space-y-3">
                  {subjectIds.map((sid) => (
                    <TopicEditor
                      key={`assignment-${sid}`}
                      subjectName={subjectOptions.find((x) => x.id === sid)?.name ?? sid}
                      subjectId={sid}
                      kind="assignment"
                      value={subjectTopic(sid, "assignment")}
                      onChange={(v) => editTopics(sid, "assignment", v)}
                      chips={chipsFor(sid, "assignment")}
                      paid={paidByKind(sid, "assignment")}
                      placeholder="e.g. Triangles, Trigonometry, Statistics"
                    />
                  ))}
                  {subjectIds.length === 1 && (
                    <p className="text-xs text-muted-foreground">Chapters here apply only to this subject — pick each subject&apos;s own list separately.</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <ServiceToggle
                label="Mock tests"
                description="Full mock papers in your subjects."
                checked={wantMockTests}
                onCheckedChange={setWantMockTests}
              />
              {wantMockTests && !sameTopicsForMockTests && (
                <div className="space-y-3">
                  {subjectIds.map((sid) => (
                    <TopicEditor
                      key={`mock-${sid}`}
                      subjectName={subjectOptions.find((x) => x.id === sid)?.name ?? sid}
                      subjectId={sid}
                      kind="mock"
                      value={subjectTopic(sid, "mock")}
                      onChange={(v) => editTopics(sid, "mock", v)}
                      chips={chipsFor(sid, "mock")}
                      paid={paidByKind(sid, "mock")}
                      placeholder="e.g. Algebra, Probability"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <ServiceToggle
                label="Real tests with moderation & analysis"
                description="Timed tests moderated by staff, with a full performance analysis."
                checked={wantRealTests}
                onCheckedChange={setWantRealTests}
              />
              {wantRealTests && !sameTopicsForMockTests && (
                <div className="space-y-3">
                  {subjectIds.map((sid) => (
                    <TopicEditor
                      key={`test-${sid}`}
                      subjectName={subjectOptions.find((x) => x.id === sid)?.name ?? sid}
                      subjectId={sid}
                      kind="test"
                      value={subjectTopic(sid, "test")}
                      onChange={(v) => editTopics(sid, "test", v)}
                      chips={chipsFor(sid, "test")}
                      paid={paidByKind(sid, "test")}
                      placeholder="e.g. Algebra, Probability"
                    />
                  ))}
                </div>
              )}
            </div>

            {(wantMockTests || wantRealTests) && (
              <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
                <Checkbox
                  checked={sameTopicsForMockTests}
                  onCheckedChange={(v) => setSameTopicsForMockTests(v === true)}
                />
                <span className="text-muted-foreground">
                  Use the <span className="font-medium text-foreground">same chapters & topics as assignments</span> for
                  my mock and real tests.
                </span>
              </label>
            )}

            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-base">Online learning from a teacher</Label>
                  <p className="text-sm text-muted-foreground">Regular classes on fixed hours with a real teacher.</p>
                </div>
                <Switch checked={wantTutoring} onCheckedChange={setWantTutoring} />
              </div>

              {wantTutoring && (
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Subjects to learn</Label>
                    <div className="flex flex-wrap gap-2">
                      {subjectOptions.map((s) => {
                        const on = tutorSubjects.includes(s.id);
                        const allowed = subjectIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={!allowed}
                            onClick={() => toggleTutorSubject(s.id)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                              !allowed
                                ? "cursor-not-allowed border-border text-muted-foreground/50"
                                : on
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border hover:bg-secondary"
                            )}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                    {subjectOptions
                      .filter((s) => tutorSubjects.includes(s.id) && s.tutoring)
                      .map((s) => {
                        const t = s.tutoring!;
                        const configured =
                          t.hourlyRate != null || t.weeklyRate != null || t.monthlyRate != null;
                        return (
                          <div key={s.id} className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{s.name}:</span>
                            {t.hourlyRate != null && <Badge variant="outline">{inr(t.hourlyRate)}/hour</Badge>}
                            {t.weeklyRate != null && (
                              <Badge variant="outline">
                                {inr(t.weeklyRate)}/week{t.weeklyClasses ? ` (${t.weeklyClasses} classes)` : ""}
                              </Badge>
                            )}
                            {t.monthlyRate != null && (
                              <Badge variant="outline">
                                {inr(t.monthlyRate)}/month{t.monthlyDaysPerWeek ? ` (${t.monthlyDaysPerWeek} days/week)` : ""}
                              </Badge>
                            )}
                            {!configured && <span>No admin rate yet</span>}
                          </div>
                        );
                      })}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goals">What do you want to learn?</Label>
                    <Textarea
                      id="goals"
                      value={tutorGoals}
                      onChange={(e) => setTutorGoals(e.target.value)}
                      placeholder="e.g. I want to improve my algebra and geometry before board exams."
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="plan">Billing plan</Label>
                      <Select
                        value={tutorPlan}
                        onValueChange={(v) => setTutorPlan(v as "HOURLY" | "WEEKLY" | "MONTHLY")}
                      >
                        <SelectTrigger id="plan">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HOURLY">Per hour</SelectItem>
                          <SelectItem value="WEEKLY">Per week</SelectItem>
                          <SelectItem value="MONTHLY">Per month</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {tutorPlan === "HOURLY" && (
                      <div className="space-y-2">
                        <Label htmlFor="hours">Number of hours</Label>
                        <Input
                          id="hours"
                          type="number"
                          min={1}
                          value={tutorHours}
                          onChange={(e) => setTutorHours(Math.max(1, Number(e.target.value) || 1))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button
                disabled={!wantsSomething || submitting}
                onClick={() => submitRequest(2)}
                className="gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                Get my quotation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 */}
      {step === 2 && quotation && (
        <>
          <PreviewRequest form={{ boardId, classRoomId, subjectIds, wantAssignments, subjectTopics: Object.fromEntries(subjectIds.map((sid) => [sid, { assignment: subjectTopic(sid, "assignment"), mock: subjectTopic(sid, "mock"), test: subjectTopic(sid, "test") }])), wantMockTests, wantRealTests, sameTopicsForMockTests, wantTutoring, tutorSubjects: filteredTutorSubjects, tutorGoals, tutorPlan, tutorHours }} classes={classes} options={options} />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your quotation</CardTitle>
              <CardDescription>
                {isAdditional
                  ? "You already pay for some of this, so you are only charged for what is new. Everything you selected stays on your plan either way."
                  : isRenewal
                    ? "The whole next month, at the admin's current rates. Anything you removed here ends with your current month."
                    : "Rates set by the admin for each chapter/topic you listed."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {quotation.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
                  {quotation.warnings.map((w, i) => (
                    <p key={i}>• {w}</p>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                {quotation.perSubject.map((q) => (
                  <div key={q.subjectId} className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium">{q.subjectName}</span>
                      {q.batchName && <Badge variant="outline">{q.batchName}</Badge>}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <KindCell title="Assignments" kind={q.assignment} />
                      <KindCell title="Mock tests" kind={q.mock} />
                      <KindCell title="Real tests" kind={q.test} />
                    </div>

                    {q.tutoring && (
                      <div className="mt-3 flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2 text-sm">
                        <span>
                          Tuition · {q.tutoring.plan === "HOURLY" ? `${q.tutoring.hours} hour(s)` : q.tutoring.plan === "WEEKLY" ? "per week" : "per month"}
                        </span>
                        <span className="font-medium">{inr(q.tutoring.total)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Assignments</span><span>{inr(quotation.totals.assignment)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Mock tests</span><span>{inr(quotation.totals.mock)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Real tests</span><span>{inr(quotation.totals.test)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Learning from teacher</span><span>{inr(quotation.totals.tutoring)}</span></div>
                </div>
                <SeparatorLine />
                {isAdditional && quotation.currentTotal !== undefined && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Your current plan costs</span>
                    <span className="line-through">{inr(Number(quotation.currentTotal))}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-base">
                  <span className="font-semibold">
                    {isAdditional
                      ? "To pay for the new services"
                      : isRenewal
                        ? "Total for next month"
                        : "Total to pay"}
                  </span>
                  <span className="text-xl font-semibold text-primary">{inr(quotation.totals.grand)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {payRequestId && !requestLocked && !confirming && (
            <PayNowCard amount={quotation.totals.grand} onProceed={() => setConfirming(true)} />
          )}

          {payRequestId && !requestLocked && confirming && (
            <Card className="border-primary/40">
              <CardHeader>
                <CardTitle className="text-lg">Preview of your bill</CardTitle>
                <CardDescription>
                  Check the total before you commit. Once locked, this selection is frozen until an admin approves or rejects the payment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-secondary/40 p-4">
                  <p className="text-sm text-muted-foreground">Total to pay</p>
                  <p className="text-3xl font-bold text-primary">{inr(quotation.totals.grand)}</p>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={locking}
                    onClick={() => {
                      setConfirming(false);
                      setStep(1);
                    }}
                  >
                    <PenLine className="mr-2 h-4 w-4" /> Edit choices
                  </Button>
                  <Button className="flex-1" disabled={locking} onClick={lockQuotation}>
                    <Lock className="mr-2 h-4 w-4" />
                    {locking ? "Locking request…" : "Lock request & pay now"}
                  </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  You will get a reference number to put in the payment so we can match it. Locking takes you straight to the payment screen.
                </p>
              </CardContent>
            </Card>
          )}

          {requestLocked && payRequestId && (
            <Card className="border-primary/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lock className="h-5 w-5" /> Your quotation is locked
                </CardTitle>
                <CardDescription>
                  This selection and amount are frozen so we can verify the exact payment. Continue to pay now — you can change services only after this payment is approved or rejected.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <span className="text-sm text-muted-foreground">Total to pay: </span>
                  <span className="text-lg font-semibold text-primary">{inr(quotation.totals.grand)}</span>
                </div>
                <Button asChild>
                  <Link href={`/dashboard/payments/${payRequestId}/pay`}>
                    Continue to payment <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {!isEdit && (
            <details className="rounded-xl border border-border bg-card">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-muted-foreground">
                Already have a 15-digit payment code?
              </summary>
              <div className="px-5 pb-5">
                <PayAndRedeem
                  amount={quotation.totals.grand}
                  saved={saved}
                  onRedeem={activate}
                  submitting={submitting}
                />
              </div>
            </details>
          )}
        </>
      )}

      {step === 2 && !quotation && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(1)}><ChevronLeft className="mr-1 h-4 w-4" /> Back</Button>
        </div>
      )}

      {activated && (
        <Card className="border-emerald-600/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" /> Payment confirmed — services activated
            </CardTitle>
            <CardDescription>
              Your selected services are now live for one month, until{" "}
              <span className="font-medium text-foreground">{new Date(activated).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>.
              Head to the dashboard to start.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/dashboard">Go to dashboard</a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ServiceToggle(props: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label className="text-base">{props.label}</Label>
          <p className="text-sm text-muted-foreground">{props.description}</p>
        </div>
        <Switch checked={props.checked} onCheckedChange={props.onCheckedChange} disabled={props.disabled} />
      </div>
    </div>
  );
}

// One subject's chapter picker for one service kind. Chapters the student
// already holds in their plan (additional/top-up mode) render disabled so a
// paid topic cannot be quietly dropped; every other topic taps in and out of
// the per-subject text input below.
function TopicEditor({
  subjectName,
  subjectId,
  kind,
  value,
  onChange,
  chips,
  paid,
  placeholder,
}: {
  subjectName: string;
  subjectId: string;
  kind: "assignment" | "mock" | "test";
  value: string;
  onChange: (v: string) => void;
  chips: { name: string; rate: number | null }[];
  paid: Set<string>;
  placeholder: string;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-secondary/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{subjectName}</span>
        <span className="text-[11px] text-muted-foreground capitalize">{kind}</span>
      </div>
      {chips.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chips.map((it) => {
            const on = hasTopic(value, it.name);
            const locked = paid.has(it.name.toLowerCase());
            return (
              <button
                key={it.name}
                type="button"
                disabled={locked}
                title={locked ? "Already part of your current plan" : undefined}
                onClick={() => onChange(toggleTopic(value, it.name))}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary",
                  locked && "cursor-not-allowed border-primary/40 bg-primary/10 text-primary/70 opacity-70"
                )}
              >
                {it.name}
                {it.rate != null ? (
                  <span className={cn("ml-1", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{inr(it.rate)}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      <Label htmlFor={`${subjectId}-${kind}`}>
        Chapters / topics <span className="font-normal text-muted-foreground">(tap priced topics above, or add any comma separated)</span>
      </Label>
      <Input
        id={`${subjectId}-${kind}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1"
      />
    </div>
  );
}

function KindCell({ title, kind }: { title: string; kind: KindQuote }) {
  const hasItems = kind.items.length > 0;
  const residual = kind.residual.length > 0;
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {!kind.configured ? (
        <p className="mt-1 text-xs text-amber-600">No matching admin rate{residual ? ` (${kind.residual.join(", ")})` : ""}</p>
      ) : (
        <div className="mt-1 space-y-1 text-sm">
          {hasItems ? (
            kind.items.map((it) => (
              <div key={it.name} className="flex justify-between">
                <span className="truncate pr-2">{it.name}</span>
                <span className="text-muted-foreground">{inr(it.rate)}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Nothing priced.</p>
          )}
        </div>
      )}
      <div className="mt-2 flex justify-between border-t border-border pt-1 text-sm font-medium">
        <span>Total</span>
        <span>{inr(kind.total)}</span>
      </div>
    </div>
  );
}

function SeparatorLine() {
  return <div className="my-3 h-px bg-border" />;
}

function PreviewRequest({
  form,
  classes,
  options,
}: {
  form: {
    boardId: string;
    classRoomId: string;
    subjectIds: string[];
    wantAssignments: boolean;
    subjectTopics: SubjectTopicsInput;
    wantMockTests: boolean;
    wantRealTests: boolean;
    sameTopicsForMockTests: boolean;
    wantTutoring: boolean;
    tutorSubjects: string[];
    tutorGoals: string;
    tutorPlan: string;
    tutorHours: number;
  };
  classes: OptionClass[];
  options: Options | null;
}) {
  const boardName = options?.boards.find((b) => b.id === form.boardId)?.name ?? "—";
  const className = classes.find((c) => c.id === form.classRoomId)?.name ?? "—";
  const subjectName = (sid: string) =>
    Array.from(new Set(classes.flatMap((c) => c.subjects.map((s) => [s.id, s.name] as const))))
      .find(([id]) => id === sid)?.[1] ?? sid;
  const topicText = (sid: string, key: "assignment" | "mock" | "test"): string => {
    const e = form.subjectTopics[sid];
    const join = (v?: string | string[]) => (Array.isArray(v) ? v.join(", ") : typeof v === "string" ? v : "");
    if (e) return join(e[key]);
    return "";
  };
  const subjectNames = Array.from(
    new Set(
      classes
        .flatMap((c) => c.subjects)
        .filter((s) => form.subjectIds.includes(s.id))
        .map((s) => s.name)
    )
  );
  return (
    <Card>
      <CardContent className="space-y-3 pt-6 text-sm">
        <div className="grid gap-1 sm:grid-cols-2">
          <div><span className="text-muted-foreground">Board: </span>{boardName}</div>
          <div><span className="text-muted-foreground">Class: </span>{className}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {subjectNames.map((n) => <Badge key={n} variant="secondary">{n}</Badge>)}
        </div>
        <div className="space-y-1 text-muted-foreground">
          {form.wantAssignments && (
            <div className="space-y-0.5">
              <div>• Assignments</div>
              {form.subjectIds.map((sid) => (
                <div key={sid} className="pl-4">
                  <span className="font-medium text-foreground">{subjectName(sid)}:</span> {topicText(sid, "assignment") || "—"}
                </div>
              ))}
            </div>
          )}
          {form.wantMockTests && (
            <div className="space-y-0.5">
              <div>• Mock tests</div>
              {form.subjectIds.map((sid) => (
                <div key={sid} className="pl-4">
                  <span className="font-medium text-foreground">{subjectName(sid)}:</span>{" "}
                  {form.sameTopicsForMockTests ? `same as assignments (${topicText(sid, "assignment") || "—"})` : topicText(sid, "mock") || "—"}
                </div>
              ))}
            </div>
          )}
          {form.wantRealTests && (
            <div className="space-y-0.5">
              <div>• Real tests</div>
              {form.subjectIds.map((sid) => (
                <div key={sid} className="pl-4">
                  <span className="font-medium text-foreground">{subjectName(sid)}:</span>{" "}
                  {form.sameTopicsForMockTests ? `same as assignments (${topicText(sid, "assignment") || "—"})` : topicText(sid, "test") || "—"}
                </div>
              ))}
            </div>
          )}
          {form.wantTutoring && (
            <div>
              • Learning from teacher: {form.tutorSubjects.length} subject(s), {form.tutorPlan === "HOURLY" ? `${form.tutorHours} h` : form.tutorPlan.toLowerCase()}
              {form.tutorGoals ? <> — “{form.tutorGoals}”</> : null}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The pay call to action shown under every quotation.
 *
 * This is the step the whole flow exists for: the amount, a button into the page
 * that carries the QR code and UPI id, and a plain statement of what happens next.
 * The legacy 15-digit code is no longer the primary route - an admin approving the
 * payment is - so the code box is tucked away behind a disclosure above.
 */
function PayNowCard({ amount, onProceed }: { amount: number; onProceed: () => void }) {
  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-lg">Pay now</CardTitle>
        <CardDescription>
          You will see a preview of this bill with an “Edit choices” option before anything locks in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-secondary/40 p-4">
          <p className="text-sm text-muted-foreground">Amount to pay</p>
          <p className="text-3xl font-bold text-primary">{inr(amount)}</p>
        </div>
        <Button size="lg" className="w-full" onClick={onProceed}>
          Pay {inr(amount)} &amp; upload proof <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          You will get a reference number to put in the payment so we can match it.
        </p>
      </CardContent>
    </Card>
  );
}

function PayAndRedeem({
  amount,
  saved,
  submitting,
  onRedeem,
}: {
  amount: number;
  saved: SavedRequest | null;
  submitting: boolean;
  onRedeem: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const billed = saved?.status === "BILLED";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Payment & activation</CardTitle>
        <CardDescription>
          Pay this amount to the academy. Keep your payment success access code (15 digits) safe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Amount to pay</p>
              <p className="text-2xl font-bold text-primary">{inr(amount)}</p>
            </div>
            <Button size="lg" asChild variant="default">
              <a href={`tel:${SERVICE_CONTACT.replace(/\s/g, "")}`} className="gap-2">
                <Phone className="h-4 w-4" /> {SERVICE_CONTACT}
              </a>
            </Button>
          </div>
        </div>

        {!billed && (
          <p className="text-sm text-muted-foreground">
            After paying, the admin will allow your requested services and share a 15-digit access code. Enter it below once you receive it.
          </p>
        )}

        <div className="rounded-lg border p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-medium"
            onClick={() => setShowCode((v) => !v)}
          >
            <span className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Done payment? Enter the access code</span>
            <span>{showCode ? "hide" : "show"}</span>
          </button>
          {showCode && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 15))}
                placeholder="15-digit access code"
                inputMode="numeric"
              />
              <Button
                disabled={code.length !== 15 || submitting}
                onClick={() => onRedeem(code)}
                className="shrink-0"
              >
                {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Activate for 30 days
              </Button>
            </div>
          )}
          {billed && !showCode && (
            <p className="mt-2 text-xs text-emerald-600">Your services were allowed by the admin — open the code entry and activate.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}