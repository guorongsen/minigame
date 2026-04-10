import { Player } from "../entities/Player";
import { ExpOrb } from "../types";

let dropAutoId = 1;

/**
 * Handles exp orb lifecycle and pickup attraction.
 */
export class DropSystem {
  readonly expOrbs: ExpOrb[] = [];

  spawnExp(x: number, y: number, value: number): void {
    this.expOrbs.push({
      id: dropAutoId++,
      x,
      y,
      value,
      radius: 7,
      life: 20
    });
  }

  clear(): void {
    this.expOrbs.length = 0;
  }

  update(dt: number, player: Player, pullSpeed: number): number {
    let collectedExp = 0;

    for (let i = this.expOrbs.length - 1; i >= 0; i -= 1) {
      const orb = this.expOrbs[i];
      orb.life -= dt;
      if (orb.life <= 0) {
        this.expOrbs.splice(i, 1);
        continue;
      }

      const dx = player.x - orb.x;
      const dy = player.y - orb.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (dist <= player.passives.pickupRange + 46) {
        orb.x += (dx / dist) * pullSpeed * dt;
        orb.y += (dy / dist) * pullSpeed * dt;
      }

      if (dist <= player.radius + orb.radius + 3) {
        collectedExp += orb.value;
        this.expOrbs.splice(i, 1);
      }
    }

    return collectedExp;
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const orb of this.expOrbs) {
      ctx.fillStyle = "#7bc4ff";
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#cce8ff";
      ctx.beginPath();
      ctx.arc(orb.x - 2, orb.y - 2, orb.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
