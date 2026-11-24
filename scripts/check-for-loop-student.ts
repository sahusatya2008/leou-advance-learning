/**
 * Read-only check: does a real, entitled student see the for-loop questions in
 * the Class 11 "Getting Started with Python" practical set?
 *
 * It mints a session for the given username (default `rolex`) through
 * `createSession` - the same JWT + Session row a real face login issues - then
 * calls the student practicals API exactly as the browser does, and removes the
 * session again. Nothing else is written.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/check-for-loop-student.ts [username]
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, createSession, revokeSession } from "@/lib/auth";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const USERNAME = process.argv[2] ?? "rolex";
const CHAPTER = "Getting Started with Python";

type Summary = { id: string; title: string; topic: string; questionCount: number };
type Delivered = { stem: string; tags?: string[] | null };
type ListBody = { practicals?: Summary[]; items?: Summary[] };
type DetailBody = { practical?: { questions?: Delivered[] }; questions?: Delivered[] };

async function main() {
  const user = await prisma.user.findUnique({ where: { username: USERNAME }, select: { id: true } });
  if (!user) throw new Error(`no user named ${USERNAME}`);

  const session = await createSession({ id: user.id, role: "STUDENT" }, { userAgent: "for-loop-check" });
  const cookie = `${SESSION_COOKIE}=${session.token}`;
  const get = async <T>(path: string) => {
    const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as T };
  };

  try {
    const list = await get<ListBody>("/api/student/practicals");
    console.log(`\n${USERNAME}: GET /api/student/practicals -> ${list.status}`);
    if (list.status === 403) {
      // A lapsed or non-entitled student must not even see the list.
      console.log("  blocked (expected for a student with no active service)");
      return;
    }
    const sets = list.json.practicals ?? list.json.items ?? [];
    const set = sets.find((s) => s.topic.toLowerCase() === CHAPTER.toLowerCase());
    if (!set) {
      console.log(`  sets visible: ${sets.map((s) => s.topic).join(", ") || "(none)"}`);
      throw new Error(`${USERNAME} cannot see the "${CHAPTER}" practical set`);
    }
    console.log(`  set: ${set.title} — ${set.questionCount} questions`);

    const detail = await get<DetailBody>(`/api/student/practicals/${set.id}`);
    console.log(`  GET /api/student/practicals/${set.id} -> ${detail.status}`);
    const questions = detail.json.practical?.questions ?? detail.json.questions ?? [];
    const hasTag = (q: Delivered, tag: string) => (q.tags ?? []).includes(tag);
    const forLoop = questions.filter((q) => hasTag(q, "for-loop"));
    // The while block lives in the same set and carries its own stars, so only
    // the for-loop questions are counted here.
    const starred = forLoop.filter((q) => hasTag(q, "very-important"));
    const whileLoop = questions.filter((q) => hasTag(q, "while-loop"));

    console.log(`  questions returned: ${questions.length}`);
    console.log(`  for-loop tagged   : ${forLoop.length}`);
    console.log(`  while-loop tagged : ${whileLoop.length}`);
    console.log(`  for-loop starred  : ${starred.length}`);
    console.log(`  first for-loop Q  : ${(forLoop[0]?.stem ?? "").split("\n")[0]}`);
    console.log(`  last question     : ${(questions.at(-1)?.stem ?? "").split("\n")[0]}`);

    const ok = questions.length === 75 && forLoop.length === 35 && starred.length === 17;
    console.log(ok ? "\n  OK: entitled student sees the full set" : "\n  UNEXPECTED: counts differ from 75/35/17");
    if (!ok) process.exitCode = 1;
  } finally {
    await revokeSession(session.sid);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
