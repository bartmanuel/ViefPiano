import { PRACTICING_WEIGHT, ANTI_REPEAT_WINDOW } from '../config.js';

export function shuffle(arr) {
  // Fisher-Yates (in-place)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildBag(songs, practicingWeight = PRACTICING_WEIGHT) {
  const bag = [];
  for (const song of songs) {
    const copies = song.practicing ? practicingWeight : 1;
    for (let i = 0; i < copies; i++) bag.push(song.id);
  }
  return shuffle(bag);
}

/**
 * Pick next song id. Returns `{ pickedId, bag }` (bag is the new bag state
 * after this pick). Returns `{ pickedId: null, bag: [] }` if no songs.
 *
 * Parameters:
 *  - songs: current song list
 *  - bag: previous bag (may be empty; we rebuild then)
 *  - history: array of recently-picked ids (used for anti-repeat)
 *  - opts.practicingWeight, opts.antiRepeatWindow (optional overrides)
 */
export function pickNext(songs, bag, history, opts = {}) {
  if (!songs || songs.length === 0) return { pickedId: null, bag: [] };
  if (songs.length === 1) return { pickedId: songs[0].id, bag: [] };

  const practicingWeight = opts.practicingWeight ?? PRACTICING_WEIGHT;
  const antiRepeatWindow = opts.antiRepeatWindow ?? ANTI_REPEAT_WINDOW;

  // Rebuild if empty
  let workingBag = bag && bag.length > 0 ? [...bag] : buildBag(songs, practicingWeight);

  // Ensure bag only contains ids that still exist (guards against stale entries)
  const validIds = new Set(songs.map((s) => s.id));
  workingBag = workingBag.filter((id) => validIds.has(id));
  if (workingBag.length === 0) {
    workingBag = buildBag(songs, practicingWeight);
  }

  const lastN = history.slice(-antiRepeatWindow);

  // Try to find a candidate not in the anti-repeat window. If the current
  // bag is depleted to only "banned" entries, rebuild once and try again —
  // this preserves the no-immediate-repeat invariant as long as there's
  // more than one eligible song in `songs`.
  let idx = findCandidateIdx(workingBag, lastN);
  if (idx < 0) {
    workingBag = buildBag(songs, practicingWeight);
    idx = findCandidateIdx(workingBag, lastN);
  }

  // Final fallback: all songs are in the anti-repeat window (can happen when
  // window is large relative to song count, or only one eligible song).
  if (idx < 0) idx = workingBag.length - 1;

  const [pickedId] = workingBag.splice(idx, 1);
  return { pickedId, bag: workingBag };
}

function findCandidateIdx(bag, lastN) {
  for (let i = bag.length - 1; i >= 0; i--) {
    if (!lastN.includes(bag[i])) return i;
  }
  return -1;
}
