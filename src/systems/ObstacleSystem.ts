import { AreaAttack, Projectile } from "../types";
import { clamp, randomInt, randomRange } from "../utils/MathUtil";

export interface ObstacleRect {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  maxHp: number;
  hp: number;
  dropExp: number;
}

interface CircleBody {
  x: number;
  y: number;
  radius: number;
}

export interface ObstacleGenerateOptions {
  countMin?: number;
  countMax?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  safeRadiusRatio?: number;
  overlapPadding?: number;
}

export interface ObstacleBreakDrop {
  x: number;
  y: number;
  exp: number;
  color: string;
}

let obstacleAutoId = 1;

/**
 * Static map obstacles and circle-vs-rectangle collision helpers.
 */
export class ObstacleSystem {
  readonly obstacles: ObstacleRect[] = [];

  clear(): void {
    this.obstacles.length = 0;
  }

  generate(
    worldWidth: number,
    worldHeight: number,
    count: number,
    safeX: number,
    safeY: number,
    options?: ObstacleGenerateOptions
  ): void {
    this.clear();

    const countMin = Math.max(0, Math.floor(options?.countMin ?? count));
    const countMax = Math.max(countMin, Math.floor(options?.countMax ?? count));
    const targetCount = randomInt(countMin, countMax);

    const minWidth = Math.max(16, options?.minWidth ?? 80);
    const maxWidth = Math.max(minWidth, options?.maxWidth ?? 190);
    const minHeight = Math.max(16, options?.minHeight ?? 64);
    const maxHeight = Math.max(minHeight, options?.maxHeight ?? 170);

    const overlapBase = Math.max(4, options?.overlapPadding ?? 14);
    const overlapPadding = Math.max(4, overlapBase + randomRange(-2, 3));

    const safeRadiusBase = Math.max(0.05, options?.safeRadiusRatio ?? 0.14);
    const safeRadiusRatio = clamp(safeRadiusBase + randomRange(-0.02, 0.03), 0.05, 0.22);

    const maxAttempts = Math.max(24, targetCount * 55);
    const safeRadius = Math.min(worldWidth, worldHeight) * safeRadiusRatio;

    let attempts = 0;
    while (this.obstacles.length < targetCount && attempts < maxAttempts) {
      attempts += 1;
      const shapeRoll = Math.random();

      let w = randomRange(minWidth, maxWidth);
      let h = randomRange(minHeight, maxHeight);

      // Add obstacle archetypes so every run has clearly different map texture.
      if (shapeRoll < 0.24) {
        // Horizontal barrier
        w = randomRange(minWidth * 1.2, maxWidth * 1.5);
        h = randomRange(Math.max(16, minHeight * 0.58), Math.max(24, minHeight * 0.95));
      } else if (shapeRoll < 0.48) {
        // Vertical barrier
        w = randomRange(Math.max(16, minWidth * 0.58), Math.max(24, minWidth * 0.95));
        h = randomRange(minHeight * 1.2, maxHeight * 1.5);
      }

      w = Math.min(w, worldWidth - 64);
      h = Math.min(h, worldHeight - 64);

      const x = randomRange(28, worldWidth - w - 28);
      const y = randomRange(28, worldHeight - h - 28);

      const centerX = x + w * 0.5;
      const centerY = y + h * 0.5;

      const sx = centerX - safeX;
      const sy = centerY - safeY;
      if (Math.sqrt(sx * sx + sy * sy) < safeRadius) {
        continue;
      }

      const baseArea = Math.max(1, minWidth * minHeight);
      const areaFactor = clamp((w * h) / baseArea, 0.65, 3.4);
      const maxHp = Math.round(34 + areaFactor * 24 + randomRange(0, 11));
      const dropExp = Math.round(2 + areaFactor * 2.8 + randomRange(0, 2.2));

      const rect: ObstacleRect = {
        id: obstacleAutoId++,
        x,
        y,
        w,
        h,
        color: this.pickColor(),
        maxHp,
        hp: maxHp,
        dropExp: Math.max(2, dropExp)
      };

      if (this.intersectsAny(rect, overlapPadding)) {
        continue;
      }

      this.obstacles.push(rect);
    }
  }

  resolveAttacks(projectiles: Projectile[], areas: AreaAttack[], damageScale = 0.56): ObstacleBreakDrop[] {
    const destroyed: ObstacleBreakDrop[] = [];

    for (let pIndex = projectiles.length - 1; pIndex >= 0; pIndex -= 1) {
      const projectile = projectiles[pIndex];
      if (!projectile) {
        continue;
      }

      let removedProjectile = false;
      for (let oIndex = this.obstacles.length - 1; oIndex >= 0; oIndex -= 1) {
        const obstacle = this.obstacles[oIndex];
        const hitId = 1000000 + obstacle.id;
        if (projectile.hitIds.has(hitId)) {
          continue;
        }

        if (!this.circleRectOverlap(projectile.x, projectile.y, projectile.radius, obstacle)) {
          continue;
        }

        projectile.hitIds.add(hitId);

        const damage = projectile.damage * damageScale * 0.92;
        const drop = this.damageObstacleAt(oIndex, damage);
        if (drop) {
          destroyed.push(drop);
        }

        projectile.pierce -= 1;
        if (projectile.pierce < 0) {
          projectiles.splice(pIndex, 1);
          removedProjectile = true;
        }
        break;
      }

      if (removedProjectile) {
        continue;
      }
    }

    for (const area of areas) {
      if (!area) {
        continue;
      }

      for (let oIndex = this.obstacles.length - 1; oIndex >= 0; oIndex -= 1) {
        const obstacle = this.obstacles[oIndex];
        const hitId = 1000000 + obstacle.id;
        if (area.hitIds.has(hitId)) {
          continue;
        }

        let hit = false;
        if (area.shape === "circle") {
          hit = this.circleRectOverlap(area.x, area.y, area.radius || 0, obstacle);
        } else {
          const dist = this.distanceSegmentToRect(
            area.x,
            area.y,
            area.x2 || area.x,
            area.y2 || area.y,
            obstacle
          );
          hit = dist <= (area.width || 12) * 0.5;
        }

        if (!hit) {
          continue;
        }

        area.hitIds.add(hitId);

        const damage = area.damage * damageScale * 0.82;
        const drop = this.damageObstacleAt(oIndex, damage);
        if (drop) {
          destroyed.push(drop);
        }
      }
    }

    return destroyed;
  }

  resolveCircle(body: CircleBody, worldWidth: number, worldHeight: number): void {
    body.x = clamp(body.x, body.radius + 6, worldWidth - body.radius - 6);
    body.y = clamp(body.y, body.radius + 6, worldHeight - body.radius - 6);

    for (let iter = 0; iter < 2; iter += 1) {
      for (const obstacle of this.obstacles) {
        const nearestX = clamp(body.x, obstacle.x, obstacle.x + obstacle.w);
        const nearestY = clamp(body.y, obstacle.y, obstacle.y + obstacle.h);

        let dx = body.x - nearestX;
        let dy = body.y - nearestY;
        let distSq = dx * dx + dy * dy;

        if (distSq > body.radius * body.radius) {
          continue;
        }

        if (distSq <= 0.00001) {
          const leftPen = Math.abs(body.x - obstacle.x);
          const rightPen = Math.abs(obstacle.x + obstacle.w - body.x);
          const topPen = Math.abs(body.y - obstacle.y);
          const bottomPen = Math.abs(obstacle.y + obstacle.h - body.y);

          const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
          if (minPen === leftPen) {
            body.x = obstacle.x - body.radius - 0.5;
          } else if (minPen === rightPen) {
            body.x = obstacle.x + obstacle.w + body.radius + 0.5;
          } else if (minPen === topPen) {
            body.y = obstacle.y - body.radius - 0.5;
          } else {
            body.y = obstacle.y + obstacle.h + body.radius + 0.5;
          }
        } else {
          const dist = Math.sqrt(distSq);
          const overlap = body.radius - dist + 0.2;
          dx /= dist;
          dy /= dist;
          body.x += dx * overlap;
          body.y += dy * overlap;
        }

        body.x = clamp(body.x, body.radius + 6, worldWidth - body.radius - 6);
        body.y = clamp(body.y, body.radius + 6, worldHeight - body.radius - 6);
      }
    }
  }

  isCircleBlocked(x: number, y: number, radius: number): boolean {
    for (const obstacle of this.obstacles) {
      const nearestX = clamp(x, obstacle.x, obstacle.x + obstacle.w);
      const nearestY = clamp(y, obstacle.y, obstacle.y + obstacle.h);
      const dx = x - nearestX;
      const dy = y - nearestY;
      if (dx * dx + dy * dy <= radius * radius) {
        return true;
      }
    }
    return false;
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const obstacle of this.obstacles) {
      const hpRatio = clamp(obstacle.hp / Math.max(1, obstacle.maxHp), 0, 1);

      ctx.fillStyle = obstacle.color;
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);

      if (hpRatio < 0.98) {
        ctx.globalAlpha = (1 - hpRatio) * 0.4;
        ctx.fillStyle = "#0d141f";
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);

      ctx.strokeStyle = "rgba(220, 240, 255, 0.28)";
      ctx.lineWidth = 1;
      ctx.strokeRect(obstacle.x + 4, obstacle.y + 4, obstacle.w - 8, obstacle.h - 8);

      if (hpRatio < 0.7) {
        ctx.strokeStyle = "rgba(250, 230, 210, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(obstacle.x + 6, obstacle.y + 8);
        ctx.lineTo(obstacle.x + obstacle.w - 8, obstacle.y + obstacle.h - 6);
        ctx.stroke();
      }

      if (hpRatio < 0.38) {
        ctx.strokeStyle = "rgba(255, 209, 180, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(obstacle.x + obstacle.w - 10, obstacle.y + 7);
        ctx.lineTo(obstacle.x + 10, obstacle.y + obstacle.h - 9);
        ctx.stroke();
      }
    }
  }

  private damageObstacleAt(index: number, amount: number): ObstacleBreakDrop | null {
    const obstacle = this.obstacles[index];
    if (!obstacle) {
      return null;
    }

    obstacle.hp -= Math.max(1, amount);
    if (obstacle.hp > 0) {
      return null;
    }

    this.obstacles.splice(index, 1);
    return {
      x: obstacle.x + obstacle.w * 0.5,
      y: obstacle.y + obstacle.h * 0.5,
      exp: obstacle.dropExp,
      color: obstacle.color
    };
  }

  private circleRectOverlap(x: number, y: number, radius: number, rect: ObstacleRect): boolean {
    const nearestX = clamp(x, rect.x, rect.x + rect.w);
    const nearestY = clamp(y, rect.y, rect.y + rect.h);
    const dx = x - nearestX;
    const dy = y - nearestY;
    return dx * dx + dy * dy <= radius * radius;
  }

  private distanceSegmentToRect(x1: number, y1: number, x2: number, y2: number, rect: ObstacleRect): number {
    let best = Math.min(this.distancePointToRect(x1, y1, rect), this.distancePointToRect(x2, y2, rect));

    const corners = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x, y: rect.y + rect.h },
      { x: rect.x + rect.w, y: rect.y + rect.h }
    ];

    for (const corner of corners) {
      best = Math.min(best, this.distancePointToSegment(corner.x, corner.y, x1, y1, x2, y2));
      if (best <= 0.0001) {
        return 0;
      }
    }

    return best;
  }

  private distancePointToRect(px: number, py: number, rect: ObstacleRect): number {
    const dx = Math.max(rect.x - px, 0, px - (rect.x + rect.w));
    const dy = Math.max(rect.y - py, 0, py - (rect.y + rect.h));
    return Math.sqrt(dx * dx + dy * dy);
  }

  private distancePointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    if (lenSq <= 0.00001) {
      const ex = px - x1;
      const ey = py - y1;
      return Math.sqrt(ex * ex + ey * ey);
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = clamp(t, 0, 1);

    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    const ex = px - cx;
    const ey = py - cy;
    return Math.sqrt(ex * ex + ey * ey);
  }

  private intersectsAny(rect: ObstacleRect, padding: number): boolean {
    for (const obstacle of this.obstacles) {
      if (
        rect.x - padding < obstacle.x + obstacle.w &&
        rect.x + rect.w + padding > obstacle.x &&
        rect.y - padding < obstacle.y + obstacle.h &&
        rect.y + rect.h + padding > obstacle.y
      ) {
        return true;
      }
    }
    return false;
  }

  private pickColor(): string {
    const colors = ["#334b60", "#3a5569", "#405d72", "#4a5b6f"];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

