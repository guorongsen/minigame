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

        this.castWeapon(baseId, weaponId, level, player, enemies, effectSystem);
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
    baseWeaponId: string,
    weaponId: string,
    level: number,
    player: Player,
    enemies: Enemy[],
    effectSystem: EffectSystem
  ): void {
    const weapon = ConfigManager.getInstance().getWeapon(weaponId);
    const baseMul = player.getDamageMultiplier();
    const weaponMul = player.getWeaponDamageMultiplier(baseWeaponId);
    const damage = this.calcDamage(weapon.damage, level, baseMul * weaponMul);
    const target = this.findNearestEnemy(player.x, player.y, enemies);
    const castElement = this.pickElement(player);
    const splitThrow = player.hasWeaponSkill(baseWeaponId, "split_throw");
    const pierceEdge = player.hasWeaponSkill(baseWeaponId, "pierce_edge");
    const blastCore = player.hasWeaponSkill(baseWeaponId, "blast_core");
    const twinCast = player.hasWeaponSkill(baseWeaponId, "twin_cast");
    const echoWave = player.hasWeaponSkill(baseWeaponId, "echo_wave");
    const wideField = player.hasWeaponSkill(baseWeaponId, "wide_field");
    const focusBeam = player.hasWeaponSkill(baseWeaponId, "focus_beam");
    const sideBeam = player.hasWeaponSkill(baseWeaponId, "side_beam");
    const comboStrike = player.hasWeaponSkill(baseWeaponId, "combo_strike");
    const guardWave = player.hasWeaponSkill(baseWeaponId, "guard_wave");
    const swiftThrow = player.hasWeaponSkill(baseWeaponId, "swift_throw");
    const giantBlade = player.hasWeaponSkill(baseWeaponId, "giant_blade");
    const phantomOrbit = player.hasWeaponSkill(baseWeaponId, "phantom_orbit");
    const ignitionBoost = player.hasWeaponSkill(baseWeaponId, "ignition_boost");
    const magmaPool = player.hasWeaponSkill(baseWeaponId, "magma_pool");
    const meteorSwarm = player.hasWeaponSkill(baseWeaponId, "meteor_swarm");
    const seismicForce = player.hasWeaponSkill(baseWeaponId, "seismic_force");
    const pulseChain = player.hasWeaponSkill(baseWeaponId, "pulse_chain");
    const gravityWell = player.hasWeaponSkill(baseWeaponId, "gravity_well");
    const overchargeCore = player.hasWeaponSkill(baseWeaponId, "overcharge_core");
    const longOptics = player.hasWeaponSkill(baseWeaponId, "long_optics");
    const prismBurst = player.hasWeaponSkill(baseWeaponId, "prism_burst");
    const heavyFist = player.hasWeaponSkill(baseWeaponId, "heavy_fist");
    const dashDrive = player.hasWeaponSkill(baseWeaponId, "dash_drive");
    const quakeKnuckle = player.hasWeaponSkill(baseWeaponId, "quake_knuckle");
    const extraPierce = pierceEdge ? 1 : 0;
    const knifeDamageMul = giantBlade ? 1.12 : 1;
    const knifeSpeedOffset = swiftThrow ? 64 : 0;
    const fireDamageMul = ignitionBoost ? 1.12 : 1;
    const fireSpeedOffset = ignitionBoost ? 36 : 0;
    const shockDamageMul = seismicForce ? 1.12 : 1;
    const laserDamageMul = overchargeCore ? 1.12 : 1;
    const laserRangeMul = longOptics ? 1.18 : 1;
    const punchDamageMul = heavyFist ? 1.12 : 1;
    const punchRangeMul = dashDrive ? 1.15 : 1;
    const punchRadiusMul = heavyFist ? 1.14 : 1;

    switch (weapon.pattern) {
      case "knife":
        if (target) {
          const knifeDamage = damage * knifeDamageMul;
          if (splitThrow) {
            this.spawnFanProjectiles(
              weaponId,
              player.x,
              player.y,
              target.x,
              target.y,
              knifeDamage,
              level,
              3,
              0.2,
              castElement,
              extraPierce,
              knifeSpeedOffset
            );
          } else {
            this.spawnProjectileToward(
              weaponId,
              player.x,
              player.y,
              target.x,
              target.y,
              knifeDamage,
              level,
              castElement,
              knifeSpeedOffset,
              undefined,
              extraPierce
            );
          }
          if (phantomOrbit) {
            this.spawnCircleArea(weaponId, player.x, player.y, 30 + level * 1.2, knifeDamage * 0.32, 0.16, castElement);
          }
        }
        break;
      case "fireball":
        if (target) {
          const fireDamage = damage * fireDamageMul;
          const splash = (46 + level * 6) * (blastCore ? 1.25 : 1);
          this.spawnProjectileToward(
            weaponId,
            player.x,
            player.y,
            target.x,
            target.y,
            fireDamage,
            level,
            castElement,
            fireSpeedOffset,
            splash
          );
          if (twinCast) {
            const dir = normalize({ x: target.x - player.x, y: target.y - player.y });
            const side = Math.sin(this.orbitAngle * 3) >= 0 ? 1 : -1;
            this.spawnProjectileToward(
              weaponId,
              player.x,
              player.y,
              target.x - dir.y * 42 * side,
              target.y + dir.x * 42 * side,
              fireDamage * 0.62,
              level,
              castElement,
              -24 + fireSpeedOffset,
              splash * 0.74
            );
          }
          if (meteorSwarm) {
            const dir = normalize({ x: target.x - player.x, y: target.y - player.y });
            for (const side of [-1, 1]) {
              this.spawnProjectileToward(
                weaponId,
                player.x,
                player.y,
                target.x + dir.y * 50 * side,
                target.y - dir.x * 50 * side,
                fireDamage * 0.46,
                level,
                castElement,
                -18 + fireSpeedOffset,
                splash * 0.66
              );
            }
          }
          if (magmaPool) {
            this.spawnCircleArea(weaponId, target.x, target.y, 30 + level * 2.4, fireDamage * 0.28, 0.38, castElement);
          }
        }
        break;
      case "shockwave":
        {
          const shockDamage = damage * shockDamageMul;
          const radiusMul = wideField ? 1.2 : 1;
          const radius = ((weapon.radius || 90) + level * 10) * radiusMul;
          this.spawnCircleArea(weaponId, player.x, player.y, radius, shockDamage, 0.18, castElement);
          if (echoWave) {
            this.spawnCircleArea(weaponId, player.x, player.y, radius * 0.66, shockDamage * 0.55, 0.24, castElement);
          }
          if (pulseChain) {
            this.spawnCircleArea(weaponId, player.x, player.y, radius * 0.52, shockDamage * 0.34, 0.2, castElement);
            this.spawnCircleArea(weaponId, player.x, player.y, radius * 0.82, shockDamage * 0.3, 0.26, castElement);
          }
          if (gravityWell) {
            this.spawnCircleArea(weaponId, player.x, player.y, radius * 0.44, shockDamage * 0.26, 0.5, castElement);
          }
        }
        break;
      case "laser":
        if (target) {
          const range = ((weapon.range || 360) + level * 10) * laserRangeMul;
          const width = ((weapon.beamWidth || 16) + level) * (focusBeam ? 1.16 : 1);
          const beamDamage = damage * (focusBeam ? 1.08 : 1) * laserDamageMul;
          this.spawnBeam(weaponId, player.x, player.y, target.x, target.y, range, width, beamDamage, 0.12, castElement);
          if (sideBeam) {
            const dir = normalize({ x: target.x - player.x, y: target.y - player.y });
            const angle = Math.atan2(dir.y, dir.x);
            const sideAngles = [angle - 0.2, angle + 0.2];
            for (const a of sideAngles) {
              this.spawnBeam(
                weaponId,
                player.x,
                player.y,
                player.x + Math.cos(a) * range,
                player.y + Math.sin(a) * range,
                range,
                width * 0.72,
                beamDamage * 0.5,
                0.12,
                castElement
              );
            }
          }
          if (prismBurst) {
            this.spawnCircleArea(weaponId, target.x, target.y, 32 + level * 2.4, beamDamage * 0.4, 0.18, castElement);
          }
        }
        break;
      case "punch":
        {
        const punchDamage = damage * punchDamageMul;
        const forwardDistance = (weapon.range || 100) * punchRangeMul;
        const radius = ((weapon.radius || 52) + level * 4) * punchRadiusMul;
        this.castPunch(
          weaponId,
          player,
          target,
          forwardDistance,
          radius,
          punchDamage,
          castElement
        );
        if (comboStrike && target) {
          this.castPunch(
            weaponId,
            player,
            target,
            forwardDistance * 0.92,
            radius * 0.82,
            punchDamage * 0.56,
            castElement
          );
        }
        if (guardWave) {
          this.spawnCircleArea(
            weaponId,
            player.x,
            player.y,
            radius * 0.72,
            punchDamage * 0.4,
            0.12,
            castElement
          );
        }
        if (quakeKnuckle) {
          const quakeX = target ? target.x : player.x;
          const quakeY = target ? target.y : player.y;
          this.spawnCircleArea(weaponId, quakeX, quakeY, radius * 0.72, punchDamage * 0.44, 0.14, castElement);
        }
        }
        break;
      case "blade_storm":
        {
        const stormDamage = damage * knifeDamageMul;
        const stormRadius = 26 * (giantBlade ? 1.14 : 1);
        for (let i = 0; i < 4; i += 1) {
          const angle = this.orbitAngle + i * (Math.PI / 2);
          const px = player.x + Math.cos(angle) * 70;
          const py = player.y + Math.sin(angle) * 70;
          this.spawnCircleArea(weaponId, px, py, stormRadius, stormDamage, 0.24, castElement);
        }
        if (phantomOrbit) {
          this.spawnCircleArea(weaponId, player.x, player.y, 36, stormDamage * 0.36, 0.16, castElement);
        }
        if (guardWave) {
          this.spawnCircleArea(weaponId, player.x, player.y, 42, stormDamage * 0.32, 0.14, castElement);
        }
        }
        break;
      case "arc_knives":
        if (target) {
          const arcCount = (splitThrow ? 5 : 3) + (phantomOrbit ? 1 : 0);
          this.spawnFanProjectiles(
            weaponId,
            player.x,
            player.y,
            target.x,
            target.y,
            damage * knifeDamageMul,
            level,
            arcCount,
            0.26,
            castElement,
            extraPierce,
            knifeSpeedOffset
          );
        }
        break;
      case "chain_fireball":
        if (target) {
          const fireDamage = damage * fireDamageMul;
          const splash = (70 + level * 8) * (blastCore ? 1.22 : 1);
          this.spawnProjectileToward(
            weaponId,
            player.x,
            player.y,
            target.x,
            target.y,
            fireDamage,
            level,
            castElement,
            fireSpeedOffset,
            splash
          );
          if (twinCast) {
            this.spawnProjectileToward(
              weaponId,
              player.x,
              player.y,
              target.x + 28,
              target.y - 20,
              fireDamage * 0.6,
              level,
              castElement,
              -18 + fireSpeedOffset,
              splash * 0.74
            );
          }
          if (meteorSwarm) {
            for (const side of [-1, 1]) {
              this.spawnProjectileToward(
                weaponId,
                player.x,
                player.y,
                target.x + 42 * side,
                target.y - 12 * side,
                fireDamage * 0.42,
                level,
                castElement,
                -26 + fireSpeedOffset,
                splash * 0.64
              );
            }
          }
          if (magmaPool) {
            this.spawnCircleArea(weaponId, target.x, target.y, 34 + level * 2.6, fireDamage * 0.3, 0.42, castElement);
          }
        }
        break;
      case "frostfire_orb":
        if (target) {
          const fireDamage = damage * fireDamageMul;
          const splash = (82 + level * 9) * (blastCore ? 1.2 : 1);
          this.spawnProjectileToward(
            weaponId,
            player.x,
            player.y,
            target.x,
            target.y,
            fireDamage,
            level,
            castElement,
            -70 + fireSpeedOffset,
            splash
          );
          if (twinCast) {
            this.spawnProjectileToward(
              weaponId,
              player.x,
              player.y,
              target.x - 24,
              target.y + 24,
              fireDamage * 0.62,
              level,
              castElement,
              -96 + fireSpeedOffset,
              splash * 0.74
            );
          }
          if (meteorSwarm) {
            for (const side of [-1, 1]) {
              this.spawnProjectileToward(
                weaponId,
                player.x,
                player.y,
                target.x + 36 * side,
                target.y + 18 * side,
                fireDamage * 0.4,
                level,
                castElement,
                -110 + fireSpeedOffset,
                splash * 0.6
              );
            }
          }
          if (magmaPool) {
            this.spawnCircleArea(weaponId, target.x, target.y, 36 + level * 2.8, fireDamage * 0.28, 0.46, castElement);
          }
        }
        break;
      case "ice_quake":
        {
          const shockDamage = damage * shockDamageMul;
          const radiusMul = wideField ? 1.18 : 1;
          const radius = ((weapon.radius || 130) + level * 12) * radiusMul;
          this.spawnCircleArea(weaponId, player.x, player.y, radius, shockDamage, 0.2, castElement);
          this.spawnCircleArea(weaponId, player.x, player.y, radius * 0.6, shockDamage * 0.7, 0.3, castElement);
          if (echoWave) {
            this.spawnCircleArea(weaponId, player.x, player.y, radius * 0.82, shockDamage * 0.44, 0.3, castElement);
          }
          if (pulseChain) {
            this.spawnCircleArea(weaponId, player.x, player.y, radius * 0.46, shockDamage * 0.32, 0.2, castElement);
            this.spawnCircleArea(weaponId, player.x, player.y, radius * 0.9, shockDamage * 0.3, 0.32, castElement);
          }
          if (gravityWell) {
            this.spawnCircleArea(weaponId, player.x, player.y, radius * 0.4, shockDamage * 0.24, 0.54, castElement);
          }
        }
        break;
      case "toxic_wave":
        {
          const shockDamage = damage * shockDamageMul;
          const radiusMul = wideField ? 1.18 : 1;
          const radius = ((weapon.radius || 110) + level * 8) * radiusMul;
          this.spawnCircleArea(weaponId, player.x, player.y, radius, shockDamage, 0.22, castElement);
          this.spawnCircleArea(weaponId, player.x, player.y, radius * 0.7, shockDamage * 0.6, 0.5, castElement);
          if (echoWave) {
            this.spawnCircleArea(weaponId, player.x, player.y, radius * 0.52, shockDamage * 0.4, 0.3, castElement);
          }
          if (pulseChain) {
            this.spawnCircleArea(weaponId, player.x, player.y, radius * 0.86, shockDamage * 0.3, 0.28, castElement);
          }
          if (gravityWell) {
            this.spawnCircleArea(weaponId, player.x, player.y, radius * 0.42, shockDamage * 0.26, 0.56, castElement);
          }
        }
        break;
      case "corrosion_laser":
        if (target) {
          const range = ((weapon.range || 450) + level * 12) * laserRangeMul;
          const width = ((weapon.beamWidth || 22) + level * 1.5) * (focusBeam ? 1.14 : 1);
          const beamDamage = damage * (focusBeam ? 1.06 : 1) * laserDamageMul;
          this.spawnBeam(weaponId, player.x, player.y, target.x, target.y, range, width, beamDamage, 0.16, castElement);
          this.spawnBeam(
            weaponId,
            player.x,
            player.y,
            target.x + 20,
            target.y - 20,
            (weapon.range || 450) * laserRangeMul,
            width * 0.65,
            beamDamage * 0.6,
            0.16,
            castElement
          );
          if (sideBeam) {
            const dir = normalize({ x: target.x - player.x, y: target.y - player.y });
            const angle = Math.atan2(dir.y, dir.x);
            for (const side of [-0.24, 0.24]) {
              const a = angle + side;
              this.spawnBeam(
                weaponId,
                player.x,
                player.y,
                player.x + Math.cos(a) * range,
                player.y + Math.sin(a) * range,
                range,
                width * 0.58,
                beamDamage * 0.36,
                0.16,
                castElement
              );
            }
          }
          if (prismBurst) {
            this.spawnCircleArea(weaponId, target.x, target.y, 38 + level * 2.6, beamDamage * 0.38, 0.2, castElement);
          }
        }
        break;
      case "solar_laser":
        if (target) {
          const range = ((weapon.range || 500) + level * 14) * laserRangeMul;
          const width = ((weapon.beamWidth || 20) + level) * (focusBeam ? 1.14 : 1);
          const beamDamage = damage * (focusBeam ? 1.08 : 1) * laserDamageMul;
          this.spawnBeam(weaponId, player.x, player.y, target.x, target.y, range, width, beamDamage, 0.13, castElement);
          this.spawnCircleArea(weaponId, target.x, target.y, 48 + level * 5, damage * 0.56, 0.18, castElement);
          if (sideBeam) {
            const dir = normalize({ x: target.x - player.x, y: target.y - player.y });
            const angle = Math.atan2(dir.y, dir.x);
            for (const side of [-0.22, 0.22]) {
              const a = angle + side;
              this.spawnBeam(
                weaponId,
                player.x,
                player.y,
                player.x + Math.cos(a) * range,
                player.y + Math.sin(a) * range,
                range,
                width * 0.62,
                beamDamage * 0.42,
                0.13,
                castElement
              );
            }
          }
          if (prismBurst) {
            this.spawnCircleArea(weaponId, target.x, target.y, 44 + level * 3, beamDamage * 0.4, 0.2, castElement);
          }
        }
        break;
      case "flame_punch":
        {
        const punchDamage = damage * punchDamageMul;
        const forwardDistance = (weapon.range || 150) * punchRangeMul;
        const radius = ((weapon.radius || 80) + level * 5) * punchRadiusMul;
        this.castPunch(
          weaponId,
          player,
          target,
          forwardDistance,
          radius,
          punchDamage,
          castElement
        );
        this.spawnCircleArea(weaponId, player.x, player.y, 55 + level * 4, punchDamage * 0.45, 0.12, castElement);
        if (comboStrike && target) {
          this.castPunch(
            weaponId,
            player,
            target,
            forwardDistance * 0.86,
            radius * 0.8,
            punchDamage * 0.54,
            castElement
          );
        }
        if (guardWave) {
          this.spawnCircleArea(weaponId, player.x, player.y, 48 + level * 3, punchDamage * 0.38, 0.12, castElement);
        }
        if (quakeKnuckle) {
          const quakeX = target ? target.x : player.x;
          const quakeY = target ? target.y : player.y;
          this.spawnCircleArea(weaponId, quakeX, quakeY, radius * 0.68, punchDamage * 0.44, 0.14, castElement);
        }
        }
        break;
      case "storm_punch":
        {
        const punchDamage = damage * punchDamageMul;
        const forwardDistance = (weapon.range || 150) * punchRangeMul;
        const radius = ((weapon.radius || 76) + level * 4) * punchRadiusMul;
        this.castPunch(
          weaponId,
          player,
          target,
          forwardDistance,
          radius,
          punchDamage,
          castElement
        );
        if (target) {
          this.spawnCircleArea(weaponId, target.x, target.y, 45, punchDamage * 0.55, 0.14, castElement);
        }
        if (comboStrike && target) {
          this.castPunch(
            weaponId,
            player,
            target,
            forwardDistance * 0.9,
            radius * 0.82,
            punchDamage * 0.54,
            castElement
          );
        }
        if (guardWave) {
          this.spawnCircleArea(weaponId, player.x, player.y, 42 + level * 3, punchDamage * 0.38, 0.11, castElement);
        }
        if (quakeKnuckle) {
          const quakeX = target ? target.x : player.x;
          const quakeY = target ? target.y : player.y;
          this.spawnCircleArea(weaponId, quakeX, quakeY, radius * 0.66, punchDamage * 0.46, 0.14, castElement);
        }
        }
        break;
      case "prism_laser":
        if (target) {
          const range = ((weapon.range || 420) + level * 8) * laserRangeMul;
          const width = (weapon.beamWidth || 12) * (focusBeam ? 1.16 : 1);
          const beamDamage = damage * (focusBeam ? 1.08 : 1) * laserDamageMul;
          this.spawnPrismLaser(weaponId, player.x, player.y, target.x, target.y, range, width, beamDamage, castElement);
          if (sideBeam) {
            this.spawnBeam(
              weaponId,
              player.x,
              player.y,
              target.x + 38,
              target.y + 18,
              range,
              width * 0.7,
              beamDamage * 0.4,
              0.15,
              castElement
            );
          }
          if (prismBurst) {
            this.spawnCircleArea(weaponId, target.x, target.y, 36 + level * 2.6, beamDamage * 0.38, 0.18, castElement);
          }
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
            damage * knifeDamageMul,
            level,
            (weapon.shots || 5) + (splitThrow ? 2 : 0),
            0.42,
            castElement,
            extraPierce,
            knifeSpeedOffset
          );
          if (phantomOrbit) {
            this.spawnCircleArea(weaponId, player.x, player.y, 32 + level * 1.6, damage * knifeDamageMul * 0.3, 0.16, castElement);
          }
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
    splashRadius?: number,
    extraPierce = 0
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
      pierce: (weapon.pierce ?? 0) + Math.floor(level / 3) + Math.max(0, extraPierce),
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
    element?: ElementType,
    extraPierce = 0,
    speedOffset = 0
  ): void {
    const weapon = ConfigManager.getInstance().getWeapon(weaponId);
    const dir = normalize({ x: tx - x, y: ty - y });
    const baseAngle = Math.atan2(dir.y, dir.x);
    const totalSpread = spread * (count - 1);

    for (let i = 0; i < count; i += 1) {
      const angle = baseAngle - totalSpread * 0.5 + spread * i;
      const speed = (weapon.speed || 340) + level * 16 + speedOffset;
      this.projectiles.push({
        id: attackAutoId++,
        weaponId,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: (weapon.projectileRadius || 5) + level * 0.25,
        damage: damage * 0.66,
        life: weapon.life || 1.2,
        color: weapon.color,
        pierce: (weapon.pierce || 1) + 1 + Math.max(0, extraPierce),
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
        this.removeProjectileAt(i);
      }
    }
  }

  private updateAreas(dt: number): void {
    for (let i = this.areas.length - 1; i >= 0; i -= 1) {
      const area = this.areas[i];
      area.life -= dt;
      if (area.life <= 0) {
        this.removeAreaAt(i);
      }
    }
  }

  private removeProjectileAt(index: number): void {
    if (index < 0 || index >= this.projectiles.length) {
      return;
    }
    const lastIndex = this.projectiles.length - 1;
    if (index !== lastIndex) {
      this.projectiles[index] = this.projectiles[lastIndex];
    }
    this.projectiles.pop();
  }

  private removeAreaAt(index: number): void {
    if (index < 0 || index >= this.areas.length) {
      return;
    }
    const lastIndex = this.areas.length - 1;
    if (index !== lastIndex) {
      this.areas[index] = this.areas[lastIndex];
    }
    this.areas.pop();
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
