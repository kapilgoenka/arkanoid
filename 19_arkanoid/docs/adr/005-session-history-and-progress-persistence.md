# ADR 005: Session History and Progress Persistence

**Date**: 2026-05-23
**Status**: Accepted
**Issue**: KGO-25 — Session History & Progress Comparison

---

## Context

The core motivation for this feature is letting a child player answer "am I
getting better?" across multiple play sessions on different days. This requires
persisting structured data between page loads with no server, no accounts, and
no network dependency. The design must work on the first session and degrade
gracefully when localStorage is unavailable or full.

---

## Decisions

### 1. localStorage as the sole persistence mechanism

```js
const HISTORY_KEY = 'arkanoid_sessions';
localStorage.setItem(HISTORY_KEY, JSON.stringify(this.sessions));
```

All session data is stored under a single key as a JSON-serialised array. No
IndexedDB, no cookies, no remote API.

**Why localStorage over alternatives**:

| Option | Rejected reason |
|--------|-----------------|
| IndexedDB | Async API; requires Promise/callback plumbing incompatible with the synchronous game loop |
| Cookies | 4 KB limit; not intended for structured data |
| Remote API | Requires a server, accounts, and network — violates the "open index.html" zero-setup principle |
| sessionStorage | Does not survive tab close — sessions from yesterday would be lost |

**Capacity**: Each session object serialises to ~120 bytes. At 50 sessions
(MAX_SESSIONS) that is ~6 KB — well within localStorage's typical 5–10 MB
browser limit.

**Error handling**: Both `localStorage.getItem` (parse) and `setItem` (write)
are wrapped in `try/catch`:

```js
load() {
  try { this.sessions = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch (_) { this.sessions = []; }
},
save(...) {
  ...
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(this.sessions)); }
  catch (_) { /* storage full — silently skip */ }
}
```

Silent failure on write is intentional: a failed save should never interrupt
gameplay. The worst outcome is a missing session in the history list.

### 2. Session data model — 5 fields, human-readable date

```js
{
  date:            "May 23, 2026",   // toLocaleDateString('en-US', {month:'short', ...})
  score:           1240,
  level:           3,
  bricksDestroyed: 87,
  duration:        142,              // seconds, rounded
}
```

**Why a pre-formatted date string, not a timestamp**: The history screen renders
this string directly onto the canvas. Storing a timestamp would require
`new Date(ts).toLocaleDateString()` on every render call. Pre-formatting at
save time costs one call per session and keeps `drawHistoryScreen` read-only
with respect to date logic.

**Trade-off**: The human-readable date is locale-specific (en-US). If the game
were internationalised, the save format should store a UTC timestamp and format
at render time. Acceptable for a single-player home game.

**`bricksDestroyed` derivation** — brick count is not tracked directly; it is
inferred from score delta each frame:

```js
const prevScore = scoreRef.value;
// ... collisions ...
game.bricksDestroyed += Math.round((scoreRef.value - prevScore) / 10);
```

Since each brick scores exactly 10 points, dividing score delta by 10 gives
brick count without adding a separate counter to `collision.js`. This works
correctly even with multi-ball (all balls contribute to `scoreRef` in the same
frame; the delta captures all hits).

### 3. Rolling window: 50 max, pruned from the front

```js
if (this.sessions.length > MAX_SESSIONS) {
  this.sessions.splice(0, this.sessions.length - MAX_SESSIONS);
}
```

`splice(0, n)` removes the oldest entries (beginning of array) and keeps the
most recent 50. The cap prevents unbounded localStorage growth for a player
who plays daily for months.

**Why 50**: At ~120 bytes/session × 50 = ~6 KB. This stores roughly 3–6 months
of daily play without approaching browser storage limits.

**Why keep newest, not highest-scoring**: Displaying recent sessions (including
bad ones) shows actual progress trajectory. Keeping only top scores would hide
regression and discourage a child who is having an off day.

### 4. Personal best via linear scan, not sorted index

```js
personalBest() {
  return this.sessions.reduce(
    (best, s) => s.score > best.score ? s : best,
    this.sessions[0]
  );
}
```

A single `reduce` over at most 50 sessions is O(50) — negligible. Maintaining
a sorted index or separate `bestScore` field would add write-time complexity
with no measurable benefit at this data size.

**Tie-breaking**: If two sessions share the identical top score, `reduce`
returns the earlier one (the first occurrence that set `best`). The date shown
under the banner will be from the earlier session. This edge case is acceptable
— the score value displayed is still correct.

### 5. Trend detection: strictly ascending last 3 sessions

```js
isTrendingUp() {
  const recent = this.sessions.slice(-3);
  if (recent.length < 3) return false;
  return recent[0].score < recent[1].score && recent[1].score < recent[2].score;
}
```

**Why strict inequality (not >=)**: Repeating the same score is not improvement.
A child who scores 500 three times in a row should not see "You're improving!"

**Why 3 sessions minimum**: Two sessions is a single comparison with no trend
to observe. Three is the minimum sequence that shows directional momentum
without requiring too many sessions before the message can appear.

**Why the message is conservative** (only shown when strictly true): A false
positive ("You're improving!") when the player is actually plateauing would
erode trust. Missing a true positive (e.g., 4 sessions with one dip) is the
lesser harm for a child audience.

### 6. Progress bar: score as percentage of personal best

```js
const barWidth = Math.round((s.score / best.score) * (W - 30));
ctx.fillRect(10, y, barWidth, rowH);
```

Each row's background is filled proportionally to that session's score relative
to the personal best. The personal best row therefore always fills the full
width — providing an immediate visual anchor. Other rows show as partial fills,
making the relative performance instantly scannable without reading numbers.

**Why not a separate bar element**: Drawing a filled rect behind the text (same
`y`, same `rowH`) layers the bar under the text with one draw call. No
additional layout calculation needed.

### 7. Session timing: `Date.now()` wall-clock, started on Space press

```js
// on Space from TITLE:
game.sessionStart = Date.now();
// on GAME_OVER or YOU_WIN:
const duration = (Date.now() - game.sessionStart) / 1000;
```

`Date.now()` is wall-clock time. Pausing the game does not stop the clock, so
duration includes pause time. This is acceptable — duration is a secondary
stat shown in the table, not used in any ranking or comparison logic.

---

## Consequences

- **Positive**: Zero-dependency persistence — works offline, no server, survives
  browser restarts
- **Positive**: Graceful degradation — localStorage unavailability or full
  storage silently skips the save; gameplay is unaffected
- **Positive**: History screen works correctly on first session (empty state
  message) and at 50+ sessions (rolling prune)
- **Positive**: `isTrendingUp()` is conservative — the motivational message
  only appears when genuinely earned
- **Risk**: Pre-formatted date string is en-US locale only; non-English systems
  will still see English month names
- **Risk**: Duration includes pause time (wall-clock, not game-time)
- **Risk**: `bricksDestroyed` inferred from score delta — if scoring ever
  changes from a flat 10 pts/brick, this calculation breaks silently

---

## Data Flow Summary

```
Space key pressed
  → game.sessionStart = Date.now()
  → game.bricksDestroyed = 0

Each frame (PLAYING state)
  → prevScore captured before collision checks
  → scoreRef mutated by checkBrickCollisions()
  → game.bricksDestroyed += (scoreRef.value - prevScore) / 10

GAME_OVER or YOU_WIN transition
  → saveSession() called
  → history.load() (re-reads localStorage for freshness)
  → session object pushed, array pruned to 50
  → localStorage.setItem() (silent fail on quota error)

H key from TITLE
  → game.state = STATES.HISTORY
  → drawHistory() → drawHistoryScreen(ctx, canvas)
  → history.load() called fresh on every render frame
```

## Storage Schema

```
localStorage key: "arkanoid_sessions"
value: JSON array of:
  { date: string, score: number, level: number,
    bricksDestroyed: number, duration: number }
max entries: 50
approximate size: ~120 bytes/entry × 50 = ~6 KB
```
