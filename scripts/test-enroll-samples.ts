import "dotenv/config";
import { readFileSync } from "node:fs";
import { FACE_CONFIG } from "@/lib/constants";
import { validateStudentInput } from "@/services/studentService";
import { selectFaceGroup } from "@/lib/face";

/**
 * Guards the "Create student" flow against the bug where the wizard let an
 * admin submit three face photos while the server demanded five: the request
 * was rejected, and the message was shown on the username/password step, so
 * the account simply never appeared and the photos were never re-checked.
 *
 * Two things are asserted:
 *   1. the server rule itself, so the required count stays deliberate; and
 *   2. that the wizard reads the count from FACE_CONFIG rather than repeating
 *      a literal, because the two drifting apart is what caused the failure.
 */

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const REQUIRED = FACE_CONFIG.ENROLL_SAMPLES;

/** A well-formed 512-d vector. validateStudentInput only checks shape. */
function vector(): number[] {
  return Array.from({ length: FACE_CONFIG.EMBEDDING_DIM }, (_, i) =>
    Math.sin(i * 0.37) * 0.5 + Math.cos(i * 0.11) * 0.3
  );
}

function input(faceEmbeddings: number[][]) {
  return {
    fullName: "Sample Student",
    classRoomId: "class-placeholder",
    stream: "SCIENCE" as const,
    subjectIds: [],
    schoolName: "Sample School",
    schoolStatus: "CURRENT" as const,
    email: "sample.student@example.com",
    phone: "+911234567890",
    username: "sample_student",
    password: "SamplePass123",
    facePhotoUrl: "/api/files/face/sample.jpg",
    faceEmbeddings,
  };
}

console.log(`\n=== The server demands ${REQUIRED} usable face samples ===`);

for (const n of [1, 2, 3, 4]) {
  if (REQUIRED <= 4) {
    check(`${n} sample(s) is rejected`, validateStudentInput(input(Array.from({ length: n }, vector))).length > 0);
  }
}

const shortErrors = validateStudentInput(input(Array.from({ length: REQUIRED - 1 }, vector)));
check(
  `${REQUIRED - 1} samples are rejected with a face-sample error`,
  shortErrors.some((e) => /sample/i.test(e)),
  shortErrors.join(" | ") || "no error raised"
);

const exactErrors = validateStudentInput(input(Array.from({ length: REQUIRED }, vector)));
check(
  `exactly ${REQUIRED} samples pass validation`,
  !exactErrors.some((e) => /sample/i.test(e)),
  exactErrors.join(" | ")
);

console.log(`\n=== The wizard asks for the same number the server demands ===`);

const wizard = readFileSync("src/components/register/StudentRegisterWizard.tsx", "utf8");
check(
  "the wizard gates on FACE_CONFIG.ENROLL_SAMPLES",
  wizard.includes("state.face.length >= FACE_CONFIG.ENROLL_SAMPLES") &&
    wizard.includes("state.face.length < FACE_CONFIG.ENROLL_SAMPLES")
);
check(
  "the capture step is given the same count",
  /samples=\{FACE_CONFIG\.ENROLL_SAMPLES\}/.test(wizard) &&
    /minSamples=\{FACE_CONFIG\.ENROLL_SAMPLES\}/.test(wizard)
);
check(
  "no hardcoded face-count gate is left behind",
  !/face\.length\s*(>=|<)\s*[0-9]/.test(wizard) && !/minSamples=\{[0-9]/.test(wizard),
  "a literal face count would drift from the server again"
);

console.log(`\n=== A rejected face sample is reported on the face step ===`);
check(
  "errors mentioning the face send the admin back to the photo step",
  /const faceProblem = msgs\.some/.test(wizard) && /setStep\(faceProblem \? 4 : 3\)/.test(wizard)
);

// A photo-step rejection used to be invisible: the alert lived inside the
// credentials block, so `setStep(4)` moved the admin to the one screen that
// could not show the reason and the account simply was never created.
console.log(`\n=== The alert is visible on the step the admin is left on ===`);
const alertAt = wizard.indexOf("{errors.length > 0 && (");
const step3At = wizard.indexOf("{step === 3 && (");
const step3EndAt = wizard.indexOf("{step === 4 && (");
check(
  "the alert is rendered outside the credentials-only block",
  alertAt !== -1 && alertAt > step3At && alertAt > step3EndAt,
  `alert at ${alertAt} must come after the step 3 block (${step3At}..${step3EndAt}) so it also shows on step 4`
);
check(
  "a live frame that fails embedding explains itself",
  /no_face/.test(wizard) &&
    /multiple_faces/.test(wizard) &&
    /did not lock onto one consistent face/.test(wizard)
);

// The old rule rejected a whole capture if ANY two frames were farther apart
// than SELF_MAX, so one blurry or half-turned shot of a correctly-framed student
// failed the enrollment. selectFaceGroup keeps the consistent majority instead.
console.log(`\n=== One stray frame no longer sinks a whole enrollment ===`);

/**
 * A unit vector aimed at `deg` (plus a small fixed offset so the vector has
 * real spread and is not mistaken for a degenerate one). The cosine distance
 * between two of these is, to within a hair, 1 - cos(angle between them).
 */
const dir = (deg: number) => {
  const r = (deg * Math.PI) / 180;
  const v = [Math.cos(r), Math.sin(r), 0.05];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};
const SELF_MAX = FACE_CONFIG.SELF_MAX_DISTANCE;

{
  const set = [dir(0), dir(10), dir(20), dir(30)];
  const s = selectFaceGroup(set, { selfMax: SELF_MAX, minCore: 3 });
  check(
    "a consistent same-face set keeps every frame",
    s.ok === true && s.kept.length === 4 && s.dropped.length === 0,
    JSON.stringify(s)
  );
}

{
  const set = [dir(0), dir(12), dir(24), dir(85)];
  const s = selectFaceGroup(set, { selfMax: SELF_MAX, minCore: 3 });
  check(
    "a single stray frame is dropped, not made fatal",
    s.ok === true && s.kept.length === 3 && s.dropped.length === 1,
    JSON.stringify(s)
  );
}

{
  const set = [dir(0), dir(10), dir(20), dir(150), dir(160), dir(170)];
  const s = selectFaceGroup(set, { selfMax: SELF_MAX, minCore: 3 });
  check(
    "two sizeable, different faces are refused",
    s.ok === false && s.reason === "inconsistent",
    JSON.stringify(s)
  );
}

{
  const s = selectFaceGroup([], { selfMax: SELF_MAX, minCore: 3 });
  check("an empty set is refused", s.ok === false && s.reason === "empty");
}

check(
  "the wizard keeps the consistent core instead of rejecting on a single pair",
  /selectFaceGroup\(/.test(wizard) && !/cosineDistance\(/.test(wizard)
);

check(
  "the enrollment service drops outliers the same way",
  readFileSync("src/services/faceEnrollmentService.ts", "utf8").includes("selectFaceGroup(")
);

console.log(`\n${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(` - ${f}`);
  process.exit(1);
}
