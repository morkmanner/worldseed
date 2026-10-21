import { World } from './sim/world';
import { Renderer } from './ui/renderer';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('world');
const renderer = new Renderer(canvas);

let world = new World();
let speed = 1;
let foodMode = false;
const TICK_MS = 100; // base: 10 ticks/sec at 1x

function layout() {
  renderer.resize(world);
  renderer.draw(world);
}

function renderUi() {
  const s = world.stats();
  $('clock').textContent = `Year ${s.year} · tick ${s.tick}`;
  $('stats').innerHTML = [
    ['Population', s.population], ['Births', s.births], ['Deaths', s.deaths],
    ['Avg hunger', s.avgHunger.toFixed(0)], ['Avg health', s.avgHealth.toFixed(0)],
    ['Drought', s.droughtTicks > 0 ? `${Math.ceil(s.droughtTicks / world.cfg.ticksPerYear)}y left` : 'no'],
  ].map(([k, v]) => `<div><b>${v}</b><small>${k}</small></div>`).join('');
  const entries = world.log.slice(-40).reverse();
  $('log').innerHTML = entries
    .map((e) => `<div class="${e.kind}"><small>Y${Math.floor(e.tick / world.cfg.ticksPerYear)}</small> ${e.text}</div>`)
    .join('');
}

function frame() {
  renderer.draw(world);
  renderUi();
}

let last = performance.now();
let acc = 0;
function loop(now: number) {
  acc += Math.min(now - last, 500) * speed;
  last = now;
  let steps = 0;
  while (acc >= TICK_MS && steps < 40) {
    world.step();
    acc -= TICK_MS;
    steps++;
  }
  if (steps) frame();
  requestAnimationFrame(loop);
}

document.querySelectorAll<HTMLButtonElement>('#speed button').forEach((b) =>
  b.addEventListener('click', () => {
    speed = Number(b.dataset.speed);
    document.querySelectorAll('#speed button').forEach((o) => o.classList.toggle('active', o === b));
  }),
);
$('food').addEventListener('click', () => {
  foodMode = !foodMode;
  $('food').classList.toggle('active', foodMode);
});
$('drought').addEventListener('click', () => { world.triggerDrought(); frame(); });
$('reset').addEventListener('click', () => { world = new World(); layout(); frame(); });
canvas.addEventListener('pointerdown', (e) => {
  if (!foodMode) return;
  const t = renderer.toTile(world, e.clientX, e.clientY);
  world.spawnFood(t.x, t.y);
  frame();
});
window.addEventListener('resize', layout);

layout();
frame();
requestAnimationFrame(loop);
