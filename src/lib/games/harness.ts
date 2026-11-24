import type {
  ArenaLevel,
  BotLevel,
  GameLanguage,
  Level,
  OutputLevel,
  PaintLevel,
  WorldSpec,
} from "./types";
import { ARENA_MARKER, OUTPUT_MARKER, RETURN_MARKER, TRACE_MARKER, parseWorld } from "./types";

/**
 * Per-language game harness compiler.
 *
 * The student only ever writes a `solve(...)` function. This wraps it in a
 * generated program that lays out the level, provides the toolkit, calls the
 * student's `solve`, and prints a compact result the app replays:
 *
 *   - `bot`    → a one-line action trace after `@@BOT@@`.
 *   - `paint`  → a one-line turtle trace after `@@BOT@@`.
 *   - `output` → one `@@OUT@@<i>|<value>` line per test case.
 *   - `arena`  → a `@@AR@@` line of `;`-joined operations plus a `@@RET@@` line.
 *
 * The bot's harness is the only stateful one: its sensors (`canMove`, `hasKey`,
 * …) force it to model the world. The turtle and the output harness are stateless
 * emitters — the server replays/compares, so the two can never disagree.
 *
 * The whole assembled program is what runs in the sandbox; the editor only ever
 * shows the student's `solve`, which is why the starters are just the function.
 */

const MAX = 20_000;

export function buildProgram(language: GameLanguage, level: Level, studentCode: string): string {
  switch (level.kind) {
    case "bot":
      return buildBotProgram(language, level, studentCode);
    case "paint":
      return buildPaintProgram(language, level, studentCode);
    case "output":
      return buildOutputProgram(language, level, studentCode);
    case "arena":
      return buildArenaProgram(language, level, studentCode);
  }
}

// ===========================================================================
// BOT
// ===========================================================================

function rowsLiteral(world: WorldSpec, join = ", "): string {
  return world.rows.map((r) => JSON.stringify(r)).join(join);
}

function botPreamble(language: GameLanguage, level: BotLevel): string {
  const startDir = parseWorld(level.world).startDir;
  const rowsJson = rowsLiteral(level.world);
  const rowsC = rowsLiteral(level.world);

  switch (language) {
    case "python":
      return `# --- Leou Bot harness (generated) ---
_world = [${rowsJson}]
_start_dir = ${startDir}
_dirs = [(0, -1), (1, 0), (0, 1), (-1, 0)]
_h = len(_world)
_w = len(_world[0]) if _h else 0
_walls = set()
_gems = set()
_keys = set()
_doors = set()
_teles = {}
_goal = None
_start = (0, 0)
_sd = _start_dir
for _y in range(_h):
    for _x in range(_w):
        _c = _world[_y][_x]
        if _c == "#":
            _walls.add((_x, _y))
        elif _c == "*":
            _gems.add((_x, _y))
        elif _c == "k":
            _keys.add((_x, _y))
        elif _c == "D":
            _doors.add((_x, _y))
        elif _c == "G":
            _goal = (_x, _y)
        if _c == "1" or _c == "2":
            _teles.setdefault(_c, []).append((_x, _y))
        if _c in "S^>v<":
            _start = (_x, _y)
            if _c == "^":
                _sd = 0
            elif _c == ">":
                _sd = 1
            elif _c == "v":
                _sd = 2
            elif _c == "<":
                _sd = 3
_trace = []
_MAX = ${MAX}

def _open(_x, _y, _keys):
    if _x < 0 or _y < 0 or _x >= _w or _y >= _h:
        return False
    if (_x, _y) in _walls:
        return False
    if (_x, _y) in _doors and _keys <= 0:
        return False
    return True

def _emit(_t):
    _trace.append(_t)
    if len(_trace) > _MAX:
        raise RuntimeError("overrun")

class Bot:
    def __init__(self):
        self.x, self.y = _start
        self.dir = _sd
        self.keys = 0
    def forward(self):
        _dx, _dy = _dirs[self.dir]
        _nx, _ny = self.x + _dx, self.y + _dy
        if not _open(_nx, _ny, self.keys):
            _emit("X")
            raise RuntimeError("crash")
        self.x, self.y = _nx, _ny
        if (self.x, self.y) in _keys:
            self.keys += 1
        for _band, _pts in _teles.items():
            if (self.x, self.y) in _pts:
                for _p in _pts:
                    if _p != (self.x, self.y):
                        self.x, self.y = _p
                        break
        _emit("F")
    def turnLeft(self):
        self.dir = (self.dir - 1) % 4
        _emit("L")
    def turnRight(self):
        self.dir = (self.dir + 1) % 4
        _emit("R")
    def pick(self):
        _emit("P")
    def canMove(self):
        _dx, _dy = _dirs[self.dir]
        return _open(self.x + _dx, self.y + _dy, self.keys)
    def canMoveLeft(self):
        _dx, _dy = _dirs[(self.dir - 1) % 4]
        return _open(self.x + _dx, self.y + _dy, self.keys)
    def canMoveRight(self):
        _dx, _dy = _dirs[(self.dir + 1) % 4]
        return _open(self.x + _dx, self.y + _dy, self.keys)
    def canMoveBack(self):
        _dx, _dy = _dirs[(self.dir + 2) % 4]
        return _open(self.x + _dx, self.y + _dy, self.keys)
    def atGoal(self):
        return _goal is not None and (self.x, self.y) == _goal
    def onGem(self):
        return (self.x, self.y) in _gems
    def hasKey(self):
        return self.keys > 0
    def currentRow(self):
        return self.y
    def currentCol(self):
        return self.x
    def facing(self):
        return self.dir

# --- your code ---
`;

    case "javascript":
      return `// --- Leou Bot harness (generated) ---
const _world = [${rowsJson}];
const _startDir = ${startDir};
const _dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const _h = _world.length;
const _w = _h ? _world[0].length : 0;
const _walls = new Set();
const _gems = new Set();
const _keys = new Set();
const _doors = new Set();
const _teles = new Map();
let _goal = null;
let _start = [0, 0];
let _sd = _startDir;
for (let _y = 0; _y < _h; _y++) {
  for (let _x = 0; _x < _w; _x++) {
    const _c = _world[_y][_x];
    if (_c === "#") _walls.add(_x + "," + _y);
    else if (_c === "*") _gems.add(_x + "," + _y);
    else if (_c === "k") _keys.add(_x + "," + _y);
    else if (_c === "D") _doors.add(_x + "," + _y);
    else if (_c === "G") _goal = [_x, _y];
    if (_c === "1" || _c === "2") {
      const arr = _teles.get(_c) || [];
      arr.push([_x, _y]);
      _teles.set(_c, arr);
    }
    if (_c === "S" || _c === "^" || _c === ">" || _c === "v" || _c === "<") {
      _start = [_x, _y];
      if (_c === "^") _sd = 0;
      else if (_c === ">") _sd = 1;
      else if (_c === "v") _sd = 2;
      else if (_c === "<") _sd = 3;
    }
  }
}
const _trace = [];
const _MAX = ${MAX};
function _open(x, y, keys) {
  if (x < 0 || y < 0 || x >= _w || y >= _h) return false;
  if (_walls.has(x + "," + y)) return false;
  if (_doors.has(x + "," + y) && keys <= 0) return false;
  return true;
}
function _emit(t) {
  _trace.push(t);
  if (_trace.length > _MAX) throw new Error("overrun");
}
class Bot {
  constructor() {
    this.x = _start[0];
    this.y = _start[1];
    this.dir = _sd;
    this.keys = 0;
  }
  forward() {
    const [dx, dy] = _dirs[this.dir];
    const nx = this.x + dx;
    const ny = this.y + dy;
    if (!_open(nx, ny, this.keys)) {
      _emit("X");
      throw new Error("crash");
    }
    this.x = nx;
    this.y = ny;
    if (_keys.has(this.x + "," + this.y)) this.keys++;
    for (const [, pts] of _teles) {
      for (const [tx, ty] of pts) {
        if (tx === this.x && ty === this.y) {
          for (const [ox, oy] of pts) {
            if (ox !== this.x || oy !== this.y) { this.x = ox; this.y = oy; break; }
          }
          break;
        }
      }
    }
    _emit("F");
  }
  turnLeft() { this.dir = (this.dir + 3) % 4; _emit("L"); }
  turnRight() { this.dir = (this.dir + 1) % 4; _emit("R"); }
  pick() { _emit("P"); }
  canMove() { const [dx, dy] = _dirs[this.dir]; return _open(this.x + dx, this.y + dy, this.keys); }
  canMoveLeft() { const [dx, dy] = _dirs[(this.dir + 3) % 4]; return _open(this.x + dx, this.y + dy, this.keys); }
  canMoveRight() { const [dx, dy] = _dirs[(this.dir + 1) % 4]; return _open(this.x + dx, this.y + dy, this.keys); }
  canMoveBack() { const [dx, dy] = _dirs[(this.dir + 2) % 4]; return _open(this.x + dx, this.y + dy, this.keys); }
  atGoal() { return _goal !== null && this.x === _goal[0] && this.y === _goal[1]; }
  onGem() { return _gems.has(this.x + "," + this.y); }
  hasKey() { return this.keys > 0; }
  currentRow() { return this.y; }
  currentCol() { return this.x; }
  facing() { return this.dir; }
}

// --- your code ---
`;

    case "java":
      return `// --- Leou Bot harness (generated) ---
import java.util.*;

public class Main {
  static String[] WORLD = {${rowsC}};
  static int START_DIR = ${startDir};
  static int[][] DIRS = {{0, -1}, {1, 0}, {0, 1}, {-1, 0}};
  static int H, W;
  static Set<String> walls = new HashSet<>();
  static Set<String> gems = new HashSet<>();
  static Set<String> keys = new HashSet<>();
  static Set<String> doors = new HashSet<>();
  static Map<String, List<int[]>> teles = new HashMap<>();
  static int goalX = -1, goalY = -1, startX = 0, startY = 0, startDir = START_DIR;
  static List<String> trace = new ArrayList<>();
  static final int MAX = ${MAX};

  static void emit(String t) {
    trace.add(t);
    if (trace.size() > MAX) throw new RuntimeException("overrun");
  }
  static boolean isOpen(int x, int y, int held) {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    if (walls.contains(x + "," + y)) return false;
    if (doors.contains(x + "," + y) && held <= 0) return false;
    return true;
  }

  static class Bot {
    int x, y, dir, held;
    Bot() { x = startX; y = startY; dir = startDir; held = 0; }
    void forward() {
      int nx = x + DIRS[dir][0], ny = y + DIRS[dir][1];
      if (!isOpen(nx, ny, held)) { emit("X"); throw new RuntimeException("crash"); }
      x = nx; y = ny;
      if (keys.contains(x + "," + y)) held++;
      for (List<int[]> pts : teles.values()) {
        for (int[] p : pts) {
          if (p[0] == x && p[1] == y) {
            for (int[] o : pts) if (o[0] != x || o[1] != y) { x = o[0]; y = o[1]; break; }
            break;
          }
        }
      }
      emit("F");
    }
    void turnLeft() { dir = (dir + 3) % 4; emit("L"); }
    void turnRight() { dir = (dir + 1) % 4; emit("R"); }
    void pick() { emit("P"); }
    boolean canMove() { return isOpen(x + DIRS[dir][0], y + DIRS[dir][1], held); }
    boolean canMoveLeft() { int d = (dir + 3) % 4; return isOpen(x + DIRS[d][0], y + DIRS[d][1], held); }
    boolean canMoveRight() { int d = (dir + 1) % 4; return isOpen(x + DIRS[d][0], y + DIRS[d][1], held); }
    boolean canMoveBack() { int d = (dir + 2) % 4; return isOpen(x + DIRS[d][0], y + DIRS[d][1], held); }
    boolean atGoal() { return goalX >= 0 && x == goalX && y == goalY; }
    boolean onGem() { return gems.contains(x + "," + y); }
    boolean hasKey() { return held > 0; }
    int currentRow() { return y; }
    int currentCol() { return x; }
    int facing() { return dir; }
  }

  static void build() {
    H = WORLD.length;
    W = WORLD[0].length();
    for (int y = 0; y < H; y++) {
      for (int x = 0; x < W; x++) {
        char c = WORLD[y].charAt(x);
        if (c == '#') walls.add(x + "," + y);
        else if (c == '*') gems.add(x + "," + y);
        else if (c == 'k') keys.add(x + "," + y);
        else if (c == 'D') doors.add(x + "," + y);
        else if (c == 'G') { goalX = x; goalY = y; }
        if (c == '1' || c == '2') { teles.computeIfAbsent(String.valueOf(c), k -> new ArrayList<>()).add(new int[]{x, y}); }
        if ("S^>v<".indexOf(c) >= 0) {
          startX = x; startY = y;
          if (c == '^') startDir = 0;
          else if (c == '>') startDir = 1;
          else if (c == 'v') startDir = 2;
          else if (c == '<') startDir = 3;
        }
      }
    }
  }

  // --- your code (write: static void solve(Bot bot) { ... }) ---
`;

    case "cpp":
      return `// --- Leou Bot harness (generated) ---
#include <bits/stdc++.h>
using namespace std;

static vector<string> WORLD = {${rowsC}};
static int START_DIR = ${startDir};
static int DIRS[4][2] = {{0, -1}, {1, 0}, {0, 1}, {-1, 0}};
static int H, W;
static set<pair<int,int>> walls;
static set<pair<int,int>> gems;
static set<pair<int,int>> keys;
static set<pair<int,int>> doors;
static map<char, vector<pair<int,int>>> teles;
static int goalX = -1, goalY = -1, startX = 0, startY = 0, startDir = 1;
static vector<string> trace;
static const int MAX = ${MAX};

static void emit(const string& t) {
  trace.push_back(t);
  if ((int)trace.size() > MAX) throw runtime_error("overrun");
}
static bool isOpen(int x, int y, int held) {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  if (walls.count({x, y})) return false;
  if (doors.count({x, y}) && held <= 0) return false;
  return true;
}

struct Bot {
  int x, y, dir, held;
  Bot() { x = startX; y = startY; dir = startDir; held = 0; }
  void forward() {
    int nx = x + DIRS[dir][0], ny = y + DIRS[dir][1];
    if (!isOpen(nx, ny, held)) { emit("X"); throw runtime_error("crash"); }
    x = nx; y = ny;
    if (keys.count({x, y})) held++;
    for (auto& kv : teles) {
      for (auto& p : kv.second) {
        if (p.first == x && p.second == y) {
          for (auto& o : kv.second) if (o.first != x || o.second != y) { x = o.first; y = o.second; break; }
          break;
        }
      }
    }
    emit("F");
  }
  void turnLeft() { dir = (dir + 3) % 4; emit("L"); }
  void turnRight() { dir = (dir + 1) % 4; emit("R"); }
  void pick() { emit("P"); }
  bool canMove() { return isOpen(x + DIRS[dir][0], y + DIRS[dir][1], held); }
  bool canMoveLeft() { int d = (dir + 3) % 4; return isOpen(x + DIRS[d][0], y + DIRS[d][1], held); }
  bool canMoveRight() { int d = (dir + 1) % 4; return isOpen(x + DIRS[d][0], y + DIRS[d][1], held); }
  bool canMoveBack() { int d = (dir + 2) % 4; return isOpen(x + DIRS[d][0], y + DIRS[d][1], held); }
  bool atGoal() { return goalX >= 0 && x == goalX && y == goalY; }
  bool onGem() { return gems.count({x, y}) > 0; }
  bool hasKey() { return held > 0; }
  int currentRow() { return y; }
  int currentCol() { return x; }
  int facing() { return dir; }
};

static void build() {
  H = (int)WORLD.size();
  W = (int)WORLD[0].size();
  for (int y = 0; y < H; y++) {
    for (int x = 0; x < W; x++) {
      char c = WORLD[y][x];
      if (c == '#') walls.insert({x, y});
      else if (c == '*') gems.insert({x, y});
      else if (c == 'k') keys.insert({x, y});
      else if (c == 'D') doors.insert({x, y});
      else if (c == 'G') { goalX = x; goalY = y; }
      if (c == '1' || c == '2') teles[c].push_back({x, y});
      if (string("S^>v<").find(c) != string::npos) {
        startX = x; startY = y;
        if (c == '^') startDir = 0;
        else if (c == '>') startDir = 1;
        else if (c == 'v') startDir = 2;
        else if (c == '<') startDir = 3;
      }
    }
  }
}

// --- your code (write: void solve(Bot &bot) { ... }) ---
`;
  }
}

function botEpilogue(language: GameLanguage): string {
  switch (language) {
    case "python":
      return `
# --- run ---
try:
    solve(Bot())
except Exception:
    pass
import sys
sys.stdout.write("${TRACE_MARKER}" + ",".join(_trace) + "\\n")
`;
    case "javascript":
      return `
// --- run ---
try {
  solve(new Bot());
} catch (e) {}
console.log("${TRACE_MARKER}" + _trace.join(","));
`;
    case "java":
      return `
  public static void main(String[] args) {
    build();
    try { solve(new Bot()); } catch (Throwable t) {}
    StringBuilder sb = new StringBuilder("${TRACE_MARKER}");
    for (int i = 0; i < trace.size(); i++) {
      if (i > 0) sb.append(",");
      sb.append(trace.get(i));
    }
    System.out.println(sb.toString());
  }
}
`;
    case "cpp":
      return `
int main() {
  build();
  try { Bot bot; solve(bot); } catch (...) {}
  string out = "${TRACE_MARKER}";
  for (size_t i = 0; i < trace.size(); i++) {
    if (i) out += ",";
    out += trace[i];
  }
  cout << out << endl;
  return 0;
}
`;
  }
}

function buildBotProgram(language: GameLanguage, level: BotLevel, studentCode: string): string {
  return botPreamble(language, level) + "\n" + studentCode + "\n" + botEpilogue(language);
}

// ===========================================================================
// PAINT (stateless turtle — the server replays positions)
// ===========================================================================

function paintPreamble(language: GameLanguage): string {
  switch (language) {
    case "python":
      return `# --- Leou Turtle harness (generated) ---
_trace = []
_MAX = ${MAX}

def _emit(_t):
    _trace.append(_t)
    if len(_trace) > _MAX:
        raise RuntimeError("overrun")

class Turtle:
    def forward(self, n=1):
        _emit("F" + str(int(n)))
    def back(self, n=1):
        _emit("B" + str(int(n)))
    def turnLeft(self):
        _emit("L")
    def turnRight(self):
        _emit("R")
    def left(self):
        _emit("L")
    def right(self):
        _emit("R")
    def penUp(self):
        _emit("U")
    def penDown(self):
        _emit("D")

# --- your code ---
`;
    case "javascript":
      return `// --- Leou Turtle harness (generated) ---
const _trace = [];
const _MAX = ${MAX};
function _emit(t) {
  _trace.push(t);
  if (_trace.length > _MAX) throw new Error("overrun");
}
class Turtle {
  forward(n = 1) { _emit("F" + Math.trunc(n)); }
  back(n = 1) { _emit("B" + Math.trunc(n)); }
  turnLeft() { _emit("L"); }
  turnRight() { _emit("R"); }
  left() { _emit("L"); }
  right() { _emit("R"); }
  penUp() { _emit("U"); }
  penDown() { _emit("D"); }
}

// --- your code ---
`;
    case "java":
      return `// --- Leou Turtle harness (generated) ---
import java.util.*;

public class Main {
  static List<String> trace = new ArrayList<>();
  static final int MAX = ${MAX};
  static void emit(String t) {
    trace.add(t);
    if (trace.size() > MAX) throw new RuntimeException("overrun");
  }
  static class Turtle {
    void forward() { emit("F1"); }
    void forward(int n) { emit("F" + n); }
    void back(int n) { emit("B" + n); }
    void turnLeft() { emit("L"); }
    void turnRight() { emit("R"); }
    void penUp() { emit("U"); }
    void penDown() { emit("D"); }
  }

  // --- your code (write: static void solve(Turtle turtle) { ... }) ---
`;
    case "cpp":
      throw new Error("Painting is not offered in C++.");
  }
}

function paintEpilogue(language: GameLanguage): string {
  switch (language) {
    case "python":
      return `
# --- run ---
try:
    solve(Turtle())
except Exception:
    pass
import sys
sys.stdout.write("${TRACE_MARKER}" + ",".join(_trace) + "\\n")
`;
    case "javascript":
      return `
// --- run ---
try { solve(new Turtle()); } catch (e) {}
console.log("${TRACE_MARKER}" + _trace.join(","));
`;
    case "java":
      return `
  public static void main(String[] args) {
    try { solve(new Turtle()); } catch (Throwable t) {}
    StringBuilder sb = new StringBuilder("${TRACE_MARKER}");
    for (int i = 0; i < trace.size(); i++) {
      if (i > 0) sb.append(",");
      sb.append(trace.get(i));
    }
    System.out.println(sb.toString());
  }
}
`;
    case "cpp":
      throw new Error("Painting is not offered in C++.");
  }
}

function buildPaintProgram(language: GameLanguage, _level: PaintLevel, studentCode: string): string {
  return paintPreamble(language) + "\n" + studentCode + "\n" + paintEpilogue(language);
}

// ===========================================================================
// OUTPUT (one sandbox run grades every test)
// ===========================================================================

function casesLiteral(level: OutputLevel, join = ", "): string {
  return level.tests.map((t) => JSON.stringify(t.input)).join(join);
}

function outputPreamble(language: GameLanguage, level: OutputLevel): string {
  const cases = casesLiteral(level);
  switch (language) {
    case "python":
      return `# --- Leou Dojo harness (generated) ---
_cases = [${cases}]

# --- your code ---
`;
    case "javascript":
      return `// --- Leou Dojo harness (generated) ---
const _cases = [${cases}];

// --- your code ---
`;
    case "java":
      return `// --- Leou Dojo harness (generated) ---
import java.util.*;

public class Main {
  static String[] CASES = {${cases}};

  // --- your code (write: static String solve(String s) { ... }) ---
`;
    case "cpp":
      throw new Error("Data Dojo is not offered in C++.");
  }
}

function outputEpilogue(language: GameLanguage): string {
  switch (language) {
    case "python":
      return `
# --- run tests ---
import sys
for _i, _c in enumerate(_cases):
    try:
        _r = solve(_c)
        _s = "" if _r is None else str(_r)
    except Exception as _e:
        _s = "!!ERR!!" + str(_e)
    sys.stdout.write("${OUTPUT_MARKER}" + str(_i) + "|" + _s + "\\n")
`;
    case "javascript":
      return `
// --- run tests ---
for (let _i = 0; _i < _cases.length; _i++) {
  let _s;
  try {
    const _r = solve(_cases[_i]);
    _s = _r === null || _r === undefined ? "" : String(_r);
  } catch (_e) {
    _s = "!!ERR!!" + (_e && _e.message ? _e.message : _e);
  }
  console.log("${OUTPUT_MARKER}" + _i + "|" + _s);
}
`;
    case "java":
      return `
  static void report(int i, String s) {
    System.out.println("${OUTPUT_MARKER}" + i + "|" + (s == null ? "" : s));
  }
  public static void main(String[] args) {
    for (int i = 0; i < CASES.length; i++) {
      try {
        report(i, solve(CASES[i]));
      } catch (Throwable t) {
        report(i, "!!ERR!!" + t);
      }
    }
  }
}
`;
    case "cpp":
      throw new Error("Data Dojo is not offered in C++.");
  }
}

function buildOutputProgram(language: GameLanguage, level: OutputLevel, studentCode: string): string {
  return outputPreamble(language, level) + "\n" + studentCode + "\n" + outputEpilogue(language);
}

// ===========================================================================
// ARENA (stateful box — the harness records every counted operation)
// ===========================================================================

function arrayLiteral(a: number[]): string {
  return a.join(", ");
}

/** Python method bodies, keyed so only the level's `api` is emitted. Gating
 *  matters: a pure sort level must not hand out `get`/`set`, or a student could
 *  sidestep the compare/swap model entirely. */
const ARENA_PY: Record<string, string> = {
  size: `    def size(self):\n        return len(_arr)`,
  compare: `    def compare(self, i, j):\n        i, j = int(i), int(j)\n        _rec("c" + str(i) + ":" + str(j))\n        a, b = _arr[_idx(i)], _arr[_idx(j)]\n        return -1 if a < b else (1 if a > b else 0)`,
  swap: `    def swap(self, i, j):\n        i, j = int(i), int(j)\n        _rec("s" + str(i) + ":" + str(j))\n        i = _idx(i)\n        j = _idx(j)\n        _arr[i], _arr[j] = _arr[j], _arr[i]`,
  get: `    def get(self, i):\n        i = int(i)\n        _rec("g" + str(i))\n        return _arr[_idx(i)]`,
  set: `    def set(self, i, v):\n        i, v = int(i), int(v)\n        _rec("w" + str(i) + ":" + str(v))\n        _arr[_idx(i)] = v`,
};

const ARENA_JS: Record<string, string> = {
  size: `  size() { return _arr.length; }`,
  compare: `  compare(i, j) {\n    i = Math.trunc(i); j = Math.trunc(j);\n    _rec("c" + i + ":" + j);\n    const a = _arr[_idx(i)], b = _arr[_idx(j)];\n    return a < b ? -1 : (a > b ? 1 : 0);\n  }`,
  swap: `  swap(i, j) {\n    i = Math.trunc(i); j = Math.trunc(j);\n    _rec("s" + i + ":" + j);\n    const ii = _idx(i), jj = _idx(j);\n    const t = _arr[ii]; _arr[ii] = _arr[jj]; _arr[jj] = t;\n  }`,
  get: `  get(i) {\n    i = Math.trunc(i);\n    _rec("g" + i);\n    return _arr[_idx(i)];\n  }`,
  set: `  set(i, v) {\n    i = Math.trunc(i); v = Math.trunc(v);\n    _rec("w" + i + ":" + v);\n    _arr[_idx(i)] = v;\n  }`,
};

const ARENA_JAVA: Record<string, string> = {
  size: `    int size() { return arr.length; }`,
  compare: `    int compare(int i, int j) {\n      rec("c" + i + ":" + j);\n      int a = arr[idx(i)], b = arr[idx(j)];\n      return a < b ? -1 : (a > b ? 1 : 0);\n    }`,
  swap: `    void swap(int i, int j) {\n      rec("s" + i + ":" + j);\n      int ii = idx(i), jj = idx(j);\n      int t = arr[ii]; arr[ii] = arr[jj]; arr[jj] = t;\n    }`,
  get: `    int get(int i) {\n      rec("g" + i);\n      return arr[idx(i)];\n    }`,
  set: `    void set(int i, int v) {\n      rec("w" + i + ":" + v);\n      arr[idx(i)] = v;\n    }`,
};

function arenaMethods(language: GameLanguage, level: ArenaLevel): string {
  const table = language === "python" ? ARENA_PY : language === "javascript" ? ARENA_JS : ARENA_JAVA;
  return level.api.map((name) => table[name]).join("\n");
}

function arenaPreamble(language: GameLanguage, level: ArenaLevel): string {
  const values = arrayLiteral(level.input);
  const methods = arenaMethods(language, level);
  switch (language) {
    case "python":
      return `# --- Leou Arena harness (generated) ---
_arr = [${values}]
_ops = []
_MAX = ${MAX}

def _rec(_t):
    _ops.append(_t)
    if len(_ops) > _MAX:
        raise RuntimeError("overrun")

def _idx(_i):
    _i = int(_i)
    if _i < 0 or _i >= len(_arr):
        raise IndexError("index outside array")
    return _i

class Box:
${methods}

# --- your code ---
`;
    case "javascript":
      return `// --- Leou Arena harness (generated) ---
const _arr = [${values}];
const _ops = [];
const _MAX = ${MAX};
function _rec(t) {
  _ops.push(t);
  if (_ops.length > _MAX) throw new Error("overrun");
}
function _idx(i) {
  i = Math.trunc(i);
  if (!(i >= 0 && i < _arr.length)) throw new Error("index outside array");
  return i;
}
class Box {
${methods}
}

// --- your code ---
`;
    case "java":
      return `// --- Leou Arena harness (generated) ---
import java.util.*;

public class Main {
  static int[] arr = {${values}};
  static List<String> ops = new ArrayList<>();
  static final int MAX = ${MAX};
  static void rec(String t) {
    ops.add(t);
    if (ops.size() > MAX) throw new RuntimeException("overrun");
  }
  static int idx(int i) {
    if (i < 0 || i >= arr.length) throw new IndexOutOfBoundsException();
    return i;
  }
  static class Box {
${methods}
  }

  // --- your code (write: static int solve(Box box) { ... }) ---
`;
    case "cpp":
      throw new Error("Algo Arena is not offered in C++.");
  }
}

function arenaEpilogue(language: GameLanguage): string {
  switch (language) {
    case "python":
      return `
# --- run ---
_ret = -1
try:
    _ret = solve(Box())
except Exception:
    pass
if _ret is None:
    _ret = -1
import sys
sys.stdout.write("${ARENA_MARKER}" + ";".join(_ops) + "\\n")
sys.stdout.write("${RETURN_MARKER}" + str(_ret) + "\\n")
`;
    case "javascript":
      return `
// --- run ---
let _ret = -1;
try {
  const _r = solve(new Box());
  if (_r !== null && _r !== undefined) _ret = Math.trunc(_r);
} catch (_e) {}
console.log("${ARENA_MARKER}" + _ops.join(";"));
console.log("${RETURN_MARKER}" + _ret);
`;
    case "java":
      return `
  public static void main(String[] args) {
    int ret = -1;
    try { ret = solve(new Box()); } catch (Throwable t) {}
    StringBuilder sb = new StringBuilder("${ARENA_MARKER}");
    for (int i = 0; i < ops.size(); i++) {
      if (i > 0) sb.append(";");
      sb.append(ops.get(i));
    }
    System.out.println(sb.toString());
    System.out.println("${RETURN_MARKER}" + ret);
  }
}
`;
    case "cpp":
      throw new Error("Algo Arena is not offered in C++.");
  }
}

function buildArenaProgram(language: GameLanguage, level: ArenaLevel, studentCode: string): string {
  return arenaPreamble(language, level) + "\n" + studentCode + "\n" + arenaEpilogue(language);
}

// ===========================================================================
// Starters
// ===========================================================================

const DEFAULT_BOT_STARTER: Record<GameLanguage, () => string> = {
  python: () => `def solve(bot):\n    # write your instructions here\n    pass\n`,
  javascript: () => `function solve(bot) {\n  // write your instructions here\n}\n`,
  java: () => `  static void solve(Bot bot) {\n    // write your instructions here\n  }\n`,
  cpp: () => `void solve(Bot &bot) {\n  // write your instructions here\n}\n`,
};

const DEFAULT_PAINT_STARTER: Record<GameLanguage, () => string> = {
  python: () => `def solve(turtle):\n    # draw the shape\n    pass\n`,
  javascript: () => `function solve(turtle) {\n  // draw the shape\n}\n`,
  java: () => `  static void solve(Turtle turtle) {\n    // draw the shape\n  }\n`,
  cpp: () => `void solve(Turtle &turtle) {\n  // draw the shape\n}\n`,
};

const DEFAULT_OUTPUT_STARTER: Record<GameLanguage, () => string> = {
  python: () => `def solve(s):\n    # return the answer as a string or number\n    pass\n`,
  javascript: () => `function solve(s) {\n  // return the answer\n}\n`,
  java: () => `  static String solve(String s) {\n    return "";\n  }\n`,
  cpp: () => `string solve(string s) {\n  return "";\n}\n`,
};

const DEFAULT_ARENA_STARTER: Record<GameLanguage, () => string> = {
  python: () => `def solve(box):\n    # rearrange the hidden array using box.compare / swap / get / set\n    pass\n`,
  javascript: () => `function solve(box) {\n  // rearrange the hidden array\n}\n`,
  java: () => `  static int solve(Box box) {\n    // rearrange the hidden array\n    return -1;\n  }\n`,
  cpp: () => `int solve(Box &box) {\n  return -1;\n}\n`,
};

export function starterCode(language: GameLanguage, level: Level): string {
  const override = level.starter?.[language];
  if (override) return override;
  switch (level.kind) {
    case "bot":
      return DEFAULT_BOT_STARTER[language]();
    case "paint":
      return DEFAULT_PAINT_STARTER[language]();
    case "output":
      return DEFAULT_OUTPUT_STARTER[language]();
    case "arena":
      return DEFAULT_ARENA_STARTER[language]();
  }
}
