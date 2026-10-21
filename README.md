# Worldseed

Emergent Civilization Sandbox – a god-game where people survive, age, reproduce and die (or go extinct) on their own. Mobile-friendly HTML5 canvas, written in TypeScript.

## Setup

```bash
npm install
npm run dev      # dev server (also reachable from your phone on the LAN)
npm run build    # typecheck + production build into dist/
npm run preview  # serve the production build
```

## Controls

- **⏸ / 1x / 2x / 4x** – pause or change simulation speed.
- **🍎 Spawn food** – toggle, then tap the map to bless an area with food.
- **☀️ Drought** – food regrowth drops to 10% for 3 years.
- **↻ New world** – generate a fresh world (also the way to restart after extinction).

You cannot command citizens directly.

## Gameplay loop

Watch the population, hunger/health stats and event log. Intervene sparingly: feed a starving settlement, or send a drought and see whether people survive. Colours: white = adult, yellow = child, lilac = elder; ring colour pink = female, blue = male; red dots = food.

## Architecture

- `src/sim/` – pure simulation (no DOM): `types.ts`, `config.ts`, `rng.ts`, `world.ts` (terrain, food, agents, reproduction, god powers).
- `src/ui/` – canvas `renderer.ts` and CSS.
- `src/main.ts` – wires the sim to the UI, runs the fixed-timestep loop.

## Phase 0 includes / limitations

Includes: 32x32 grid (grass/forest/water), food regrowth, ~20 agents with traits (metabolism, vigor, fertility), sex, life stages, hunger/energy/health, seek-food/wander/rest behaviour, sexual reproduction with trait inheritance + mutation + cooldown + population cap, death by age/starvation/health, extinction, god powers, stats and event log.

Limitations: no social relationships, dialogue/AI, crafting or persistence; agents only see 6 tiles; balance is untuned; no automated tests.
