"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollisionSystem = void 0;
/**
 * Resolves combat collisions among attacks, enemies and player.
 */
class CollisionSystem {
    resolve(player, enemies, projectiles, areas, contactInterval) {
        const killedEnemies = [];
        for (let pIndex = projectiles.length - 1; pIndex >= 0; pIndex -= 1) {
            const p = projectiles[pIndex];
            if (!p) {
                continue;
            }
            let removeProjectile = false;
            for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex -= 1) {
                const enemy = enemies[eIndex];
                if (!enemy) {
                    continue;
                }
                if (p.hitIds.has(enemy.id)) {
                    continue;
                }
                const dx = p.x - enemy.x;
                const dy = p.y - enemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > p.radius + enemy.radius) {
                    continue;
                }
                p.hitIds.add(enemy.id);
                if (p.element) {
                    enemy.applyElementEffect(p.element, p.damage);
                }
                if (enemy.applyDamage(p.damage)) {
                    killedEnemies.push(enemy);
                    enemies.splice(eIndex, 1);
                }
                if (p.element === "lightning") {
                    this.applyLightningChain(enemies, enemy, p.damage * 0.44, killedEnemies);
                }
                if (p.splashRadius && p.splashRadius > 0) {
                    this.applySplashDamage(enemies, p.x, p.y, p.splashRadius, p.damage * 0.62, p.element, killedEnemies);
                }
                p.pierce -= 1;
                if (p.pierce < 0) {
                    removeProjectile = true;
                    break;
                }
            }
            if (removeProjectile) {
                projectiles.splice(pIndex, 1);
            }
        }
        for (const area of areas) {
            if (!area) {
                continue;
            }
            for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex -= 1) {
                const enemy = enemies[eIndex];
                if (!enemy) {
                    continue;
                }
                if (area.hitIds.has(enemy.id)) {
                    continue;
                }
                let hit = false;
                if (area.shape === "circle") {
                    const dx = area.x - enemy.x;
                    const dy = area.y - enemy.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    hit = dist <= (area.radius || 0) + enemy.radius;
                }
                else {
                    hit =
                        this.distancePointToLine(enemy.x, enemy.y, area.x, area.y, area.x2 || area.x, area.y2 || area.y) <=
                            (area.width || 12) * 0.5 + enemy.radius;
                }
                if (!hit) {
                    continue;
                }
                area.hitIds.add(enemy.id);
                if (area.element) {
                    enemy.applyElementEffect(area.element, area.damage);
                }
                if (enemy.applyDamage(area.damage)) {
                    killedEnemies.push(enemy);
                    enemies.splice(eIndex, 1);
                }
                if (area.element === "lightning") {
                    this.applyLightningChain(enemies, enemy, area.damage * 0.4, killedEnemies);
                }
            }
        }
        let playerDamageTaken = 0;
        for (const enemy of enemies) {
            if (!enemy) {
                continue;
            }
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= enemy.radius + player.radius && enemy.canContact()) {
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
    applyLightningChain(enemies, source, damage, killedEnemies) {
        const targets = enemies
            .filter((enemy) => enemy && enemy.id !== source.id)
            .map((enemy) => {
            const dx = enemy.x - source.x;
            const dy = enemy.y - source.y;
            return {
                enemy,
                dist: Math.sqrt(dx * dx + dy * dy)
            };
        })
            .filter((item) => item.dist <= 120)
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 2);
        for (const item of targets) {
            item.enemy.applyElementEffect("lightning", damage);
            if (item.enemy.applyDamage(damage)) {
                const removed = this.removeEnemy(enemies, item.enemy.id);
                if (removed) {
                    killedEnemies.push(removed);
                }
            }
        }
    }
    applySplashDamage(enemies, x, y, radius, damage, element, killedEnemies) {
        for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex -= 1) {
            const enemy = enemies[eIndex];
            if (!enemy) {
                continue;
            }
            const dx = x - enemy.x;
            const dy = y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius + enemy.radius) {
                if (element) {
                    enemy.applyElementEffect(element, damage);
                }
                if (enemy.applyDamage(damage)) {
                    killedEnemies.push(enemy);
                    enemies.splice(eIndex, 1);
                }
            }
        }
    }
    removeEnemy(enemies, id) {
        const index = enemies.findIndex((item) => item.id === id);
        if (index < 0) {
            return null;
        }
        const [removed] = enemies.splice(index, 1);
        return removed || null;
    }
    distancePointToLine(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) {
            const ex = px - x1;
            const ey = py - y1;
            return Math.sqrt(ex * ex + ey * ey);
        }
        let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const cx = x1 + dx * t;
        const cy = y1 + dy * t;
        const ex = px - cx;
        const ey = py - cy;
        return Math.sqrt(ex * ex + ey * ey);
    }
}
exports.CollisionSystem = CollisionSystem;
