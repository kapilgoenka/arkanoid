# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Repository Structure

This is a learning playground where each project lives in a numbered folder:

```
1_hello_world/            # Python hello world
2_hello_fibonacci/        # Python Fibonacci
3_hello_loop/             # Python loop demo
4_reverse_string/         # Python string reversal (uses input())
5_is_prime/               # JavaScript prime checker (Node)
6_file_renaming/          # Python file renaming script (see below)
7_tic_tac_toe_streamlit/  # Python Streamlit app
8_tic_tac_toe_js/         # Vanilla JS/HTML/CSS game
9_sudoku_game/            # Vanilla JS/HTML/CSS game
10_employee_sql/          # Python MySQL query script
11_workout_dashboard/     # React + Vite web app (see below)
12_django_uv/             # Django + uv project scaffold
13_uv_cats_cli/           # Python CLI tool using TheCatAPI (see below)
14_us_map_uv_django/      # Django + uv US states quiz app (see below)
15_simple_form/           # React dark-themed contact form (single HTML file)
16_daily_challenge/       # Next.js 16 daily challenge generator (see below)
17_kanban/                # Next.js 16 Kanban board with drag-and-drop (see below)
19_arkanoid/              # Vanilla JS/HTML5 Canvas Arkanoid game (see below)
```

New projects are prefixed with the next number and use underscores (not
hyphens).

## Running Code

**Python scripts:**
```bash
python <path>/<filename>.py
```

**JavaScript (Node) scripts:**
```bash
node <path>/<filename>.js
```

**Streamlit app (`7_tic_tac_toe_streamlit`):**
```bash
streamlit run 7_tic_tac_toe_streamlit/tic_tac_toe.py
```

**Workout dashboard (`11_workout_dashboard`):**
```bash
cd 11_workout_dashboard
npm run dev      # dev server at http://localhost:5173
npm run build    # production build
```

## Code Style

- **Line length**: 88 characters maximum — wrap lines where necessary
- No comments unless the WHY is non-obvious

### File Header Comments

Every standalone script must begin with a PROMPT header capturing all prompts
used to build it (append new prompts as the file evolves):

**Python:**
```python
# PROMPT:
#
# [prompt text, wrapped at 88 characters]
#
```

**JavaScript:**
```javascript
// PROMPT:
//
// [prompt text, wrapped at 88 characters]
//
```

Format rules: `PROMPT:` label, blank comment line, wrapped prompt text, blank
comment line, then one blank line before code.

## Project Notes

### `6_file_renaming/file_renaming.py`
Creates a `files/` subfolder relative to the script's own directory (uses
`__file__`), generates 20 random files (.txt, .pdf, .csv, .png), renames them
with timestamps or resolution (for PNGs), then reverts. Run with `--execute`
to do real renames; default is dry-run mode.

### `13_uv_cats_cli/`
CLI tool that fetches cat breed info from TheCatAPI. Managed with `uv`.
```bash
cd 13_uv_cats_cli
uv sync
uv run uv-cats Siamese   # replace with any breed name
uv run pytest            # run tests
```

### `14_us_map_uv_django/`
Django + uv web app — a US states quiz with an interactive SVG map.
```bash
cd 14_us_map_uv_django
uv sync
uv run python manage.py migrate
uv run python manage.py runserver   # http://127.0.0.1:8000
```

### `15_simple_form/`
Self-contained React contact form (`form.html`) using React via CDN —
no build step. Open directly in a browser.

### `16_daily_challenge/`
Next.js 16 + React 19 daily challenge generator. Client-only, no persistence.
```bash
cd 16_daily_challenge/frontend
npm install
npm run dev       # http://localhost:3000
npm run test      # vitest unit tests
npm run test:e2e  # playwright e2e
```

### `17_kanban/`
Next.js 16 + React 19 Kanban board. One board, five renameable columns, drag-
and-drop cards via `@dnd-kit`, add/delete cards, no persistence.
```bash
cd 17_kanban/frontend
npm install
npm run dev       # http://localhost:3000
npm run test      # vitest unit tests
npm run test:e2e  # playwright e2e (port 3003)
```

### `19_arkanoid/`
Vanilla JS + HTML5 Canvas Arkanoid/Breakout game. No build step — open
`index.html` directly in any modern browser.
- **Controls**: Mouse or ←/→ arrow keys / A/D for paddle; Space or click to
  launch ball; P to pause; M to mute; H from title for progress history
- **Features**: 5 levels, 4 power-ups (Expand/Multi-Ball/Extra Life/Slow),
  Web Audio API synthesized sounds, particle effects, session history stored
  in localStorage with personal best and trend detection
- **ADRs**: `docs/adr/` — 5 architecture decision records documenting game
  loop, physics model, brick grid, collision system, and history persistence

### `11_workout_dashboard/`
React 18 + Vite + Tailwind CSS + Chart.js dashboard for Hevy gym app exports.

- **Data**: `public/hevy-export.csv` (Hevy export, format:
  `"Nov 25, 2025, 5:47 AM"`)
- **Entry**: `src/App.jsx` fetches the CSV with PapaParse, passes parsed rows
  to `<Dashboard>`
- **Data layer**: `src/utils/dataProcessor.js` — all parsing and aggregation
  logic; `parseDate()` handles the abbreviated-month 12-hour format
- **Components**: one file per chart/section in `src/components/`; each
  imports only the Chart.js elements it needs and calls `ChartJS.register()`
- **PRD**: `prd/workout-dashboard-prd.md`
