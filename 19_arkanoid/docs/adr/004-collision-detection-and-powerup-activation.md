# ADR 004: Collision Detection and Power-up Activation System

**Date**: 2026-05-23
**Status**: Accepted
**Issues**: KGO-20 (Collision Detection), KGO-23 (Power-up System)

---

## Context

With brick grid, ball, and paddle in place, this commit wires the core game loop
together: detecting hits, reflecting the ball, destroying bricks, dropping and
collecting power-ups, and transitioning between game states. Four distinct
algorithmic decisions were made, each with meaningful trade-offs.

---

## Decisions

### 1. Circle-vs-AABB brick collision with overlap-axis reflection

The detection step uses a **nearest-point test** — the canonical approach for
circle vs. rectangle:

```js
const nearX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
const nearY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
const dx    = ball.x - nearX;
const dy    = ball.y - nearY;
if (dx * dx + dy * dy > ball.radius * ball.radius) continue; // no hit
```

`nearX/nearY` is the point on the brick's AABB closest to the ball centre.
Comparing the squared distance against `radius²` avoids a `Math.sqrt` call.

The **reflection axis** is determined by which overlap is smaller:

```js
const overlapX = (brick.w / 2) - Math.abs(ball.x - (brick.x + brick.w / 2));
const overlapY = (brick.h / 2) - Math.abs(ball.y - (brick.y + brick.h / 2));
if (overlapX < overlapY) {
  ball.vx = -ball.vx;   // hit left or right face
} else {
  ball.vy = -ball.vy;   // hit top or bottom face
}
```

The smaller overlap indicates the penetration axis — the direction the ball
entered the brick. Reflecting on that axis produces physically plausible bounces
without full physics simulation.

**`break` after first hit**: Only one brick is destroyed per ball per frame.
Without this, a ball moving fast enough to overlap two bricks in one step would
destroy both and reflect twice, producing erratic bouncing. The `break` ensures
at most one reflection event per frame per ball.

**Why not swept collision**: Swept (continuous) collision would prevent
tunnelling at high speeds but requires significantly more math (segment-vs-AABB
intersection). Given the 50ms dt cap established in ADR 001 and a max ball
speed of 7.2 px/frame, the ball travels at most ~21 px per frame — well under
the brick height of 20 px — making tunnelling impossible in practice.

### 2. Paddle collision: velocity-gated check + angle control

```js
function checkPaddleCollision(ball, paddle) {
  if (ball.vy <= 0) return; // only check when moving downward
  ...
  if (ballBottom >= paddleTop &&
      ballBottom <= paddleTop + paddle.height + Math.abs(ball.vy) &&
      ...) {
    const hitPos = (ball.x - paddle.x) / paddle.width; // 0..1
    const angle  = (hitPos - 0.5) * (Math.PI * 2 / 3); // ±60°
    ball.vx = Math.sin(angle) * ball.speed;
    ball.vy = -Math.abs(Math.cos(angle) * ball.speed);
    ball.y  = paddleTop - ball.radius; // snap out of paddle
  }
}
```

Three techniques prevent the classic "ball sticking" bugs:

1. **`ball.vy <= 0` early return** — only detects hits when the ball travels
   downward. Without this, the ball rising through the paddle after a bounce
   would trigger a second reflection, sending it straight down.

2. **`+ Math.abs(ball.vy)` in the lower bound** — extends the collision window
   by one frame's worth of travel. This catches fast-ball tunnelling through
   thin paddles where the ball jumps from above to below the paddle in one step.

3. **`ball.y = paddleTop - ball.radius`** — repositions the ball exactly at the
   paddle surface after collision. This prevents the ball from remaining inside
   the paddle on the next frame (which would trigger another collision if the
   `vy > 0` guard were ever relaxed).

**Angle range ±60°** (`Math.PI * 2 / 3` total spread):
- Dead centre → straight up (0°)
- Left/right edge → 60° from vertical
- 60° was chosen over 45° to give more steering range while keeping the ball
  moving upward at all times (`-Math.abs(Math.cos(...))` ensures vy is always
  negative)

### 3. Score mutation via `scoreRef` wrapper object

```js
const scoreRef = { value: 0 };
// in collision.js:
scoreRef.value += 10;
// in game.js:
game.score = scoreRef.value;
```

JavaScript primitives are passed by value — `collision.js` cannot mutate a
plain `let score` declared in `game.js`. Wrapping the score in an object passes
a reference that `collision.js` can write through.

**Why not return score delta from `checkBrickCollisions()`**: The function
already returns implicitly (void). Returning a delta would require the caller
to accumulate it — adding boilerplate at every call site, which increases with
multi-ball (every ball calls `checkBrickCollisions` each frame). The `scoreRef`
pattern keeps all call sites identical.

**Alternative considered**: Passing a callback `onBrickHit = () => game.score += 10`.
This is cleaner architecturally but adds a function allocation per call and
obscures where score mutation happens. The object wrapper is more visible.

### 4. Multi-ball spawning via 2D rotation matrix

```js
[-25, 25].forEach(deg => {
  const rad = deg * Math.PI / 180;
  const nb  = new Ball(ref.x, ref.y, ref.radius);
  nb.launched = true;
  nb.speed    = ref.speed;
  nb.vx = ref.vx * Math.cos(rad) - ref.vy * Math.sin(rad);
  nb.vy = ref.vx * Math.sin(rad) + ref.vy * Math.cos(rad);
  balls.push(nb);
});
```

The two new balls are clones of the reference ball rotated ±25° using the
standard 2D rotation matrix. This preserves the original ball's speed magnitude
while diverging its direction, so all three balls fan out naturally.

**±25° spread**: Narrow enough that both new balls still travel generally upward
(not sideways), but wide enough to cover different brick columns.

**Reference ball selection**: `balls.find(b => b.launched) || balls[0]` picks
the first launched ball. If multi-ball is collected before launch (unlikely but
possible), it falls back to `balls[0]`. The fallback prevents a null-reference
crash.

**Slow power-up restoration caveat**: `setTimeout(() => balls.forEach(b => b.setSpeed(b.speed / 0.7)), 8000)` divides by 0.7 to reverse the 0.7× reduction. This is algebraically exact but means: if multiple Slow power-ups stack, only the most recent timer's restoration fires correctly — earlier timers restore a speed that is already partially restored, slightly overshooting. Accepted: stacked Slow is a rare edge case in a 5-level child's game.

### 5. Power-up drop: 20% uniform random, 4 types equally weighted

```js
const POWERUP_CHANCE = 0.2;
const POWERUP_TYPES  = ['expand', 'multiball', 'life', 'slow'];

if (Math.random() < POWERUP_CHANCE) {
  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  powerUps.push(new PowerUp(brick.x + brick.w / 2, brick.y, type));
}
```

20% drop chance means roughly 1 power-up per 5 bricks. Level 1 (60 bricks)
produces ~12 power-ups on average — enough to feel rewarding without flooding
the screen. Each of the 4 types has 25% probability when a drop occurs.

The `powerUps` array is never filtered in-place during iteration — instead,
`pu.active = false` marks collected/expired items, and the draw loop uses
`.filter(p => p.active)`. This avoids mutation-during-iteration bugs. Inactive
entries are cleared on `startLevel()` via `powerUps.length = 0`.

---

## Consequences

- **Positive**: Nearest-point circle-AABB is exact and handles all brick entry
  angles without edge-case special casing
- **Positive**: Paddle angle control gives strategic depth — player can aim
  toward remaining bricks
- **Positive**: Multi-ball uses true rotation math — clones maintain speed
  magnitude and diverge symmetrically
- **Positive**: `scoreRef` pattern keeps `collision.js` independent of
  `game.js` internals
- **Risk**: One-brick-per-frame limit means a very fast ball clipping two
  bricks simultaneously only destroys one. Acceptable given the dt cap
- **Risk**: Slow power-up stacking causes minor speed overshoot on timer
  expiry (see §4 above)
- **Risk**: `setTimeout` for power-up expiry is wall-clock time, not game
  time — pausing the game does not pause the timer. Power-ups will expire
  during pause. Acceptable for this scope; a game-time accumulator in the
  update loop would fix this in a future issue

---

## Key Values

| Constant | Value | Effect |
|----------|-------|--------|
| `POWERUP_CHANCE` | 0.2 | ~1 drop per 5 bricks destroyed |
| Expand duration | 10 000 ms | Paddle stays wide for 10 s |
| Expand factor | ×1.5 | Paddle grows from 100 → 150 px |
| Expand max | 60% canvas width | Caps at 480 px to stay playable |
| Slow factor | ×0.7 | Ball slows to 70% of current speed |
| Slow duration | 8 000 ms | Slow lasts 8 s |
| Multi-ball angle | ±25° | Two clones fan out from reference ball |
| Paddle angle range | ±60° | Full paddle sweep maps to ±60° reflection |
| Score per brick | 10 pts | Flat rate across all levels/rows |
