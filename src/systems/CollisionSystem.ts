import { Enemy } from "../entities/Enemy";
import { Player } from "../entities/Player";
import { AreaAttack, ElementType, Projectile } from "../types";

export interface CollisionResult {
  killedEnemies: Enemy[];
  playerDamageTaken: number;
}

/**
 * Resolves combat collisions among attacks, enemies and player.
 */
export class CollisionSystem {
  private static readonly LIGHTNING_CHAIN_RADIUS = 120;
  private static readonly LIGHTNING_CHAIN_RADIUS_SQ =
    CollisionSystem.LIGHTNING_CHAIN_RADIUS * CollisionSystem.LIGHTNING_CHAIN_RADIUS;
  private static readonly GRID_CELL_SIZE = 96;

  private readonly enemyGrid = new Map<number, Enemy[]>();
  private readonly enemyIndexById = new Map<number, number>();
  private readonly projectileCandidates: Enemy[] = [];
  private readonly areaCandidates: Enemy[] = [];
  private readonly splashCandidates: Enemy[] = [];
  private readonly chainCandidates: Enemy[] = [];
  private readonly playerCandidates: Enemy[] = [];
  private maxEnemyRadius = 0;

  resolve(
    player: Player,
    enemies: Enemy[],
    projectiles: Projectile[],
    areas: AreaAttack[],
    contactInterval: number
  ): CollisionResult {
    const killedEnemies: Enemy[] = [];
    this.rebuildEnemyGrid(enemies);

    for (let pIndex = projectiles.length - 1; pIndex >= 0; pIndex -= 1) {
      const p = projectiles[pIndex];
      if (!p) {
        continue;
      }
      let removeProjectile = false;
      this.collectEnemiesInCircle(p.x, p.y, p.radius + this.maxEnemyRadius, this.projectileCandidates);

      for (const enemy of this.projectileCandidates) {
        if (!this.isEnemyAlive(enemy.id)) {
          continue;
        }
        if (p.hitIds.has(enemy.id)) {
          continue;
        }

        const dx = p.x - enemy.x;
        const dy = p.y - enemy.y;
        const hitRadius = p.radius + enemy.radius;
        if (dx * dx + dy * dy > hitRadius * hitRadius) {
          continue;
        }

        p.hitIds.add(enemy.id);

        if (p.element) {
          enemy.applyElementEffect(p.element, p.damage);
        }

        if (enemy.applyDamage(p.damage)) {
          const removed = this.removeEnemy(enemies, enemy.id);
          if (removed) {
            killedEnemies.push(removed);
          }
        }

        if (p.element === "lightning") {
          this.applyLightningChain(enemies, enemy, p.damage * 0.44, killedEnemies);
        }

        if (p.splashRadius && p.splashRadius > 0) {
          this.applySplashDamage(
            enemies,
            p.x,
            p.y,
            p.splashRadius,
            p.damage * 0.62,
            p.element,
            killedEnemies
          );
        }

        p.pierce -= 1;
        if (p.pierce < 0) {
          removeProjectile = true;
          break;
        }
      }

      if (removeProjectile) {
        this.removeProjectileAt(projectiles, pIndex);
      }
    }

    for (const area of areas) {
      if (!area) {
        continue;
      }

      if (area.shape === "circle") {
        this.collectEnemiesInCircle(
          area.x,
          area.y,
          (area.radius || 0) + this.maxEnemyRadius,
          this.areaCandidates
        );
      } else {
        const hitRadius = (area.width || 12) * 0.5 + this.maxEnemyRadius;
        const x2 = area.x2 || area.x;
        const y2 = area.y2 || area.y;
        this.collectEnemiesInBox(
          Math.min(area.x, x2) - hitRadius,
          Math.min(area.y, y2) - hitRadius,
          Math.max(area.x, x2) + hitRadius,
          Math.max(area.y, y2) + hitRadius,
          this.areaCandidates
        );
      }

      for (const enemy of this.areaCandidates) {
        if (!this.isEnemyAlive(enemy.id)) {
          continue;
        }
        if (area.hitIds.has(enemy.id)) {
          continue;
        }

        let hit = false;
        if (area.shape === "circle") {
          const dx = area.x - enemy.x;
          const dy = area.y - enemy.y;
          const hitRadius = (area.radius || 0) + enemy.radius;
          hit = dx * dx + dy * dy <= hitRadius * hitRadius;
        } else {
          const hitRadius = (area.width || 12) * 0.5 + enemy.radius;
          hit =
            this.distancePointToLineSq(enemy.x, enemy.y, area.x, area.y, area.x2 || area.x, area.y2 || area.y) <=
            hitRadius * hitRadius;
        }

        if (!hit) {
          continue;
        }

        area.hitIds.add(enemy.id);

        if (area.element) {
          enemy.applyElementEffect(area.element, area.damage);
        }

        if (enemy.applyDamage(area.damage)) {
          const removed = this.removeEnemy(enemies, enemy.id);
          if (removed) {
            killedEnemies.push(removed);
          }
        }

        if (area.element === "lightning") {
          this.applyLightningChain(enemies, enemy, area.damage * 0.4, killedEnemies);
        }
      }
    }

    let playerDamageTaken = 0;
    this.collectEnemiesInCircle(player.x, player.y, player.radius + this.maxEnemyRadius, this.playerCandidates);
    for (const enemy of this.playerCandidates) {
      if (!this.isEnemyAlive(enemy.id)) {
        continue;
      }
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const hitRadius = enemy.radius + player.radius;

      if (dx * dx + dy * dy <= hitRadius * hitRadius && enemy.canContact()) {
        const tookDamage = player.receiveDamage(enemy.damage);
        if (tookDamage) {
          playerDamageTaken += enemy.damage;
        }
        enemy.triggerContactCooldown(contactInterval);
      }
    }

    return {
      killedEnemies,
      playerDamageTaken
    };
  }

  private applyLightningChain(
    enemies: Enemy[],
    source: Enemy,
    damage: number,
    killedEnemies: Enemy[]
  ): void {
    this.collectEnemiesInCircle(
      source.x,
      source.y,
      CollisionSystem.LIGHTNING_CHAIN_RADIUS,
      this.chainCandidates
    );

    let nearest1: Enemy | null = null;
    let nearest2: Enemy | null = null;
    let nearestDist1 = Number.MAX_VALUE;
    let nearestDist2 = Number.MAX_VALUE;

    for (const enemy of this.chainCandidates) {
      if (!this.isEnemyAlive(enemy.id) || enemy.id === source.id) {
        continue;
      }

      const dx = enemy.x - source.x;
      const dy = enemy.y - source.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > CollisionSystem.LIGHTNING_CHAIN_RADIUS_SQ) {
        continue;
      }

      if (distSq < nearestDist1) {
        nearestDist2 = nearestDist1;
        nearest2 = nearest1;
        nearestDist1 = distSq;
        nearest1 = enemy;
      } else if (distSq < nearestDist2) {
        nearestDist2 = distSq;
        nearest2 = enemy;
      }
    }

    const targets = [nearest1, nearest2];
    for (const target of targets) {
      if (!target) {
        continue;
      }
      target.applyElementEffect("lightning", damage);
      if (target.applyDamage(damage)) {
        const removed = this.removeEnemy(enemies, target.id);
        if (removed) {
          killedEnemies.push(removed);
        }
      }
    }
  }

  private applySplashDamage(
    enemies: Enemy[],
    x: number,
    y: number,
    radius: number,
    damage: number,
    element: ElementType | undefined,
    killedEnemies: Enemy[]
  ): void {
    this.collectEnemiesInCircle(x, y, radius + this.maxEnemyRadius, this.splashCandidates);
    for (const enemy of this.splashCandidates) {
      if (!this.isEnemyAlive(enemy.id)) {
        continue;
      }
      const dx = x - enemy.x;
      const dy = y - enemy.y;
      const hitRadius = radius + enemy.radius;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        if (element) {
          enemy.applyElementEffect(element, damage);
        }
        if (enemy.applyDamage(damage)) {
          const removed = this.removeEnemy(enemies, enemy.id);
          if (removed) {
            killedEnemies.push(removed);
          }
        }
      }
    }
  }

  private removeEnemy(enemies: Enemy[], id: number): Enemy | null {
    const index = this.enemyIndexById.get(id);
    if (index === undefined) {
      return null;
    }
    return this.removeEnemyAt(enemies, index);
  }

  private removeEnemyAt(enemies: Enemy[], index: number): Enemy | null {
    if (index < 0 || index >= enemies.length) {
      return null;
    }

    const lastIndex = enemies.length - 1;
    const removed = enemies[index];

    if (index !== lastIndex) {
      const lastEnemy = enemies[lastIndex];
      enemies[index] = lastEnemy;
      this.enemyIndexById.set(lastEnemy.id, index);
    }
    enemies.pop();

    this.enemyIndexById.delete(removed.id);
    return removed || null;
  }

  private isEnemyAlive(enemyId: number): boolean {
    return this.enemyIndexById.has(enemyId);
  }

  private rebuildEnemyGrid(enemies: Enemy[]): void {
    this.enemyGrid.clear();
    this.enemyIndexById.clear();
    this.maxEnemyRadius = 0;

    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i];
      if (!enemy) {
        continue;
      }

      this.enemyIndexById.set(enemy.id, i);
      this.maxEnemyRadius = Math.max(this.maxEnemyRadius, enemy.radius);

      const key = this.cellKey(this.toCell(enemy.x), this.toCell(enemy.y));
      let bucket = this.enemyGrid.get(key);
      if (!bucket) {
        bucket = [];
        this.enemyGrid.set(key, bucket);
      }
      bucket.push(enemy);
    }
  }

  private collectEnemiesInCircle(x: number, y: number, radius: number, out: Enemy[]): void {
    this.collectEnemiesInBox(x - radius, y - radius, x + radius, y + radius, out);
  }

  private collectEnemiesInBox(minX: number, minY: number, maxX: number, maxY: number, out: Enemy[]): void {
    out.length = 0;
    const minCellX = this.toCell(minX);
    const minCellY = this.toCell(minY);
    const maxCellX = this.toCell(maxX);
    const maxCellY = this.toCell(maxY);

    for (let cy = minCellY; cy <= maxCellY; cy += 1) {
      for (let cx = minCellX; cx <= maxCellX; cx += 1) {
        const bucket = this.enemyGrid.get(this.cellKey(cx, cy));
        if (!bucket || bucket.length === 0) {
          continue;
        }
        for (const enemy of bucket) {
          out.push(enemy);
        }
      }
    }
  }

  private toCell(v: number): number {
    return Math.floor(v / CollisionSystem.GRID_CELL_SIZE);
  }

  private cellKey(cellX: number, cellY: number): number {
    return (cellX << 16) ^ (cellY & 0xffff);
  }

  private removeProjectileAt(projectiles: Projectile[], index: number): void {
    if (index < 0 || index >= projectiles.length) {
      return;
    }
    const lastIndex = projectiles.length - 1;
    if (index !== lastIndex) {
      projectiles[index] = projectiles[lastIndex];
    }
    projectiles.pop();
  }

  private distancePointToLineSq(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      const ex = px - x1;
      const ey = py - y1;
      return ex * ex + ey * ey;
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    const ex = px - cx;
    const ey = py - cy;
    return ex * ex + ey * ey;
  }
}
