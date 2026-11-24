import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { ChevronLeft, UserRound, ShieldCheck, Fingerprint, ClipboardList, TrendingUp, Trophy, BarChart3, FileText, Terminal } from "lucide-react";
import StudentStatusBadge from "@/components/admin/students/StatusBadge";
import AccessCodeButton from "@/components/admin/students/AccessCodeButton";
import ServiceOnboardingCard from "@/components/admin/students/ServiceOnboardingCard";
import StudentStatusActions from "@/components/admin/students/StudentStatusActions";
import StudentEditDialog from "@/components/admin/students/StudentEditDialog";
import BatchAssignment from "@/components/admin/students/BatchAssignment";
import StudentActivityLog from "@/components/admin/students/StudentActivityLog";
import FaceReEnrollButton from "@/components/admin/students/FaceReEnrollButton";
import { RevealSecret } from "@/components/admin/RevealSecret";
import { FACE_CONFIG } from "@/lib/constants";
import { kindBadge } from "@/lib/assessmentConstants";

export const dynamic = "force-dynamic";

export default async function ManageStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const student = await prisma.user.findUnique({
    where: { id },
    include: {
      studentProfile: {
        include: {
          classRoom: true,
          batches: { include: { batch: { include: { subjects: { include: { subject: true } } } } } },
          payments: true,
          parent: { include: { user: { select: { id: true, username: true } } } },
        },
      },
    },
  });

  if (!student || !student.studentProfile) notFound();

  const prof = student.studentProfile;
  const faceCount = Array.isArray(prof.faceEmbeddings) ? prof.faceEmbeddings.length : 0;
  // Legacy enrollments were 128-d (browser face-api.js). The AI pipeline only
  // matches 512-d ArcFace embeddings, so those students must re-enroll.
  const firstDim = Array.isArray(prof.faceEmbeddings) && Array.isArray((prof.faceEmbeddings as unknown[])[0])
    ? ((prof.faceEmbeddings as unknown[])[0] as unknown[]).length
    : 0;
  const legacyFormat = faceCount > 0 && firstDim !== FACE_CONFIG.EMBEDDING_DIM;
  const enrolled = faceCount >= 3 && !legacyFormat;

  const [classBatches, classes] = await Promise.all([
    prisma.batch.findMany({
      where: { classRoomId: prof.classRoomId },
      include: { _count: { select: { students: true } }, subjects: { include: { subject: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.classRoom.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  const [submissions, records] = await Promise.all([
    prisma.submission.findMany({
      where: { studentId: prof.id },
      include: {
        assessment: {
          include: {
            questions: {
              include: { question: { select: { subject: { select: { name: true } } } } },
            },
          },
        },
        answers: true,
      },
      orderBy: { startedAt: "desc" },
      take: 60,
    }),
    prisma.reportRecord.findMany({
      where: { studentId: prof.id },
      orderBy: { releasedAt: "desc" },
      take: 40,
    }),
  ]);

  const released = submissions.filter((s) => s.totalScore != null && s.releasedAt);
  const attemptsCount = submissions.length;
  const inProgressCount = submissions.filter((s) => s.status === "IN_PROGRESS").length;
  const pendingGrading = submissions.filter((s) => s.status === "SUBMITTED").length;
  const releasedMarks = released.reduce((acc, s) => acc + s.totalScore!, 0);
  const releasedMax = released.reduce((acc, s) => acc + s.assessment.totalMarks, 0);
  const avgPct = releasedMax ? Math.round((releasedMarks / releasedMax) * 100) : 0;
  const bestPct = released.length
    ? Math.round(Math.max(...released.map((s) => ((s.totalScore! / s.assessment.totalMarks) * 100 || 0))))
    : 0;

  const bySubject = new Map<string, { got: number; max: number }>();
  for (const r of released) {
    const answerByAq = new Map(r.answers.map((a) => [a.assessmentQuestionId, a]));
    for (const aq of r.assessment.questions) {
      const ans = answerByAq.get(aq.id);
      const name = aq.question.subject?.name ?? "Other";
      const entry = bySubject.get(name) ?? { got: 0, max: 0 };
      entry.max += aq.marks;
      entry.got += ans?.marksAwarded ?? 0;
      bySubject.set(name, entry);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/students">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
              <UserRound className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{prof.fullName}</h1>
                <StudentStatusBadge status={student.status} />
              </div>
              <p className="text-sm text-muted-foreground">@{student.username} · {student.email}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/students/${student.id}/practical-activity`}>
              <Terminal className="mr-1.5 h-4 w-4" /> Show Practical Activity
            </Link>
          </Button>
          <StudentEditDialog
            classes={classes.map((c) => ({ id: c.id, name: c.name, hasStreams: c.hasStreams }))}
            student={{
              id: student.id,
              fullName: prof.fullName,
              username: student.username,
              email: student.email,
              phone: student.phone ?? "",
              classRoomId: prof.classRoomId,
              stream: prof.stream ?? "",
              schoolName: prof.schoolName,
              schoolStatus: prof.schoolStatus,
              schoolClassHistory: prof.schoolClassHistory ?? "",
            }}
          />
          <StudentStatusActions id={student.id} status={student.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Enrollment & face biometrics</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={prof.facePhotoUrl} alt="Face" className="h-full w-full object-cover" />
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Fingerprint className="h-4 w-4 text-accent" />
                  <Badge variant={enrolled ? "default" : legacyFormat ? "destructive" : "outline"}>
                    {enrolled
                      ? "Enrolled"
                      : legacyFormat
                        ? "Legacy format — re-enroll"
                        : `Face samples: ${faceCount}/${FACE_CONFIG.ENROLL_SAMPLES}`}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {enrolled
                    ? "Biometrics active — face login is enabled for this account."
                    : legacyFormat
                      ? `This student was enrolled with the old ${firstDim}-d format and cannot use face login. Re-enroll with live capture or an uploaded photo.`
                      : `Gather at least 3 face samples. Face login will not match until enrolled.`}
                </p>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Student can use a 60-second access code if face verification fails.
                </p>
                <FaceReEnrollButton studentUserId={student.id} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Batch assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <BatchAssignment
                studentUserId={student.id}
                batches={classBatches.map((b) => ({
                  id: b.id,
                  name: b.name,
                  studentCount: b._count.students,
                  subjectNames: b.subjects.map((s) => s.subject.name),
                  assigned: prof.batches.some((s) => s.batchId === b.id),
                }))}
              />
            </CardContent>
          </Card>

          <StudentActivityLog studentUserId={student.id} />
        </div>

        <div className="space-y-6">
          <ServiceOnboardingCard userId={student.id} />
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Login credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Student username</span>
                  <span className="font-mono font-medium">@{student.username}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Current password</span>
                </div>
                <RevealSecret userId={student.id} />
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="font-medium">Parent access</p>
                {prof.parent ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Parent username</span>
                      <span className="font-mono font-medium">@{prof.parent.user.username}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Parent password</span>
                    </div>
                    <RevealSecret userId={prof.parent.user.id} />
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    No parent linked yet. The student can register one from their profile.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Access code</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Generate a rotating 6-digit code. Each new code invalidates the previous one and
                expires after 60 seconds.
              </p>
              <AccessCodeButton id={student.id} />
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Class</span>
                <span className="font-medium">{prof.classRoom.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stream</span>
                <span className="font-medium">{prof.stream ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">School</span>
                <span className="font-medium">{prof.schoolName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">School status</span>
                <span className="font-medium">{prof.schoolStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">{student.phone ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Joined</span>
                <span className="font-medium">{student.createdAt.toLocaleDateString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned subjects</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {prof.batches.flatMap((b) => b.batch.subjects.map((s) => s.subject.name)).filter((v, i, a) => a.indexOf(v) === i)
                  .length === 0 && <span className="text-xs text-muted-foreground">None (no batch assigned)</span>}
                {[...new Set(prof.batches.flatMap((b) => b.batch.subjects.map((s) => s.subject.name)))].map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" /> Performance & progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Attempts" value={String(attemptsCount)} icon={<ClipboardList className="h-5 w-5" />} tone="indigo" />
              <Stat label="In progress / pending grading" value={`${inProgressCount} / ${pendingGrading}`} icon={<TrendingUp className="h-5 w-5" />} tone="amber" />
              <Stat label="Average score" value={`${avgPct}%`} icon={<Trophy className="h-5 w-5" />} tone="emerald" />
              <Stat label="Best score" value={`${bestPct}%`} icon={<Trophy className="h-5 w-5" />} tone="cyan" />
            </div>

            {bySubject.size > 0 ? (
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-muted-foreground">Score by subject (published results)</p>
                {[...bySubject.entries()].map(([name, s]) => {
                  const pct = s.max ? Math.round((s.got / s.max) * 100) : 0;
                  return (
                    <div key={name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{name}</span>
                        <span className="text-xs text-muted-foreground">
                          {s.got} / {s.max} · {pct}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full ${pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No published results yet. Close and evaluate an assessment, then release results to see progress.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" /> Attempts ({submissions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {submissions.length === 0 && (
              <p className="text-sm text-muted-foreground">No assessment attempts yet.</p>
            )}
            {submissions.map((s) => (
              <Link
                key={s.id}
                href={`/admin/assessments/${s.assessmentId}/grading/${s.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/50 px-4 py-2.5 transition-colors hover:border-primary/40"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{s.assessment.title}</span>
                  <Badge variant="outline">{kindBadge(s.assessment.kind)}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant={s.status === "IN_PROGRESS" ? "secondary" : s.status === "SUBMITTED" ? "default" : "default"}>
                    {s.status.replace(/_/g, " ")}
                  </Badge>
                  {s.totalScore != null ? (
                    <span className="font-semibold">
                      {s.totalScore} <span className="font-normal">/ {s.assessment.totalMarks}</span>
                    </span>
                  ) : (
                    s.status === "EVALUATED" && <span>Ready to release</span>
                  )}
                  <span>{s.startedAt.toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Published record ({records.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {records.length === 0 && (
              <p className="text-sm text-muted-foreground">No records published yet.</p>
            )}
            {records.map((r) => {
              const s = r.summary as { totalScore?: number; totalMarks?: number; autoScore?: number; manualScore?: number } | null;
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/50 px-4 py-2.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{r.title}</span>
                    <Badge variant="outline">{r.kind.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {s?.totalScore != null && (
                      <span className="font-semibold">
                        {s.totalScore} <span className="font-normal">/ {s.totalMarks ?? "—"}</span>
                      </span>
                    )}
                    <span>Published {r.releasedAt.toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: "indigo" | "emerald" | "amber" | "cyan";
}) {
  const tones: Record<string, string> = {
    indigo: "bg-indigo-500/20 text-indigo-300",
    emerald: "bg-emerald-500/20 text-emerald-300",
    amber: "bg-amber-500/20 text-amber-300",
    cyan: "bg-cyan-500/20 text-cyan-300",
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-3">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}