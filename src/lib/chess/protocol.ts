/**
 * Wire types shared by the chess API routes and the client. Pure — no server
 * imports — so the board UI can depend on it safely.
 */

export type ChessSide = "white" | "black";

export type PublicMove = {
  ply: number;
  color: "w" | "b";
  uci: string;
  san: string;
  fen: string;
  /** True when the built-in engine, not a person, chose this ply. */
  ai: boolean;
  thinkMs: number | null;
};

export type PublicMatch = {
  id: string;
  mode: string;
  status: string;
  difficulty: string | null;
  language: string;
  fen: string;
  turn: "white" | "black";
  result: string | null;
  reason: string | null;
  plyCount: number;
  whiteCode: string | null;
  blackCode: string | null;
  /** Shareable slug for multiplayer rooms (`/chess/join/<token>`); null otherwise. */
  inviteToken: string | null;
  /** Which seats are occupied — a multiplayer room starts with one empty seat. */
  seatsFilled: { white: boolean; black: boolean };
  finished: boolean;
  moves: PublicMove[];
};
