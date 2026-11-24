"use client";

import "@/lib/monaco";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import { ChessBoard, type BoardLastMove } from "@/components/chess/ChessBoard";
import { friendlyError } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { START_FEN } from "@/lib/chess/engine";
import type { PublicMatch, PublicMove } from "@/lib/chess/protocol";
import { Bot, Check, CircleDot, Copy, Crown, Handshake, Link2, Loader2, Play, RotateCcw, Swords, Terminal, TriangleAlert } from "lucide-react";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-lg bg-secondary/50" />,
});

const MONACO_LANG: Record<string, string> = {
  python: "python",
  javascript: "javascript",
  java: "java",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Rookie",
  medium: "Challenger",
  hard: "Master",
  grandmaster: "Grandmaster",
};

const CHESS_API_DOCS: Array<{ call: string; doc: string }> = [
  { call: "game.turn()", doc: 'Whose turn it is — "white" or "black".' },
  { call: "game.legal_moves()", doc: "Every move you may play, as text like \"e2e4\"." },
  { call: "game.fen()", doc: "The full position in Forsyth–Edwards notation." },
  { call: "game.in_check()", doc: "True if the side to move is in check." },
  { call: "game.piece_at(sq)", doc: 'The piece on a square, e.g. "P", "q" or "" if empty.' },
  { call: "game.pieces()", doc: "Every occupied square with its piece." },
  { call: "game.moves_from(sq)", doc: 'Legal moves that start on a square, e.g. "e2".' },
];

export function ChessMatchClient({
  match: initialMatch,
  starters,
  languages,
  languageLabels,
  myColor,
  inviteUrl,
}: {
  match: PublicMatch;
  starters: Record<string, string>;
  languages: string[];
  languageLabels: Record<string, string>;
  myColor: "white" | "black";
  inviteUrl: string;
}) {
  const [match, setMatch] = useState<PublicMatch>(initialMatch);
  const [language, setLanguage] = useState(initialMatch.language);
  const [codeByLang, setCodeByLang] = useState<Record<string, string>>(() => ({
    ...starters,
    [initialMatch.language]: (myColor === "white" ? initialMatch.whiteCode : initialMatch.blackCode) ?? starters[initialMatch.language] ?? "",
  }));
  const code = codeByLang[language] ?? "";

  const [revealed, setRevealed] = useState(initialMatch.moves.length);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");

  const finished = match.status !== "ACTIVE";
  const opponentSeated =
    match.mode !== "MULTIPLAYER" || (myColor === "white" ? match.seatsFilled.black : match.seatsFilled.white);
  const waitingForOpponent = match.mode === "MULTIPLAYER" && !opponentSeated;
  const canPlay = !finished && match.turn === myColor && !waitingForOpponent;

  // Reveal plies one at a time so the human move lands before the engine replies.
  useEffect(() => {
    if (revealed >= match.moves.length) return;
    const t = window.setTimeout(() => setRevealed((r) => Math.min(r + 1, match.moves.length)), 440);
    return () => window.clearTimeout(t);
  }, [revealed, match.moves.length]);

  const boardFen = revealed === 0 ? START_FEN : match.moves[revealed - 1].fen;
  const lastMove: BoardLastMove | null = revealed > 0 ? { from: match.moves[revealed - 1].uci.slice(0, 2), to: match.moves[revealed - 1].uci.slice(2, 4) } : null;

  // Debounced draft save.
  useEffect(() => {
    if (finished) return;
    const t = window.setTimeout(async () => {
      setSaved("saving");
      try {
        await fetch(`/api/student/chess/matches/${match.id}/code`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, language }),
        });
        setSaved("saved");
      } catch {
        setSaved("idle");
      }
    }, 1200);
    return () => window.clearTimeout(t);
  }, [code, language, match.id, finished]);

  const play = useCallback(async () => {
    if (running || !canPlay) return;
    if (!code.trim()) {
      toast.error("Write some code first.");
      return;
    }
    setRunning(true);
    setError("");
    setStdout("");
    setStderr("");
    try {
      const res = await fetch(`/api/student/chess/matches/${match.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStdout(String(data.stdout ?? ""));
        setStderr(String(data.stderr ?? ""));
        throw new Error(data.error ?? "The move failed.");
      }
      setStdout(String(data.stdout ?? ""));
      setStderr(String(data.stderr ?? ""));
      setMatch(data.match as PublicMatch);
    } catch (e) {
      setError(friendlyError(e, "The move failed."));
    } finally {
      setRunning(false);
    }
  }, [running, canPlay, code, language, match.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void play();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play]);

  // A multiplayer room runs on someone else's clock, so poll while we are
  // waiting for the opponent to join or to answer, and fold in what changed.
  const shouldPoll = match.mode === "MULTIPLAYER" && !finished && !canPlay;
  useEffect(() => {
    if (!shouldPoll) return;
    let alive = true;
    const tick = async () => {
      if (running) return;
      try {
        const res = await fetch(`/api/student/chess/matches/${match.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setMatch((prev) => {
          const next = data.match as PublicMatch;
          const changed =
            next.plyCount !== prev.plyCount ||
            next.status !== prev.status ||
            next.seatsFilled.white !== prev.seatsFilled.white ||
            next.seatsFilled.black !== prev.seatsFilled.black;
          return changed ? next : prev;
        });
      } catch {
        /* transient hiccup — the next tick retries */
      }
    };
    const id = window.setInterval(() => void tick(), 1500);
    void tick();
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [shouldPoll, running, match.id]);

  const [copied, setCopied] = useState(false);
  const copyInvite = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy — select the link and copy it manually.");
    }
  }, [inviteUrl]);

  const captured = useMemo(() => materialBalance(match.moves, revealed), [match.moves, revealed]);
  const sans = match.moves.map((m) => m.san);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/chess" className="text-xs text-muted-foreground hover:text-foreground">
            ← Leou Chess
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Swords className="h-5 w-5 text-primary" />
            {match.mode === "COMPUTER" ? (
              <>
                vs Computer · <span className="text-primary">{DIFFICULTY_LABEL[match.difficulty ?? "medium"] ?? "Computer"}</span>
              </>
            ) : (
              "Multiplayer"
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            You play <span className="font-medium text-foreground capitalize">{myColor}</span> · ply {match.plyCount}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", canPlay ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : waitingForOpponent ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-border bg-card/60 text-muted-foreground")}>
            {waitingForOpponent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleDot className="h-3.5 w-3.5" />}
            {finished ? "Game over" : waitingForOpponent ? "Waiting for opponent" : canPlay ? "Your move" : "Opponent's move"}
          </span>
          <Link href="/dashboard/chess" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs transition hover:bg-secondary">
            <RotateCcw className="h-3.5 w-3.5" /> New
          </Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-4">
            <div className="mx-auto w-full max-w-[min(72vh,44rem)]">
              <ChessBoard fen={boardFen} orientation={myColor} lastMove={lastMove} animateKey={revealed} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <CapturedRow label="You captured" pieces={myColor === "white" ? captured.white : captured.black} />
              <CapturedRow label="Opponent captured" pieces={myColor === "white" ? captured.black : captured.white} />
            </div>
          </div>

          {waitingForOpponent && inviteUrl && (
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Link2 className="h-4 w-4 text-primary" /> Waiting for your opponent to join
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Send this link to a friend. Your first game with a friend is free — they only need an account.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => void copyInvite()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>
          )}

          {match.mode === "MULTIPLAYER" && !finished && !canPlay && !waitingForOpponent && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Waiting for your opponent&apos;s move…
            </div>
          )}

          {finished && (
            <div
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm",
                match.result === "DRAW" ? "border-amber-500/40 bg-amber-500/10" : resultForMe(match.result, myColor) ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"
              )}
            >
              {match.result === "DRAW" ? <Handshake className="h-5 w-5 text-amber-400" /> : resultForMe(match.result, myColor) ? <Crown className="h-5 w-5 text-emerald-400" /> : <TriangleAlert className="h-5 w-5 text-red-400" />}
              <span className="font-medium">{match.reason ?? "Game over."}</span>
              <Link href="/dashboard/chess" className="ml-auto inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                Play again
              </Link>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Language</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {languageLabels[l]}
                  </option>
                ))}
              </select>
              <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                <span>{saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : ""}</span>
                <span>
                  Write <code className="rounded bg-secondary px-1">move(game)</code> · ⌘/Ctrl+Enter to play
                </span>
              </span>
            </div>
            <Editor
              height="320px"
              language={MONACO_LANG[language] ?? "python"}
              theme="vs-dark"
              value={code}
              onChange={(v) => setCodeByLang((m) => ({ ...m, [language]: v ?? "" }))}
              options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, tabSize: 4, renderLineHighlight: "all" }}
            />
          </div>

          <button
            type="button"
            onClick={() => void play()}
            disabled={running || !canPlay}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {running ? "Running…" : finished ? "Game over" : waitingForOpponent ? "Waiting for opponent…" : canPlay ? "Play move" : "Opponent's move"}
          </button>

          {(stdout.trim() || stderr.trim()) && (
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" /> Output
              </div>
              <pre className="max-h-40 overflow-auto bg-black/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {stdout.trim() && <span className="text-emerald-200">{stdout.trimEnd()}</span>}
                {stderr.trim() && <span className="text-red-300">{stderr.trimEnd()}</span>}
              </pre>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Bot className="h-3.5 w-3.5" /> Your toolkit
            </div>
            <ul className="space-y-2">
              {CHESS_API_DOCS.map((d) => (
                <li key={d.call}>
                  <code className="block rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-accent">{d.call}</code>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{d.doc}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Moves</p>
            {sans.length === 0 ? (
              <p className="text-xs text-muted-foreground">No moves yet.</p>
            ) : (
              <ol className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[12px]">
                {sans.map((s, i) => (
                  <li key={i} className={cn("flex gap-1", i >= revealed && "opacity-40")}>
                    <span className="w-6 text-right text-muted-foreground">{i % 2 === 0 ? `${i / 2 + 1}.` : ""}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function resultForMe(result: string | null, myColor: "white" | "black"): boolean {
  return (result === "WHITE" && myColor === "white") || (result === "BLACK" && myColor === "black");
}

const START_COUNTS: Record<string, number> = { P: 8, N: 2, B: 2, R: 2, Q: 1, p: 8, n: 2, b: 2, r: 2, q: 1 };

/** Which pieces each color is missing relative to the start — i.e. captured. */
function materialBalance(moves: PublicMove[], revealed: number): { white: string[]; black: string[] } {
  if (revealed === 0) return { white: [], black: [] };
  const fen = moves[revealed - 1].fen;
  const counts: Record<string, number> = {};
  for (const ch of fen.split(" ")[0]) if (/[a-zA-Z]/.test(ch)) counts[ch] = (counts[ch] ?? 0) + 1;
  const captured: { white: string[]; black: string[] } = { white: [], black: [] };
  for (const [ch, n] of Object.entries(START_COUNTS)) {
    const missing = Math.max(0, n - (counts[ch] ?? 0));
    const isWhite = ch === ch.toUpperCase();
    for (let i = 0; i < missing; i++) (isWhite ? captured.white : captured.black).push(ch);
  }
  return captured;
}

const GLYPH: Record<string, string> = { k: "\u265A", q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E", p: "\u265F" };

function CapturedRow({ label, pieces }: { label: string; pieces: string[] }) {
  return (
    <div className="flex items-center gap-2">
      <span>{label}:</span>
      <span className="flex gap-0.5 text-base leading-none">
        {pieces.length === 0 ? <span className="text-muted-foreground/50">—</span> : pieces.map((p, i) => <span key={i} style={{ color: p === p.toUpperCase() ? "#f8fafc" : "#0b1220" }}>{GLYPH[p.toLowerCase()]}</span>)}
      </span>
    </div>
  );
}
