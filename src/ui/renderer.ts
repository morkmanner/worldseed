import type { World } from '../sim/world';

const TERRAIN_COLOR = { grass: '#5a8f3e', forest: '#2f6b34', water: '#2f6fb0' } as const;
const STAGE_COLOR = { child: '#ffe66d', adult: '#ffffff', elder: '#c9b6e4' } as const;

/** Draws the world onto a square canvas. Holds no simulation state. */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private cell = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(world: World) {
    const dpr = window.devicePixelRatio || 1;
    const css = Math.min(this.canvas.parentElement!.clientWidth, 640);
    this.canvas.style.width = this.canvas.style.height = `${css}px`;
    this.canvas.width = this.canvas.height = Math.floor(css * dpr);
    this.cell = this.canvas.width / world.cfg.size;
  }

  toTile(world: World, clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: Math.min(world.cfg.size - 1, Math.max(0, Math.floor(((clientX - r.left) / r.width) * world.cfg.size))),
      y: Math.min(world.cfg.size - 1, Math.max(0, Math.floor(((clientY - r.top) / r.height) * world.cfg.size))),
    };
  }

  draw(world: World) {
    const { ctx, cell } = this;
    const n = world.cfg.size;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const t = world.tileAt(x, y);
        ctx.fillStyle = TERRAIN_COLOR[t.terrain];
        ctx.fillRect(x * cell, y * cell, cell + 1, cell + 1);
        if (t.food > 0) {
          ctx.fillStyle = '#e8504a';
          const r = cell * (0.1 + 0.07 * t.food);
          ctx.beginPath();
          ctx.arc((x + 0.5) * cell + cell * 0.2, (y + 0.5) * cell + cell * 0.2, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    if (world.droughtTicks > 0) {
      ctx.fillStyle = 'rgba(220,160,40,0.18)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    for (const a of world.agents) {
      ctx.fillStyle = STAGE_COLOR[world.stageOf(a)];
      ctx.strokeStyle = a.sex === 'F' ? '#e85d9a' : '#3d8bff';
      ctx.lineWidth = Math.max(1, cell * 0.1);
      ctx.beginPath();
      ctx.arc((a.x + 0.5) * cell, (a.y + 0.5) * cell, cell * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
