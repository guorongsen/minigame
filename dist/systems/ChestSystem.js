"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChestSystem = void 0;
let chestAutoId = 1;
/**
 * Spawns and resolves chest pickups.
 */
class ChestSystem {
    constructor() {
        this.chests = [];
    }
    clear() {
        this.chests.length = 0;
    }
    spawnChest(x, y) {
        this.chests.push({
            id: chestAutoId++,
            x,
            y,
            radius: 14,
            life: 35,
            opened: false
        });
    }
    onEnemyKilled(x, y, isBoss, isElite, baseChance, bossBonus) {
        if (isElite || isBoss) {
            this.spawnChest(x, y);
            return;
        }
        const chance = isBoss ? Math.min(1, baseChance + bossBonus) : baseChance;
        if (Math.random() < chance) {
            this.spawnChest(x, y);
        }
    }
    update(dt) {
        for (let i = this.chests.length - 1; i >= 0; i -= 1) {
            const chest = this.chests[i];
            chest.life -= dt;
            if (chest.life <= 0 || chest.opened) {
                this.chests.splice(i, 1);
            }
        }
    }
    tryPickup(player) {
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
    render(ctx) {
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
exports.ChestSystem = ChestSystem;
