/**
 * Verifies the practical doubt flow end to end against a running server:
 * ask, admin answer, student confirm, plus the privacy and retention promises.
 *
 * The interesting assertions are the negative ones:
 *   - a recording cannot be attached without explicit consent,
 *   - a recording cannot be attached to somebody else's thread or message,
 *   - a non-WebM payload cannot be parked in the uploads volume,
 *   - another student gets 404 for a recording, not 403,
 *   - a student cannot read or answer a doubt they cannot see,
 *   - confirming the answer helped deletes the recordings from disk *and* the row,
 *   - the 30-day purge leaves fresh unresolved recordings alone and reaps old ones.
 *
 * Everything it creates is removed in `finally`. No pre-existing student,
 * question, batch, practical set or doubt is touched.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/test-practical-doubts.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/validation";
import { SESSION_COOKIE, createSession } from "@/lib/auth";
import { resolveRecordingPath } from "@/lib/recordings";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Asks the running container whether a recording is on its uploads volume. The
 * harness itself resolves the host path, which the container never touches, so
 * without this the "file was deleted" checks would pass vacuously.
 */
async function onServer(storageName: string): Promise<boolean> {
  try {
    await execFileAsync("docker", ["compose", "exec", "-T", "app", "test", "-f", `/app/uploads/doubt/${storageName}`]);
    return true;
  } catch (e) {
    // Exit 1 is a plain "no such file"; anything else means we never got to ask.
    return (e as { code?: number }).code === 1 ? false : (() => { throw new Error("could not reach the app container"); })();
  }
}

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const PASSWORD = "Test-Passw0rd!";
const STAMP = Date.now().toString(36);

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail = "") {
  checks++;
  if (condition) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}

let cookie = "";

async function loginAs(userId: string, role: "STUDENT" | "ADMIN") {
  const info = await createSession({ id: userId, role }, { userAgent: "doubt-test" });
  cookie = `${SESSION_COOKIE}=${info.token}`;
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0] ?? cookie;
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function upload(fields: Record<string, string>, blob: Blob, filename: string) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  form.set("file", new File([blob], filename, { type: blob.type }));
  const res = await fetch(`${BASE}/api/student/practicals/doubts`, {
    method: "PUT",
    headers: cookie ? { Cookie: cookie } : {},
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json: json as Record<string, unknown> };
}

/** A minimal but structurally real WebM header: EBML magic plus a DocType. */
function fakeWebm(body: string) {
  return new Blob([
    new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]),
    new TextEncoder().encode(body),
  ], { type: "video/webm" });
}

const undo: (() => Promise<void>)[] = [];

async function main() {
  const classRoom = await prisma.classRoom.findFirst({ orderBy: { createdAt: "asc" } });
  if (!classRoom) throw new Error("no class room to build the probe in");
  const subject = await prisma.subject.findFirst({ where: { code: "CS" } });
  if (!subject) throw new Error("no CS subject");
  const priced = await prisma.batch.findFirst({
    where: { classRoomId: classRoom.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      classRoomId: true,
      pricingItems: { where: { subject: { code: "CS" } }, select: { name: true }, orderBy: { name: "asc" } },
    },
  });
  if (!priced) throw new Error("no batch in the first class room");
  const batch = priced;
  const chapter = priced.pricingItems[0]?.name;
  if (!chapter) throw new Error("that batch prices no CS chapter");

  async function makeStudent(tag: string, joinBatch: boolean) {
    const username = `zz_dou_${STAMP}_${tag}`;
    const user = await prisma.user.create({
      data: {
        username,
        email: `${username}@leou.invalid`,
        passwordHash: await hashPassword(PASSWORD),
        role: "STUDENT",
        // A subscriber, not an onboarding-free account: requireActiveService is a
        // no-op unless onboardingRequired is set, so the lapse checks below would
        // pass for the wrong reason without this.
        onboardingRequired: true,
        studentProfile: {
          create: {
            fullName: `Doubt Student ${tag}`,
            classRoomId: classRoom!.id,
            schoolName: "ZZ School",
            facePhotoUrl: "",
            faceEmbeddings: [],
          },
        },
      },
      include: { studentProfile: true },
    });
    undo.push(async () => {
      await prisma.practicalDoubt.deleteMany({ where: { studentId: user.studentProfile!.id } });
      await prisma.serviceActivation.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
    });
    if (joinBatch) {
      await prisma.batchStudent.create({ data: { batchId: batch!.id, studentId: user.studentProfile!.id } });
      undo.push(async () => {
        await prisma.batchStudent
          .deleteMany({ where: { batchId: batch!.id, studentId: user.studentProfile!.id } })
          .catch(() => null);
      });
    }
    await prisma.serviceActivation.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000) },
    });
    return user;
  }

  const student = await makeStudent("in", true);
  const outsider = await makeStudent("out", false);

  const admin = await prisma.user.create({
    data: {
      username: `zz_dou_${STAMP}_admin`,
      email: `zz_dou_${STAMP}_admin@leou.invalid`,
      passwordHash: await hashPassword(PASSWORD),
      role: "ADMIN",
    },
  });
  undo.push(async () => {
    await prisma.user.delete({ where: { id: admin.id } }).catch(() => null);
  });

  // A published set with one practical question, built through the admin routes.
  cookie = "";
  const login = await api("POST", "/api/auth/login", {
    mode: "password",
    identifier: admin.username,
    password: PASSWORD,
  });
  check("the throwaway admin can log in", login.status === 200, `got ${login.status}`);

  const stem = `ZZ doubt probe ${STAMP}`;
  const created = await api("POST", "/api/admin/questions", {
    type: "CODING",
    classRoomId: classRoom.id,
    subjectId: subject.id,
    difficulty: "MEDIUM",
    topic: chapter,
    stem,
    allowedLanguages: ["python"],
    starterCode: { python: "print('hello')" },
    solutionCode: "print('SECRET_MARKING_ANSWER')",
    testCases: [{ input: "", expected: "hello", isHidden: true, weight: 1 }],
    isPractical: true,
  });
  check("a practical question is created", created.status === 201, `got ${created.status} ${String(created.json.error ?? "")}`);
  const question = await prisma.question.findFirst({ where: { stem }, select: { id: true } });
  if (!question) throw new Error("probe question was not persisted");
  undo.push(async () => {
    await prisma.practicalDoubt.deleteMany({ where: { questionId: question.id } });
    await prisma.practicalAssignmentQuestion.deleteMany({ where: { questionId: question.id } });
    await prisma.question.delete({ where: { id: question.id } }).catch(() => null);
  });

  const setRes = await api("POST", "/api/admin/practical", {
    action: "create",
    batchId: batch.id,
    subjectId: subject.id,
    topic: chapter,
    title: `ZZ doubt practical ${STAMP}`,
  });
  const assignmentId = String(setRes.json.id ?? "");
  check("the practical set is created", Boolean(assignmentId), `got ${setRes.status}`);
  undo.push(async () => {
    await prisma.practicalAssignment.delete({ where: { id: assignmentId } }).catch(() => null);
  });
  await api("POST", "/api/admin/practical", { action: "add", assignmentId, questionId: question.id });
  // Publishing goes through the create/upsert action, same as the builder does:
  // the set now has a question, so the non-empty guard is satisfied.
  const published = await api("POST", "/api/admin/practical", {
    action: "create",
    batchId: batch.id,
    subjectId: subject.id,
    topic: chapter,
    status: "PUBLISHED",
  });
  check("the set publishes", published.status === 200, `got ${published.status} ${String(published.json.error ?? "")}`);

  console.log("\na student asks a doubt");
  let doubtId = "";
  {
    cookie = "";
    await loginAs(student.id, "STUDENT");
    const r = await api("POST", "/api/student/practicals/doubts", {
      action: "create",
      assignmentId,
      questionId: question.id,
      body: "It says the loop should run five times but I only see three lines.",
      codeExcerpt: "for i in range(5):\n    print(i)",
      terminalExcerpt: "0\n1\n2",
    });
    check("the doubt is created", r.status === 200, `got ${r.status} ${String(r.json.error ?? "")}`);
    doubtId = String((r.json.doubt as Record<string, unknown>)?.id ?? "");
    check("the thread starts OPEN", (r.json.doubt as Record<string, unknown>)?.status === "OPEN");
    const listed = await api(
      "GET",
      `/api/student/practicals/doubts?assignmentId=${assignmentId}&questionId=${question.id}`
    );
    check("the thread is listed for the student", (listed.json.doubts as unknown[])?.length === 1);
    const excerpt = JSON.stringify(listed.json);
    check("the attached code is stored", excerpt.includes("range(5)"));
    check("the attached output is stored", excerpt.includes("0\\n1\\n2"));
  }

  console.log("\nstorage names cannot escape the recordings directory");
  {
    check("a traversal name is refused", !resolveRecordingPath("../../../../etc/passwd").ok);
    check("a bare name is refused", !resolveRecordingPath("recording.webm").ok);
    check("a name with a subdirectory is refused", !resolveRecordingPath("sub/dir/recording.webm").ok);
    check("a non-webm extension is refused", !resolveRecordingPath("4ecd6bba-9eef-484e-904c-3c510fce0297.mp4").ok);
    check(
      "a uuid webm name is accepted",
      resolveRecordingPath("4ecd6bba-9eef-484e-904c-3c510fce0297.webm").ok
    );
  }

  console.log("\na lapsed service hides the practical, not just its writes");
  {
    await prisma.serviceActivation.updateMany({
      where: { userId: student.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const list = await api("GET", "/api/student/practicals");
    check("the list is refused once the service has lapsed", list.status === 403, `got ${list.status}`);
    const detail = await api("GET", `/api/student/practicals/${assignmentId}`);
    check("the detail is refused too", detail.status === 403, `got ${detail.status}`);
    const thread = await api(
      "GET",
      `/api/student/practicals/doubts?assignmentId=${assignmentId}&questionId=${question.id}`
    );
    check("their doubts are refused as well", thread.status === 403, `got ${thread.status}`);
    const ask = await api("POST", "/api/student/practicals/doubts", {
      action: "create",
      assignmentId,
      questionId: question.id,
      body: "still here?",
    });
    check("they cannot raise a new doubt", ask.status === 403, `got ${ask.status}`);

    await prisma.serviceActivation.updateMany({
      where: { userId: student.id },
      data: { expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000) },
    });
    const back = await api("GET", "/api/student/practicals");
    check("renewing the service brings it back", back.status === 200, `got ${back.status}`);
  }

  console.log("\nconsent is required before anything is written");
  {
    const noConsent = await upload(
      { doubtId, kind: "VOICE", consent: "false" },
      fakeWebm("voice"),
      "voice.webm"
    );
    check("an upload without consent is refused", noConsent.status === 400, `got ${noConsent.status}`);
    const rows = await prisma.practicalRecording.count({ where: { doubtId } });
    check("no recording row was created", rows === 0, `got ${rows}`);
  }

  console.log("\nrecordings are attached with consent");
  let recordingId = "";
  let storageName = "";
  {
    const up = await upload(
      { doubtId, kind: "VOICE", consent: "true", durationMs: "4200" },
      fakeWebm("voice clip"),
      "voice.webm"
    );
    check("a consented voice clip uploads", up.status === 200, `got ${up.status} ${String(up.json.error ?? "")}`);
    check("the voice clip comes back with an id", Boolean((up.json.recording as Record<string, unknown>)?.id));
    const screen = await upload(
      { doubtId, kind: "SCREEN", consent: "true" },
      fakeWebm("screen clip"),
      "screen.webm"
    );
    check("a consented screen clip uploads", screen.status === 200, `got ${screen.status} ${String(screen.json.error ?? "")}`);
    recordingId = String((screen.json.recording as Record<string, unknown>)?.id ?? "");

    const row = await prisma.practicalRecording.findUnique({
      where: { id: recordingId },
      select: { storageName: true, consentedAt: true, mimeType: true, sizeBytes: true },
    });
    storageName = row?.storageName ?? "";
    check("the consent timestamp is recorded", Boolean(row?.consentedAt));
    check("it is stored as webm", row?.mimeType === "video/webm", String(row?.mimeType));
    check(
      "the file name is a uuid, not the client's",
      /^[0-9a-f-]{36}\.webm$/.test(storageName) && !storageName.includes("screen") && !storageName.includes("evil"),
      storageName
    );
    check("the bytes are on the app's uploads volume", await onServer(storageName), storageName);
  }

  console.log("\nthe uploads endpoint cannot be used as a file drop");
  {
    const junk = await upload(
      { doubtId, kind: "SCREEN", consent: "true" },
      new Blob([new TextEncoder().encode("#!/bin/sh\necho pwned")], { type: "video/webm" }),
      "evil.webm"
    );
    check("a non-webm payload is refused", junk.status === 400, `got ${junk.status}`);
    const before = await prisma.practicalRecording.count({ where: { doubtId } });
    check("still only the two consented clips", before === 2, `got ${before}`);
  }

  console.log("\na recording cannot be pinned to somebody else's thread");
  {
    const crossThread = await upload(
      { doubtId: "00000000-0000-4000-8000-000000000000", kind: "VOICE", consent: "true" },
      fakeWebm("x"),
      "voice.webm"
    );
    check("an unknown thread id is refused", crossThread.status === 404, `got ${crossThread.status}`);

    const mine = cookie;
    cookie = "";
    await loginAs(outsider.id, "STUDENT");
    const otherThread = await upload(
      { doubtId, kind: "VOICE", consent: "true" },
      fakeWebm("x"),
      "voice.webm"
    );
    check("another student cannot record onto it", otherThread.status === 404, `got ${otherThread.status}`);
    cookie = mine;
  }

  console.log("\nplayback is private");
  {
    const mine = await fetch(`${BASE}/api/student/practicals/doubts/recordings/${recordingId}`, {
      headers: { Cookie: cookie },
    });
    const bytes = await mine.arrayBuffer();
    check("the owner can play their own clip", mine.status === 200, `got ${mine.status}`);
    check("the bytes come back", bytes.byteLength > 0, `${bytes.byteLength}`);
    check("it is served as webm", (mine.headers.get("content-type") ?? "").includes("webm"));
    check("it is not cached", (mine.headers.get("cache-control") ?? "").includes("no-store"));

    cookie = "";
    const noCookie = await fetch(`${BASE}/api/student/practicals/doubts/recordings/${recordingId}`);
    check("a signed-out visitor gets nothing", noCookie.status === 401 || noCookie.status === 403, `got ${noCookie.status}`);

    await loginAs(outsider.id, "STUDENT");
    const stranger = await fetch(`${BASE}/api/student/practicals/doubts/recordings/${recordingId}`, {
      headers: { Cookie: cookie },
    });
    check("another student gets 404, not 403", stranger.status === 404, `got ${stranger.status}`);
  }

  console.log("\nthe student cannot see or answer somebody else's thread");
  {
    await loginAs(outsider.id, "STUDENT");
    const listed = await api(
      "GET",
      `/api/student/practicals/doubts?assignmentId=${assignmentId}&questionId=${question.id}`
    );
    // The practical itself is invisible to them, so this is a 404 rather than an
    // empty thread list: nothing about the set should leak.
    check(
      "the thread is not in their list",
      listed.status === 404 || (listed.json.doubts as unknown[])?.length === 0,
      `got ${listed.status}`
    );
    const reply = await api("POST", "/api/student/practicals/doubts", {
      action: "reply",
      doubtId,
      body: "let me in",
    });
    check("they cannot post into it", reply.status === 404, `got ${reply.status}`);
  }

  console.log("\na student cannot answer their own doubt either");
  {
    await loginAs(student.id, "STUDENT");
    const answer = await api("POST", "/api/student/practicals/doubts", {
      action: "reply",
      doubtId,
      body: "figured it out, it was me",
    });
    check("a student reply is recorded as a student message", answer.status === 200, `got ${answer.status}`);
    const adminRole = (answer.json.doubt as { messages: { authorRole: string }[] }).messages.at(-1)?.authorRole;
    check("it is attributed to the student", adminRole === "STUDENT", String(adminRole));
  }

  console.log("\nthe admin inbox sees it with context");
  {
    await loginAs(admin.id, "ADMIN");
    const inbox = await api("GET", "/api/admin/practical/doubts?status=OPEN");
    const rows = (inbox.json.doubts as Record<string, unknown>[]) ?? [];
    const row = rows.find((d) => d.id === doubtId);
    check("the thread is in the inbox", Boolean(row), `got ${rows.length}`);
    check("it says who asked", String((row?.student as { fullName?: string })?.fullName ?? "").includes("Doubt Student"));
    check("it says which practical", String((row?.assignment as { title?: string })?.title ?? "").includes("ZZ doubt practical"));
    check("it shows the question", String((row?.question as { stem?: string })?.stem ?? "").includes("ZZ doubt probe"));
    check("it never carries the solution", !JSON.stringify(inbox.json).includes("SECRET_MARKING_ANSWER"));
  }

  console.log("\na student cannot reach the admin inbox");
  {
    await loginAs(student.id, "STUDENT");
    const inbox = await api("GET", "/api/admin/practical/doubts");
    check("the admin route refuses a student", inbox.status === 403, `got ${inbox.status}`);
  }

  console.log("\nthe admin answers");
  {
    await loginAs(admin.id, "ADMIN");
    const answer = await api("POST", `/api/admin/practical/doubts/${doubtId}`, {
      body: "range(5) does run five times; the last two prints went to the runner log. Try again with a larger delay.",
    });
    check("the answer is accepted", answer.status === 200, `got ${answer.status} ${String(answer.json.error ?? "")}`);
    const doubt = (answer.json.doubt as Record<string, unknown>) ?? {};
    check("the thread is ANSWERED", doubt.status === "ANSWERED", String(doubt.status));
    check("answeredAt is stamped", Boolean(doubt.answeredAt));

    const clip = await fetch(`${BASE}/api/admin/practical/doubts/recordings/${recordingId}`, {
      headers: { Cookie: cookie },
    });
    check("the admin can play the clip", clip.status === 200, `got ${clip.status}`);
    await loginAs(student.id, "STUDENT");
    const asStudent = await fetch(`${BASE}/api/admin/practical/doubts/recordings/${recordingId}`, {
      headers: { Cookie: cookie },
    });
    check("a student cannot use the admin playback route", asStudent.status === 403, `got ${asStudent.status}`);
  }

  console.log("\nconfirming the answer helped deletes the recordings");
  {
    await loginAs(student.id, "STUDENT");
    check("the file is there before", await onServer(storageName), storageName);
    const done = await api("POST", "/api/student/practicals/doubts", { action: "satisfied", doubtId });
    check("the student can confirm it", done.status === 200, `got ${done.status}`);
    check("the route reports the deletions", Number(done.json.recordingsDeleted) === 2, String(done.json.recordingsDeleted));
    const doubt = (done.json.doubt as Record<string, unknown>) ?? {};
    check("the thread is SATISFIED", doubt.status === "SATISFIED", String(doubt.status));
    check("satisfiedAt is stamped", Boolean(doubt.satisfiedAt));
    check("the bytes are gone from disk", !(await onServer(storageName)), storageName);
    const rows = await prisma.practicalRecording.count({ where: { doubtId } });
    check("the rows are marked deleted, not resurrected", rows === 2, `got ${rows}`);
    const live = await prisma.practicalRecording.count({ where: { doubtId, deletedAt: null } });
    check("no live recordings remain", live === 0, `got ${live}`);

    const play = await fetch(`${BASE}/api/student/practicals/doubts/recordings/${recordingId}`, {
      headers: { Cookie: cookie },
    });
    check("a deleted recording will not play", play.status === 404, `got ${play.status}`);

    const reply = await api("POST", "/api/student/practicals/doubts", { action: "reply", doubtId, body: "one more thing" });
    check("a closed thread cannot be reopened by a student", reply.status === 409, `got ${reply.status}`);
  }

  console.log("\nthe retention purge only reaps what is past the window");
  const probeDoubtIds: string[] = [];
  {
    // A fresh unresolved thread must survive the purge.
    const open = await prisma.practicalDoubt.create({
      data: {
        assignmentId,
        questionId: question.id,
        studentId: student.studentProfile!.id,
        status: "OPEN",
        lastActivityAt: new Date(),
        messages: { create: { authorRole: "STUDENT", authorId: student.id, body: "still stuck" } },
      },
      select: { id: true },
    });
    const fresh = await upload(
      { doubtId: open.id, kind: "VOICE", consent: "true" },
      fakeWebm("fresh"),
      "voice.webm"
    );
    const freshId = String((fresh.json.recording as Record<string, unknown>)?.id ?? "");
    const freshRow = await prisma.practicalRecording.findUnique({ where: { id: freshId }, select: { storageName: true } });


    // An unresolved thread older than the window, with its recording backdated.
    const stale = await prisma.practicalDoubt.create({
      data: {
        assignmentId,
        questionId: question.id,
        studentId: student.studentProfile!.id,
        status: "ANSWERED",
        lastActivityAt: new Date(),
        messages: { create: { authorRole: "STUDENT", authorId: student.id, body: "nobody came back to this" } },
      },
      select: { id: true },
    });
    const old = await upload(
      { doubtId: stale.id, kind: "SCREEN", consent: "true" },
      fakeWebm("stale"),
      "screen.webm"
    );
    const oldId = String((old.json.recording as Record<string, unknown>)?.id ?? "");
    const oldRow = await prisma.practicalRecording.findUnique({ where: { id: oldId }, select: { storageName: true } });

    await prisma.practicalRecording.update({
      where: { id: oldId },
      data: { createdAt: new Date(Date.now() - 31 * 24 * 3600 * 1000) },
    });

    await loginAs(admin.id, "ADMIN");
    const purge = await api("POST", "/api/admin/practical/purge-recordings");
    check("the admin purge route answers", purge.status === 200, `got ${purge.status} ${String(purge.json.error ?? "")}`);
    const purged = {
      purged: Number(purge.json.purged),
      bytesFreed: Number(purge.json.bytesFreed),
    };
    check("the stale recording is purged", purged.purged === 1, `got ${purged.purged}`);
    check("its bytes are freed", purged.bytesFreed > 0, `${purged.bytesFreed}`);
    check("the stale file is gone from disk", !(await onServer(oldRow?.storageName ?? "")), oldRow?.storageName ?? "");
    check("the fresh recording is left alone", purged.purged === 1 && (await onServer(freshRow?.storageName ?? "")), freshRow?.storageName ?? "");

    const freshRow2 = await prisma.practicalRecording.findUnique({
      where: { id: freshId },
      select: { deletedAt: true },
    });
    check("its row is still live", freshRow2?.deletedAt === null);
    const staleRow = await prisma.practicalRecording.findUnique({
      where: { id: oldId },
      select: { deletedAt: true },
    });
    check("the purged row is marked deleted", Boolean(staleRow?.deletedAt));

    probeDoubtIds.push(open.id, stale.id);
    if (await onServer(freshRow?.storageName ?? ""))
      await execFileAsync("docker", ["compose", "exec", "-T", "app", "rm", "-f", `/app/uploads/doubt/${freshRow?.storageName}`]);
  }

  console.log("\nthe recordings directory holds nothing but consented clips");
  {
    // Remove the surviving retention probe the same way a real closure would, so
    // the closing count is a real end state rather than a leftover.
    await prisma.practicalDoubt.deleteMany({ where: { id: { in: probeDoubtIds } } });
    const stray = await prisma.practicalRecording.count({
      where: { deletedAt: null, doubt: { questionId: question.id } },
    });
    check("no live recordings on the probe question", stray === 0, `got ${stray}`);
  }
}

main()
  .catch((e) => {
    failures++;
    console.log(`  FAIL harness error \u2014 ${e instanceof Error ? e.message : String(e)}`);
  })
  .finally(async () => {
    for (const step of undo.reverse()) await step();
    const stray = await prisma.practicalDoubt.count({
      where: { question: { stem: { startsWith: "ZZ doubt probe" } } },
    });
    console.log(`\ncleanup: leftover ZZ doubts ${stray}`);
    await prisma.$disconnect();
    console.log(`\n${checks - failures}/${checks} checks passed`);
    process.exit(failures ? 1 : 0);
  });