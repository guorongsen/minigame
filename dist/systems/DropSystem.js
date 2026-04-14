"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropSystem = void 0;
let dropAutoId = 1;
/**
 * Handles exp orb lifecycle and pickup attraction.
 */
class DropSystem {
    constructor() {
        this.expOrbs = [];
    }
    spawnExp(x, y, value) {
        this.expOrbs.push({
            id: dropAutoId++,
            x,
            y,
            value,
            radius: 7,
            life: 20
        });
    }
    clear() {
        this.expOrbs.length = 0;
    }
    update(dt, player, pullSpeed) {
        let collectedExp = 0;
        const pullRadius = player.passives.pickupRange + 46;
        const pullRadiusSq = pullRadius * pullRadius;
        for (let i = this.expOrbs.length - 1; i >= 0; i -= 1) {
            const orb = this.expOrbs[i];
            orb.life -= dt;
            if (orb.life <= 0) {
                this.removeOrbAt(i);
                continue;
            }
            const dx = player.x - orb.x;
            const dy = player.y - orb.y;
            let distSq = dx * dx + dy * dy;
            if (distSq <= pullRadiusSq) {
                const dist = Math.sqrt(distSq) || 1;
                orb.x += (dx / dist) * pullSpeed * dt;
                orb.y += (dy / dist) * pullSpeed * dt;
                const ndx = player.x - orb.x;
                const ndy = player.y - orb.y;
                distSq = ndx * ndx + ndy * ndy;
            }
            const pickupRadius = player.radius + orb.radius + 3;
            if (distSq <= pickupRadius * pickupRadius) {
                collectedExp += orb.value;
                this.removeOrbAt(i);
            }
        }
        return collectedExp;
    }
    removeOrbAt(index) {
        if (index < 0 || index >= this.expOrbs.length) {
            return;
        }
        const last = this.expOrbs.length - 1;
        if (index !== last) {
            this.expOrbs[index] = this.expOrbs[last];
        }
        this.expOrbs.pop();
    }
    render(ctx) {
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
exports.DropSystem = DropSystem;
