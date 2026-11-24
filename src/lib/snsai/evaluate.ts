/**
 * SNSAI — evaluators.
 *
 * One evaluator per question type. Each returns a full SnsaiReport so the UI
 * never has to know which type it is looking at.
 *
 * Deterministic by design: the same answer always produces the same report, and
 * every mark is traceable to a stated reason. Nothing here calls a network
 * service, loads a model file, or keeps state between requests.
 */

import { arithmeticFaults, assemble, findMisconception, lengthFaults, missingPointFaults, relevanceFaults } from "./teach";
import {
  buildCriteria,
  cosine,
  extractConcepts,
  looksLikeKeywordList,
  normalise,
  precision as precisionOf,
  verbatimOverlap,
} from "./keypoints";
import { clamp, round, wordCount } from "./text";
import { outputsMatch } from "@/lib/outputMatch";
import type { SnsaiFault, SnsaiInput, SnsaiReport } from "./types";

/* ------------------------------------------------------------------ shared */

function blank(input: SnsaiInput, started: number, faults: SnsaiFault[] = []): SnsaiReport {
  return assemble({
    type: input.type,
    stem: input.stem,
    reference: input.reference,
    maxMarks: input.maxMarks,
    quality: 0,
    criteria: [],
    faults,
    words: 0,
    similarity: 0,
    coverage: 0,
    precision: 0,
    elapsedMs: Date.now() - started,
  });
}

/**
 * The written-answer evaluator, shared by SHORT, LONG and ORAL. These three
 * differ only in how the student's words are obtained and in how strictly
 * length is judged, not in how the ideas are marked.
 */
function evaluateWritten(input: SnsaiInput, answer: string, started: number): SnsaiReport {
  const trimmed = answer.trim();
  if (!trimmed) return blank(input, started);

  const { criteria, coverage, conflicts } = buildCriteria(
    input.reference,
    trimmed,
    input.stem,
    input.keyPoints
  );
  const similarity = cosine(normalise(trimmed), normalise(input.reference));
  const prec = precisionOf(trimmed, input.reference, input.stem);
  const overlap = verbatimOverlap(trimmed, input.reference);
  const words = wordCount(trimmed);
  const keywordList = looksLikeKeywordList(trimmed);

  const faults: SnsaiFault[] = [
    ...findMisconception(trimmed),
    ...missingPointFaults(criteria),
    ...lengthFaults(trimmed, input.type),
    ...relevanceFaults(prec, similarity, coverage),
    ...arithmeticFaults(trimmed, input.reference, input.stem),
  ];

  // Contradictions are surfaced as their own fault so the student sees the
  // specific idea they got backwards, not just a low number.
  for (const conflict of conflicts) {
    faults.push({
      kind: "misconception",
      message: conflict,
      teach: `The correct statement is: ${criteria.find((c) => c.note === "Stated, but with the opposite meaning.")?.expected ?? input.reference}`,
    });
  }

  if (keywordList) {
    faults.push({
      kind: "vague",
      message: "This reads as a list of words rather than an explanation.",
      teach:
        "Turn each keyword into a statement. Instead of writing \"volatile, non-volatile, firmware\", write \"RAM is volatile because it loses its data when the power is cut, whereas ROM is non-volatile and holds firmware.\"",
    });
  }

  // Copying the reference word-for-word is not understanding. It is reported
  // and capped hard, so it can never outscore an honest answer.
  //
  // A spoken answer is exempt. In an oral exam, repeating a taught answer
  // correctly is recall, not cheating: the student is being asked to *say* it,
  // and a verbatim sentence is the expected sign of having learnt it. Applying
  // the written-answer cap here scored the reference answer itself at 0.53 of
  // 2 and "incorrect", which told a student who was right that they were wrong.
  const spokenRecall = input.type === "ORAL";
  const copied = !spokenRecall && overlap > 0.88 && words > 12;
  if (copied) {
    faults.push({
      kind: "copied_reference",
      message: "This answer matches the reference answer almost word for word.",
      teach:
        "Understand it rather than reproduce it. Close the reference, then write the same points in your own words and add one example of your own. An answer copied from the book scores far lower than a genuine one.",
    });
  }

  // An example lifts an answer, but only a real explanation should be rewarded,
  // so this is a small nudge rather than a bonus.
  const hasExample = /\b(e\.g|eg|for example|for instance|such as|like)\b/i.test(trimmed);
  if (criteria.length > 0 && !hasExample) {
    faults.push({
      kind: "no_example",
      message: "No example was given.",
      teach:
        "One concrete example makes an answer memorable to the examiner. Add a short one — a device, a chip, or a value from this chapter.",
    });
  }

  // Quality is dominated by how much of the rubric was actually met. Similarity
  // and precision only break ties, so neither rambling nor keyword-stuffing can
  // outscore a genuine answer. The coverage multiplier is deliberately above 1:
  // a reference answer often lists more detail than a short answer had room
  // for, and a student who made every relevant point should not be punished
  // for stopping early.
  let quality = clamp(0.72 * Math.min(1, coverage * 1.3) + 0.16 * similarity + 0.12 * prec);
  if (keywordList) quality *= 0.6;
  if (conflicts.length > 0) quality = Math.min(quality, 0.45);
  // Capped below a genuinely partial answer, so reproducing the reference can
  // never be worth more than understanding half of it.
  if (copied) quality = Math.min(quality, 0.25);

  return assemble({
    type: input.type,
    stem: input.stem,
    reference: input.reference,
    maxMarks: input.maxMarks,
    quality,
    criteria,
    faults,
    words,
    similarity,
    coverage,
    precision: prec,
    elapsedMs: Date.now() - started,
  });
}

/* --------------------------------------------------------------------- MCQ */

function evaluateMcq(input: SnsaiInput, started: number): SnsaiReport {
  const payload = (input.payload ?? {}) as { optionIds?: unknown };
  const selected = Array.isArray(payload.optionIds) ? (payload.optionIds as string[]) : [];
  const options = input.options ?? [];
  const correct = options.filter((o) => o.isCorrect);
  const correctIds = new Set(correct.map((o) => o.id));
  const byId = new Map(options.map((o) => [o.id, o]));

  const faults: SnsaiFault[] = [];
  const criteria = options.map((o) => ({
    label: o.text.slice(0, 60),
    score: o.isCorrect ? (selected.includes(o.id) ? 1 : 0) : selected.includes(o.id) ? 0 : 1,
    hit: selected.includes(o.id) === o.isCorrect,
    expected: o.isCorrect ? `${o.text} — this is the correct option.` : `${o.text} — not correct.`,
    matched: selected.includes(o.id) ? [o.text] : [],
  }));

  if (selected.length === 0) {
    return blank(input, started, [
      {
        kind: "not_attempted",
        message: "You did not select any option.",
        teach: "Read every option and eliminate the ones that are definitely wrong before choosing.",
      },
    ]);
  }

  const rightOnes = selected.filter((id) => correctIds.has(id)).length;
  const wrongOnes = selected.filter((id) => !correctIds.has(id)).length;
  const full = selected.length === correctIds.size && rightOnes === correctIds.size;

  for (const id of selected) {
    if (!correctIds.has(id)) {
      const o = byId.get(id);
      faults.push({
        kind: "wrong_value",
        message: `"${o?.text ?? "That option"}" is not the correct answer.`,
        teach: `The correct answer is ${correct.map((c) => `"${c.text}"`).join(" or ")}. Read the question once more and check which option satisfies every word of it.`,
      });
    }
  }
  if (!full && rightOnes > 0 && wrongOnes > 0) {
    faults.push({
      kind: "wrong_value",
      message: "A right option was selected, but a wrong one was selected too.",
      teach: "For a single-answer question, choose only one option. Mixing a correct answer with a wrong one is marked wrong.",
    });
  }
  if (full && faults.length === 0) {
    faults.push({
      kind: "no_example",
      message: "Correct.",
      teach: `Right: ${correct.map((c) => c.text).join(" / ")}. Take a moment to say to yourself why the other options are wrong — that is what makes the answer stick.`,
    });
  }

  // Partial credit for a single-answer MCQ where the student picked a wrong
  // option: none, but every other correct option they did not pick is a
  // separate fault so the student learns what to reconsider.
  const quality = full ? 1 : rightOnes > 0 ? 0.4 : 0;

  return assemble({
    type: input.type,
    stem: input.stem,
    reference: input.reference,
    maxMarks: input.maxMarks,
    quality,
    criteria,
    faults,
    words: 0,
    similarity: full ? 1 : 0,
    coverage: full ? 1 : rightOnes / Math.max(1, correctIds.size),
    precision: 1,
    elapsedMs: Date.now() - started,
    attempted: selected.length > 0,
  });
}

/* ------------------------------------------------------------------ CODING */

/**
 * Coding is marked by running the code, never by reading it. SNSAI does not
 * guess whether a program is "right looking" — the test cases decide. What it
 * adds on top of the pass/fail is the diagnosis: which cases failed, what the
 * code printed, and which specific habit the failure points to.
 */
function evaluateCoding(input: SnsaiInput, started: number): SnsaiReport {
  const payload = (input.payload ?? {}) as { language?: string; code?: string; runs?: unknown[] };
  const code = (payload.code ?? "").trim();
  const runs = (payload.runs ?? []) as { stdout?: string; stderr?: string; exitCode?: number; timedOut?: boolean }[];

  if (!code) {
    return blank(input, started, [
      {
        kind: "not_attempted",
        message: "No code written.",
        teach: "Write the program first, run it on the sample input, and only then check your answer.",
      },
    ]);
  }

  const faults: SnsaiFault[] = [];
  const criteria = (input.testCases ?? []).map((tc, i) => {
    const run = runs[i];
    const printed = (run?.stdout ?? "").trim();
    const expected = tc.expected.trim();
    // The same normalisation the official grader uses, so Check and submit can
    // never disagree about the same output. Comparing raw strings marked a
    // program wrong for a trailing newline while the real grade passed it.
    const passed = !!run && outputsMatch(run.stdout ?? "", tc.expected) && run.exitCode === 0 && !run.timedOut;
    return {
      label: `Test case ${i + 1}`,
      score: passed ? 1 : 0,
      hit: passed,
      expected: `Input "${tc.input}" should print: ${expected}`,
      matched: passed ? [printed] : [],
    };
  });

  const lastRun = runs[runs.length - 1];
  if (!lastRun) {
    faults.push({
      kind: "no_example",
      message: "The code was not run.",
      teach: "Run your program against the sample input. A program you have not executed is a program you have not tested.",
    });
  } else if (lastRun.timedOut) {
    faults.push({
      kind: "runtime_error",
      message: "The program did not finish — it ran past the time limit.",
      teach:
        "This usually means an infinite loop. Check that every loop has a condition that eventually becomes false, and that you are not waiting on input that will never arrive.",
    });
  } else if (lastRun.exitCode !== 0) {
    const err = (lastRun.stderr ?? "").split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 160);
    faults.push({
      kind: "runtime_error",
      message: `The program crashed (exit code ${lastRun.exitCode}).`,
      teach: `Fix the error first, then re-run. ${err || "Read the error message from the last line — it names the line that failed."}`,
    });
  } else {
    const printed = (lastRun.stdout ?? "").trim();
    const expected = (input.testCases?.[0]?.expected ?? "").trim();
    if (input.testCases?.length && printed !== expected) {
      faults.push({
        kind: "wrong_output",
        message: `Your program printed "${printed}" but the expected output is "${expected}".`,
        teach:
          "Compare your output with the expected output character by character. Watch for extra spaces, extra blank lines, extra text you did not print, and missing rounding or units.",
      });
    }
  }

  if (code.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#")).length <= 1) {
    faults.push({
      kind: "too_short",
      message: "The program is a single line.",
      teach: "Check you have not left a placeholder. A solution to this problem needs at least an input step, a calculation and an output step.",
    });
  }

  const passed = criteria.filter((c) => c.hit).length;
  const coverage = criteria.length ? passed / criteria.length : lastRun && lastRun.exitCode === 0 ? 0.5 : 0;

  return assemble({
    type: input.type,
    stem: input.stem,
    reference: input.reference,
    maxMarks: input.maxMarks,
    quality: coverage,
    criteria,
    faults,
    words: 0,
    similarity: coverage,
    coverage,
    precision: 1,
    elapsedMs: Date.now() - started,
    attempted: code.length > 0,
  });
}

/* --------------------------------------------------------------------- SQL */

function evaluateSql(input: SnsaiInput, started: number): SnsaiReport {
  const payload = (input.payload ?? {}) as {
    query?: string;
    resultSummary?: string;
    /**
     * Structured evidence from actually running the query. When this is
     * present it decides the answer; the keyword comparison below is only a
     * fallback for when nothing could be executed.
     */
    sqlResult?: {
      ran: boolean;
      rowCount: number | null;
      expectedRows: number | null;
      matched: boolean | null;
      error?: string;
    };
  };
  const query = (payload.query ?? "").trim();

  if (!query) {
    return blank(input, started, [
      {
        kind: "not_attempted",
        message: "No SQL query written.",
        teach: "Write the query, run it against the practice database, and check the rows it returns before checking your answer.",
      },
    ]);
  }

  const faults: SnsaiFault[] = [];
  const upper = query.toUpperCase();
  const lowered = query.toLowerCase();

  // A query that is not a SELECT cannot answer a "retrieve" question.
  if (!/\bSELECT\b/.test(upper)) {
    faults.push({
      kind: "runtime_error",
      message: "The query does not contain a SELECT.",
      teach: "This question asks for data to be retrieved, which means the query must begin with SELECT.",
    });
  }
  if (/\bSELECT\s+\*/.test(upper)) {
    faults.push({
      kind: "vague",
      message: "SELECT * returns every column, including columns the question did not ask for.",
      teach: "Name only the columns the question asks for. It is more precise and is what an examiner expects.",
    });
  }
  if (/\bDELETE\b|\bDROP\b|\bUPDATE\b|\bTRUNCATE\b/.test(upper)) {
    faults.push({
      kind: "runtime_error",
      message: "The query modifies or destroys data.",
      teach: "A retrieval question needs a SELECT. UPDATE, DELETE and DROP change data and are not what is being asked here.",
    });
  }
  if (/\bJOIN\b/.test(upper) && !/\bON\b/.test(upper)) {
    faults.push({
      kind: "runtime_error",
      message: "A JOIN has no ON condition.",
      teach: "Every JOIN needs an ON clause saying which columns match, otherwise the result is a cross join with meaningless rows.",
    });
  }
  if (/\bWHERE\b/.test(upper) && /\bOR\b/.test(upper) && /\bAND\b/.test(upper)) {
    faults.push({
      kind: "vague",
      message: "AND and OR are mixed in one condition.",
      teach: "AND binds tighter than OR, which is a common source of wrong answers. If you mean one or the other, use parentheses to make the intent explicit.",
    });
  }
  if (!/;/.test(query) && lowered.trim().length > 0) {
    // Style only; not worth a fault, but worth teaching.
    faults.push({
      kind: "no_example",
      message: "The query is not terminated with a semicolon.",
      teach: "End a SQL statement with a semicolon. It stops the statement running on into the next one.",
    });
  }

  const reference = input.reference;
  const { criteria, coverage } = buildCriteria(
    reference || "The query selects the requested columns from the correct table, filtered by the stated condition.",
    query,
    input.stem,
    input.keyPoints
  );
  const similarity = cosine(normalise(query), normalise(reference));
  const evidence = payload.sqlResult;

  if (evidence) {
    // The query was really executed, so the result decides. Each branch below
    // returns or fixes the quality outright: a fault that does not cost marks
    // is decoration, and a query that does not run must not collect most of
    // the marks on keyword similarity alone.
    if (!evidence.ran) {
      faults.push({
        kind: "runtime_error",
        message: "The query did not run.",
        teach:
          evidence.error ??
          "Read the database error message: it names the table, column or keyword it could not find. Fix that first, then run it again.",
      });
      return assemble({
        type: input.type,
        stem: input.stem,
        reference: input.reference,
        maxMarks: input.maxMarks,
        quality: 0,
        criteria,
        faults,
        words: 0,
        similarity,
        coverage,
        precision: 1,
        elapsedMs: Date.now() - started,
        attempted: true,
      });
    }

    if (evidence.matched === true) {
      // Running correctly and returning the expected rows is the definition of
      // a right answer, so the key-point comparison is only corroboration.
      return assemble({
        type: input.type,
        stem: input.stem,
        reference: input.reference,
        maxMarks: input.maxMarks,
        quality: clamp(Math.max(coverage, 0.95)),
        criteria,
        faults: [
          ...faults.filter((f) => f.kind === "vague"),
          {
            kind: "no_example",
            message: payload.resultSummary ?? "Query returned the expected rows.",
            teach: "This query returns exactly the right rows. Read it once more and make sure you could rebuild it from scratch.",
          },
        ],
        words: 0,
        similarity,
        coverage,
        precision: 1,
        elapsedMs: Date.now() - started,
        attempted: true,
      });
    }

    if (evidence.matched === false) {
      // It ran and it is wrong. How wrong depends on how much it returned.
      faults.push({
        kind: "wrong_output",
        message: payload.resultSummary ?? "The query returned the wrong rows.",
        teach: `It ran, but returned ${evidence.rowCount ?? 0} row(s) where ${evidence.expectedRows ?? 0} were expected. Check the WHERE condition first, then the columns in SELECT — an extra column changes the answer even when the rows are right.`,
      });
      // Capped at "partial": a query that returns the wrong rows is not a
      // mostly-correct answer, however well it reads.
      return assemble({
        type: input.type,
        stem: input.stem,
        reference: input.reference,
        maxMarks: input.maxMarks,
        quality: clamp(Math.min(coverage, 0.34)),
        criteria,
        faults,
        words: 0,
        similarity,
        coverage,
        precision: 1,
        elapsedMs: Date.now() - started,
        attempted: true,
      });
    }

    // It ran, but this question has no stored expected result to compare with.
    // Say so rather than grading on resemblance alone.
    faults.push({
      kind: "no_example",
      message: payload.resultSummary ?? "The query ran, but there is no expected result stored to check it against.",
      teach:
        "SNSAI ran your query and it worked, but this question has no stored answer to compare the rows with, so it cannot confirm the result is right. Read the question again and check that the rows, the columns and the filter are all exactly what was asked for.",
    });
    return assemble({
      type: input.type,
      stem: input.stem,
      reference: input.reference,
      maxMarks: input.maxMarks,
      // Held below "mostly correct" on purpose: unconfirmed is not confirmed.
      quality: clamp(Math.min(coverage, 0.69)),
      criteria,
      faults,
      words: 0,
      similarity,
      coverage,
      precision: 1,
      elapsedMs: Date.now() - started,
      attempted: true,
    });
  }

  // Structural faults are the difference between "right shape, wrong query"
  // and "correct query", so each one costs real marks. There is deliberately
  // no floor: an unrelated query must not be able to collect a third of the
  // marks just for containing the word SELECT.
  const structuralPenalty = faults.filter((f) => f.kind === "runtime_error").length * 0.35;
  const stylePenalty = faults.filter((f) => f.kind === "vague").length * 0.1;
  const quality = clamp(coverage + 0.15 * similarity - structuralPenalty - stylePenalty);
  return assemble({
    type: input.type,
    stem: input.stem,
    reference: input.reference,
    maxMarks: input.maxMarks,
    quality,
    criteria,
    faults,
    words: 0,
    similarity,
    coverage,
    precision: 1,
    elapsedMs: Date.now() - started,
    attempted: query.length > 0,
  });
}

/* -------------------------------------------------------------------- ORAL */

function evaluateOral(input: SnsaiInput, started: number): SnsaiReport {
  const transcript = (input.transcript ?? "").trim();

  if (!transcript) {
    const faults: SnsaiFault[] = [
      {
        kind: "no_transcript",
        message: input.hasAudio
          ? "Your recording was saved, but no transcript was produced, so SNSAI cannot read what you said."
          : "There is no recording and no written answer for this question.",
        teach: input.hasAudio
          ? "Your teacher can still listen to the recording and will mark it. To let SNSAI check you, also type the answer in the box below the recorder, or record in Chrome/Edge where live transcription is available."
          : "Press Start recording and speak your answer, or type it in the box. An oral answer scores nothing if nothing was captured.",
      },
    ];
    return blank(input, started, faults);
  }

  // Spoken answers run short and are messy. Discount surface penalties that
  // make sense on paper but not when someone is speaking, and judge the ideas.
  const report = evaluateWritten({ ...input, type: "ORAL" }, transcript, started);
  const softFaults = report.faults.filter(
    (f) => f.kind === "too_short" || f.kind === "too_long" || f.kind === "copied_reference" || f.kind === "no_example"
  );
  const keptFaults = report.faults.filter((f) => !softFaults.includes(f));

  const spoken = /\b(uh|um|erm|like|basically|actually|okay|so yeah)\b/i;
  const fillerCount = transcript.match(spoken)?.length ?? 0;
  const fillerFaults: SnsaiFault[] =
    fillerCount >= 4
      ? [
          {
            kind: "vague",
            message: `There are about ${fillerCount} filler words ("um", "like", "basically") in the answer.`,
            teach: "Pauses are fine when speaking. Cutting the fillers makes the same answer much easier to follow and to mark.",
          },
        ]
      : [];

  return assemble({
    type: "ORAL",
    stem: input.stem,
    reference: input.reference,
    maxMarks: input.maxMarks,
    quality: report.quality,
    criteria: report.criteria,
    faults: [...keptFaults, ...fillerFaults],
    words: report.signals.words,
    similarity: report.signals.similarity,
    coverage: report.signals.coverage,
    precision: report.signals.precision,
    elapsedMs: Date.now() - started,
  });
}

/* ------------------------------------------------------------------ UPLOAD */

function evaluateUpload(input: SnsaiInput, started: number): SnsaiReport {
  const payload = (input.payload ?? {}) as { fileUrls?: string[] };
  const files = payload.fileUrls ?? [];
  const faults: SnsaiFault[] = [];

  if (files.length === 0) {
    return blank(input, started, [
      {
        kind: "not_attempted",
        message: "Nothing was uploaded.",
        teach: "Upload a clear photograph or a readable scan. SNSAI cannot read a missing file.",
      },
    ]);
  }
  if (files.length > 1) {
    faults.push({
      kind: "too_long",
      message: `${files.length} files were uploaded.`,
      teach: "One clear, well-lit image per file is easier to mark than several. Crop to just the answer.",
    });
  }

  // The reference is turned into a checklist for the student to check their own
  // file against, but nothing is scored. SNSAI cannot open a photograph, so
  // any number here would be invented — and an invented mark is worse than no
  // mark, because a student would act on it.
  const criteria = extractConcepts(input.reference, input.stem).map((c) => ({
    label: c.label,
    score: 0,
    hit: false,
    expected: c.expected,
    matched: [],
    note: "Check that your file shows this.",
  }));
  faults.push({
    kind: "unreadable",
    message: "Files received.",
    teach: `SNSAI can confirm your file arrived, but it cannot read handwriting or a diagram, so it will not guess at a mark. Check it is legible, then use these points to check your own work: ${
      criteria.map((c) => c.expected).join(" | ") || input.reference
    }`,
  });

  return assemble({
    type: input.type,
    stem: input.stem,
    reference: input.reference,
    maxMarks: input.maxMarks,
    quality: 0,
    criteria,
    faults,
    words: 0,
    similarity: 0,
    coverage: 0,
    precision: 1,
    elapsedMs: Date.now() - started,
    attempted: files.length > 0,
    forcedVerdict: "needs_teacher",
  });
}

/* ---------------------------------------------------------------- dispatch */

export function evaluateAnswer(input: SnsaiInput): SnsaiReport {
  const started = Date.now();
  switch (input.type) {
    case "MCQ":
      return evaluateMcq(input, started);
    case "SHORT":
    case "LONG":
      return evaluateWritten(input, readText(input.payload), started);
    case "CODING":
      return evaluateCoding(input, started);
    case "SQL":
      return evaluateSql(input, started);
    case "ORAL":
      return evaluateOral(input, started);
    case "UPLOAD":
      return evaluateUpload(input, started);
    default:
      return blank(input, started, [
        {
          kind: "not_attempted",
          message: "This question type cannot be checked automatically.",
          teach: "Your teacher will mark this one by hand.",
        },
      ]);
  }
}

function readText(payload: unknown): string {
  const p = (payload ?? {}) as { text?: string };
  return typeof p.text === "string" ? p.text : "";
}

export const SNSAI_VERSION = "1.0.0";

/** Compact, cheap summary used for the "Check all" header. */
export function summariseReports(reports: SnsaiReport[]) {
  const marks = round(reports.reduce((s, r) => s + r.marks, 0), 2);
  const maxMarks = reports.reduce((s, r) => s + r.maxMarks, 0);
  return {
    marks,
    maxMarks,
    checked: reports.length,
    correct: reports.filter((r) => r.verdict === "correct").length,
    // "Mostly right" is the most common real outcome and must be counted
    // somewhere, or a class of answers vanishes from the summary entirely.
    mostlyCorrect: reports.filter((r) => r.verdict === "mostly_correct").length,
    needsWork: reports.filter((r) => r.verdict === "partial" || r.verdict === "incorrect").length,
    awaitingTeacher: reports.filter((r) => r.verdict === "needs_teacher").length,
    unanswered: reports.filter((r) => r.verdict === "unanswered").length,
    totalMs: reports.reduce((s, r) => s + r.signals.elapsedMs, 0),
  };
}
