"use client";

import { useMemo } from "react";
import { KING, parseFen, pieceName, squareName, WHITE } from "@/lib/chess/engine";
import { cn } from "@/lib/utils";

export type BoardLastMove = { from: string; to: string };

/** Solid glyphs for both colors; CSS colors white pieces light and black dark. */
const GLYPH: Record<string, string> = {
  k: "\u265A",
  q: "\u265B",
  r: "\u265C",
  b: "\u265D",
  n: "\u265E",
  p: "\u265F",
};

function glyph(code: string): string {
  return GLYPH[code.toLowerCase()] ?? "";
}

/**
 * A board that reads a FEN and animates the last move: the piece on `to` slides
 * in from `from`, squares are tinted, and a checked king pulses. Everything is
 * driven by CSS custom properties so no layout pass is needed mid-animation.
 */
export function ChessBoard({
  fen,
  orientation = "white",
  lastMove,
  animateKey,
  className,
}: {
  fen: string;
  orientation?: "white" | "black";
  lastMove?: BoardLastMove | null;
  /** Change this to replay the slide (usually the current ply). */
  animateKey?: string | number;
  className?: string;
}) {
  const state = useMemo(() => {
    const pos = parseFen(fen);
    const whiteAtBottom = orientation === "white";
    const cells: Array<{ sq: number; row: number; col: number; light: boolean; piece: string | null; isWhite: boolean }> = [];
    let kingSquare: string | null = null;
    for (let sq = 0; sq < 64; sq++) {
      const file = sq & 7;
      const rank = sq >> 3;
      const row = whiteAtBottom ? 7 - rank : rank;
      const col = whiteAtBottom ? file : 7 - file;
      const code = pos.board[sq];
      const isWhite = code > 0;
      if (code && Math.abs(code) === KING && ((code > 0) === (pos.turn === WHITE))) {
        kingSquare = squareName(sq);
      }
      cells.push({ sq, row, col, light: (file + rank) % 2 === 1, piece: code ? pieceName(code) : null, isWhite });
    }
    return { cells, whiteAtBottom, kingSquare, turn: pos.turn };
  }, [fen, orientation]);

  const toRC = (square: string): { row: number; col: number } | null => {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
    const row = state.whiteAtBottom ? 7 - rank : rank;
    const col = state.whiteAtBottom ? file : 7 - file;
    return { row, col };
  };

  const from = lastMove ? toRC(lastMove.from) : null;
  const to = lastMove ? toRC(lastMove.to) : null;
  const movedTo = lastMove?.to;

  return (
    <div className={cn("relative w-full select-none overflow-hidden rounded-xl border border-border shadow-xl shadow-black/30", className)}>
      <div className="grid aspect-square w-full grid-cols-8 grid-rows-8">
        {Array.from({ length: 64 }).map((_, i) => {
          const row = Math.floor(i / 8);
          const col = i % 8;
          const light = (row + col) % 2 === 0;
          return <div key={i} className={light ? "bg-[#b9c4d6]" : "bg-[#5b6b85]"} />;
        })}
      </div>

      {/* Highlights (tints) */}
      <div className="pointer-events-none absolute inset-0">
        {from && <Tint row={from.row} col={from.col} kind="from" />}
        {to && <Tint row={to.row} col={to.col} kind="to" />}
        {state.kingSquare && <Tint row={toRC(state.kingSquare)!.row} col={toRC(state.kingSquare)!.col} kind="check" animateKey={animateKey} />}
      </div>

      {/* Pieces */}
      <div className="pointer-events-none absolute inset-0">
        {state.cells
          .filter((c) => c.piece)
          .map((c) => {
            const isMoved = movedTo != null && squareName(c.sq) === movedTo && from && to;
            const dx = isMoved ? from!.col - to!.col : 0;
            const dy = isMoved ? from!.row - to!.row : 0;
            return (
              <div
                key={isMoved ? `${c.sq}:${animateKey}` : String(c.sq)}
                className={cn(
                  "absolute left-0 top-0 flex h-[12.5%] w-[12.5%] items-center justify-center",
                  isMoved && "chess-slide"
                )}
                style={
                  {
                    transform: `translate(${c.col * 100}%, ${c.row * 100}%)`,
                    "--tx": c.col,
                    "--ty": c.row,
                    "--dx": dx,
                    "--dy": dy,
                  } as React.CSSProperties
                }
              >
                <span
                  className="chess-piece leading-none"
                  style={{
                    fontSize: "min(9vw, 3.4rem)",
                    color: c.isWhite ? "#f8fafc" : "#0b1220",
                    textShadow: c.isWhite ? "0 2px 3px rgba(0,0,0,.55)" : "0 1px 2px rgba(0,0,0,.35)",
                  }}
                >
                  {glyph(c.piece!)}
                </span>
              </div>
            );
          })}
      </div>

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

function Tint({ row, col, kind, animateKey }: { row: number; col: number; kind: "from" | "to" | "check"; animateKey?: string | number }) {
  const bg =
    kind === "from"
      ? "rgba(99,102,241,0.35)"
      : kind === "to"
        ? "rgba(34,211,238,0.40)"
        : "radial-gradient(circle, rgba(239,68,68,0.85) 0%, rgba(239,68,68,0) 72%)";
  return (
    <div
      key={kind === "check" ? `check:${animateKey}` : kind}
      className={cn("absolute h-[12.5%] w-[12.5%]", kind === "check" && "chess-check")}
      style={{ transform: `translate(${col * 100}%, ${row * 100}%)`, background: bg }}
    />
  );
}
