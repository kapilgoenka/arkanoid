# ADR 002: Ball & Paddle Physics Model and Input System

**Date**: 2026-05-23
**Status**: Accepted
**Issues**: KGO-16 (Ball Entity & Wall Physics), KGO-18 (Paddle Entity & Controls)

---

## Context

The two core interactive entities — Ball and Paddle — needed physics models and
input handling that feel responsive at any frame rate and remain correct when
the browser tab briefly loses focus. These decisions cascade into all future
modules: collision detection (KGO-20) reads `ball.vx/vy` directly, power-ups
(KGO-23) call `ball.setSpeed()`, and multi-ball spawning pushes into the
`balls[]` array managed here.

---

## Decisions

### 1. Frame-rate–independent movement via dt scaling

Both Ball and Paddle scale all positional changes by `dt / 16.67`:

```js
// Ball.update()
const scale = dt / 16.67;   // 16.67 ms = one frame at 60 FPS
this.x += this.vx * scale;
this.y += this.vy * scale;

// Paddle.update()
const scale = dt / 16.67;
this.x += moving * this.speed * scale;
```

`dt` is capped at 50 ms in the game loop (ADR 001), so the maximum positional
jump per frame is `velocity × 3.0` — preventing tunnelling through thin objects
on slow machines or after a tab-switch.

**Why 16.67 ms as the divisor**: This is the exact duration of one frame at
60 FPS. At 60 FPS `dt ≈ 16.67` → `scale ≈ 1.0` → no adjustment. At 30 FPS
`dt ≈ 33.3` → `scale ≈ 2.0` → double step per frame, preserving velocity.
The physics feel identical regardless of monitor refresh rate.

**Trade-off**: Floating-point accumulation over many frames can cause
sub-pixel drift. For a game at this scale (~5 min sessions) this is
imperceptible; a fixed-step accumulator would add complexity with no
visible benefit.

### 2. Ball velocity stored as Cartesian components (vx, vy), not polar

```js
this.speed = 5;   // scalar magnitude, px per 60Hz frame
this.vx = 0;
this.vy = 0;
```

Wall reflections simply negate the relevant component:

```js
// Left/right walls
if (this.x - this.radius < 0) {
  this.x = this.radius;
  this.vx = Math.abs(this.vx);   // force rightward, not just negate
}
```

`Math.Abs` is used instead of `vx = -vx` to prevent the ball from getting
"stuck" inside a wall if floating-point drift places it slightly past the
boundary between frames.

**Speed scaling via `setSpeed()`**:

```js
setSpeed(newSpeed) {
  if (!this.launched) { this.speed = newSpeed; return; }
  const ratio = newSpeed / this.speed;
  this.vx *= ratio;
  this.vy *= ratio;
  this.speed = newSpeed;
}
```

This preserves direction while changing magnitude — used by the Slow power-up
(KGO-23) and level-speed increases (KGO-22). Polar conversion would require
`Math.atan2` + `Math.sin/cos` for every speed change; Cartesian ratio
multiplication is exact and cheaper.

### 3. Random launch angle ±30° from vertical

```js
const angle = (Math.random() * 60 - 30) * (Math.PI / 180);
this.vx = Math.sin(angle) * this.speed;
this.vy = -Math.cos(angle) * this.speed;   // negative = upward
```

The range is ±30° (not ±45° or ±90°) because:
- Angles below 15° from vertical produce very slow horizontal movement,
  making the game feel sluggish
- Angles above 45° can send the ball nearly horizontal, which is frustrating
  for a child player on the first launch
- The `Math.cos` baseline ensures a non-trivial upward component at all angles

**idempotency guard**: `if (this.launched) return` in `launch()` prevents a
second Space press or click from re-randomising the angle mid-flight.

### 4. Multi-ball–ready `balls[]` array with `activeBalls()` filter

Rather than a single `ball` variable, `game.js` maintains an array from the
start:

```js
const balls = [new Ball(canvas.width / 2, paddle.y - 10)];

function activeBalls() { return balls.filter(b => !b.isLost(canvas.height)); }

function resetBall() {
  balls.length = 0;
  balls.push(new Ball(paddle.x + paddle.width / 2, paddle.y - 10));
}
```

Life loss triggers only when `activeBalls().length === 0`, not on any single
ball exiting. The Multi-Ball power-up (KGO-23) simply pushes additional `Ball`
instances into this array — no structural changes to the game loop are needed.

`balls.length = 0` (mutate-in-place) rather than `balls = []` (reassign)
keeps the reference stable for any future module that holds a reference to
the array.

### 5. Dual input: keyboard via `Set`, mouse via `mousemove`

**Keyboard** (in `paddle.js`, global scope):

```js
const keys = new Set();
document.addEventListener('keydown', (e) => keys.add(e.code));
document.addEventListener('keyup',   (e) => keys.delete(e.code));
```

The Set is polled every frame in `Paddle.update()`:

```js
const moving =
  keys.has('ArrowLeft')  || keys.has('KeyA') ? -1 :
  keys.has('ArrowRight') || keys.has('KeyD') ?  1 : 0;
```

**Why a Set, not a boolean flag**: `keydown` fires repeatedly when a key is
held (key-repeat events). A flag set to `true` on `keydown` and `false` on
`keyup` handles this, but a Set handles simultaneous keys cleanly and scales
to any future key additions (e.g. power-up shortcuts) without new variables.

`e.code` (physical key) is used instead of `e.key` (character) so that WASD
works identically regardless of keyboard layout (AZERTY, Dvorak, etc.).

**Mouse** (in `game.js`):

```js
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  paddle.trackMouse(e.clientX - rect.left);
  balls.forEach(b => { if (!b.launched) b.x = paddle.x + paddle.width / 2; });
});
```

Mouse position is translated from page coordinates to canvas coordinates via
`getBoundingClientRect()`. The unlaunched ball's x is updated in the same
handler so it always appears centred on the paddle before launch.

`trackMouse()` is a separate method (not merged into `update()`) so the
keyboard path and mouse path can co-exist — mouse overrides keyboard position
continuously while moving, keyboard takes over when the mouse is still.

### 6. Paddle positioned 40 px from canvas bottom; ball starts 10 px above

```js
this.y = canvasHeight - 40;          // Paddle
balls.push(new Ball(..., paddle.y - 10));  // Ball
```

40 px gap gives enough visible area below the paddle to see the ball fall
before a life is lost. 10 px above keeps the ball visually touching the paddle
without overlapping it (ball radius = 8 px, so 10 px clears the paddle top).

---

## Consequences

- **Positive**: dt-scaled physics work correctly at any refresh rate
- **Positive**: `balls[]` array requires zero refactoring for Multi-Ball (KGO-23)
- **Positive**: Keyboard + mouse work simultaneously with no conflict
- **Positive**: `setSpeed()` ratio method lets KGO-22 and KGO-23 change speed
  without knowing current direction
- **Risk**: `keys` Set is global in `paddle.js` scope — any future key added
  to the Set (e.g. in another module) could interact unexpectedly with paddle
  movement if key codes overlap. Convention: only `paddle.js` writes to `keys`
- **Risk**: `Math.roundRect` used in `Paddle.draw()` requires Chrome 99+,
  Firefox 112+. Fallback `fillRect` can be substituted if older browser
  support is needed

---

## Key Constants

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| Ball radius | 8 px | `Ball` constructor default | Collision boundary |
| Ball base speed | 5 px/frame | `Ball.speed` | Initial velocity magnitude |
| Launch angle range | ±30° | `Ball.launch()` | Prevents near-horizontal launches |
| Paddle width | 100 px | `Paddle` constructor | Starting width (expandable via KGO-23) |
| Paddle height | 12 px | `Paddle` constructor | Hit-box height |
| Paddle speed | 7 px/frame | `Paddle.speed` | Keyboard movement rate |
| Paddle bottom gap | 40 px | `Paddle` constructor | Distance from canvas bottom |
| Ball above paddle | 10 px | `resetBall()` | Visual separation on reset |
| dt cap | 50 ms | `game.js` game loop | Max physics step (from ADR 001) |
