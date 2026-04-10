import { Enemy } from "../entities/Enemy";
import { Player } from "../entities/Player";
import { ConfigManager } from "../managers/ConfigManager";
import { AreaAttack, ElementType, Projectile, Vec2 } from "../types";
import { normalize } from "../utils/MathUtil";
import { EffectSystem } from "./EffectSystem";

let attackAutoId = 1;

/**
 * Auto-attack executor for all player weapons.
 */
export class WeaponSystem {
  readonly projectiles: Projectile[] = [];
  readonly areas: AreaAttack[] = [];

  private cooldownByBase: Record<string, number> = {};
  private orbitAngle = 0;
  private elementCursor = 0;

  reset(player: Player): void {
    this.projectiles.length = 0;
    this.areas.length = 0;
    this.cooldownByBase = {};
    for (const baseId of player.ownedBaseWeaponIds) {
      this.cooldownByBase[baseId] = Math.random() * 0.15;
    }
    this.orbitAngle = 0;
    this.elementCursor = 0;
  }

  onWeaponAdded(baseWeaponId: string): void {
    if (this.cooldownByBase[baseWeaponId] === undefined) {
      this.cooldownByBase[baseWeaponId] = Math.random() * 0.15;
    }
  }

  update(dt: number, player: Player, enemies: Enemy[], effectSystem: EffectSystem): void {
    this.orbitAngle += dt * 2.4;

    for (const baseId of player.ownedBaseWeaponIds) {
      if (this.cooldownByBase[baseId] === undefined) {
        this.cooldownByBase[baseId] = 0;
      }
      this.cooldownByBase[baseId] -= dt;

      if (this.cooldownByBase[baseId] <= 0) {
        const weaponId = player.currentWeaponByBase[baseId];
        const weapon = ConfigManager.getInstance().getWeapon(weaponId);
        const level = player.getWeaponLevel(baseId);
        const cooldown = this.calcCooldown(weapon.cooldown, level, player.getCooldownMultiplier());
        this.cooldownByBase[baseId] += cooldown;

        this.castWeapon(weaponId, level, player, enemies, effectSystem);
      }
    }

    this.updateProjectiles(dt);
    this.updateAreas(dt);
  }

  clear(): void {
    this.projectiles.length = 0;
    this.areas.length = 0;
  }

  private calcCooldown(base: number, level: number, cooldownMultiplier: number): number {
    const levelMul = 1 - (level - 1) * 0.08;
    return Math.max(0.12, base * Math.max(0.5, levelMul) * cooldownMultiplier);
  }

  private calcDamage(base: number, level: number, playerDamageMul: number): number {
    return base * (1 + (level - 1) * 0.26) * playerDamageMul;
  }

  private castWeapon(
    weaponId: string,
    level: number,
    player: Player,
    enemies: Enemy[],
    effectSystem: EffectSystem
  ): void {
    const weapon = ConfigManager.getInstance().getWeapon(weaponId);
    const damage = this.calcDamage(weapon.damage, level, player.getDamageMultiplier());
    const target = this.findNearestEnemy(player.x, player.y, enemies);
    const castElement = this.pickElement(player);

    switch (weapon.pattern) {
      case "knife":
        if (target) {
          this.spawnProjectileToward(weaponId, player.x, player.y, target.x, target.y, damage, level, castElement);
        }
        break;
      case "fireball":
        if (target) {
          this.spawnProjectileToward(
            weaponId,
            player.x,
            player.y,
            target.x,
            target.y,
            damage,
            level,
            castElement,
            0,
            46 + level * 6
          );
        }
        break;
      case "shockwave":
        this.spawnCircleArea(
          weaponId,
          player.x,
          player.y,
          (weapon.radius || 90) + level * 10,
          damage,
          0.18,
          castElement
        );
        break;
      case "laser":
        if (target) {
          this.spawnBeam(
            weaponId,
            player.x,
            player.y,
            target.x,
            target.y,
            (weapon.range || 360) + level * 10,
            (weapon.beamWidth || 16) + level,
            damage,
            0.12,
            castElement
          );
        }
        break;
      case "punch":
        this.castPunch(
          weaponId,
          player,
          target,
          weapon.range || 100,
          (weapon.radius || 52) + level * 4,
          damage,
          castElement
        );
        break;
      case "blade_storm":
        for (let i = 0; i < 4; i += 1) {
          const angle = this.orbitAngle + i * (Math.PI / 2);
          const px = player.x + Math.cos(angle) * 70;
          const py = player.y + Math.sin(angle) * 70;
          this.spawnCircleArea(weaponId, px, py, 26, damage, 0.24, castElement);
        }
        break;
      case "arc_knives":
        if (target) {
          this.spawnFanProjectiles(
            weaponId,
            player.x,
            player.y,
            target.x,
            target.y,
            damage,
            level,
            3,
            0.26,
            castElement
          );
        }
        break;
      case "chain_fireball":
        if (target) {
          this.spawnProjectileToward(
            weaponId,
            player.x,
            player.y,
            target.x,
            target.y,
            damage,
            level,
            castElement,
            0,
            70 + level * 8
          );
        }
        break;
      case "frostfire_orb":
        if (target) {
          this.spawnProjectileToward(
            weaponId,
            player.x,
            player.y,
            target.x,
            target.y,
            damage,
            level,
            castElement,
            -70,
            82 + level * 9
          );
        }
        break;
      case "ice_quake":
        this.spawnCircleArea(
          weaponId,
          player.x,
          player.y,
          (weapon.radius || 130) + level * 12,
          damage,
          0.2,
          castElement
        );
        this.spawnCircleArea(
          weaponId,
          player.x,
          player.y,
          (weapon.radius || 130) * 0.6,
          damage * 0.7,
          0.3,
          castElement
        );
        break;
      case "toxic_wave":
        this.spawnCircleArea(
          weaponId,
          player.x,
          player.y,
          (weapon.radius || 110) + level * 8,
          damage,
          0.22,
          castElement
        );
        this.spawnCircleArea(
          weaponId,
          player.x,
          player.y,
          (weapon.radius || 110) * 0.7,
          damage * 0.6,
          0.5,
          castElement
        );
        break;
      case "corrosion_laser":
        if (target) {
          this.spawnBeam(
            weaponId,
            player.x,
            player.y,
            target.x,
            target.y,
            (weapon.range || 450) + level * 12,
            (weapon.beamWidth || 22) + level * 1.5,
            damage,
            0.16,
            castElement
          );
          this.spawnBeam(
            weaponId,
            player.x,
            player.y,
            target.x + 20,
            target.y - 20,
            weapon.range || 450,
            (weapon.beamWidth || 22) * 0.65,
            damage * 0.6,
            0.16,
            castElement
          );
        }
        break;
      case "solar_laser":
        if (target) {
          this.spawnBeam(
            weaponId,
            player.x,
            player.y,
            target.x,
            target.y,
            (weapon.range || 500) + level * 14,
            (weapon.beamWidth || 20) + level,
            damage,
            0.13,
            castElement
          );
          this.spawnCircleArea(weaponId, target.x, target.y, 48 + level * 5, damage * 0.7, 0.2, castElement);
        }
        break;
      case "flame_punch":
        this.castPunch(
          weaponId,
          player,
          target,
          weapon.range || 150,
          (weapon.radius || 80) + level * 5,
          damage,
          castElement
        );
        this.spawnCircleArea(weaponId, player.x, player.y, 55 + level * 4, damage * 0.45, 0.12, castElement);
        break;
      case "storm_punch":
        this.castPunch(
          weaponId,
          player,
          target,
          weapon.range || 150,
          (weapon.radius || 76) + level * 4,
          damage,
          castElement
        );
        if (target) {
          this.spawnCircleArea(weaponId, target.x, target.y, 45, damage * 0.65, 0.15, castElement);
        }
        break;
      case "prism_laser":
        if (target) {
          this.spawnPrismLaser(
            weaponId,
            player.x,
            player.y,
            target.x,
            target.y,
            (weapon.range || 420) + level * 8,
            weapon.beamWidth || 12,
            damage,
            castElement
          );
        }
        break;
      case "shadow_daggers":
        if (target) {
          this.spawnFanProjectiles(
            weaponId,
            player.x,
            player.y,
            target.x,
            target.y,
            damage,
            level,
            weapon.shots || 5,
            0.42,
            castElement
          );
        }
        break;
      default:
        break;
    }

    effectSystem.burst(player.x, player.y, weapon.color, 3);
  }

  private pickElement(player: Player): ElementType | undefined {
    if (player.elements.size <= 0) {
      return undefined;
    }

    const elements = Array.from(player.elements);
    const element = elements[this.elementCursor % elements.length];
    this.elementCursor += 1;
    return element;
  }

  private spawnProjectileToward(
    weaponId: string,
    x: number,
    y: number,
    tx: number,
    ty: number,
    damage: number,
    level: number,
    element?: ElementType,
    speedOffset = 0,
    splashRadius?: number
  ): void {
    const weapon = ConfigManager.getInstance().getWeapon(weaponId);
    const dir = normalize({ x: tx - x, y: ty - y });
    const speed = (weapon.speed || 300) + level * 18 + speedOffset;

    this.projectiles.push({
      id: attackAutoId++,
      weaponId,
      x,
      y,
      vx: dir.x * speed,
      vy: dir.y * speed,
      radius: (weapon.projectileRadius || 6) + level * 0.35,
      damage,
      life: weapon.life || 1.2,
      color: weapon.color,
      pierce: (weapon.pierce ?? 0) + Math.floor(level / 3),
      splashRadius,
      element,
      hitIds: new Set<number>()
    });
  }

  private spawnFanProjectiles(
    weaponId: string,
    x: number,
    y: number,
    tx: number,
    ty: number,
    damage: number,
    level: number,
    count: number,
    spread: number,
    element?: ElementType
  ): void {
    const weapon = ConfigManager.getInstance().getWeapon(weaponId);
    const dir = normalize({ x: tx - x, y: ty - y });
    const baseAngle = Math.atan2(dir.y, dir.x);
    const totalSpread = spread * (count - 1);

    for (let i = 0; i < count; i += 1) {
      const angle = baseAngle - totalSpread * 0.5 + spread * i;
      const speed = (weapon.speed || 340) + level * 16;
      this.projectiles.push({
        id: attackAutoId++,
        weaponId,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: (weapon.projectileRadius || 5) + level * 0.25,
        damage: damage * 0.72,
        life: weapon.life || 1.2,
        color: weapon.color,
        pierce: (weapon.pierce || 1) + 1,
        splashRadius: weapon.pattern === "chain_fireball" ? 58 + level * 6 : undefined,
        element,
        hitIds: new Set<number>()
      });
    }
  }

  private spawnCircleArea(
    weaponId: string,
    x: number,
    y: number,
    radius: number,
    damage: number,
    life: number,
    element?: ElementType
  ): void {
    const weapon = ConfigManager.getInstance().getWeapon(weaponId);
    this.areas.push({
      id: attackAutoId++,
      weaponId,
      shape: "circle",
      x,
      y,
      radius,
      damage,
      life,
      color: weapon.color,
      element,
      hitIds: new Set<number>()
    });
  }

  private castPunch(
    weaponId: string,
    player: Player,
    target: Enemy | null,
    forwardDistance: number,
    radius: number,
    damage: number,
    element?: ElementType
  ): void {
    let dir: Vec2;
    if (target) {
      dir = normalize({ x: target.x - player.x, y: target.y - player.y });
    } else {
      dir = normalize(player.lastMoveDir);
      if (dir.x === 0 && dir.y === 0) {
        dir = { x: 1, y: 0 };
      }
    }

    const cx = player.x + dir.x * forwardDistance * 0.6;
    const cy = player.y + dir.y * forwardDistance * 0.6;
    this.spawnCircleArea(weaponId, cx, cy, radius, damage, 0.14, element);
  }

  private spawnBeam(
    weaponId: string,
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    range: number,
    width: number,
    damage: number,
    life: number,
    element?: ElementType
  ): void {
    const dir = normalize({ x: tx - sx, y: ty - sy });
    const endX = sx + dir.x * range;
    const endY = sy + dir.y * range;

    const weapon = ConfigManager.getInstance().getWeapon(weaponId);
    this.areas.push({
      id: attackAutoId++,
      weaponId,
      shape: "line",
      x: sx,
      y: sy,
      x2: endX,
      y2: endY,
      width,
      damage,
      life,
      color: weapon.color,
      element,
      hitIds: new Set<number>()
    });
  }

  private spawnPrismLaser(
    weaponId: string,
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    range: number,
    width: number,
    damage: number,
    element?: ElementType
  ): void {
    const dir = normalize({ x: tx - sx, y: ty - sy });
    const angle = Math.atan2(dir.y, dir.x);
    const offsets = [-0.22, 0, 0.22];
    for (const offset of offsets) {
      const a = angle + offset;
      const endX = sx + Math.cos(a) * range;
      const endY = sy + Math.sin(a) * range;
      this.areas.push({
        id: attackAutoId++,
        weaponId,
        shape: "line",
        x: sx,
        y: sy,
        x2: endX,
        y2: endY,
        width,
        damage: damage * (offset === 0 ? 1 : 0.7),
        life: 0.15,
        color: ConfigManager.getInstance().getWeapon(weaponId).color,
        element,
        hitIds: new Set<number>()
      });
    }
  }

  private findNearestEnemy(x: number, y: number, enemies: Enemy[]): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = Number.MAX_VALUE;
    for (const enemy of enemies) {
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        best = enemy;
      }
    }
    return best;
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateAreas(dt: number): void {
    for (let i = this.areas.length - 1; i >= 0; i -= 1) {
      const area = this.areas[i];
      area.life -= dt;
      if (area.life <= 0) {
        this.areas.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.projectiles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      if (p.element) {
        const elementColor = this.getElementColor(p.element);
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = elementColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    for (const area of this.areas) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = area.color;
      ctx.fillStyle = area.color;

      if (area.shape === "circle") {
        ctx.beginPath();
        ctx.arc(area.x, area.y, area.radius || 10, 0, Math.PI * 2);
        ctx.fill();
      } else if (area.shape === "line") {
        ctx.lineWidth = area.width || 10;
        ctx.beginPath();
        ctx.moveTo(area.x, area.y);
        ctx.lineTo(area.x2 || area.x, area.y2 || area.y);
        ctx.stroke();
      }

      if (area.element) {
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = this.getElementColor(area.element);
        if (area.shape === "circle") {
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(area.x, area.y, area.radius || 10, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  private getElementColor(element: ElementType): string {
    if (element === "fire") {
      return "#ff8b54";
    }
    if (element === "ice") {
      return "#7fd9ff";
    }
    if (element === "lightning") {
      return "#ffe06b";
    }
    return "#82ff9f";
  }
}
