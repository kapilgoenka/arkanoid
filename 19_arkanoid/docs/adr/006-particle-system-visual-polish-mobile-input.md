# ADR 006: Particle System, Visual Polish, and Mobile Touch Input

**Date**: 2026-05-23
**Status**: Accepted
**Issue**: KGO-26 — Polish & Final Touches

---

## Context

With all gameplay systems complete, this commit adds three independent visual
subsystems and a touch input layer. Each involves specific algorithmic choices
worth documenting for future maintenance.

---

## Decisions

### 1. Particle system: pool-less array with reverse-iterate prune

```js
const particles = [];

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(dt);
    if (particles[i].life <= 0) particles.splice(i, 1);
  }
}
```

Dead particles are removed with `splice(i, 1)` during a **reverse iteration**.
Iterating backwards means removing index `i` does not shift any elements that
haven't been visited yet — a forward loop would skip the element immediately
after the removed one.

Each `Particle` carries randomised properties set at construction time:

| Property | Range | Purpose |
|----------|-------|---------|
| `vx`, `vy` | `±2.5 px/frame` | Outward spread direction |
| `life` | 1.0 (start) | Alpha multiplier, decremented each frame |
| `decay` | `0.04–0.08` | Random lifespan: ~12–25 frames (0.2–0.4 s at 60fps) |
| `size` | `2–5 px` | Square particle, centred on `x/y` |

**Why no object pool**: At 10 particles per brick, a worst-case frame (all
multi-ball balls clear multiple bricks simultaneously) might spawn ~30 particles.
Even at 200 simultaneous particles the array manipulation cost is negligible
compared to canvas draw calls. An object pool adds complexity with no measurable
benefit at this scale.

**`_sparked` flag on Brick**: Particles are spawned in `game.js` by scanning
for bricks whose `status` just changed to `0`:

```js
bricks.filter(b => b.status === 0 && !b._sparked).forEach(b => {
  spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.color, 10);
  b._sparked = true;
});
```

The `_sparked` flag prevents re-spawning on subsequent frames (bricks remain
`status === 0` for the rest of the level). This is a write-once sentinel on
the `Brick` object — acceptable given bricks are discarded and recreated via
`buildLevel()` at every level start.

**`globalAlpha` draw pattern**: Each particle sets `ctx.globalAlpha = this.life`
and restores it to `1` after drawing. This uses the Canvas 2D context's
compositing rather than colour alpha, which works for any fill style without
string manipulation.

### 2. Ball trail: fixed-length ring buffer via array shift

```js
const trail = [];
const TRAIL_LEN = 4;

function updateTrail(ball) {
  if (!ball.launched) { trail.length = 0; return; }
  trail.push({ x: ball.x, y: ball.y });
  if (trail.length > TRAIL_LEN) trail.shift();
}
```

`trail` behaves as a ring buffer: newest position at the end, oldest removed
from the front via `shift()`. At 4 entries the array never grows beyond 5
elements, making `shift()` (O(n)) negligible.

**Alpha gradient on trail positions**:

```js
const alpha = (i + 1) / (TRAIL_LEN + 1) * 0.35;
```

- Index 0 (oldest): `1/5 * 0.35 = 0.07` — nearly invisible
- Index 3 (newest): `4/5 * 0.35 = 0.28` — most visible

The `0.35` cap keeps the brightest ghost well below the ball's own opacity,
preserving the ball as the primary visual. Ghost radius is `ballRadius * 0.7`
— slightly smaller than the real ball to reinforce the receding effect.

**Trail only for first ball**: `game.js` passes `balls[0]?.radius` and calls
`updateTrail(b)` for each ball, but the trail array is shared — in multi-ball
mode, all balls write to the same `trail[]`, producing a composite trail of
the most recently updated ball's positions. This is a simplification; per-ball
trails would require separate arrays and were deemed unnecessary visual complexity
for a children's game.

### 3. Paddle glow: `ctx.shadowBlur` toggled by power-up state flag

```js
let _powerUpActive = false;

function drawPaddleWithGlow(ctx, paddle) {
  if (_powerUpActive) {
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 18;
  }
  paddle.draw(ctx);
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';
}
```

`ctx.shadowBlur` is a Canvas 2D property that applies a Gaussian blur to
subsequently drawn shapes. Setting it to `0` after the paddle draw is essential
— an unreset shadow bleeds onto every subsequent draw call (bricks, HUD text,
particles) in the same frame.

**Why a boolean flag over querying power-up state**: The power-up activation
is event-driven (called from `activatePowerUp()`). Querying active power-up
state each frame would require exposing internal timer state or adding an
`isActive()` method to each power-up. A simple module-level boolean
`_powerUpActive` is set on activate and cleared inside the `setTimeout` callback
— matching exactly when the visual effect should appear and disappear.

**`shadowBlur = 18`**: Chosen to be visible against the dark `#111122`
background without overwhelming the paddle shape. Values above 20 start to
look blurry rather than glowing at paddle height (12 px).

### 4. Mobile touch: coordinate scaling and event prevention

```js
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const rect  = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x     = (touch.clientX - rect.left) * (canvas.width / rect.width);
  paddle.trackMouse(x);
}, { passive: false });
```

**Coordinate scaling**: `touch.clientX - rect.left` gives the touch position
in CSS pixels relative to the canvas element. Multiplying by
`(canvas.width / rect.width)` converts from CSS pixels to canvas pixels —
necessary because the canvas element may be scaled by CSS (e.g., on mobile
where the viewport is narrower than 800 px). Without this scaling, the paddle
would only track correctly at 100% zoom.

**`{ passive: false }` + `e.preventDefault()`**: Touch events on a canvas
default to triggering scroll and zoom gestures. `preventDefault()` suppresses
these. `{ passive: false }` is required to make `preventDefault()` effective
— passive listeners (the browser default since Chrome 56) cannot call
`preventDefault()`.

**`e.touches[0]`**: Only the first touch point is tracked. Multi-touch gestures
(pinch-zoom, two-finger scroll) are ignored — the first finger controls the
paddle.

**`touchstart` as game launcher**: A single `touchstart` handler both starts
the game (from TITLE state) and launches the ball (from PLAYING state),
mirroring the Space key behaviour. There is no separate "tap to confirm" step,
keeping the touch UX as simple as possible for a child player.

---

## Consequences

- **Positive**: Particle colours inherit from destroyed brick — no separate
  colour mapping needed
- **Positive**: `_sparked` flag ensures exactly one burst per brick destruction
  across all frames and all balls
- **Positive**: Trail alpha formula is a single expression with no branching
- **Positive**: Shadow glow cleared unconditionally after each paddle draw —
  no risk of bleed onto other elements
- **Positive**: Touch coordinate scaling handles any CSS-scaled canvas size
- **Risk**: Shared `trail[]` array across multiple balls produces a merged
  trail in multi-ball mode — acceptable visual simplification
- **Risk**: `_sparked` flag is a dynamic property added to `Brick` instances
  after construction — not declared in the class. Works in JS but breaks
  TypeScript type safety if the project is ever migrated
- **Risk**: `ctx.shadowBlur` has a performance cost (GPU blur pass). At one
  paddle per frame this is negligible, but should not be applied to many
  objects simultaneously

---

## Key Constants

| Constant | Value | Effect |
|----------|-------|--------|
| Particles per brick | 10 | Burst count on destruction |
| Particle velocity | ±2.5 px/frame | Spread radius over lifetime |
| Particle decay | 0.04–0.08/frame | Lifespan ~12–25 frames |
| Particle size | 2–5 px | Square sprite |
| Trail length | 4 positions | ~4 frames of history at 60 FPS |
| Trail max alpha | 0.35 | Brightest ghost opacity |
| Trail ghost radius | ballRadius × 0.7 | Smaller than real ball |
| Paddle glow blur | 18 px | `ctx.shadowBlur` value |
| Paddle glow color | `#00ff88` | Green, matches Expand power-up |
