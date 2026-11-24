"use client";

/**
 * The hero showcase: a macOS window that tours the product on its own.
 *
 * Behaviour worth knowing about:
 *  - It auto-advances every CYCLE_MS, but pauses the moment the pointer enters
 *    the window, a tab is focused, the tab is hidden, or the visitor has asked
 *    for reduced motion. It resumes when they leave.
 *  - Keyboard and pointer users can drive it manually; auto-advance is a
 *    progressive enhancement, never the only way to see a screen.
 *  - Every screen is a static mockup of invented demo data (see Screens.tsx).
 */

import { useCallback, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Code2,
  CreditCard,
  FileCheck2,
  FileText,
  Home,
  ListChecks,
  Lock,
  Mic,
  ScanFace,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useReducedMotion, useVisibleInterval } from "./motion";
import {
  AdminUsersScreen,
  CodingDetailsScreen,
  EvaluationScreen,
  ExamAttemptScreen,
  FaceScreen,
  OralUploadScreen,
  PaymentLedgerScreen,
  PaymentScreen,
  ProctorEventsScreen,
  QuestionTypesScreen,
  ReportsScreen,
  SandboxScreen,
  SettingsScreen,
  SnaiScreen,
  StudentHomeScreen,
} from "./Screens";
import s from "./landing.module.css";

const CYCLE_MS = 5200;

/** The test suite waits this long to assert the tour advanced on its own. */
export const DEMO_CYCLE_MS = CYCLE_MS;

type Tab = {
  id: string;
  label: string;
  url: string;
  caption: string;
  Screen: () => React.JSX.Element;
};

/** Icons per tab, kept out of the data so the array stays purely descriptive. */
const ICONS = {
  home: Home,
  face: ScanFace,
  test: ListChecks,
  sandbox: Code2,
  payments: CreditCard,
  evaluation: ClipboardCheck,
  exam: FileText,
  reports: BarChart3,
  users: Users,
  ledger: CreditCard,
  logs: FileCheck2,
  coding: Code2,
  qtypes: BookOpen,
  settings: Settings,
  oral: Mic,
} as const satisfies Record<string, LucideIcon>;

const TABS: Tab[] = [
  {
    id: "home",
    label: "Student home",
    url: "leou.app/dashboard",
    caption: "One dashboard for students, parents and admins with role-aware views.",
    Screen: StudentHomeScreen,
  },
  {
    id: "face",
    label: "Face sign-in",
    url: "leou.app/login",
    caption: "Every sign-in runs a liveness check against the stored face template.",
    Screen: FaceScreen,
  },
  {
    id: "test",
    label: "Answer check",
    url: "leou.app/tests/attempt",
    caption: "Leou reads the answer back and shows what to fix — never a final mark.",
    Screen: SnaiScreen,
  },
  {
    id: "sandbox",
    label: "Coding",
    url: "leou.app/tests/attempt/run",
    caption: "Student code is run against hidden tests, then wiped.",
    Screen: SandboxScreen,
  },
  {
    id: "payments",
    label: "Payment check",
    url: "leou.app/admin/payments",
    caption: "A camera scan of the UPI screen fills the verification checklist.",
    Screen: PaymentScreen,
  },
  {
    id: "evaluation",
    label: "Evaluation",
    url: "leou.app/admin/evaluation",
    caption: "Auto-graded objective answers; oral and written answers wait for a teacher.",
    Screen: EvaluationScreen,
  },
  {
    id: "exam",
    label: "Exam attempt",
    url: "leou.app/tests/attempt",
    caption: "Question view, timer, options and autosave during the attempt.",
    Screen: ExamAttemptScreen,
  },
  {
    id: "reports",
    label: "Reports",
    url: "leou.app/dashboard/reports",
    caption: "Batch performance and study insights — no mark prediction.",
    Screen: ReportsScreen,
  },
  {
    id: "users",
    label: "Users",
    url: "leou.app/admin/users",
    caption: "Role-scoped user management — STUDENT, ADMIN, PARENT.",
    Screen: AdminUsersScreen,
  },
  {
    id: "ledger",
    label: "Payments ledger",
    url: "leou.app/admin/payments",
    caption: "Payment ledger with automatic verification and a review workflow.",
    Screen: PaymentLedgerScreen,
  },
  {
    id: "logs",
    label: "Activity logs",
    url: "leou.app/admin/activity",
    caption: "Chronological, immutable audit trail of platform events.",
    Screen: ProctorEventsScreen,
  },
  {
    id: "coding",
    label: "Coding detail",
    url: "leou.app/tests/coding",
    caption: "The coding runner with limits, hidden test cases and captured I/O.",
    Screen: CodingDetailsScreen,
  },
  {
    id: "qtypes",
    label: "Question bank",
    url: "leou.app/admin/questions",
    caption: "MCQ, SHORT, LONG, CODING, DATABASE, ORAL, UPLOAD with images and test cases.",
    Screen: QuestionTypesScreen,
  },
  {
    id: "settings",
    label: "Settings",
    url: "leou.app/admin/settings",
    caption: "Batch config and institution settings with least-privilege views.",
    Screen: SettingsScreen,
  },
  {
    id: "oral",
    label: "Oral & Upload",
    url: "leou.app/evaluation/oral",
    caption: "Oral and upload answers enter the evaluation queue for review.",
    Screen: OralUploadScreen,
  },
];

export function MacBrowser() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  const hoverTimer = useRef<number | undefined>(undefined);

  const go = useCallback((next: number) => {
    setActive(((next % TABS.length) + TABS.length) % TABS.length);
  }, []);

  const step = useCallback(
    (delta: number) => {
      go(active + delta);
    },
    [active, go],
  );

  /* Auto-advance. `useVisibleInterval` already no-ops while the tab is hidden
     or the element is off screen, so the tour costs nothing when nobody is
     looking at it. */
  useVisibleInterval(() => {
    if (!held && !reduced) setActive((i) => (i + 1) % TABS.length);
  }, CYCLE_MS);

  /* Pause briefly on hover rather than snapping away mid-gesture. */
  const onEnter = () => {
    window.clearTimeout(hoverTimer.current);
    setHeld(true);
  };
  const onLeave = () => {
    hoverTimer.current = window.setTimeout(() => setHeld(false), 900);
  };

  /* Arrow keys move between screens when the tab strip has focus. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };

  const Tab = TABS[active];
  const Screen = Tab.Screen;

  return (
    <div
      className={s.showcase}
      data-demo
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocusCapture={onEnter}
      onBlurCapture={onLeave}
    >
      <div className={s.window}>
        <div className={s.chrome}>
          <div className={s.lights} aria-hidden>
            <span className={s.light} style={{ background: "#ff5f57" }} />
            <span className={s.light} style={{ background: "#febc2e" }} />
            <span className={s.light} style={{ background: "#28c840" }} />
          </div>
          <div className={s.urlbar}>
            <Lock className={s.lock} style={{ width: 10, height: 10 }} />
            <span>{Tab.url}</span>
          </div>
        </div>

        {/* The tour is fully drivable without the timer: real buttons, arrow
            keys, and a visible focus ring. */}
        <div
          className={s.tabbar}
          role="tablist"
          aria-label="Product screens"
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          {TABS.map((t, i) => {
            const Icon = ICONS[t.id as keyof typeof ICONS];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={i === active}
                data-demo-tab={t.id}
                className={`${s.tab} ${i === active ? s.tabActive : ""}`}
                onClick={() => go(i)}
              >
                <Icon className={s.tabIcon} style={{ width: 11, height: 11 }} />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className={s.stage}>
          <div key={Tab.id} className={s.panel} data-demo-screen={Tab.id}>
            <Screen />
          </div>
        </div>

        <div className={s.caption}>
          <span data-demo-caption className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={s.demoBadge}>Illustrative data</span>
            <span className="min-w-0">{Tab.caption}</span>
          </span>
          <span className={s.pips} aria-hidden>
            {TABS.map((t, i) => (
              <span key={t.id} className={s.pip}>
                {i <= active ? <span className={s.pipFill} /> : null}
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
