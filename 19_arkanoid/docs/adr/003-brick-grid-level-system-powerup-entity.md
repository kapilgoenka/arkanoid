# ADR 003: Brick Grid Layout, Level System, and PowerUp Entity

**Date**: 2026-05-23
**Status**: Accepted
**Issue**: KGO-19 — Brick Grid System

---

## Context

Three related design decisions were made together in this issue because they are
tightly coupled: how bricks are sized and laid out on the canvas, how levels are
defined and constructed, and how PowerUp capsules are represented as data.
Getting these right early prevents costly refactoring when collision detection
(KGO-20) and the power-up activation system (KGO-23) are added.

---

## Decisions

### 1. Brick dimensions and grid layout via named constants

All brick geometry is declared as module-level constants in `brick.js`:

```js
const BRICK_W    = 72;   // brick width, px
const BRICK_H    = 20;   // brick height, px
const BRICK_PAD  = 4;    // gap between bricks, px
const BRICK_TOP  = 50;   // y offset of first row from canvas top
const BRICK_LEFT = 24;   // x offset of first column from canvas left
```

Each `Brick` computes its own pixel position from `row` and `col` at
construction time:

```js
this.x = BRICK_LEFT + col * (BRICK_W + BRICK_PAD);
this.y = BRICK_TOP  + row * (BRICK_H + BRICK_PAD);
```

**Grid dimensions at 800 px canvas width**:
- 10 columns × (72 + 4) px = 760 px occupied + 24 px left margin + 16 px right
  margin = 800 px total ✓
- 6 rows × (20 + 4) px = 144 px + 50 px top offset = 194 px — bricks occupy
  the top third of the 600 px canvas, leaving ample play space below

**Why pre-computed position**: Collision detection (KGO-20) reads `brick.x`,
`brick.y`, `brick.w`, `brick.h` directly without needing to know the grid
constants. This means `collision.js` is decoupled from the layout math.

**Why named constants over inline numbers**: Every file that needs to know brick
geometry (e.g., future power-up drop position, particle origin) imports from the
same source of truth. Changing `BRICK_PAD = 4` to `6` updates every derived
position automatically.

### 2. Level maps as 2D binary arrays, built by a factory function

```js
const LEVEL_MAPS = [
  Array.from({ length: ROWS }, () => Array(COLS).fill(1)),  // L1: full grid
  Array.from({ length: ROWS }, (_, r) =>                    // L2: checkerboard
    Array.from({ length: COLS }, (_, c) => (r + c) % 2 === 0 ? 1 : 0)
  ),
  [[0,0,0,1,1,1,1,0,0,0], ...],   // L3: diamond  (hand-authored)
  [[1,0,0,0,0,0,0,0,0,1], ...],   // L4: V-shape  (hand-authored)
  [[1,0,1,1,0,0,1,1,0,1], ...],   // L5: scattered (hand-authored)
];

function buildLevel(levelIndex) {
  const map = LEVEL_MAPS[levelIndex % LEVEL_MAPS.length];
  const bricks = [];
  for (let r = 0; r < map.length; r++)
    for (let c = 0; c < map[r].length; c++)
      if (map[r][c]) bricks.push(new Brick(r, c, ROW_COLORS[r]));
  return bricks;
}
```

**Why binary maps**: A `1`/`0` grid is the most readable format for hand-crafting
brick patterns. Visual inspection of the 2D array reveals the shape immediately.
Alternatives (bitmask integers, run-length encoding, JSON objects with
coordinates) trade readability for compactness that is unnecessary at this scale
(max 60 bricks per level).

**Why `buildLevel()` factory**: `game.js` calls `bricks = buildLevel(levelIndex)`
on level start and on restart. Returning a fresh `Brick[]` array means each
level starts with all bricks at `status = 1` — no reset logic needed. The
previous level's bricks are simply garbage collected.

**`% LEVEL_MAPS.length` wrapping**: If the game is ever extended beyond 5 levels,
`buildLevel(5)` silently cycles back to Level 1's pattern. This is a defensive
convenience for infinite-replay mode rather than an active feature.

**Why two generation strategies**: Levels 1–2 use `Array.from` generators (the
pattern is mathematically expressible in one line). Levels 3–5 are hand-authored
literal arrays because their shapes (diamond, V, scattered) have no compact
algorithmic form. Mixing both strategies keeps each level definition as short as
possible.

### 3. Row colour coded by row index, not by brick value

```js
const ROW_COLORS = [
  '#ff4444',  // row 0 — red    (top, hardest to reach)
  '#ff8800',  // row 1 — orange
  '#ffdd00',  // row 2 — yellow
  '#44cc44',  // row 3 — green
  '#4488ff',  // row 4 — blue
  '#aa44ff',  // row 5 — purple (bottom, easiest to reach)
];
```

Colour is assigned in `buildLevel()` as `ROW_COLORS[r]` — the map value (`1`)
carries no colour information. This means all bricks in a row share one colour
regardless of pattern gaps, producing the classic Arkanoid rainbow-row look
without per-cell colour data.

**Trade-off**: If a future level needs mixed colours within a row (e.g., a
chessboard with alternating colours), the map would need to store colour indices
instead of binary values. That refactor is deferred until needed.

### 4. Ball speed progression via `LEVEL_SPEEDS` parallel array

```js
const LEVEL_SPEEDS = [5, 5.5, 6, 6.5, 7.2];
```

`startLevel()` in `game.js` calls `ball.setSpeed(LEVEL_SPEEDS[levelIndex])` for
each ball. The progression is non-linear: steps are 0.5, 0.5, 0.5, then 0.7 at
Level 5 — a steeper jump on the final level to make it feel like a real
difficulty spike.

### 5. PowerUp entity co-located with Brick in `brick.js`

`PowerUp` lives in the same file as `Brick` because both are created during
brick destruction and share the same draw loop in `game.js`. Co-location avoids
a fourth script tag and a fourth dependency to manage.

```js
const META = {
  expand:    { color: '#22cc66', label: 'EX'  },
  multiball: { color: '#00cfff', label: 'MB'  },
  life:      { color: '#ff4444', label: '1UP' },
  slow:      { color: '#8888ff', label: 'SL'  },
};
```

The `META` lookup is constructed inside the constructor (not as a module-level
constant) so it is only evaluated when a `PowerUp` is actually instantiated,
keeping the module load lightweight.

PowerUp position `x` is stored as the **centre** of the capsule (not left edge),
matching the drop origin `brick.x + brick.w / 2`. `draw()` then offsets by
`-this.w / 2` to render centred. This avoids a consistent `- w/2` adjustment at
every call site in `collision.js` (KGO-23).

---

## Consequences

- **Positive**: Collision detection (KGO-20) reads pre-computed `brick.x/y/w/h`
  — no dependency on grid constants
- **Positive**: Adding a Level 6 requires only a new entry in `LEVEL_MAPS` and
  `LEVEL_SPEEDS`
- **Positive**: `buildLevel()` factory eliminates reset logic — fresh array per
  level start
- **Risk**: Row colour is index-based — mixed-colour rows require a map format
  change (deferred)
- **Risk**: `BRICK_W/H/PAD/TOP/LEFT` are globals in `brick.js` scope. Any future
  file that needs brick geometry must load `brick.js` first (enforced by script
  tag order in `index.html`)

---

## Layout Verification (800×600 canvas)

| Dimension | Calculation | Result |
|-----------|-------------|--------|
| Grid width | `BRICK_LEFT(24) + 10×(BRICK_W(72)+BRICK_PAD(4))` | 784 px (16 px right margin) |
| Grid height | `BRICK_TOP(50) + 6×(BRICK_H(20)+BRICK_PAD(4))` | 194 px (bottom of row 5) |
| Play area | Canvas height minus grid bottom | 406 px for ball travel |
| PowerUp width | 40 px centred on brick centre | Fits within any brick |
| PowerUp fall speed | 2.5 px/frame at 60 FPS | ~4 seconds to cross play area |
