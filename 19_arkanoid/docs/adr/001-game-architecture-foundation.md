# ADR 001: Game Architecture Foundation

**Date**: 2026-05-23
**Status**: Accepted
**Issue**: KGO-17 — Project Setup & Canvas Foundation

---

## Context

A browser-based Arkanoid/Breakout game is being built for a child audience,
requiring smooth 60 FPS animation, real-time input handling, and state-managed
screens (title, gameplay, pause, game over, progress history). The choice of
runtime environment and architectural pattern determines how all future modules
(ball, paddle, bricks, power-ups, sound) integrate.

---

## Decision

### 1. Vanilla HTML5 Canvas — no framework, no build tool

`index.html` loads a single `<canvas id="gameCanvas" width="800" height="600">`
and seven `<script>` tags in dependency order. There is no bundler, no npm, no
transpilation step. The game opens by double-clicking `index.html`.

**Why**: The existing playground projects (8_tic_tac_toe_js, 9_sudoku_game) are
all dependency-free vanilla JS. Keeping the same pattern means zero onboarding
friction and direct cause-and-effect between code and visual output — ideal for
a learning project and for a child player who just opens a file.

**Trade-off**: No module system means all JS files share the global scope. Seven
script tags must be ordered manually (audio → ball → paddle → brick → levels →
collision → game). This is acceptable for a project of this size (~500–800 LOC
across all files) but would not scale to a large application.

**Rejected alternative**: Phaser 3 was considered. It provides built-in physics,
asset management, and scene management, but adds ~500 KB and hides the
mechanics behind a framework API — the opposite of what this project needs.

### 2. `requestAnimationFrame` loop with capped delta time

```js
function gameLoop(timestamp) {
  const dt = Math.min(timestamp - game.lastTime, 50); // cap at 50 ms
  game.lastTime = timestamp;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // dispatch to state handler
  requestAnimationFrame(gameLoop);
}
```

The 50 ms cap prevents physics tunnelling when the tab loses focus and then
regains it (which would otherwise produce a massive `dt` spike and teleport
the ball through walls). All physics updates in future modules receive `dt`
in milliseconds and scale movement accordingly.

**Why**: `requestAnimationFrame` syncs to the display refresh rate (typically
60 Hz) and pauses automatically when the tab is backgrounded, conserving CPU.
A fixed-step loop (`setInterval`) would continue burning CPU while hidden.

### 3. Explicit string-keyed state machine

```js
const STATES = {
  TITLE: 'TITLE', PLAYING: 'PLAYING', PAUSED: 'PAUSED',
  LEVEL_COMPLETE: 'LEVEL_COMPLETE', GAME_OVER: 'GAME_OVER',
  YOU_WIN: 'YOU_WIN', HISTORY: 'HISTORY',
};
const game = { state: STATES.TITLE, score: 0, lives: 3, level: 1, lastTime: 0 };
```

Each frame the loop dispatches to exactly one handler based on `game.state`.
State transitions happen in the `keydown` listener:
- `Space` on TITLE → PLAYING
- `P` toggles PLAYING ↔ PAUSED
- `R` on GAME_OVER/YOU_WIN → resets score/lives/level → TITLE
- `H` on TITLE → HISTORY; `Escape` on HISTORY → TITLE

**Why**: A flat switch in the game loop is easy to reason about and extend.
Adding a new screen (e.g., a settings screen) requires only a new `STATES` key,
a handler function, and a transition in the input listener. No inheritance or
observer wiring needed.

**Trade-off**: All game state (score, lives, level) lives on the single `game`
object as mutable globals. This is intentional — for a single-player, single-
page game with no concurrency, a shared mutable object is simpler than
immutable state or a pub/sub system. Future modules mutate `game.score`,
`game.lives`, and `game.level` directly.

### 4. Web Audio API with lazy initialization

```js
const audio = {
  ctx: null,
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
};
['click', 'keydown'].forEach((evt) => {
  document.addEventListener(evt, () => audio.init(), { once: true });
});
```

`AudioContext` is not created on page load. It is created on the first user
gesture (click or keydown) to satisfy the browser autoplay policy that blocks
audio contexts created before user interaction. The `{ once: true }` option
removes the listener after the first firing so it runs exactly once.

All sounds are synthesized from oscillators — no audio files to fetch:

| Sound          | Oscillator type | Frequency        | Duration |
|----------------|-----------------|------------------|----------|
| Brick hit      | square          | 500 Hz           | 0.1 s    |
| Paddle bounce  | sine            | 300 Hz           | 0.08 s   |
| Life lost      | sawtooth        | 400 → 150 Hz     | 0.5 s    |
| Power-up       | sine arpeggio   | C4→E4→G4 (261, 329, 392 Hz) | 3×0.15 s |
| Level complete | sine chord      | G4→B4→D5 (392, 494, 587 Hz) | 3×0.25 s |
| Game over      | sawtooth melody | 300→250→200→150 Hz | 4×0.2 s |

Volume envelope: gain starts at 0.3 and exponentially ramps to 0.001 over the
sound duration, giving a natural click-free decay on every note.

**Trade-off**: Synthesized sounds are instant to load but lack the richness of
sampled audio. For a child's game, the retro beep aesthetic is intentional and
matches the Arkanoid source material.

### 5. Module loading order via script tags

```html
<script src="js/audio.js"></script>   <!-- no deps -->
<script src="js/ball.js"></script>    <!-- no deps -->
<script src="js/paddle.js"></script>  <!-- no deps -->
<script src="js/brick.js"></script>   <!-- no deps -->
<script src="js/levels.js"></script>  <!-- depends on Brick -->
<script src="js/collision.js"></script> <!-- depends on Ball, Paddle, Brick -->
<script src="js/game.js"></script>    <!-- depends on all above + canvas -->
```

`game.js` is last because it references `canvas`, `ctx`, `audio`, and all
entity classes. Leaf modules (audio, ball, paddle, brick) have no dependencies
on each other and can be reordered freely among themselves.

---

## Consequences

- **Positive**: Zero setup for contributors or players — open the HTML file
- **Positive**: The capped-dt loop prevents physics bugs on tab switch
- **Positive**: State machine is immediately extensible (11 planned issues add
  functionality without restructuring the loop)
- **Positive**: Audio works without any network requests or file serving
- **Risk**: Global scope sharing between 7 files — name collisions are possible.
  Convention: each file exports exactly one top-level name (`audio`, `Ball`,
  `Paddle`, `Brick`, `PowerUp`, `LEVELS`, `checkCollisions`)
- **Risk**: 800×600 canvas is fixed. Mobile scaling is planned in KGO-26 via
  CSS transforms; the canvas coordinate system stays unchanged

---

## Files Introduced

| File | Purpose |
|------|---------|
| `index.html` | Canvas element (800×600), ordered script tags |
| `css/style.css` | Dark background (#0a0a1a), centered canvas, blue box-shadow glow |
| `js/game.js` | Game loop, state machine (7 states), input handler, screen renderers |
| `js/audio.js` | Web Audio API manager, 6 synthesized sounds, mute toggle (M key) |
| `js/ball.js` | Stub — implemented in KGO-16 |
| `js/paddle.js` | Stub — implemented in KGO-18 |
| `js/brick.js` | Stub — implemented in KGO-19 |
| `js/levels.js` | Stub — implemented in KGO-19/KGO-22 |
| `js/collision.js` | Stub — implemented in KGO-20 |
