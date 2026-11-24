"use client";

/**
 * Product screens for the landing showcase.
 *
 * Every screen is a hand-built mockup of a real surface in this codebase, and
 * every string in them is either copied from the actual UI or invented demo
 * data. Nothing here reads the database, and no screen is wired to a real
 * route — they exist to be looked at, not clicked.
 *
 * What is deliberately NOT here: any claim of webcam proctoring, fullscreen
 * lockdown, tab-switch tracking or a proctor audit trail. Those settings exist
 * in the admin form but nothing in the student attempt flow enforces them, so
 * showing them would be a lie. The screens below show what the platform
 * genuinely does.
 */

import type { ReactNode } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  BookOpen,
  CalendarClock,
  CircleCheck,
  CircleHelp,
  CircleX,
  ClipboardCheck,
  Code2,
  FileCheck2,
  GraduationCap,
  Home,
  Landmark,
  ListChecks,
  Lock,
  Mic,
  Paperclip,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  CreditCard,
  FileText,
  HelpCircle,
  ScanLine,
  Terminal,
  Settings,
  UploadCloud,
} from "lucide-react";
import s from "./landing.module.css";
import { LeouGlyph } from "@/components/brand";

/* ------------------------------------------------------------------ atoms */

type Tone = "good" | "warn" | "stop" | "info" | "violet";

const TONE_CLS: Record<Tone, string> = {
  good: s.chipGood,
  warn: s.chipWarn,
  stop: s.chipStop,
  info: s.chipInfo,
  violet: s.chipViolet,
};

/** What the badge is claiming happened, which is not the same as its colour. */
const TONE_LABEL: Record<Tone, string> = {
  good: "Graded",
  warn: "Manual",
  stop: "Flagged",
  info: "Auto",
  violet: "Feedback",
};

const TONE_GLYPH: Record<Tone, typeof CircleCheck> = {
  good: CircleCheck,
  warn: CircleHelp,
  stop: CircleX,
  info: CircleCheck,
  violet: Sparkles,
};

const Icon = ({ tone }: { tone: Tone }) => {
  const Glyph = TONE_GLYPH[tone];
  return (
    <span className={`${s.chip} ${TONE_CLS[tone]}`}>
      <Glyph style={{ width: 9, height: 9 }} />
      {TONE_LABEL[tone]}
    </span>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div className={s.stat}>
    <div className={s.statLabel}>{label}</div>
    <div className={s.statValue} style={tone ? { color: tone } : undefined}>
      {value}
    </div>
  </div>
);

const Side = ({
  items,
  active,
  brand,
}: {
  items: { icon: ReactNode; label: string }[];
  active: string;
  brand: string;
}) => (
  <div className={s.sidebar}>
    <div className={s.sideBrand}>
      <LeouGlyph className={s.sideGlyph} />
      {brand}
    </div>
    {items.map((it) => (
      <div key={it.label} className={`${s.sideItem} ${it.label === active ? s.sideItemActive : ""}`}>
        {it.icon}
        {it.label}
      </div>
    ))}
  </div>
);

const ic = (I: ReactNode) => <span style={{ width: 12, height: 12, display: "grid", placeItems: "center" }}>{I}</span>;

/* --------------------------------------------------- 1 · student home ---- */

const STUDENT_NAV = [
  { icon: ic(<Home style={{ width: 12, height: 12 }} />), label: "Home" },
  { icon: ic(<BadgeCheck style={{ width: 12, height: 12 }} />), label: "My Plan" },
  { icon: ic(<BookOpen style={{ width: 12, height: 12 }} />), label: "My Classes" },
  { icon: ic(<ClipboardCheck style={{ width: 12, height: 12 }} />), label: "Tests" },
  { icon: ic(<BarChart3 style={{ width: 12, height: 12 }} />), label: "Results" },
  { icon: ic(<FileCheck2 style={{ width: 12, height: 12 }} />), label: "Reports" },
  { icon: ic(<Activity style={{ width: 12, height: 12 }} />), label: "Activity" },
  { icon: ic(<Wallet style={{ width: 12, height: 12 }} />), label: "Payments" },
];

export function StudentHomeScreen() {
  return (
    <div className={s.app}>
      <Side items={STUDENT_NAV} active="Home" brand="Leou." />
      <div className={s.main}>
        <div className={s.panelTitle}>
          <span>Welcome back, Aarav</span>
          <span className={`${s.chip} ${s.chipGood}`}>
            <ScanFace style={{ width: 9, height: 9 }} /> Face verified
          </span>
        </div>

        <div className={s.grid} style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <Stat label="Classes" value="4" />
          <Stat label="Tests due" value="2" tone="var(--lp-warn)" />
          <Stat label="Avg score" value="86%" tone="var(--lp-good)" />
        </div>

        <div className={s.row}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CalendarClock style={{ width: 13, height: 13, color: "var(--lp-cyan)" }} />
            Physics — Full Syllabus Mock
          </span>
          <span className={`${s.chip} ${s.chipWarn}`}>Due in 2 days</span>
        </div>
        <div className={s.row}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Code2 style={{ width: 13, height: 13, color: "var(--lp-violet)" }} />
            Coding — Assignment 04
          </span>
          <span className={`${s.chip} ${s.chipInfo}`}>45 min</span>
        </div>

        <div className={s.row}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Wallet style={{ width: 13, height: 13, color: "var(--lp-good)" }} />
            Tuition fee — October
          </span>
          <span className={`${s.chip} ${s.chipGood}`}>Paid</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ 2 · answer feedback --- */

export function SnaiScreen() {
  return (
    <div className={s.app}>
      <Side items={STUDENT_NAV} active="Tests" brand="Leou." />
      <div className={s.main}>
        <div className={s.panelTitle}>
          <span>Question 4 · Biology · 4 marks</span>
          <span className={`${s.chip} ${s.chipViolet}`}>
            <Sparkles style={{ width: 9, height: 9 }} /> Checked automatically
          </span>
        </div>

        <div
          style={{
            padding: "0.6rem 0.7rem",
            borderRadius: "0.55rem",
            border: "1px solid var(--lp-line-soft)",
            background: "rgb(255 255 255 / 0.022)",
            fontSize: "0.6875rem",
            color: "var(--lp-dim)",
            lineHeight: 1.6,
          }}
        >
          Explain why the rate of a reaction increases with temperature, up to a point.
        </div>

        {/* The verdict. Tones map exactly to VERDICT_STYLE in AttemptView. */}
        <div className={s.verdict}>
          <CircleHelp style={{ width: 14, height: 14, color: "var(--lp-warn)", flexShrink: 0, marginTop: 1 }} />
          <div className={s.verdictBody}>
            <div className={s.verdictTitle} style={{ color: "#fde68a" }}>
              Partly right — 3 of 4 key points covered
            </div>
            <ul className={s.points}>
              <li>Collisions between molecules increase as particles move faster</li>
              <li>More particles exceed the activation energy barrier</li>
              <li>Equilibrium constant is unaffected by temperature</li>
            </ul>
            <div className={s.footnote}>
              One idea in it is incorrect. A study aid, not a grade — your teacher marks the final score.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <span className={`${s.chip} ${s.chipInfo}`}>
            <Mic style={{ width: 9, height: 9 }} /> Oral answer recorded
          </span>
          <span className={s.chip}>
            <Paperclip style={{ width: 9, height: 9 }} /> Diagram attached
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ 3 · coding runner ----- */

const CODE_LINES: [string, string][] = [
  ["tkCmt", "# Read n, then print the n-th value of the sequence"],
  ["tkFn", "solve(n):"],
  ["tkPunc", "    a = 0"],
  ["tkPunc", "    b = 1"],
  ["tkKey", "    repeat n times:"],
  ["tkPunc", "        a, b = b, a + b"],
  ["tkKey", "    return a"],
  ["tkPunc", ""],
  ["tkFn", "print solve(10)"],
];

export function SandboxScreen() {
  return (
    <div className={s.app}>
      <Side items={STUDENT_NAV} active="Tests" brand="Leou." />
      <div className={s.main}>
        <div className={s.panelTitle}>
          <span>Coding · Assignment 04</span>
          <span className={`${s.chip} ${s.chipGood}`}>
            <CircleCheck style={{ width: 9, height: 9 }} /> All tests passed
          </span>
        </div>

        <div className={s.editor}>
          <div className={s.editorBar}>
            <span>solution</span>
            <span>stdin ready</span>
          </div>
          <pre className={s.code}>
            {CODE_LINES.map(([tone, text], i) => (
              <div key={i} className={tone === " " ? undefined : s[tone]}>
                {text || " "}
              </div>
            ))}
            <span className={s.cursor} />
          </pre>
          <div className={s.term}>
            <span style={{ color: "var(--lp-dimmer)" }}>$ </span>
            <span style={{ color: "var(--lp-good)" }}>run tests</span>
            {"\n"}
            55
            {"\n"}
            <span style={{ color: "var(--lp-good)" }}>✓ exit 0</span>
            <span style={{ color: "var(--lp-dimmer)" }}> · 41 tests · 1.2s</span>
          </div>
        </div>

        {/* What the student sees: the guarantees of the run, not its internals. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {["Hidden tests", "Time-limited", "Own secure space"].map((f) => (
            <span key={f} className={`${s.chip} ${s.chipViolet}`}>
              <Lock style={{ width: 9, height: 9 }} /> {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ 4 · face verify ------- */

export function FaceScreen() {
  return (
    <div className={s.app}>
      <Side items={STUDENT_NAV} active="Home" brand="Leou." />
      <div className={s.main}>
        <div className={s.panelTitle}>
          <span>Sign in</span>
          <span className={`${s.chip} ${s.chipInfo}`}>Step 2 of 2</span>
        </div>

        <div className={s.verify}>
          <div className={s.viewfinder}>
            <span className={`${s.corner} ${s.cornerA}`} />
            <span className={`${s.corner} ${s.cornerB}`} />
            <span className={`${s.corner} ${s.cornerC}`} />
            <span className={`${s.corner} ${s.cornerD}`} />
            <ScanFace style={{ width: 34, height: 34, color: "var(--lp-cyan)", opacity: 0.85 }} />
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            <span className={`${s.chip} ${s.chipGood}`}>
              <CircleCheck style={{ width: 9, height: 9 }} /> Face matched
            </span>
            <span className={`${s.chip} ${s.chipGood}`}>
              <ShieldCheck style={{ width: 9, height: 9 }} /> Liveness
            </span>
            <span className={s.chip}>On-server</span>
          </div>

          <div style={{ fontSize: "0.625rem", color: "var(--lp-dimmer)", textAlign: "center", maxWidth: "20rem", lineHeight: 1.6 }}>
            Matched on the server against the stored template. No photo is ever written to disk.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ 5 · payment verify ---- */

export function PaymentScreen() {
  return (
    <div className={s.app}>
      <Side
        brand="Leou."
        active="Payments"
        items={[
          { icon: ic(<Home style={{ width: 12, height: 12 }} />), label: "Dashboard" },
          { icon: ic(<GraduationCap style={{ width: 12, height: 12 }} />), label: "Student Management" },
          { icon: ic(<Landmark style={{ width: 12, height: 12 }} />), label: "Payments" },
          { icon: ic(<ListChecks style={{ width: 12, height: 12 }} />), label: "Evaluation" },
          { icon: ic(<Users style={{ width: 12, height: 12 }} />), label: "Parents" },
          { icon: ic(<Activity style={{ width: 12, height: 12 }} />), label: "Activity Logs" },
        ]}
      />
      <div className={s.main}>
        <div className={s.panelTitle}>
          <span>Verify payment · LEOU-4KQ2-9TPD</span>
          <span className={`${s.chip} ${s.chipInfo}`}>
            <ScanFace style={{ width: 9, height: 9 }} /> Auto-read
          </span>
        </div>

        <div className={s.grid} style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          <Stat label="Scanned amount" value="₹ 4,500" />
          <Stat label="Expected" value="₹ 4,500" tone="var(--lp-good)" />
          <Stat label="Scanned date" value="02 Oct, 7:41 pm" />
          <Stat label="Payee" value="Verified" tone="var(--lp-good)" />
        </div>

        <div className={s.audit}>
          {[
            ["Amount matches request", "var(--lp-good)"],
            ["Date within window", "var(--lp-good)"],
            ["Reference found in screenshot", "var(--lp-good)"],
            ["Confirm with student", "var(--lp-warn)"],
          ].map(([label, tone]) => (
            <div key={label} className={s.auditItem}>
              <span className={s.auditDot} style={{ background: tone }} />
              <span style={{ fontSize: "0.6875rem", color: "var(--lp-dim)" }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <span className={`${s.chip} ${s.chipInfo}`}>
            <Paperclip style={{ width: 9, height: 9 }} /> Camera scan
          </span>
          <span className={s.chip}>Transaction ID</span>
          <span className={s.chip}>Screenshot</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ 6 · evaluation queue -- */

export function EvaluationScreen() {
  return (
    <div className={s.app}>
      <Side
        brand="Leou."
        active="Evaluation"
        items={[
          { icon: ic(<Home style={{ width: 12, height: 12 }} />), label: "Dashboard" },
          { icon: ic(<GraduationCap style={{ width: 12, height: 12 }} />), label: "Student Management" },
          { icon: ic(<BookOpen style={{ width: 12, height: 12 }} />), label: "Question Bank" },
          { icon: ic(<ClipboardCheck style={{ width: 12, height: 12 }} />), label: "Assessments" },
          { icon: ic(<ListChecks style={{ width: 12, height: 12 }} />), label: "Evaluation" },
          { icon: ic(<FileCheck2 style={{ width: 12, height: 12 }} />), label: "Activity Logs" },
        ]}
      />
      <div className={s.main}>
        <div className={s.panelTitle}>
          <span>Evaluation queue · Physics Mock 03</span>
          <span className={`${s.chip} ${s.chipWarn}`}>18 need review</span>
        </div>

        <div style={{ display: "grid", gap: 5 }}>
          {[
            ["Aarav Sharma", "MCQ · 20", "20/20", "good"],
            ["Diya Patel", "CODING · 15", "13/15", "warn"],
            ["Rohan Mehta", "ORAL · 10", "—", "info"],
            ["Sara Khan", "SHORT · 10", "8/10", "warn"],
          ].map(([name, kind, score, tone]) => (
            <div key={name} className={s.row}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontWeight: 550 }}>{name}</span>
                <span className={s.chip}>{kind}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ fontSize: "0.6875rem", color: "var(--lp-dim)" }}>
                  {score}
                </span>
                <Icon tone={tone as Tone} />
              </span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: "0.625rem", color: "var(--lp-dimmer)", lineHeight: 1.6 }}>
          Objective answers and code tests are graded automatically. Oral and written answers wait for a
          teacher — marks stay unreleased until you publish them.
        </div>
      </div>
    </div>
  );
}


/* ------------------------------------------------ 7 · exam attempt ---- */

export function ExamAttemptScreen() {
  return (
    <div className={s.app}>
      <Side
        brand="Leou."
        active="Exam"
        items={[
          { icon: ic(<Home style={{ width: 12, height: 12 }} />), label: "Dashboard" },
          { icon: ic(<FileText style={{ width: 12, height: 12 }} />), label: "Tests" },
          { icon: ic(<BookOpen style={{ width: 12, height: 12 }} />), label: "Practice" },
          { icon: ic(<ShieldCheck style={{ width: 12, height: 12 }} />), label: "Rules" },
          { icon: ic(<HelpCircle style={{ width: 12, height: 12 }} />), label: "Help" },
        ]}
      />
      <div className={s.main}>
        <div className={s.panelTitle}>
          <span>Physics Mock 03 · Q3 of 25</span>
          <span className={`${s.chip} ${s.chipInfo}`}>Time: 00:13:42</span>
        </div>
        <div className={s.panel}>
          <div style={{ fontSize: "0.75rem", fontWeight: 550, lineHeight: 1.8 }}>
            Which of the following has the largest de Broglie wavelength for the same velocity?
          </div>
          <div style={{ fontSize: "0.6875rem", color: "var(--lp-dim)", marginTop: 6 }}>
            Options
          </div>
          <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
            {["Electron", "Proton", "Neutron", "Alpha particle"].map((o) => (
              <div key={o} className={s.row} style={{ fontSize: "0.6875rem" }}>
                <span>{o}</span>
                <span className={s.dot} style={{ opacity: 0.5 }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {["MCQ", "Single answer", "Marks: 2"].map((t) => (
              <span key={t} className={s.chip}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div style={{ fontSize: "0.625rem", color: "var(--lp-dimmer)", lineHeight: 1.6 }}>
          Fullscreen-aware layout. Tab/paste behaviour is tracked by the platform; locking is
          not forced. Responses are autosaved.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ 8 · reports ---- */

export function ReportsScreen() {
  return (
    <div className={s.app}>
      <Side
        brand="Leou."
        active="Reports"
        items={[
          { icon: ic(<Home style={{ width: 12, height: 12 }} />), label: "Dashboard" },
          { icon: ic(<ClipboardCheck style={{ width: 12, height: 12 }} />), label: "Assessments" },
          { icon: ic(<FileCheck2 style={{ width: 12, height: 12 }} />), label: "Results" },
          { icon: ic(<BarChart3 style={{ width: 12, height: 12 }} />), label: "Reports" },
          { icon: ic(<Users style={{ width: 12, height: 12 }} />), label: "Classes" },
        ]}
      />
      <div className={s.main}>
        <div className={s.panelTitle}>
          <span>Batch performance · Class 12 PCM</span>
          <span className={`${s.chip} ${s.chipViolet}`}>Study insights</span>
        </div>
        <div className={s.panel} style={{ gap: 6 }}>
          {["Physics Mock 03", "Maths Weekly 05", "Chemistry Unit 02"].map((a) => (
            <div key={a} className={s.row}>
              <span>{a}</span>
              <span style={{ fontSize: "0.6875rem", color: "var(--lp-dim)" }}>Avg. 78% · 42 submitted</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: "0.625rem", color: "var(--lp-dimmer)", lineHeight: 1.6 }}>
          Study feedback, common errors and improvement areas — without predicting final marks.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------- 9 · admin user mgmt ---- */

export function AdminUsersScreen() {
  return (
    <div className={s.app}>
      <Side
        brand="Leou."
        active="Users"
        items={[
          { icon: ic(<Home style={{ width: 12, height: 12 }} />), label: "Dashboard" },
          { icon: ic(<Users style={{ width: 12, height: 12 }} />), label: "Users" },
          { icon: ic(<ShieldCheck style={{ width: 12, height: 12 }} />), label: "Roles" },
          { icon: ic(<ClipboardCheck style={{ width: 12, height: 12 }} />), label: "Batches" },
          { icon: ic(<FileCheck2 style={{ width: 12, height: 12 }} />), label: "Activity Logs" },
        ]}
      />
      <div className={s.main}>
        <div className={s.panelTitle}>
          <span>User management</span>
          <span className={`${s.chip}`}>Roles: STUDENT · ADMIN · PARENT</span>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          {[
            ["T. Sharma", "ADMIN"],
            ["A. Khan", "STUDENT"],
            ["P. Mehta", "PARENT"],
          ].map(([n, r]) => (
            <div key={n} className={s.row}>
              <span>{n}</span>
              <span className={s.chip}>{r}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: "0.625rem", color: "var(--lp-dimmer)", lineHeight: 1.6 }}>
          Role-scoped access. Parent views are read-only windows over the model.
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------- 10 · payment ledger ---- */

export function PaymentLedgerScreen() {
  return (
    <div className={s.app}>
      <Side
        brand="Leou."
        active="Payments"
        items={[
          { icon: ic(<Home style={{ width: 12, height: 12 }} />), label: "Dashboard" },
          { icon: ic(<Wallet style={{ width: 12, height: 12 }} />), label: "Payments" },
          { icon: ic(<CreditCard style={{ width: 12, height: 12 }} />), label: "Requests" },
          { icon: ic(<ScanLine style={{ width: 12, height: 12 }} />), label: "Scan" },
        ]}
      />
      <div className={s.main}>
        <div className={s.panelTitle}>
          <span>Payment verification</span>
          <span className={`${s.chip} ${s.chipWarn}`}>Scan review</span>
        </div>
        <div className={s.panel}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
            {["Ref", "Amount", "Status"].map((h) => (
              <div key={h} style={{ fontSize: "0.625rem", color: "var(--lp-dimmer)" }}>
                {h}
              </div>
            ))}
            {[
              ["P-1042", "₹2,500", "Verified"],
              ["P-1043", "₹2,500", "Pending"],
              ["P-1044", "₹1,500", "Flagged"],
            ].map(([r, a, st], i) => (
              <>
                <div style={{ fontSize: "0.6875rem" }}>{r}</div>
                <div style={{ fontSize: "0.6875rem" }}>{a}</div>
                <div>
                  <span className={`${s.chip} ${i === 2 ? s.chipStop : i === 1 ? s.chipWarn : s.chipGood}`}>
                    {st}
                  </span>
                </div>
              </>
            ))}
          </div>
        </div>
        <div style={{ fontSize: "0.625rem", color: "var(--lp-dimmer)", lineHeight: 1.6 }}>
          Payment screenshots are read automatically. Manual review is available with an audit trail.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------- 11 · proctor events ---- */

export function ProctorEventsScreen() {
  return (
    <div className={s.app}>
      <Side
        brand="Leou."
        active="Logs"
        items={[
          { icon: ic(<Home style={{ width: 12, height: 12 }} />), label: "Dashboard" },
          { icon: ic(<FileCheck2 style={{ width: 12, height: 12 }} />), label: "Activity Logs" },
          { icon: ic(<ShieldCheck style={{ width: 12, height: 12 }} />), label: "Proctoring" },
          { icon: ic(<BarChart3 style={{ width: 12, height: 12 }} />), label: "Reports" },
        ]}
      />
      <div className={s.main}>
        <div className={s.panelTitle}>
          <span>Activity log</span>
          <span className={`${s.chip}`}>Chronological, immutable</span>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          {[
            ["10:02:14", "Session started"],
            ["10:17:22", "Face verification check"],
            ["10:38:56", "Tab visibility change recorded"],
            ["11:24:03", "Submission accepted"],
          ].map(([ts, ev]) => (
            <div key={ts} className={s.row}>
              <span className="mono" style={{ fontSize: "0.6875rem", color: "var(--lp-dim)" }}>
                {ts}
              </span>
              <span style={{ fontSize: "0.6875rem" }}>{ev}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: "0.625rem", color: "var(--lp-dimmer)", lineHeight: 1.6 }}>
          Events are timestamped for auditability. Lockdown features are not claimed or enforced.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------ 12 · coding details ---- */

export function CodingDetailsScreen() {
  return (
    <div className={s.app}>
      <Side
        brand="Leou."
        active="Coding"
        items={[
          { icon: ic(<Home style={{ width: 12, height: 12 }} />), label: "Dashboard" },
          { icon: ic(<Terminal style={{ width: 12, height: 12 }} />), label: "Coding" },
          { icon: ic(<BookOpen style={{ width: 12, height: 12 }} />), label: "Practice" },
          { icon: ic(<FileCheck2 style={{ width: 12, height: 12 }} />), label: "Results" },
        ]}
      />
      <div className={s.main}>
        <div className={s.panelTitle}>
          <span>Coding runner</span>
          <span className={`${s.chip} ${s.chipViolet}`}>Coding · Database</span>
        </div>
        <div className={s.panel} style={{ gap: 4 }}>
          <div style={{ fontSize: "0.6875rem", color: "var(--lp-dim)" }}>stdin/stdout/stderr captured</div>
          <div className="mono" style={{ fontSize: "0.625rem", lineHeight: 1.8, color: "var(--lp-dim)" }}>
            {"> run tests\nall passed\nruntime: 0.012s\nexit: 0"}
          </div>
          <div style={{ fontSize: "0.6875rem", color: "var(--lp-dim)" }}>Test cases: public + hidden</div>
          <div style={{ fontSize: "0.6875rem" }}>Each attempt runs on its own, then is discarded</div>
        </div>
        <div style={{ fontSize: "0.625rem", color: "var(--lp-dimmer)", lineHeight: 1.6 }}>
          Each attempt is isolated and wiped afterwards. Checking is automatic; final marks stay
          with the teacher.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------- 13 · question types ---- */

export function QuestionTypesScreen() {
  return (
    <div className={s.app}>
      <Side
        brand="Leou."
        active="Bank"
        items={[
          { icon: ic(<Home style={{ width: 12, height: 12 }} />), label: "Dashboard" },
          { icon: ic(<BookOpen style={{ width: 12, height: 12 }} />), label: "Question Bank" },
          { icon: ic(<ClipboardCheck style={{ width: 12, height: 12 }} />), label: "Assessments" },
          { icon: ic(<ListChecks style={{ width: 12, height: 12 }} />), label: "Evaluation" },
        ]}
      />
      <div className={s.main}>
        <div className={s.panelTitle}>
          <span>Question types</span>
          <span className={`${s.chip}`}>MCQ · SHORT · LONG · CODING · DATABASE · ORAL · UPLOAD</span>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          {["MCQ: auto-graded", "SHORT/LONG: manual with feedback", "CODING: judge with tests", "DATABASE: query against a seeded schema", "ORAL/UPLOAD: evaluation queue"].map((x) => (
            <div key={x} className={s.row}>
              <span style={{ fontSize: "0.6875rem" }}>{x}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: "0.625rem", color: "var(--lp-dimmer)", lineHeight: 1.6 }}>
          Images, difficulty, topics, explanations and hidden test cases supported.
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------- 14 · settings ---- */

export function SettingsScreen() {
  return (
    <div className={s.app}>
      <Side
        brand="Leou."
        active="Settings"
        items={[
          { icon: ic(<Home style={{ width: 12, height: 12 }} />), label: "Dashboard" },
          { icon: ic(<Users style={{ width: 12, height: 12 }} />), label: "Users" },
          { icon: ic(<ClipboardCheck style={{ width: 12, height: 12 }} />), label: "Batches" },
          { icon: ic(<Settings style={{ width: 12, height: 12 }} />), label: "Settings" },
        ]}
      />
      <div className={s.main}>
        <div className={s.panelTitle}>
          <span>Institute settings</span>
          <span className={`${s.chip}`}>Configurable</span>
        </div>
        <div className={s.panel} style={{ gap: 4 }}>
          {["Batch timing", "Assessment window", "Grading policy", "Face verification mode"].map((x) => (
            <div key={x} className={s.row}>
              <span style={{ fontSize: "0.6875rem" }}>{x}</span>
              <span className={s.dot} style={{ opacity: 0.4 }} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: "0.625rem", color: "var(--lp-dimmer)", lineHeight: 1.6 }}>
          Non-privileged roles see limited, read-only views where applicable.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------- 15 · oral/upload ---- */

export function OralUploadScreen() {
  return (
    <div className={s.app}>
      <Side
        brand="Leou."
        active="Evaluation"
        items={[
          { icon: ic(<Home style={{ width: 12, height: 12 }} />), label: "Dashboard" },
          { icon: ic(<ListChecks style={{ width: 12, height: 12 }} />), label: "Evaluation" },
          { icon: ic(<Mic style={{ width: 12, height: 12 }} />), label: "Oral" },
          { icon: ic(<UploadCloud style={{ width: 12, height: 12 }} />), label: "Uploads" },
        ]}
      />
      <div className={s.main}>
        <div className={s.panelTitle}>
          <span>Oral · Upload review</span>
          <span className={`${s.chip} ${s.chipWarn}`}>In queue</span>
        </div>
        <div className={s.panel}>
          <div style={{ fontSize: "0.6875rem" }}>Submission: Answer.pdf · Audio clip attached</div>
          <div style={{ fontSize: "0.6875rem", color: "var(--lp-dim)" }}>
            Rationale (study feedback): clarity, coverage, key points — attached to assist review.
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Needs review", "Marks pending"].map((b) => (
              <span key={b} className={s.chip}>
                {b}
              </span>
            ))}
          </div>
        </div>
        <div style={{ fontSize: "0.625rem", color: "var(--lp-dimmer)", lineHeight: 1.6 }}>
          Teacher releases marks; nothing is auto-published. Feedback never assigns final marks.
        </div>
      </div>
    </div>
  );
}
