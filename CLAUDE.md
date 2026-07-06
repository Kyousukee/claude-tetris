# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Vanilla-JS Tetris (HTML5 Canvas + CSS). No build step, no dependencies, no `package.json`, no tests. Three files: `index.html`, `style.css`, `game.js` (~300 lines, all game logic). README.md is in Spanish and documents mechanics/controls in detail.

## Running

Open `index.html` directly, or serve statically (`python3 -m http.server 8000` / `npx serve .`). No compile/lint/test tooling exists.

## Architecture (game.js)

All state lives in module-level `let` variables (`board`, `current`, `next`, `score`, ...); `init()` resets them and is the entry point (also bound to the restart button). Single `requestAnimationFrame` loop (`loop`) accumulates `dt` into `dropAccum` and drops one row when `dropAccum >= dropInterval`.

Key representations:
- **Board**: `ROWS × COLS` matrix; each cell is `0` (empty) or a color index `1–7`. Both `COLORS` and `PIECES` arrays are 1-indexed (index 0 is `null`) so the cell value doubles as both piece type and color lookup.
- **Pieces**: square matrices in `PIECES`. Rotation = `rotateCW` (transpose + reverse). `tryRotate` applies basic wall kicks by testing x-offsets `[0,-1,1,-2,2]`.
- **Collision**: `collide(shape, x, y)` is the single source of truth used by movement, rotation, ghost projection, soft/hard drop, and spawn (spawn-collision triggers `endGame`).

## Coupling to watch

`game.js` looks up DOM elements by hardcoded IDs at load — they must match `index.html`. Canvas geometry is coupled: the `<canvas id="board">` `width`/`height` in `index.html` (300×600) must equal `COLS*BLOCK × ROWS*BLOCK`. Changing `COLS`/`ROWS`/`BLOCK` requires updating the HTML canvas attributes to match.
