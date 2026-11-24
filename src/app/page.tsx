import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Camera,
  Check,
  ChevronRight,
  Code2,
  FileCheck2,
  Fingerprint,
  GraduationCap,
  Layers,
  ListChecks,
  Lock,
  Mic,
  Paperclip,
  ScanFace,
  ShieldCheck,
  Terminal,
  Users,
} from "lucide-react";
import { LeouGlyph, SparkDot } from "@/components/brand";
import { MacBrowser } from "@/components/landing/MacBrowser";
import { Parallax } from "@/components/landing/Parallax";
import { Reveal } from "@/components/landing/Reveal";
import { CountUp } from "@/components/landing/CountUp";
import { AutoTerminal } from "@/components/landing/AutoTerminal";
import { HeroScroll, ScrollProgress } from "@/components/landing/ScrollBits";
import { LandingNav } from "@/components/landing/LandingNav";
import {
  ArrowScribble,
  BoltDoodle,
  CircleScribble,
  DotsDoodle,
  LoopScribble,
  Sparkle,
  UnderlineScribble,
} from "@/components/landing/Doodles";
import {
  EvaluationScreen,
  FaceScreen,
  PaymentScreen,
  SandboxScreen,
  SnaiScreen,
  StudentHomeScreen,
} from "@/components/landing/Screens";
import s from "@/components/landing/landing.module.css";

/**
 * Public landing page.
 *
 * A server component. Only the pieces that genuinely need a browser — the
 * auto-playing showcase, parallax, scroll reveals, counters and the typing
 * terminal — are client components, so all the copy and every link arrive as
 * plain HTML and work with scripting disabled.
 *
 * On honesty: every product claim below was checked against the code before it
 * was written. Where a capability is configurable but not enforced (proctoring
 * lockdown), it is not advertised here. Screens in the showcase use invented
 * demo data and are labelled as such.
 */

const NAV = [
  { href: "#platform", label: "Platform" },
  { href: "#questions", label: "Question types" },
  { href: "#roles", label: "Who it's for" },
  { href: "#tech", label: "Security" },
];

const TRUST = [
  { icon: ScanFace, label: "Face-verified sign-in" },
  { icon: Lock, label: "Answers checked automatically" },
  { icon: ShieldCheck, label: "IP + device audit trail" },
  { icon: BadgeCheck, label: "Auto and manual grading" },
];

/* Four deep-dive rows. `Screen` is a real surface, not an illustration. */
const FEATURES = [
  {
    id: "identity",
    eyebrow: "Identity",
    title: "A login that can't be shared",
    body: "Registration captures a face template. Every sign-in after that runs a liveness check and matches the face against the stored template on the server, with a majority vote across samples. No photo is ever written to disk — only the template that lets us recognise you.",
    points: [
      "Face match decided on the server, never on the device",
      "Silent anti-spoofing on every sign-in",
      "Admin-issued access code as a controlled fallback",
    ],
    Screen: FaceScreen,
    flip: false,
  },
  {
    id: "checking",
    eyebrow: "Feedback",
    title: "Answers checked the moment they're written",
    body: "Leou reads a submitted answer back against the mark scheme and reports what it found, what to fix, and the reference. It is deliberately framed as a study aid: six honest verdicts, and never a final mark — oral and written answers still go to a teacher.",
    points: [
      "Correct · Nearly there · Partly right · Needs work",
      "Spoken answers transcribed, then checked",
      "Your answers stay on our servers — nothing is sent to a third party",
    ],
    Screen: SnaiScreen,
    flip: true,
  },
  {
    id: "sandbox",
    eyebrow: "Execution",
    title: "Coding and database answers, marked instantly",
    body: "Coding and database questions are graded by actually running them against hidden test cases, so a student sees a score the moment they submit. Each attempt runs in its own secure space and is thrown away afterwards — nothing a student writes can reach the rest of the platform.",
    points: [
      "Hidden test cases with per-case weights",
      "A score and the failing cases, straight away",
      "Each attempt is isolated and wiped afterwards",
    ],
    Screen: SandboxScreen,
    flip: false,
  },
  {
    id: "money",
    eyebrow: "Operations",
    title: "Fees that verify themselves",
    body: "Students pay first and prove it after — transaction ID, a screenshot, or a photo of the UPI screen. Leou reads the amount, date, time and payee straight off the image and pre-fills the admin's checklist, so verification is a comparison rather than a transcription exercise.",
    points: [
      "Camera scan extracts amount, date, time and payee",
      "Every request carries a LEOU-XXXX-XXXX reference",
      "Superseded attempts stay on the record",
    ],
    Screen: PaymentScreen,
    flip: true,
  },
];

/* The seven types are the real QuestionType enum, in order. */
const QUESTION_TYPES = [
  { name: "MCQ", desc: "Single or multi choice, auto-graded", icon: ListChecks },
  { name: "SHORT", desc: "Two or three marks, teacher marked", icon: FileCheck2 },
  { name: "LONG", desc: "Essay answers with a mark scheme", icon: BookOpen },
  { name: "CODING", desc: "Runs against hidden test cases", icon: Code2 },
  { name: "DATABASE", desc: "A query against a seeded schema", icon: Layers },
  { name: "ORAL", desc: "Recorded aloud, then transcribed", icon: Mic },
  { name: "UPLOAD", desc: "Photos of handwritten working", icon: Paperclip },
];

const ROLES = [
  {
    icon: GraduationCap,
    tint: "linear-gradient(140deg, #6366f1, #8b5cf6)",
    title: "Students",
    body: "A face-verified login and a workspace per batch.",
    points: [
      "Classes, tests, results and dated reports",
      "Answer checking with written feedback",
      "Code and database answers in the browser",
      "Fee history and payment proof upload",
    ],
  },
  {
    icon: Users,
    tint: "linear-gradient(140deg, #fbbf24, #fb7185)",
    title: "Parents",
    body: "A read-only window onto their child's progress.",
    points: [
      "Released results and reports only",
      "Fee position at a glance",
      "No independent actions of any kind",
    ],
  },
];

const STATS = [
  { to: 3, label: "Roles, one data model" },
  { to: 7, label: "Question types" },
  { to: 3, label: "Auto-scored answer types" },
  { to: 2, label: "Grading modes" },
];

export default function HomePage() {
  const year = new Date().getFullYear();

  return (
    <div className={s.lp}>
      {/* Everything decorative is CSS-driven and hidden by default. Without
          scripting the page still shows all of its copy and links. */}
      <noscript>
        <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <ScrollProgress />
      <HeroScroll />

      {/* ================================================================ nav */}
      <LandingNav nav={NAV} />

      {/* =============================================================== hero */}
      <section className={s.hero}>
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className={s.mesh} />
          {/* Signature ambience: two drifting aurora ribbons and one raked beam.
              All three are pure gradients, so they cost no layout and no JS. */}
          <div className={s.aurora} />
          <div className={`${s.aurora} ${s.auroraB}`} />
          <Parallax className="absolute inset-0" speed={0.03} limit={40}>
            <div data-parallax-target className={s.beam} />
          </Parallax>
          <Parallax className="absolute inset-0" speed={-0.05} limit={80}>
            <div data-parallax-target className={`${s.gridBg} opacity-70`} />
          </Parallax>
          <Parallax className="absolute inset-0" speed={-0.05} limit={80}>
            <div
              data-parallax-target
              className="absolute -top-48 left-1/2 h-[34rem] w-[min(58rem,120vw)] -translate-x-1/2 rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(closest-side, rgb(157 92 255 / 0.36), transparent 72%)",
                animation: "lpDrift 26s ease-in-out infinite",
              }}
            />
          </Parallax>
          <Parallax className="absolute inset-0" speed={-0.1} limit={120}>
            <div
              data-parallax-target
              className="absolute top-16 -right-24 h-96 w-96 rounded-full blur-3xl"
              style={{
                background: "radial-gradient(closest-side, rgb(77 247 255 / 0.26), transparent 70%)",
                animation: "lpDriftSlow 32s ease-in-out infinite",
              }}
            />
          </Parallax>
        </div>
        <div className={s.grain} aria-hidden />

          <div className={`${s.shell} relative z-10 text-center ${s.heroRecede}`}>
          <Reveal>
            <span className={s.pill}>
              <span className={s.dot} />
              Face verification and answer checking are live
            </span>
          </Reveal>

          <Reveal delay={70}>
            {/* `relative` anchors the two doodles to the headline. */}
            <h1 className={`${s.display} relative mx-auto mt-7 max-w-5xl`}>
              The exam room,
              <br />
              <span className={s.serif}>rebuilt</span> for people who
              <br className="hidden sm:block" /> take it seriously.
            </h1>
            {/* Hand-drawn annotations around the headline. Decorative only —
                the h1 above carries the same words without them. */}
            <UnderlineScribble
              className="pointer-events-none absolute -bottom-2 left-[6%] hidden h-5 w-56 text-[var(--lp-cyan)]/70 lg:block"
              aria-hidden
            />
            <BoltDoodle
              className="pointer-events-none absolute -right-2 top-4 hidden h-10 w-10 text-[var(--lp-violet)]/60 xl:block"
              aria-hidden
            />
          </Reveal>

          <Reveal delay={140}>
            <p className={`${s.lede} mx-auto mt-7 max-w-2xl`}>
              Leou. runs assignments, mock tests and real examinations for tuition batches — with a
              face-verified login, answers checked the moment they&apos;re submitted, and feedback that
              tells a student exactly what to fix.
            </p>
          </Reveal>

          <Reveal delay={210}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className={s.btnPrimary}>
                Create a student account
                <ArrowRight style={{ width: 15, height: 15 }} />
              </Link>
              <Link href="/login" className={s.btnGhost}>
                <ScanFace style={{ width: 15, height: 15 }} />
                Sign in with your face
              </Link>
            </div>
          </Reveal>

          <Reveal delay={280}>
            <ul className={`${s.trust} mt-10 justify-center`}>
              {TRUST.map((t) => (
                <li key={t.label} className={s.trustItem}>
                  <t.icon style={{ width: 14, height: 14 }} />
                  {t.label}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={360}>
            <a href="#platform" className={s.scrollCue} aria-label="Scroll to explore">
              <span className={s.scrollCueMouse} aria-hidden>
                <span className={s.scrollCueWheel} />
              </span>
            </a>
          </Reveal>
        </div>

        <div className={`${s.shell} relative z-10 pb-24`}>
          <Parallax speed={0.045} limit={54}>
            <Reveal variant="scale" delay={120}>
              <MacBrowser />
            </Reveal>
          </Parallax>
        </div>
      </section>

      {/* ============================================================== stats */}
      <section className="border-b border-[var(--lp-line-soft)]">
        <div className={s.shell}>
          <div className="grid grid-cols-2 gap-px lg:grid-cols-4">
            {STATS.map((st, i) => (
              <Reveal key={st.label} delay={i * 80}>
                <div className="py-9 text-center">
                  <div className={`${s.statBig} ${s.grad}`}>
                    <CountUp to={st.to} />
                  </div>
                  <div className="mt-1.5 text-[0.8125rem] text-[var(--lp-dimmer)]">{st.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================== features */}
      <section id="platform" className={`${s.section} scroll-mt-24`}>
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <ArrowScribble className={`${s.doodle} -left-4 top-40 hidden h-24 w-28 lg:block`} />
          <LoopScribble className={`${s.doodle} -right-4 top-[38rem] hidden h-28 w-24 lg:block`} />
          <Parallax className="absolute inset-0" speed={-0.04} limit={70}>
            <div
              data-parallax-target
              className="absolute top-1/4 -left-40 h-[30rem] w-[30rem] rounded-full blur-3xl"
              style={{
                background: "radial-gradient(closest-side, rgb(157 92 255 / 0.2), transparent 70%)",
                animation: "lpDriftSlow 38s ease-in-out infinite",
              }}
            />
          </Parallax>
        </div>

        <div className={`${s.shell} relative`}>
          <Reveal className={`${s.sectionHead} ${s.sectionHeadCenter}`}>
            <span className={s.eyebrow}>The platform</span>
            <h2 className={`${s.h2} mt-4`}>
              Four things that are genuinely hard,
              <br className="hidden sm:block" /> and genuinely finished.
            </h2>
            <p className={`${s.lede} mt-5`}>
              Each of these is a working surface in the product today, not a roadmap item.
            </p>
          </Reveal>

          <div className="flex flex-col gap-24 lg:gap-32">
            {FEATURES.map((f) => {
              const { Screen } = f;
              return (
                <div key={f.id} className={`${s.feature} ${f.flip ? s.featureFlip : ""}`}>
                  <Reveal variant="x" className={s.featureCopy}>
                    <div className={s.featureBody}>
                      <span className={s.eyebrow}>{f.eyebrow}</span>
                      <h3 className={s.h3}>{f.title}</h3>
                      <p className={`${s.lede} text-[0.9375rem]`}>{f.body}</p>
                      <ul className={s.bullets}>
                        {f.points.map((p) => (
                          <li key={p} className={s.bullet}>
                            <span className={s.bulletIcon}>
                              <Check style={{ width: 10, height: 10, strokeWidth: 3 }} />
                            </span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                      <Link
                        href="/register"
                        className="mt-1 inline-flex h-8 w-fit items-center gap-1.5 rounded-md px-2 text-sm font-medium text-[var(--lp-cyan)] transition-colors hover:text-white"
                      >
                        See it with a real batch
                        <ChevronRight style={{ width: 14, height: 14 }} />
                      </Link>
                    </div>
                  </Reveal>

                  <Reveal variant="scale" delay={120} className={s.featureArt}>
                    <div
                      className={`${s.lpEdge} relative overflow-hidden rounded-[0.85rem]`}
                      style={{ background: "linear-gradient(180deg, #0c1220, #070a12)" }}
                    >
                      <div className={s.stage}>
                        <Screen />
                      </div>
                    </div>
                    <Sparkle className={`${s.doodle} -right-3 -top-7 h-9 w-9`} aria-hidden />
                  </Reveal>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ====================================================== question types */}
      <section id="questions" className={`${s.section} scroll-mt-24 border-y border-[var(--lp-line-soft)]`}>
        <div className={s.shell}>
          <Reveal className={`${s.sectionHead} ${s.sectionHeadCenter}`}>
            <span className={s.eyebrow}>Question bank</span>
            <h2 className={`${s.h2} mt-4`}>Seven ways to ask a question</h2>
            <p className={`${s.lede} mt-5`}>
              Every type is authored once in the bank and then delivered per batch — with images,
              explanations, difficulty and its own marking scheme.
            </p>
          </Reveal>

          <div className={s.typeGrid}>
            {QUESTION_TYPES.map((q, i) => (
              <Reveal key={q.name} delay={i * 60} className="h-full">
                <div className={`${s.typeCell} ${s.lpEdge} h-full`}>
                  <q.icon
                    style={{ width: 17, height: 17, color: "var(--lp-cyan)" }}
                    aria-hidden
                  />
                  <span className={s.typeName}>{q.name}</span>
                  <span className={s.typeDesc}>{q.desc}</span>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <p className="mt-8 text-center text-[0.8125rem] text-[var(--lp-dimmer)]">
              Plus difficulty tags, per-subject topics, optional images, worked explanations and
              hidden test cases with their own weights.
            </p>
          </Reveal>

          {/* An authoring surface, because a question bank is only useful if a
              teacher can actually put something into it. */}
          <Reveal variant="scale" delay={120}>
            <div className={`${s.lpEdge} mt-14 overflow-hidden rounded-[0.85rem]`}>
              <div className={s.stage}>
                <StudentHomeScreen />
              </div>
            </div>
            <DotsDoodle className={`${s.doodle} -right-2 bottom-10 hidden h-12 w-32 lg:block`} aria-hidden />
          </Reveal>
        </div>
      </section>

      {/* ============================================================== roles */}
      <section id="roles" className={`${s.section} scroll-mt-24`}>
        <div className={s.shell}>
          <Reveal className={`${s.sectionHead} ${s.sectionHeadCenter}`}>
            <span className={s.eyebrow}>Who it&apos;s for</span>
            <h2 className={`${s.h2} mt-4`}>One login, two very different jobs</h2>
            <p className={`${s.lede} mt-5`}>
              Role-focused surfaces over a single data model — a parent sees a read-only window, never
              a control panel.
            </p>
          </Reveal>

          <div className="grid gap-5 md:grid-cols-2">
            {ROLES.map((r, i) => (
              <Reveal key={r.title} delay={i * 100} className="h-full">
                <div className={`${s.roleCard} ${s.lpEdge} h-full`}>
                  <span className={s.roleIcon} style={{ background: r.tint }}>
                    <r.icon style={{ width: 20, height: 20, color: "#fff" }} />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">{r.title}</h3>
                    <p className="mt-1 text-[0.8125rem] text-[var(--lp-dimmer)]">{r.body}</p>
                  </div>
                  <ul className={s.roleList}>
                    {r.points.map((p) => (
                      <li key={p}>
                        <Check
                          style={{
                            width: 13,
                            height: 13,
                            marginTop: 3,
                            color: "var(--lp-good)",
                            flexShrink: 0,
                          }}
                        />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================= under hood */}
      <section id="tech" className={`${s.section} scroll-mt-24 border-y border-[var(--lp-line-soft)]`}>
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className={s.mesh}
            style={{ opacity: 0.55, transform: "scaleY(-1)" }}
          />
        </div>

        <div className={`${s.shell} relative grid items-center gap-12 lg:grid-cols-2`}>
          <Reveal>
            <div className={s.featureBody}>
              <span className={s.eyebrow}>Security</span>
              <h2 className={s.h3}>
                Built for the moments that matter, because an exam is not a place to be casual.
              </h2>
              <p className={`${s.lede} text-[0.9375rem]`}>
                Faces are matched on the server and the photos are discarded immediately. Every
                login, submission and payment decision is written to an activity log with the IP
                address and a device fingerprint, so there is always a record of what happened.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/register" className={`${s.btnPrimary} px-5 py-2.5 text-sm`}>
                  Create an account <ArrowRight style={{ width: 14, height: 14 }} />
                </Link>
                <Link href="/login" className={`${s.btnGhost} px-5 py-2.5 text-sm`}>
                  Sign in
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal variant="scale" delay={120}>
            <AutoTerminal />
          </Reveal>
        </div>
      </section>

      {/* ============================================================ grading */}
      <section className={s.section}>
        <div className={s.shell}>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal variant="scale">
              <div className={`${s.lpEdge} overflow-hidden rounded-[0.85rem]`}>
                <div className={s.stage}>
                  <EvaluationScreen />
                </div>
              </div>
              <CircleScribble
                className={`${s.doodle} -bottom-8 -left-6 hidden h-24 w-28 lg:block`}
                aria-hidden
              />
            </Reveal>

            <Reveal variant="x">
              <div className={s.featureBody}>
                <span className={s.eyebrow}>Marking</span>
                <h2 className={s.h3}>Automatic where it should be, human where it must be</h2>
                <p className={`${s.lede} text-[0.9375rem]`}>
                  Objective answers and code tests are graded the moment a submission lands. Oral and
                  written answers go into a teacher&apos;s queue with an automatic first-pass check
                  attached as a starting point. Nothing reaches a student until the marks are released.
                </p>
                <ul className={s.bullets}>
                  <li className={s.bullet}>
                    <span className={s.bulletIcon}>
                      <Check style={{ width: 10, height: 10, strokeWidth: 3 }} />
                    </span>
                    <span>Auto-scored MCQs, coding and database answers with weighted test cases</span>
                  </li>
                  <li className={s.bullet}>
                    <span className={s.bulletIcon}>
                      <Check style={{ width: 10, height: 10, strokeWidth: 3 }} />
                    </span>
                    <span>Teacher evaluation with per-question marks and written feedback</span>
                  </li>
                  <li className={s.bullet}>
                    <span className={s.bulletIcon}>
                      <Check style={{ width: 10, height: 10, strokeWidth: 3 }} />
                    </span>
                    <span>Dated per-student reports, released on your schedule</span>
                  </li>
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================================================================= cta */}
      <section className="px-5 pb-24 sm:px-8">
        <Reveal variant="scale">
          <div className={`${s.cta} ${s.lpEdge} mx-auto max-w-5xl`}>
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
              <div className={s.mesh} />
            </div>
            <div className={s.grain} aria-hidden />
            <div className="relative">
              <Sparkle
                className="mx-auto mb-5 h-8 w-8 text-[var(--lp-cyan)]"
                aria-hidden
              />
              <h2 className={`${s.h2} mx-auto max-w-2xl`}>
                Your next exam deserves better than{" "}
                <span className={s.serif}>a shared login</span>
              </h2>
              <p className={`${s.lede} mx-auto mt-5 max-w-xl`}>
                Face-verified accounts, instant answer checking and honest feedback — ready for your
                batch today.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/register" className={`${s.btnPrimary} w-full sm:w-auto`}>
                  Create a student account <ArrowRight style={{ width: 15, height: 15 }} />
                </Link>
                <Link href="/login" className={`${s.btnGhost} w-full sm:w-auto`}>
                  Sign in
                </Link>
              </div>
              <p className="mt-6 text-xs text-[var(--lp-dimmer)]">
                Illustrative screens — the showcase above uses invented demo data, never a real
                student&apos;s.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============================================================== footer */}
      <footer className="border-t border-[var(--lp-line-soft)]">
        <div className={s.shell}>
          <div className={s.footerGrid}>
            <div className={s.footerCol}>
              <Link href="/" className="mb-1 flex items-center gap-2.5">
                <LeouGlyph className="h-7 w-7" />
                <span className="font-semibold tracking-tight">
                  Leou<SparkDot className="ml-0.5 text-[0.62em]" />
                </span>
              </Link>
              <p className="max-w-[16rem] text-[0.8125rem] leading-relaxed text-[var(--lp-dimmer)]">
                Assignments, mock tests and proctored-grade assessment for tuition batches.
              </p>
            </div>

            {[
              {
                head: "Platform",
                links: [
                  { label: "Features", href: "#platform" },
                  { label: "Question types", href: "#questions" },
                  { label: "Who it&apos;s for", href: "#roles" },
                  { label: "Security", href: "#tech" },
                ],
              },
              {
                head: "Account",
                links: [
                  { label: "Sign in", href: "/login" },
                  { label: "Register", href: "/register" },
                ],
              },
              {
                head: "Trust",
                links: [
                  { label: "Face verification", href: "#platform" },
                  { label: "Answer checking", href: "#tech" },
                  { label: "Activity logs", href: "#roles" },
                ],
              },
            ].map((col) => (
              <div key={col.head} className={s.footerCol}>
                <span className={s.footerHead}>{col.head}</span>
                {col.links.map((l) => (
                  <Link key={l.label} href={l.href} className={s.footerLink}>
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>

          <div className={`${s.ctaFooter} border-t border-[var(--lp-line-soft)]`}>
            <span>
              © {year} Leou. — assignments, mock tests &amp; serious assessment.
            </span>
            <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <span className="flex items-center gap-1.5">
                <Fingerprint style={{ width: 12, height: 12 }} /> Face-verified
              </span>
              <span className="flex items-center gap-1.5">
                <Camera style={{ width: 12, height: 12 }} /> Screenshot-verified fees
              </span>
              <span className="flex items-center gap-1.5">
                <Terminal style={{ width: 12, height: 12 }} /> Auto-checked code
              </span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
