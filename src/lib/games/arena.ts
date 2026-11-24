import type { ArenaApiName, ArenaGoal, ArenaLevel, Concept } from "./types";

/**
 * ALGO ARENA — rearrange an array through a counted API (the `arena` kind).
 *
 * The learner is handed a `box` hiding an array, and can only touch it through
 * the handful of methods a level offers. Every call is counted, so the puzzle
 * has two layers: make the array *correct*, then make it correct in as few
 * operations as possible. Bubble sort solves; quicksort earns the stars.
 *
 * Par is *computed*, not typed by hand: `runRef` replays a canonical algorithm
 * through the same operation-cost model the sim uses (`TBox`), and the cost
 * becomes the 3★ budget. That keeps a level's promise honest — if the reference
 * gets cheaper or dearer, the par follows automatically.
 *
 * The level set is verified by `scripts/test-games.ts`: a Python reference for
 * each level is compiled and run through the real sandbox and must win.
 */

/** A stand-in for the student's `box`, used only to cost the reference runs. */
class TBox {
  arr: number[];
  compares = 0;
  swaps = 0;
  reads = 0;
  writes = 0;

  constructor(arr: number[]) {
    this.arr = [...arr];
  }
  size() {
    return this.arr.length;
  }
  compare(i: number, j: number) {
    this.compares++;
    return this.arr[i] < this.arr[j] ? -1 : this.arr[i] > this.arr[j] ? 1 : 0;
  }
  swap(i: number, j: number) {
    this.swaps++;
    const t = this.arr[i];
    this.arr[i] = this.arr[j];
    this.arr[j] = t;
  }
  get(i: number) {
    this.reads++;
    return this.arr[i];
  }
  set(i: number, v: number) {
    this.writes++;
    this.arr[i] = v;
  }
  get cost() {
    return this.compares + this.swaps + this.reads + this.writes;
  }
}

type Algo =
  | "selection"
  | "selection-desc"
  | "bubble"
  | "insertion"
  | "quick"
  | "reverse"
  | "rotate"
  | "partition"
  | "dutch"
  | "binary";

type RefOpts = { k?: number; pivot?: number; target?: number };

/** Replay a canonical algorithm, counting operations exactly as the sim does. */
function runRef(algo: Algo, input: number[], opts: RefOpts): TBox {
  const b = new TBox(input);
  const n = b.size();

  switch (algo) {
    case "selection": {
      for (let i = 0; i < n - 1; i++) {
        let m = i;
        for (let j = i + 1; j < n; j++) if (b.compare(j, m) < 0) m = j;
        if (m !== i) b.swap(i, m);
      }
      break;
    }
    case "selection-desc": {
      for (let i = 0; i < n - 1; i++) {
        let m = i;
        for (let j = i + 1; j < n; j++) if (b.compare(j, m) > 0) m = j;
        if (m !== i) b.swap(i, m);
      }
      break;
    }
    case "bubble": {
      for (let i = 0; i < n - 1; i++) {
        let swapped = false;
        for (let j = 0; j < n - 1 - i; j++) {
          if (b.compare(j, j + 1) > 0) {
            b.swap(j, j + 1);
            swapped = true;
          }
        }
        if (!swapped) break;
      }
      break;
    }
    case "insertion": {
      for (let i = 1; i < n; i++) {
        let j = i;
        while (j > 0 && b.compare(j, j - 1) < 0) {
          b.swap(j, j - 1);
          j--;
        }
      }
      break;
    }
    case "quick": {
      const rec = (lo: number, hi: number) => {
        if (lo >= hi) return;
        const p = hi;
        let i = lo;
        for (let j = lo; j < hi; j++) if (b.compare(j, p) < 0) b.swap(i++, j);
        b.swap(i, p);
        rec(lo, i - 1);
        rec(i + 1, hi);
      };
      rec(0, n - 1);
      break;
    }
    case "reverse": {
      for (let i = 0; i < Math.floor(n / 2); i++) b.swap(i, n - 1 - i);
      break;
    }
    case "rotate": {
      const k = opts.k ?? 1;
      for (let i = 0; i < n; i++) b.get(i);
      for (let i = 0; i < n; i++) b.set(i, input[(i + k) % n]);
      break;
    }
    case "partition": {
      let i = 0;
      let j = n - 1;
      while (i < j) {
        while (i < j && b.get(i) % 2 === 0) i++;
        while (i < j && b.get(j) % 2 !== 0) j--;
        if (i < j) {
          b.swap(i, j);
          i++;
          j--;
        }
      }
      break;
    }
    case "dutch": {
      const p = opts.pivot ?? 0;
      const rank = (v: number) => (v < p ? 0 : v === p ? 1 : 2);
      let low = 0;
      let mid = 0;
      let high = n - 1;
      while (mid <= high) {
        const r = rank(b.get(mid));
        if (r === 0) {
          b.swap(low, mid);
          low++;
          mid++;
        } else if (r === 1) mid++;
        else {
          b.swap(mid, high);
          high--;
        }
      }
      break;
    }
    case "binary": {
      const target = opts.target ?? 0;
      let lo = 0;
      let hi = n - 1;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const v = b.get(mid);
        if (v === target) break;
        if (v < target) lo = mid + 1;
        else hi = mid - 1;
      }
      break;
    }
  }

  return b;
}

type ArenaSpec = {
  id: string;
  name: string;
  mission: string;
  concept: Concept;
  hints: string[];
  input: number[];
  goal: ArenaGoal;
  target?: number;
  pivot?: number;
  k?: number;
  api: ArenaApiName[];
  algo: Algo;
};

function makeArena(s: ArenaSpec): ArenaLevel {
  const cost = runRef(s.algo, s.input, { k: s.k, pivot: s.pivot, target: s.target }).cost;
  return {
    kind: "arena",
    id: s.id,
    name: s.name,
    mission: s.mission,
    concept: s.concept,
    hints: s.hints,
    input: s.input,
    goal: s.goal,
    target: s.target,
    pivot: s.pivot,
    k: s.k,
    api: s.api,
    par: { three: cost, two: Math.ceil(cost * 1.4) },
  };
}

const SORT: ArenaApiName[] = ["compare", "swap", "size"];

const SPECS: ArenaSpec[] = [
  {
    id: "arena-fix",
    name: "Out of Order",
    mission: "Two bars, wrong way round. Put them in order.",
    concept: "SORT",
    input: [2, 1],
    goal: "sort-asc",
    api: SORT,
    algo: "selection",
    hints: [
      "`box.compare(i, j)` tells you which value is bigger: it returns -1, 0 or 1.",
      "Compare the two, and if the left one is bigger, `box.swap(0, 1)`.",
    ],
  },
  {
    id: "arena-swap3",
    name: "Three Step",
    mission: "Three bars. Find the smallest first, then move on.",
    concept: "SORT",
    input: [3, 1, 2],
    goal: "sort-asc",
    api: SORT,
    algo: "selection",
    hints: [
      "Selection sort: for each position, scan the rest for a smaller value.",
      "Compare `box.compare(1, 0)` and `box.compare(2, 0)` to find the minimum.",
    ],
  },
  {
    id: "arena-select",
    name: "The Picker",
    mission: "Sort five bars by repeatedly picking the smallest remaining.",
    concept: "SORT",
    input: [5, 3, 4, 1, 2],
    goal: "sort-asc",
    api: SORT,
    algo: "selection",
    hints: [
      "Keep an index `m` of the smallest seen so far; swap it into place at the end of each pass.",
      "Selection sort always does the same number of compares — the cost is in the swaps.",
    ],
  },
  {
    id: "arena-bubble",
    name: "Bubble Up",
    mission: "Compare neighbours and swap them when they're out of order.",
    concept: "SORT",
    input: [4, 2, 5, 1, 3],
    goal: "sort-asc",
    api: SORT,
    algo: "bubble",
    hints: [
      "Walk the array comparing `box.compare(j, j+1)`; swap when the left is bigger.",
      "The largest value bubbles to the end each pass. Stop early if a pass swaps nothing.",
    ],
  },
  {
    id: "arena-insert",
    name: "Insert Here",
    mission: "Grow a sorted section one bar at a time.",
    concept: "SORT",
    input: [4, 2, 5, 1, 3],
    goal: "sort-asc",
    api: SORT,
    algo: "insertion",
    hints: [
      "Take the next bar and slide it left while `box.compare(j, j-1) < 0`.",
      "Insertion sort is fast when the array is already nearly sorted.",
    ],
  },
  {
    id: "arena-desc",
    name: "Down the Line",
    mission: "Sort the bars from largest to smallest.",
    concept: "SORT",
    input: [3, 1, 4, 1, 5],
    goal: "sort-desc",
    api: SORT,
    algo: "selection-desc",
    hints: [
      "It's the same idea as before — just look for the *largest* remaining value.",
      "`box.compare(j, m) > 0` means `box[j]` beats the current best.",
    ],
  },
  {
    id: "arena-reverse",
    name: "Mirror",
    mission: "Flip the array end to end using swaps.",
    concept: "ARRAYS",
    input: [1, 2, 3, 4, 5, 6],
    goal: "reverse",
    api: ["swap", "size"],
    algo: "reverse",
    hints: [
      "Swap the first with the last, the second with the second-last, and so on.",
      "You only need to walk halfway — `box.size() // 2` pairs.",
    ],
  },
  {
    id: "arena-rotate",
    name: "Roll Left",
    mission: "Shift every value two places to the left, wrapping the ends around.",
    concept: "ARRAYS",
    input: [1, 2, 3, 4, 5],
    goal: "rotate-left",
    k: 2,
    api: ["get", "set", "size"],
    algo: "rotate",
    hints: [
      "Read every value first with `box.get(i)` — you'll need them before overwriting.",
      "The value that lands at index `i` came from index `(i + 2) % size`.",
    ],
  },
  {
    id: "arena-even",
    name: "Evens First",
    mission: "Rearrange so every even number sits before every odd one.",
    concept: "ALGORITHM",
    input: [7, 2, 9, 4, 6, 1],
    goal: "partition-even-odd",
    api: ["get", "swap", "size"],
    algo: "partition",
    hints: [
      "Two pointers: one from the left looking for an odd, one from the right looking for an even.",
      "When each finds its target, `box.swap` them and step both inward.",
    ],
  },
  {
    id: "arena-dutch",
    name: "Three Bands",
    mission: "Group the values below, equal to, then above the pivot.",
    concept: "ALGORITHM",
    input: [2, 0, 2, 1, 1, 0],
    goal: "dutch-flag",
    pivot: 1,
    api: ["get", "swap", "size"],
    algo: "dutch",
    hints: [
      "This is the Dutch national flag problem: three zones, one pass.",
      "Keep `low`, `mid` and `high`. Smaller-than-pivot swaps to `low`; bigger swaps to `high`.",
    ],
  },
  {
    id: "arena-find",
    name: "Half and Half",
    mission: "The values are sorted. Return the index of the target without scanning.",
    concept: "SEARCH",
    input: [1, 3, 5, 7, 9, 11, 13],
    goal: "find",
    target: 9,
    api: ["get", "size"],
    algo: "binary",
    hints: [
      "Binary search: read the middle value, then throw away the half that can't contain the target.",
      "`return` the index from inside `solve` — the grader reads your return value.",
    ],
  },
  {
    id: "arena-find-big",
    name: "Needle",
    mission: "A bigger sorted array. Find the target the fast way.",
    concept: "SEARCH",
    input: [1, 3, 5, 7, 9, 11, 13, 15],
    goal: "find",
    target: 15,
    api: ["get", "size"],
    algo: "binary",
    hints: [
      "Halving the search space each step finds 8 values in at most 4 reads.",
      "Track `lo` and `hi`; the middle is `(lo + hi) // 2`.",
    ],
  },
  {
    id: "arena-quick",
    name: "Quickstep",
    mission: "Sort seven bars with a divide-and-conquer partition.",
    concept: "ALGORITHM",
    input: [5, 3, 8, 1, 9, 2, 7],
    goal: "sort-asc",
    api: SORT,
    algo: "quick",
    hints: [
      "Pick the last element as a pivot, then move everything smaller to its left.",
      "Once the pivot is in place, recurse on the two sides.",
    ],
  },
  {
    id: "arena-quick2",
    name: "Quickstep II",
    mission: "Eight bars this time. Same idea, one more layer of recursion.",
    concept: "ALGORITHM",
    input: [9, 4, 7, 1, 8, 2, 6, 3],
    goal: "sort-asc",
    api: SORT,
    algo: "quick",
    hints: [
      "Write a helper `sort(lo, hi)` and call it on both halves.",
      "`box.compare(j, pivotIndex) < 0` decides which side a value belongs to.",
    ],
  },
  {
    id: "arena-insert-big",
    name: "Insert Again",
    mission: "Six bars, nearly in order. Reach for the right tool.",
    concept: "ALGORITHM",
    input: [6, 2, 8, 1, 5, 3],
    goal: "sort-asc",
    api: SORT,
    algo: "insertion",
    hints: [
      "Insertion sort is the cheapest sort when there are few swaps to make.",
      "For each `i`, slide `box[i]` left while it's smaller than its neighbour.",
    ],
  },
  {
    id: "arena-quick-big",
    name: "The Great Sort",
    mission: "Ten bars. Only an O(n log n) algorithm earns all three stars.",
    concept: "ALGORITHM",
    input: [10, 7, 8, 9, 1, 5, 3, 2, 6, 4],
    goal: "sort-asc",
    api: SORT,
    algo: "quick",
    hints: [
      "A comparison sort needs roughly n·log n compares — bubble sort can't get there.",
      "Lomuto partition: scan with `j`, keep an `i` marking the boundary of the small side.",
    ],
  },
];

export const ARENA_LEVELS: ArenaLevel[] = SPECS.map(makeArena);
