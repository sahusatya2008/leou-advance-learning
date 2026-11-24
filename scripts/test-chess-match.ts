/**
 * Integration test for the Leou Chess match service: real Postgres + real
 * sandbox runner. Plays a short computer game with the starter strategy, checks
 * the engine replies, checks the log, and checks illegal moves are rejected.
 *
 *   RUNNER_URL=http://localhost:4100 npx tsx --tsconfig scripts/tsconfig.json scripts/test-chess-match.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  createComputerMatch,
  createMultiplayerMatch,
  claimInviteSeat,
  participantColor,
  submitHumanMove,
  toPublicMatch,
} from "@/lib/chess/matchService";
import { chessStarter } from "@/lib/chess/harness";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, extra = "") {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log(`  FAIL ${label}${extra ? " — " + extra : ""}`);
  }
}

async function main() {
  const user = await prisma.user.findUnique({ where: { username: "shellstudent" }, select: { id: true } });
  if (!user) throw new Error("shellstudent not found");

  const id = await createComputerMatch(user.id, { difficulty: "medium", language: "python", color: "white" });
  console.log("created match", id);

  let state = toPublicMatch((await prisma.chessMatch.findUnique({ where: { id }, include: { moves: { orderBy: { ply: "asc" } } } }))!);
  check("starts at start position", state.fen.startsWith("rnbqkbnr"));
  check("white to move", state.turn === "white");

  const code = chessStarter("python");
  let turns = 0;
  while (state.status === "ACTIVE" && turns < 10) {
    const res = await submitHumanMove(user.id, id, code, "python");
    if (!res.ok) {
      console.log(`  stop: ${res.illegal ? "illegal" : "error"} — ${res.error}`);
      break;
    }
    check(`turn ${turns + 1}: a human move was logged`, res.humanMove.uci.length >= 4, res.humanMove.uci);
    check(`turn ${turns + 1}: engine replied`, res.aiMove != null);
    state = res.match;
    turns++;
  }
  check("played several turns", turns >= 2, `turns=${turns}`);
  check("ply log matches plyCount", state.moves.length === state.plyCount, `moves=${state.moves.length} plyCount=${state.plyCount}`);

  // Alternating colors in the log.
  const alternating = state.moves.every((m, i) => (i % 2 === 0 ? m.color === "w" : m.color === "b"));
  check("moves alternate w/b starting white", alternating);

  // Illegal move is reported, not applied. Fresh match so it is definitely live.
  const badId = await createComputerMatch(user.id, { difficulty: "medium", language: "python", color: "white" });
  const badCode = `def move(game):\n    return "a1a1"\n`;
  const bad = await submitHumanMove(user.id, badId, badCode, "python");
  check("illegal move rejected", !bad.ok && bad.illegal, bad.ok ? "accepted" : "not marked illegal");
  const after = toPublicMatch((await prisma.chessMatch.findUnique({ where: { id: badId }, include: { moves: { orderBy: { ply: "asc" } } } }))!);
  check("illegal move did not change the board", after.plyCount === 0);
  await prisma.chessMatch.delete({ where: { id: badId } });

  // ------------------------------------------------------------------ multiplayer
  const stamp = Date.now();
  const guest = await prisma.user.create({
    data: { username: `guest_${stamp}`, email: `guest_${stamp}@test.local`, passwordHash: "x" },
    select: { id: true },
  });
  const outsider = await prisma.user.create({
    data: { username: `outsider_${stamp}`, email: `outsider_${stamp}@test.local`, passwordHash: "x" },
    select: { id: true },
  });

  const room = await createMultiplayerMatch(user.id, { language: "python", color: "white" });
  check("invite token is a nontrivial slug", room.inviteToken.length >= 10, room.inviteToken);
  let mp = toPublicMatch((await prisma.chessMatch.findUnique({ where: { id: room.id }, include: { moves: { orderBy: { ply: "asc" } } } }))!);
  check("room is multiplayer", mp.mode === "MULTIPLAYER");
  check("host holds white, black is open", mp.seatsFilled.white && !mp.seatsFilled.black);
  check("invite token is exposed to the room", mp.inviteToken === room.inviteToken);

  // The host may not play the first move alone.
  const early = await submitHumanMove(user.id, room.id, chessStarter("python"), "python");
  check("host blocked while opponent absent", !early.ok && !early.illegal && /opponent has not joined/i.test(early.error), early.ok ? "accepted" : early.error);

  const claim = await claimInviteSeat(room.id, guest.id);
  check("friend claims the open seat", claim.ok && claim.color === "black", claim.ok ? claim.color : claim.error);
  const again = await claimInviteSeat(room.id, guest.id);
  check("re-claiming is idempotent", again.ok && again.color === "black");

  const full = await claimInviteSeat(room.id, outsider.id);
  check("a full room cannot be claimed", !full.ok, full.ok ? "accepted" : "");

  check("participantColor maps the host", participantColor({ whiteId: user.id, blackId: guest.id }, user.id) === "white");
  check("participantColor maps the guest", participantColor({ whiteId: user.id, blackId: guest.id }, guest.id) === "black");
  check("participantColor rejects outsiders", participantColor({ whiteId: user.id, blackId: guest.id }, outsider.id) === null);

  // Outsider is not in the game; the room must be invisible to them (no leak).
  const intruder = await submitHumanMove(outsider.id, room.id, chessStarter("python"), "python");
  check("outsider cannot move", !intruder.ok && /not found|not in this game/i.test(intruder.error), intruder.ok ? "accepted" : intruder.error);

  // Guest tries on white's turn.
  const earlyGuest = await submitHumanMove(guest.id, room.id, chessStarter("python"), "python");
  check("guest blocked on opponent's turn", !earlyGuest.ok && /not your turn/i.test(earlyGuest.error), earlyGuest.ok ? "accepted" : earlyGuest.error);

  const white = await submitHumanMove(user.id, room.id, chessStarter("python"), "python");
  check("host move logged, no engine reply", white.ok && white.aiMove === null && white.match.plyCount === 1, white.ok ? `ai=${white.aiMove}` : white.error);

  const black = await submitHumanMove(guest.id, room.id, chessStarter("python"), "python");
  check("guest reply logged, no engine reply", black.ok && black.aiMove === null && black.match.plyCount === 2, black.ok ? `ai=${black.aiMove}` : black.error);
  if (black.ok) {
    mp = black.match;
    const alternate = mp.moves.every((m, i) => (i % 2 === 0 ? m.color === "w" : m.color === "b"));
    check("multiplayer plies alternate w/b", alternate);
    check("each side's code is stored under its own seat", Boolean(mp.whiteCode) && Boolean(mp.blackCode));
  }

  await prisma.chessMatch.delete({ where: { id: room.id } });
  await prisma.user.delete({ where: { id: guest.id } });
  await prisma.user.delete({ where: { id: outsider.id } });

  await prisma.chessMatch.delete({ where: { id } });
  console.log(`\n${passed}/${passed + failed} checks passed`);
  if (failed) {
    console.log("chess match: FAILURES");
    process.exit(1);
  }
  console.log("chess match OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
