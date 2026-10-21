import { defaultConfig } from './config';
import { makeRng } from './rng';
import type { Agent, Config, LogEntry, Sex, Stats, Terrain, Tile, Traits } from './types';

const NAMES = ['Ada', 'Bo', 'Cai', 'Dara', 'Eli', 'Fen', 'Gia', 'Hal', 'Ira', 'Jun', 'Kai', 'Lia', 'Mo', 'Nia', 'Oren', 'Pia', 'Quin', 'Rae', 'Sol', 'Tam', 'Uma', 'Vik', 'Wren', 'Xan', 'Yue', 'Zed'];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Pure simulation: no DOM/canvas access. */
export class World {
  cfg: Config;
  tiles: Tile[] = [];
  agents: Agent[] = [];
  log: LogEntry[] = [];
  tick = 0;
  births = 0;
  deaths = 0;
  droughtTicks = 0;
  extinct = false;
  private nextId = 1;
  private rng: () => number;

  constructor(cfg: Partial<Config> = {}) {
    this.cfg = { ...defaultConfig, ...cfg };
    this.rng = makeRng(this.cfg.seed);
    this.generateTerrain();
    for (let i = 0; i < this.cfg.startAgents; i++) {
      const p = this.randomLand();
      const age = (this.cfg.adultAge + this.rng() * 20) * this.cfg.ticksPerYear;
      this.addAgent(p.x, p.y, i % 2 === 0 ? 'F' : 'M', this.randomTraits(), age);
    }
    this.addLog('event', `The world begins with ${this.agents.length} people.`);
  }

  tileAt(x: number, y: number): Tile {
    return this.tiles[y * this.cfg.size + x];
  }

  inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.cfg.size && y < this.cfg.size;
  }

  get year() {
    return Math.floor(this.tick / this.cfg.ticksPerYear);
  }

  stats(): Stats {
    const n = this.agents.length;
    const avg = (f: (a: Agent) => number) => (n ? this.agents.reduce((s, a) => s + f(a), 0) / n : 0);
    return {
      population: n, births: this.births, deaths: this.deaths,
      avgHunger: avg((a) => a.hunger), avgHealth: avg((a) => a.health),
      tick: this.tick, year: this.year, droughtTicks: this.droughtTicks, extinct: this.extinct,
    };
  }

  // ---- God interventions ----
  spawnFood(cx: number, cy: number, radius = 3) {
    for (let y = cy - radius; y <= cy + radius; y++)
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (!this.inBounds(x, y) || Math.hypot(x - cx, y - cy) > radius) continue;
        const t = this.tileAt(x, y);
        if (t.terrain !== 'water') t.food = this.cfg.maxFood;
      }
    this.addLog('event', `Food blessed the land near (${cx},${cy}).`);
  }

  triggerDrought(ticks = this.cfg.ticksPerYear * 3) {
    this.droughtTicks = ticks;
    this.addLog('event', 'A drought begins. Food will barely regrow.');
  }

  // ---- Simulation ----
  step() {
    if (this.extinct) return;
    this.tick++;
    this.regrowFood();
    if (this.droughtTicks > 0 && --this.droughtTicks === 0) this.addLog('event', 'The drought ends.');
    // iterate over a snapshot; newborns act next tick
    for (const a of [...this.agents]) {
      if (a.alive) this.updateAgent(a);
    }
    this.tryReproduction();
    this.agents = this.agents.filter((a) => a.alive);
    if (this.agents.length === 0) {
      this.extinct = true;
      this.addLog('extinction', `Extinction. The last person died in year ${this.year}.`);
    } else if (this.agents.length <= 3 && this.tick % this.cfg.ticksPerYear === 0) {
      this.addLog('warning', `Only ${this.agents.length} people remain!`);
    }
  }

  private regrowFood() {
    const chance = this.cfg.foodRegrowChance * (this.droughtTicks > 0 ? 0.1 : 1);
    for (const t of this.tiles) {
      if (t.terrain === 'water' || t.food >= this.cfg.maxFood) continue;
      if (this.rng() < chance * (t.terrain === 'forest' ? 2 : 1)) t.food++;
    }
  }

  private stage(a: Agent) {
    const y = a.age / this.cfg.ticksPerYear;
    return y < this.cfg.adultAge ? 'child' : y >= this.cfg.elderAge ? 'elder' : 'adult';
  }

  stageOf(a: Agent) {
    return this.stage(a);
  }

  private updateAgent(a: Agent) {
    a.age++;
    a.cooldown = Math.max(0, a.cooldown - 1);
    a.hunger = Math.min(100, a.hunger + 0.2 + a.traits.metabolism * 0.3);

    if (a.activity === 'resting') a.energy = Math.min(100, a.energy + 2);
    else a.energy = Math.max(0, a.energy - 0.15);

    // Health: starvation drains, being fed slowly heals
    if (a.hunger >= 90) a.health -= 0.6 * (1.2 - a.traits.vigor * 0.4);
    else if (a.hunger < 50) a.health = Math.min(100, a.health + 0.1);
    if (this.stage(a) === 'elder') a.health -= 0.05;

    if (a.health <= 0 || a.age >= a.maxAge) {
      const cause = a.age >= a.maxAge ? 'old age' : a.hunger >= 90 ? 'starvation' : 'poor health';
      this.kill(a, cause);
      return;
    }

    // Decide
    if (a.activity === 'resting' && a.energy < 80) return;
    if (a.energy < 20) { a.activity = 'resting'; return; }
    if (a.hunger > 40) { a.activity = 'seeking food'; this.eatOrSeek(a); return; }
    a.activity = 'wandering';
    this.wander(a);
  }

  private eatOrSeek(a: Agent) {
    const here = this.tileAt(a.x, a.y);
    if (here.food > 0) {
      here.food--;
      a.hunger = Math.max(0, a.hunger - 40);
      return;
    }
    // look for nearest food within a vision radius
    const R = 6;
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let y = a.y - R; y <= a.y + R; y++)
      for (let x = a.x - R; x <= a.x + R; x++) {
        if (!this.inBounds(x, y) || this.tileAt(x, y).food <= 0) continue;
        const d = Math.abs(x - a.x) + Math.abs(y - a.y);
        if (d < bestD) { bestD = d; best = { x, y }; }
      }
    if (best) this.stepToward(a, best.x, best.y);
    else this.wander(a);
  }

  private stepToward(a: Agent, tx: number, ty: number) {
    const dx = Math.sign(tx - a.x), dy = Math.sign(ty - a.y);
    const opts = Math.abs(tx - a.x) >= Math.abs(ty - a.y) ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
    for (const [ox, oy] of opts) if ((ox || oy) && this.tryMove(a, a.x + ox, a.y + oy)) return;
    this.wander(a);
  }

  private wander(a: Agent) {
    const [dx, dy] = DIRS[Math.floor(this.rng() * 4)];
    this.tryMove(a, a.x + dx, a.y + dy);
  }

  private tryMove(a: Agent, x: number, y: number) {
    if (!this.inBounds(x, y) || this.tileAt(x, y).terrain === 'water') return false;
    a.x = x; a.y = y;
    a.energy = Math.max(0, a.energy - 0.1);
    return true;
  }

  private tryReproduction() {
    if (this.agents.length >= this.cfg.maxPopulation) return;
    const eligible = (a: Agent) =>
      a.alive && this.stage(a) === 'adult' && a.cooldown === 0 && a.energy > 40 && a.health > 50 && a.hunger < 60;
    const females = this.agents.filter((a) => a.sex === 'F' && eligible(a));
    const males = this.agents.filter((a) => a.sex === 'M' && eligible(a));
    for (const f of females) {
      if (!eligible(f)) continue;
      const m = males.find((m) => eligible(m) && Math.abs(m.x - f.x) + Math.abs(m.y - f.y) <= 2);
      if (!m) continue;
      if (this.rng() > 0.02 + 0.08 * ((f.traits.fertility + m.traits.fertility) / 2)) continue;
      const traits = this.inherit(f.traits, m.traits);
      const child = this.addAgent(f.x, f.y, this.rng() < 0.5 ? 'F' : 'M', traits, 0);
      f.cooldown = m.cooldown = this.cfg.reproCooldown;
      f.energy -= 20; m.energy -= 10;
      this.births++;
      this.addLog('birth', `${child.name} was born to ${f.name} and ${m.name}.`);
    }
  }

  private inherit(a: Traits, b: Traits): Traits {
    const mix = (x: number, y: number) => clamp((x + y) / 2 + (this.rng() - 0.5) * 0.2, 0, 1);
    return { metabolism: mix(a.metabolism, b.metabolism), vigor: mix(a.vigor, b.vigor), fertility: mix(a.fertility, b.fertility) };
  }

  private kill(a: Agent, cause: string) {
    a.alive = false;
    this.deaths++;
    this.addLog('death', `${a.name} died of ${cause} at age ${Math.floor(a.age / this.cfg.ticksPerYear)}.`);
  }

  private addAgent(x: number, y: number, sex: Sex, traits: Traits, age: number): Agent {
    const id = this.nextId++;
    const lifespan = (60 + traits.vigor * 30 + this.rng() * 10) * this.cfg.ticksPerYear;
    const a: Agent = {
      id, name: `${NAMES[id % NAMES.length]}${Math.ceil(id / NAMES.length) > 1 ? Math.ceil(id / NAMES.length) : ''}`,
      x, y, sex, age, maxAge: lifespan, hunger: 20, energy: 80, health: 100, traits,
      cooldown: Math.floor(this.rng() * 50), activity: 'wandering', alive: true,
    };
    this.agents.push(a);
    return a;
  }

  private randomTraits(): Traits {
    return { metabolism: this.rng(), vigor: this.rng(), fertility: this.rng() };
  }

  private randomLand() {
    for (;;) {
      const x = Math.floor(this.rng() * this.cfg.size), y = Math.floor(this.rng() * this.cfg.size);
      if (this.tileAt(x, y).terrain !== 'water') return { x, y };
    }
  }

  private generateTerrain() {
    const n = this.cfg.size;
    // value noise on a coarse grid, bilinearly interpolated
    const cell = 6, gw = Math.ceil(n / cell) + 2;
    const grid = Array.from({ length: gw * gw }, () => this.rng());
    const noise = (x: number, y: number) => {
      const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = gx - x0, fy = gy - y0;
      const g = (i: number, j: number) => grid[j * gw + i];
      const top = g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx;
      const bot = g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx;
      return top * (1 - fy) + bot * fy;
    };
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = noise(x, y);
        const terrain: Terrain = v < 0.3 ? 'water' : v > 0.65 ? 'forest' : 'grass';
        this.tiles.push({ terrain, food: terrain === 'water' ? 0 : Math.floor(this.rng() * (this.cfg.maxFood + 1)) });
      }
  }

  private addLog(kind: LogEntry['kind'], text: string) {
    this.log.push({ tick: this.tick, kind, text });
    if (this.log.length > 200) this.log.shift();
  }
}
