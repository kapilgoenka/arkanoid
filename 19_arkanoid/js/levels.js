// PROMPT:
//
// Level definitions for Arkanoid. Five levels with distinct brick patterns
// and increasing ball speed. 88-char line limit.
//

const ROW_COLORS = [
  '#ff4444', // row 0 — red
  '#ff8800', // row 1 — orange
  '#ffdd00', // row 2 — yellow
  '#44cc44', // row 3 — green
  '#4488ff', // row 4 — blue
  '#aa44ff', // row 5 — purple
];

const COLS = 10;
const ROWS = 6;

// Each level is a 2D array [row][col]: 1 = brick present, 0 = empty
const LEVEL_MAPS = [
  // Level 1: full grid
  Array.from({ length: ROWS }, () => Array(COLS).fill(1)),

  // Level 2: checkerboard
  Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => (r + c) % 2 === 0 ? 1 : 0)
  ),

  // Level 3: diamond (centre rows fuller, edges sparse)
  [
    [0,0,0,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,0],
    [0,1,1,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,1,1,0,0],
    [0,0,0,1,1,1,1,0,0,0],
  ],

  // Level 4: V-shape (two diagonal arms)
  [
    [1,0,0,0,0,0,0,0,0,1],
    [1,1,0,0,0,0,0,0,1,1],
    [0,1,1,0,0,0,0,1,1,0],
    [0,0,1,1,0,0,1,1,0,0],
    [0,0,0,1,1,1,1,0,0,0],
    [0,0,0,0,1,1,0,0,0,0],
  ],

  // Level 5: scattered/dense mix (harder to clear last bricks)
  [
    [1,0,1,1,0,0,1,1,0,1],
    [0,1,1,0,1,1,0,1,1,0],
    [1,1,0,1,1,1,1,0,1,1],
    [1,0,1,0,1,1,0,1,0,1],
    [0,1,1,1,0,0,1,1,1,0],
    [1,0,0,1,1,1,1,0,0,1],
  ],
];

const LEVEL_SPEEDS = [5, 5.5, 6, 6.5, 7.2]; // base ball speed per level

function buildLevel(levelIndex) {
  const map    = LEVEL_MAPS[levelIndex % LEVEL_MAPS.length];
  const bricks = [];
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      if (map[r][c]) bricks.push(new Brick(r, c, ROW_COLORS[r]));
    }
  }
  return bricks;
}
