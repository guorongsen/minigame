"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Enemy = void 0;
const MathUtil_1 = require("../utils/MathUtil");
let enemyAutoId = 1;
/**
 * Enemy actor with chase behavior, archetype behaviors and status effects.
 */
class Enemy {
    constructor(config, x, y, hpScale = 1, isElite = false) {
        this.x = 0;
        this.y = 0;
        this.contactCooldown = 0;
        this.burnTime = 0;
        this.burnDps = 0;
        this.poisonTime = 0;
        this.poisonDps = 0;
        this.slowTime = 0;
        this.slowRatio = 1;
        this.steerMemoryTime = 0;
        this.steerDirX = 0;
        this.steerDirY = 0;
        this.eliteChargeCooldown = 0;
        this.eliteChargeTime = 0;
        this.eliteChargeDirX = 0;
        this.eliteChargeDirY = 0;
        this.eliteRangedCooldown = 0;
        this.eliteRangedStrafeDir = 1;
        this.normalRangedCooldown = 0;
        this.normalRangedStrafeDir = 1;
        this.shieldHp = 0;
        this.shieldMax = 0;
        this.shieldRecoverDelay = 0;
        this.pendingActions = [];
        this.id = enemyAutoId++;
        this.typeId = config.id;
        this.isBoss = !!config.isBoss;
        this.isElite = isElite;
        this.archetype = this.resolveArchetype(config);
        this.x = x;
        this.y = y;
        const eliteHpMul = this.isElite ? 2.2 : 1;
        const eliteSpeedMul = this.isElite ? 1.18 : 1;
        const eliteDamageMul = this.isElite ? 1.35 : 1;
        const eliteExpMul = this.isElite ? 2.4 : 1;
        this.radius = config.radius * (this.isElite ? 1.14 : 1);
        this.maxHp = config.hp * hpScale * eliteHpMul;
        this.hp = this.maxHp;
        this.speed = config.speed * eliteSpeedMul;
        this.damage = config.damage * eliteDamageMul;
        this.expDrop = Math.round(config.expDrop * eliteExpMul);
        this.color = this.isElite ? this.toEliteColor(config.color) : config.color;
        if (this.archetype === "ranged" && !this.isElite) {
            this.normalRangedCooldown = (0, MathUtil_1.randomRange)(1.5, 2.4);
            this.normalRangedStrafeDir = Math.random() < 0.5 ? -1 : 1;
        }
        if (this.archetype === "shield") {
            const ratio = Math.max(0.2, Math.min(1.2, config.shieldRatio || 0.62));
            this.shieldMax = this.maxHp * ratio;
            this.shieldHp = this.shieldMax;
            this.shieldRecoverDelay = 1.3;
        }
        this.eliteBehavior = this.rollEliteBehavior();
        if (this.eliteBehavior === "charge") {
            this.eliteChargeCooldown = (0, MathUtil_1.randomRange)(1.6, 2.5);
        }
        else if (this.eliteBehavior === "ranged") {
            this.eliteRangedCooldown = (0, MathUtil_1.randomRange)(1.2, 1.9);
            this.eliteRangedStrafeDir = Math.random() < 0.5 ? -1 : 1;
        }
    }
    update(dt, targetX, targetY, blockChecker) {
        this.pendingActions.length = 0;
        if (this.steerMemoryTime > 0) {
            this.steerMemoryTime -= dt;
            if (this.steerMemoryTime <= 0) {
                this.steerMemoryTime = 0;
                this.steerDirX = 0;
                this.steerDirY = 0;
            }
        }
        this.updateShield(dt);
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        let dirX = dx / dist;
        let dirY = dy / dist;
        let moveSpeedMul = 1;
        if (this.eliteBehavior === "charge") {
            if (this.eliteChargeTime > 0) {
                this.eliteChargeTime -= dt;
                dirX = this.eliteChargeDirX;
                dirY = this.eliteChargeDirY;
                moveSpeedMul = 2.45;
            }
            else {
                this.eliteChargeCooldown -= dt;
                if (this.eliteChargeCooldown <= 0 && dist >= this.radius + 64) {
                    this.eliteChargeDirX = dx / dist;
                    this.eliteChargeDirY = dy / dist;
                    this.eliteChargeTime = (0, MathUtil_1.randomRange)(0.24, 0.34);
                    this.eliteChargeCooldown = (0, MathUtil_1.randomRange)(2.25, 3.05);
                    this.pendingActions.push({
                        type: "elite_charge_start",
                        x: this.x,
                        y: this.y,
                        color: "#ffd57d"
                    });
                    dirX = this.eliteChargeDirX;
                    dirY = this.eliteChargeDirY;
                    moveSpeedMul = 2.2;
                }
            }
        }
        else if (this.eliteBehavior === "ranged") {
            const keepDist = 190 + this.radius;
            const nearThreshold = keepDist - 20;
            const farThreshold = keepDist + 28;
            if (dist < nearThreshold) {
                dirX = -dx / dist;
                dirY = -dy / dist;
                moveSpeedMul = 1.12;
            }
            else if (dist > farThreshold) {
                dirX = dx / dist;
                dirY = dy / dist;
                moveSpeedMul = 1.05;
            }
            else {
                const strafeX = (-dy / dist) * this.eliteRangedStrafeDir;
                const strafeY = (dx / dist) * this.eliteRangedStrafeDir;
                const blendToward = 0.18;
                const mixedX = strafeX + (dx / dist) * blendToward;
                const mixedY = strafeY + (dy / dist) * blendToward;
                const mixedLen = Math.sqrt(mixedX * mixedX + mixedY * mixedY) || 1;
                dirX = mixedX / mixedLen;
                dirY = mixedY / mixedLen;
                if (Math.random() < dt * 0.6) {
                    this.eliteRangedStrafeDir *= -1;
                }
            }
            this.eliteRangedCooldown -= dt;
            if (this.eliteRangedCooldown <= 0) {
                this.eliteRangedCooldown = (0, MathUtil_1.randomRange)(1.95, 2.8);
                this.pendingActions.push({
                    type: "elite_ranged_shot",
                    x: targetX + (0, MathUtil_1.randomRange)(-32, 32),
                    y: targetY + (0, MathUtil_1.randomRange)(-32, 32),
                    radius: (0, MathUtil_1.randomRange)(48, 60),
                    windup: (0, MathUtil_1.randomRange)(0.52, 0.68),
                    damage: this.damage * (0, MathUtil_1.randomRange)(0.62, 0.82),
                    color: "#93efff"
                });
            }
        }
        else {
            if (this.archetype === "ranged") {
                const keepDist = 165 + this.radius;
                const nearThreshold = keepDist - 16;
                const farThreshold = keepDist + 26;
                if (dist < nearThreshold) {
                    dirX = -dx / dist;
                    dirY = -dy / dist;
                    moveSpeedMul = 1.08;
                }
                else if (dist > farThreshold) {
                    dirX = dx / dist;
                    dirY = dy / dist;
                    moveSpeedMul = 1.04;
                }
                else {
                    const strafeX = (-dy / dist) * this.normalRangedStrafeDir;
                    const strafeY = (dx / dist) * this.normalRangedStrafeDir;
                    const blendToward = 0.15;
                    const mixX = strafeX + (dx / dist) * blendToward;
                    const mixY = strafeY + (dy / dist) * blendToward;
                    const mixLen = Math.sqrt(mixX * mixX + mixY * mixY) || 1;
                    dirX = mixX / mixLen;
                    dirY = mixY / mixLen;
                    if (Math.random() < dt * 0.55) {
                        this.normalRangedStrafeDir *= -1;
                    }
                }
                this.normalRangedCooldown -= dt;
                if (this.normalRangedCooldown <= 0) {
                    this.normalRangedCooldown = (0, MathUtil_1.randomRange)(2.1, 3.1);
                    this.pendingActions.push({
                        type: "enemy_ranged_shot",
                        x: targetX + (0, MathUtil_1.randomRange)(-28, 28),
                        y: targetY + (0, MathUtil_1.randomRange)(-28, 28),
                        radius: (0, MathUtil_1.randomRange)(42, 54),
                        windup: (0, MathUtil_1.randomRange)(0.62, 0.78),
                        damage: this.damage * (0, MathUtil_1.randomRange)(0.62, 0.8),
                        color: "#9ad7ff"
                    });
                }
            }
            else if (this.archetype === "swift") {
                moveSpeedMul = dist >= this.radius + 42 ? 1.42 : 1.18;
                if (Math.random() < dt * 6.2) {
                    const jitter = (0, MathUtil_1.randomRange)(-0.42, 0.42);
                    const c = Math.cos(jitter);
                    const s = Math.sin(jitter);
                    const nx = dirX * c - dirY * s;
                    const ny = dirX * s + dirY * c;
                    const len = Math.sqrt(nx * nx + ny * ny) || 1;
                    dirX = nx / len;
                    dirY = ny / len;
                }
            }
            else if (this.archetype === "shield") {
                moveSpeedMul = 0.88;
            }
        }
        const moveSpeed = this.speed * this.getSlowRatio() * moveSpeedMul;
        if (blockChecker && moveSpeed > 0.1) {
            const step = moveSpeed * dt;
            const probeRadius = this.radius + 1.2;
            const straightX = this.x + dirX * step;
            const straightY = this.y + dirY * step;
            const straightBlocked = blockChecker(straightX, straightY, probeRadius);
            if (this.steerMemoryTime > 0) {
                const memX = this.x + this.steerDirX * step;
                const memY = this.y + this.steerDirY * step;
                const memoryBlocked = blockChecker(memX, memY, probeRadius);
                if (memoryBlocked) {
                    this.steerMemoryTime = 0;
                    this.steerDirX = 0;
                    this.steerDirY = 0;
                }
                else if (straightBlocked) {
                    dirX = this.steerDirX;
                    dirY = this.steerDirY;
                }
                else {
                    const blended = this.blendDir(dirX, dirY, this.steerDirX, this.steerDirY, 0.28);
                    dirX = blended.x;
                    dirY = blended.y;
                }
            }
            if (straightBlocked && this.steerMemoryTime <= 0) {
                const steer = this.findSteerDirection(dirX, dirY, step, blockChecker);
                dirX = steer.x;
                dirY = steer.y;
                if (dirX !== 0 || dirY !== 0) {
                    this.pushSteerMemory(dirX, dirY, 0.26 + Math.random() * 0.06);
                }
            }
        }
        this.x += dirX * moveSpeed * dt;
        this.y += dirY * moveSpeed * dt;
        if (this.contactCooldown > 0) {
            this.contactCooldown -= dt;
            if (this.contactCooldown < 0) {
                this.contactCooldown = 0;
            }
        }
    }
    drainActions() {
        if (this.pendingActions.length <= 0) {
            return [];
        }
        const out = this.pendingActions.slice();
        this.pendingActions.length = 0;
        return out;
    }
    getEliteBehavior() {
        return this.eliteBehavior;
    }
    getArchetype() {
        return this.archetype;
    }
    hasShield() {
        return this.shieldMax > 0;
    }
    getShieldRatio() {
        if (this.shieldMax <= 0) {
            return 0;
        }
        return Math.max(0, Math.min(1, this.shieldHp / this.shieldMax));
    }
    isShieldActive() {
        return this.shieldMax > 0 && this.shieldHp > 0;
    }
    updateStatus(dt) {
        let damage = 0;
        if (this.burnTime > 0) {
            const tick = Math.min(this.burnTime, dt);
            const dealt = this.burnDps * tick;
            this.hp -= dealt;
            damage += dealt;
            this.burnTime -= dt;
            if (this.burnTime <= 0) {
                this.burnTime = 0;
                this.burnDps = 0;
            }
        }
        if (this.poisonTime > 0) {
            const tick = Math.min(this.poisonTime, dt);
            const dealt = this.poisonDps * tick;
            this.hp -= dealt;
            damage += dealt;
            this.poisonTime -= dt;
            if (this.poisonTime <= 0) {
                this.poisonTime = 0;
                this.poisonDps = 0;
            }
        }
        if (this.slowTime > 0) {
            this.slowTime -= dt;
            if (this.slowTime <= 0) {
                this.slowTime = 0;
                this.slowRatio = 1;
            }
        }
        return damage;
    }
    applyElementEffect(element, baseDamage) {
        if (element === "fire") {
            this.applyBurn(2.4, baseDamage * 0.18);
            return;
        }
        if (element === "poison") {
            this.applyPoison(3.2, baseDamage * 0.14);
            return;
        }
        if (element === "ice") {
            this.applySlow(1.5, 0.72);
            return;
        }
        if (element === "lightning") {
            this.applySlow(0.55, 0.9);
        }
    }
    canContact() {
        return this.contactCooldown <= 0;
    }
    triggerContactCooldown(interval) {
        this.contactCooldown = interval;
    }
    applyDamage(amount) {
        if (amount <= 0) {
            return this.hp <= 0;
        }
        if (this.shieldHp > 0) {
            const shieldDamage = amount * 0.72;
            this.shieldHp -= shieldDamage;
            this.shieldRecoverDelay = 2.6;
            if (this.shieldHp < 0) {
                this.hp += this.shieldHp;
                this.shieldHp = 0;
            }
            return this.hp <= 0;
        }
        this.hp -= amount;
        if (this.shieldMax > 0) {
            this.shieldRecoverDelay = 2.6;
        }
        return this.hp <= 0;
    }
    isDead() {
        return this.hp <= 0;
    }
    getStatusOverlayColor() {
        if (this.burnTime > 0) {
            return "#ff9f66";
        }
        if (this.poisonTime > 0) {
            return "#8dff93";
        }
        if (this.slowTime > 0) {
            return "#9edbff";
        }
        return null;
    }
    resolveArchetype(config) {
        if (config.archetype) {
            return config.archetype;
        }
        if (config.id.indexOf("shield") >= 0 || config.id.indexOf("guard") >= 0) {
            return "shield";
        }
        if (config.id.indexOf("spitter") >= 0 || config.id.indexOf("ranged") >= 0) {
            return "ranged";
        }
        if (config.id.indexOf("hound") >= 0 || config.id.indexOf("swift") >= 0) {
            return "swift";
        }
        return "normal";
    }
    updateShield(dt) {
        if (this.shieldMax <= 0) {
            return;
        }
        if (this.shieldRecoverDelay > 0) {
            this.shieldRecoverDelay -= dt;
            if (this.shieldRecoverDelay < 0) {
                this.shieldRecoverDelay = 0;
            }
            return;
        }
        if (this.shieldHp < this.shieldMax) {
            const regen = this.shieldMax * 0.2 * dt;
            this.shieldHp = Math.min(this.shieldMax, this.shieldHp + regen);
        }
    }
    rollEliteBehavior() {
        if (!this.isElite) {
            return "none";
        }
        return Math.random() < 0.5 ? "charge" : "ranged";
    }
    findSteerDirection(baseDirX, baseDirY, step, blockChecker) {
        if (step <= 0.0001) {
            return { x: baseDirX, y: baseDirY };
        }
        const probeRadius = this.radius + 1.2;
        const straightX = this.x + baseDirX * step;
        const straightY = this.y + baseDirY * step;
        if (!blockChecker(straightX, straightY, probeRadius)) {
            return { x: baseDirX, y: baseDirY };
        }
        const angles = [22, -22, 38, -38, 56, -56, 78, -78, 104, -104, 132, -132, 162, -162];
        let best = null;
        let bestScore = -999;
        for (const angle of angles) {
            const rad = (angle * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const dirX = baseDirX * cos - baseDirY * sin;
            const dirY = baseDirX * sin + baseDirY * cos;
            const nextX = this.x + dirX * step;
            const nextY = this.y + dirY * step;
            if (blockChecker(nextX, nextY, probeRadius)) {
                continue;
            }
            const lookAheadX = this.x + dirX * step * 1.8;
            const lookAheadY = this.y + dirY * step * 1.8;
            const lookAheadBlocked = blockChecker(lookAheadX, lookAheadY, probeRadius);
            const alignment = dirX * baseDirX + dirY * baseDirY;
            const openness = lookAheadBlocked ? -0.35 : 0.2;
            const memoryAlign = this.steerMemoryTime > 0 ? dirX * this.steerDirX + dirY * this.steerDirY : 0;
            const score = alignment + openness + memoryAlign * 0.18 - Math.abs(angle) * 0.0016;
            if (score > bestScore) {
                bestScore = score;
                best = { x: dirX, y: dirY };
            }
        }
        if (best) {
            return best;
        }
        const retreatX = this.x - baseDirX * step * 0.7;
        const retreatY = this.y - baseDirY * step * 0.7;
        if (!blockChecker(retreatX, retreatY, probeRadius)) {
            return { x: -baseDirX, y: -baseDirY };
        }
        return { x: 0, y: 0 };
    }
    pushSteerMemory(dirX, dirY, duration) {
        const len = Math.sqrt(dirX * dirX + dirY * dirY);
        if (len <= 0.0001) {
            return;
        }
        this.steerDirX = dirX / len;
        this.steerDirY = dirY / len;
        this.steerMemoryTime = Math.max(this.steerMemoryTime, duration);
    }
    blendDir(baseX, baseY, memX, memY, memWeight) {
        const x = baseX * (1 - memWeight) + memX * memWeight;
        const y = baseY * (1 - memWeight) + memY * memWeight;
        const len = Math.sqrt(x * x + y * y);
        if (len <= 0.0001) {
            return { x: baseX, y: baseY };
        }
        return { x: x / len, y: y / len };
    }
    applyBurn(duration, dps) {
        this.burnTime = Math.max(this.burnTime, duration);
        this.burnDps = Math.max(this.burnDps, dps);
    }
    applyPoison(duration, dps) {
        this.poisonTime = Math.max(this.poisonTime, duration);
        this.poisonDps = Math.max(this.poisonDps, dps);
    }
    applySlow(duration, ratio) {
        this.slowTime = Math.max(this.slowTime, duration);
        this.slowRatio = Math.min(this.slowRatio, ratio);
    }
    getSlowRatio() {
        if (this.slowTime <= 0) {
            return 1;
        }
        return this.slowRatio;
    }
    toEliteColor(base) {
        if (base.startsWith("#") && base.length === 7) {
            const r = parseInt(base.slice(1, 3), 16);
            const g = parseInt(base.slice(3, 5), 16);
            const b = parseInt(base.slice(5, 7), 16);
            const nr = Math.min(255, Math.floor(r * 0.55 + 255 * 0.45));
            const ng = Math.min(255, Math.floor(g * 0.55 + 215 * 0.45));
            const nb = Math.min(255, Math.floor(b * 0.55 + 100 * 0.45));
            return `#${nr.toString(16).padStart(2, "0")}${ng
                .toString(16)
                .padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
        }
        return "#ffd26e";
    }
}
exports.Enemy = Enemy;
