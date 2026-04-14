import { Player } from "../entities/Player";
import { Chest } from "../types";

let chestAutoId = 1;

/**
 * Spawns and resolves chest pickups.
 */
export class ChestSystem {
  readonly chests: Chest[] = [];
  private spawnCooldown = 0;

  clear(): void {
    this.chests.length = 0;
    this.spawnCooldown = 0;
  }

  spawnChest(x: number, y: number): void {
    this.chests.push({
      id: chestAutoId++,
      x,
      y,
      radius: 14,
      life: 35,
      opened: false
    });
  }

  onEnemyKilled(
    x: number,
    y: number,
    isBoss: boolean,
    isElite: boolean,
    baseChance: number,
    eliteBonus: number,
    minSpawnGap = 0
  ): void {
    const safeMinGap = Math.max(0, minSpawnGap || 0);
    if (this.spawnCooldown > 0 && !isBoss) {
      return;
    }

    if (isBoss) {
      this.spawnChest(x, y);
      this.spawnCooldown = safeMinGap;
      return;
    }

    const chance = Math.min(1, Math.max(0, baseChance + (isElite ? eliteBonus : 0)));
    if (Math.random() < chance) {
      this.spawnChest(x, y);
      this.spawnCooldown = safeMinGap;
    }
  }

  update(dt: number): void {
    if (this.spawnCooldown > 0) {
      this.spawnCooldown = Math.max(0, this.spawnCooldown - dt);
    }

    for (let i = this.chests.length - 1; i >= 0; i -= 1) {
      const chest = this.chests[i];
      chest.life -= dt;
      if (chest.life <= 0 || chest.opened) {
        this.chests.splice(i, 1);
      }
    }
  }

  tryPickup(player: Player): Chest | null {
    for (const chest of this.chests) {
      const dx = chest.x - player.x;
      const dy = chest.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= chest.radius + player.radius + 6) {
        chest.opened = true;
        return chest;
      }
    }
    return null;
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const chest of this.chests) {
      ctx.fillStyle = "#d99c45";
      ctx.fillRect(chest.x - 12, chest.y - 10, 24, 20);
      ctx.fillStyle = "#ffe082";
      ctx.fillRect(chest.x - 12, chest.y - 2, 24, 4);
      ctx.fillStyle = "#663f1d";
      ctx.fillRect(chest.x - 2, chest.y - 2, 4, 8);
    }
  }
}
