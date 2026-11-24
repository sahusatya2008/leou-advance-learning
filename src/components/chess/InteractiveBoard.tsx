"use client";

import { useMemo, useRef, useState } from "react";
import { KING, parseFen, pieceName, squareName, WHITE } from "@/lib/chess/engine";
import { cn } from "@/lib/utils";
import type { AnnotationTone, BoardAnnotation } from "@/lib/chess/training";

/** Solid glyphs for both colours; CSS tints white pieces light and black dark. */
const GLYPH: Record<string, string> = {
  k: "\u265A",
  q: "\u265B",
  r: "\u265C",
  b: "\u265D",
  n: "\u265E",
  p: "\u265F",
};

const TONE_COLOR: Record<AnnotationTone, string> = {
  primary: "#818cf8",
  accent: "#22d3ee",
  success: "#34d399",
  danger: "#fb7185",
  warning: "#fbbf24",
};

type Side = "white" | "black";

export type BoardMove = { from: string; to: string };

type DragState = { from: string; x: number; y: number; moved: boolean };

/**
 * A board the student can actually play on: tap a piece then a highlighted
 * square, or drag the piece onto it. Legality always comes from the caller —
 * the same `ChessGame.legalUci()` the judge uses — so the board can never
 * invent a move. Promotions are resolved with a small chooser.
 *
 * Every layer (squares, tints, targets, pieces, hit-areas) is positioned from
 * the same `(row, col)` model with `translate`, so a click always lands on the
 * square under the cursor no matter the orientation.
 */
export function InteractiveBoard({
  fen,
  legalMoves,
  turn,
  orientation = "white",
  lastMove,
  animateKey,
  onMove,
  disabled = false,
  annotations,
  className,
}: {
  fen: string;
  /** Legal moves for the side to move, as UCI ("e2e4", "e7e8q"). */
  legalMoves: string[];
  /** Whose pieces may be picked up right now. */
  turn: Side;
  orientation?: Side;
  lastMove?: BoardMove | null;
  animateKey?: string | number;
  onMove?: (uci: string) => void;
  disabled?: boolean;
  /** Auto-drawn arrows/highlights that illustrate a lesson's idea. Purely visual. */
  annotations?: BoardAnnotation;
  className?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string; options: string[] } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const state = useMemo(() => {
    const pos = parseFen(fen);
    const whiteAtBottom = orientation === "white";
    let kingSquare: string | null = null;
    for (let sq = 0; sq < 64; sq++) {
      const code = pos.board[sq];
      if (code && Math.abs(code) === KING && (code > 0) === (pos.turn === WHITE)) kingSquare = squareName(sq);
    }
    return { pos, whiteAtBottom, kingSquare };
  }, [fen, orientation]);

  const { whiteAtBottom } = state;

  /** Legal moves grouped by their from-square. */
  const targets = useMemo(() => {
    const t: Record<string, string[]> = {};
    for (const m of legalMoves) (t[m.slice(0, 2)] ??= []).push(m);
    return t;
  }, [legalMoves]);

  const movableFrom = useMemo(() => new Set(Object.keys(targets)), [targets]);

  const toRC = (square: string): { row: number; col: number } => {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    return { row: whiteAtBottom ? 7 - rank : rank, col: whiteAtBottom ? file : 7 - file };
  };

  const squareFromRC = (row: number, col: number): string => {
    const file = whiteAtBottom ? col : 7 - col;
    const rank = whiteAtBottom ? 7 - row : row;
    return squareName(rank * 8 + file);
  };

  /** Play `from -> to` if it is legal; returns true when it was a legal target. */
  const commit = (from: string, to: string): boolean => {
    const candidates = (targets[from] ?? []).filter((m) => m.slice(2, 4) === to);
    if (candidates.length === 0) return false;
    if (candidates.some((m) => m.length === 5)) {
      setPromo({ from, to, options: candidates.filter((m) => m.length === 5) });
      return true;
    }
    setSelected(null);
    onMove?.(candidates[0]);
    return true;
  };

  const squareAtPoint = (clientX: number, clientY: number): string | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return squareFromRC(row, col);
  };

  const onPointerDown = (e: React.PointerEvent, square: string) => {
    if (disabled) return;
    // A piece of ours: pick it up and start a potential drag.
    if (movableFrom.has(square)) {
      setSelected(square);
      try {
        boardRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointers have no capture target — dragging still works */
      }
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect) setDrag({ from: square, x: e.clientX - rect.left, y: e.clientY - rect.top, moved: false });
      return;
    }
    // A highlighted destination for the current selection: play it.
    if (selected && (targets[selected] ?? []).some((m) => m.slice(2, 4) === square)) {
      commit(selected, square);
      return;
    }
    setSelected(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const moved = drag.moved || Math.hypot(e.clientX - rect.left - drag.x, e.clientY - rect.top - drag.y) > 4;
    setDrag({ ...drag, x: e.clientX - rect.left, y: e.clientY - rect.top, moved });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag) return;
    const current = drag;
    setDrag(null);
    if (!current.moved) return; // a tap: keep the selection for tap-tap play
    const to = squareAtPoint(e.clientX, e.clientY);
    if (to && to !== current.from) {
      if (!commit(current.from, to)) setSelected(null);
    }
  };

  const from = lastMove ? toRC(lastMove.from) : null;
  const to = lastMove ? toRC(lastMove.to) : null;
  const movedTo = lastMove?.to;
  const selectedTargetSquares = new Set((selected ? targets[selected] ?? [] : []).map((m) => m.slice(2, 4)));
  const occupied = new Set<string>();
  for (let sq = 0; sq < 64; sq++) if (state.pos.board[sq]) occupied.add(squareName(sq));

  const draggingFrom = drag?.moved ? drag.from : null;
  const dragPiece = draggingFrom ? pieceName(state.pos.board[(Number(draggingFrom[1]) - 1) * 8 + (draggingFrom.charCodeAt(0) - 97)]) : null;
  const dragIsWhite = draggingFrom ? state.pos.board[(Number(draggingFrom[1]) - 1) * 8 + (draggingFrom.charCodeAt(0) - 97)] > 0 : false;

  const squareList: string[] = [];
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) squareList.push(squareFromRC(row, col));

  return (
    <div
      ref={boardRef}
      data-testid="chessboard"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      className={cn("relative w-full touch-none select-none overflow-hidden rounded-xl border border-border shadow-xl shadow-black/30", className)}
    >
      {/* Squares */}
      <div className="grid aspect-square w-full grid-cols-8 grid-rows-8">
        {Array.from({ length: 64 }).map((_, i) => {
          const row = Math.floor(i / 8);
          const col = i % 8;
          const light = (row + col) % 2 === 0;
          return <div key={i} className={light ? "bg-[#b9c4d6]" : "bg-[#5b6b85]"} />;
        })}
      </div>

      {/* Coordinate labels */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 8 }).map((_, col) => {
          const fileChar = String.fromCharCode(97 + (whiteAtBottom ? col : 7 - col));
          return (
            <span
              key={`file-${col}`}
              className="absolute bottom-1 text-[10px] font-semibold text-black/70 dark:text-black/60"
              style={{ left: `${col * 12.5% + 2}%` }}
            >
              {fileChar}
            </span>
          );
        })}
        {Array.from({ length: 8 }).map((_, r) => {
          const rankNum = whiteAtBottom ? 8 - r : r + 1;
          return (
            <span
              key={`rank-${r}`}
              className="absolute left-1 text-[10px] font-semibold text-black/70 dark:text-black/60"
              style={{ top: `${r * 12.5% + 2}%` }}
            >
              {rankNum}
            </span>
          );
        })}
      </div>

      {/* Highlights, targets and the checked king */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {from && <Tint row={from.row} col={from.col} kind="from" />}
        {to && <Tint row={to.row} col={to.col} kind="to" />}
        {selected && <Tint row={toRC(selected).row} col={toRC(selected).col} kind="select" />}
        {state.kingSquare && <Tint row={toRC(state.kingSquare).row} col={toRC(state.kingSquare).col} kind="check" animateKey={animateKey} />}
        {[...selectedTargetSquares].map((sq) => {
          const rc = toRC(sq);
          return <Target key={sq} row={rc.row} col={rc.col} capture={occupied.has(sq)} />;
        })}
      </div>

      {/* Pieces */}
      <div className="pointer-events-none absolute inset-0 z-20">
        {squareList.map((name) => {
          const sq = (Number(name[1]) - 1) * 8 + (name.charCodeAt(0) - 97);
          const code = state.pos.board[sq];
          if (!code) return null;
          const { row, col } = toRC(name);
          const isMoved = movedTo != null && name === movedTo && from && to;
          const dx = isMoved ? from!.col - to!.col : 0;
          const dy = isMoved ? from!.row - to!.row : 0;
          return (
            <div
              key={isMoved ? `${name}:${animateKey}` : name}
              data-square={name}
              data-piece={pieceName(code)}
              className={cn("absolute left-0 top-0 flex h-[12.5%] w-[12.5%] items-center justify-center", isMoved && "chess-slide")}
              style={
                {
                  transform: `translate(${col * 100}%, ${row * 100}%)`,
                  opacity: name === draggingFrom ? 0.25 : 1,
                  "--tx": col,
                  "--ty": row,
                  "--dx": dx,
                  "--dy": dy,
                } as React.CSSProperties
              }
            >
              <Piece code={pieceName(code)} white={code > 0} />
            </div>
          );
        })}
      </div>

      {/* Interaction layer — one hit-area per square, aligned with the visuals */}
      <div className="absolute inset-0 z-30">
        {squareList.map((name) => {
          const { row, col } = toRC(name);
          const clickable = !disabled && (movableFrom.has(name) || selectedTargetSquares.has(name));
          return (
            <button
              key={name}
              type="button"
              aria-label={name}
              data-square={name}
              disabled={disabled}
              onPointerDown={(e) => onPointerDown(e, name)}
              className={cn("absolute h-[12.5%] w-[12.5%]", clickable ? "cursor-pointer" : "cursor-default")}
              style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}
            />
          );
        })}
      </div>

      {/* Floating piece while dragging */}
      {drag?.moved && dragPiece && (
        <div
          className="pointer-events-none absolute z-40 flex h-[12.5%] w-[12.5%] items-center justify-center"
          style={{ left: 0, top: 0, transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -50%)` }}
        >
          <Piece code={dragPiece} white={dragIsWhite} size="min(11vw, 4rem)" />
        </div>
      )}

      {/* Concept arrows & highlights — a coach's marker, purely visual */}
      {annotations && (annotations.arrows?.length || annotations.highlights?.length) ? (
        <svg
          className="pointer-events-none absolute inset-0 z-[45]"
          viewBox="0 0 800 800"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {(annotations.highlights ?? []).map((h, i) => {
            const rc = toRC(h.sq);
            if (rc.row < 0 || rc.row > 7 || rc.col < 0 || rc.col > 7) return null;
            const color = TONE_COLOR[h.tone ?? "warning"];
            return <rect key={`h${i}`} x={rc.col * 100 + 6} y={rc.row * 100 + 6} width={88} height={88} rx={16} fill={color} fillOpacity={0.28} stroke={color} strokeOpacity={0.8} strokeWidth={5} />;
          })}
          {(annotations.arrows ?? []).map((a, i) => {
            const from = toRC(a.from);
            const to = toRC(a.to);
            if (from.row < 0 || from.row > 7 || from.col < 0 || from.col > 7) return null;
            if (to.row < 0 || to.row > 7 || to.col < 0 || to.col > 7) return null;
            const color = TONE_COLOR[a.tone ?? "primary"];
            const x1 = from.col * 100 + 50;
            const y1 = from.row * 100 + 50;
            const x2 = to.col * 100 + 50;
            const y2 = to.row * 100 + 50;
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const headLen = 34;
            // Pull the line end back so the arrowhead tip sits on the square centre.
            const tipX = x2 - Math.cos(angle) * 16;
            const tipY = y2 - Math.sin(angle) * 16;
            const baseX = tipX - Math.cos(angle) * headLen;
            const baseY = tipY - Math.sin(angle) * headLen;
            const wing = 15;
            const leftX = baseX - Math.sin(angle) * wing;
            const leftY = baseY + Math.cos(angle) * wing;
            const rightX = baseX + Math.sin(angle) * wing;
            const rightY = baseY - Math.cos(angle) * wing;
            return (
              <g key={`a${i}`} stroke={color} fill={color}>
                <line x1={x1} y1={y1} x2={baseX} y2={baseY} strokeWidth={14} strokeLinecap="round" strokeOpacity={0.9} />
                <polygon points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`} stroke="none" />
              </g>
            );
          })}
        </svg>
      ) : null}

      {promo && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl border border-border bg-card p-3 shadow-2xl">
            <p className="mb-2 text-center text-xs font-medium text-muted-foreground">Promote to</p>
            <div className="flex gap-2">
              {promo.options.map((uci) => (
                <button
                  key={uci}
                  type="button"
                  data-promo={uci}
                  onClick={() => {
                    const choice = uci;
                    setPromo(null);
                    setSelected(null);
                    onMove?.(choice);
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background transition hover:border-primary hover:bg-primary/15"
                >
                  <Piece code={uci.slice(4)} white={turn === "white"} size="2rem" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.chess-piece) {
          font-family: "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", sans-serif;
        }
        :global(.chess-slide) {
          animation: chess-slide 260ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        :global(.chess-check) {
          animation: chess-pulse 720ms ease-in-out infinite;
        }
        @keyframes chess-slide {
          from {
            transform: translate(calc((var(--tx) + var(--dx)) * 100%), calc((var(--ty) + var(--dy)) * 100%));
          }
          to {
            transform: translate(calc(var(--tx) * 100%), calc(var(--ty) * 100%));
          }
        }
        @keyframes chess-pulse {
          0%,
          100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

function Piece({ code, white, size = "min(9vw, 3.4rem)" }: { code: string; white: boolean; size?: string }) {
  return (
    <span
      className="chess-piece leading-none"
      style={{
        fontSize: size,
        color: white ? "#f8fafc" : "#0b1220",
        textShadow: white ? "0 2px 3px rgba(0,0,0,.55)" : "0 1px 2px rgba(0,0,0,.35)",
      }}
    >
      {GLYPH[code.toLowerCase()] ?? ""}
    </span>
  );
}

function Tint({ row, col, kind, animateKey }: { row: number; col: number; kind: "from" | "to" | "select" | "check"; animateKey?: string | number }) {
  const bg =
    kind === "from"
      ? "rgba(99,102,241,0.35)"
      : kind === "to"
        ? "rgba(34,211,238,0.40)"
        : kind === "select"
          ? "rgba(250,204,21,0.45)"
          : "radial-gradient(circle, rgba(239,68,68,0.85) 0%, rgba(239,68,68,0) 72%)";
  return (
    <div
      key={kind === "check" ? `check:${animateKey}` : kind}
      className={cn("absolute h-[12.5%] w-[12.5%]", kind === "check" && "chess-check")}
      style={{ transform: `translate(${col * 100}%, ${row * 100}%)`, background: bg }}
    />
  );
}

function Target({ row, col, capture }: { row: number; col: number; capture: boolean }) {
  return (
    <div data-target={`${row},${col}`} className="absolute flex h-[12.5%] w-[12.5%] items-center justify-center" style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}>
      {capture ? (
        <div className="h-full w-full rounded-full border-[6px] border-rose-400/70" />
      ) : (
        <div className="h-[28%] w-[28%] rounded-full bg-black/35" />
      )}
    </div>
  );
}
