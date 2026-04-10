"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvolutionSystem = void 0;
const ConfigManager_1 = require("../managers/ConfigManager");
const SaveManager_1 = require("../managers/SaveManager");
/**
 * Checks evolution rules and performs weapon replacement.
 */
class EvolutionSystem {
    constructor() {
        this.rules = ConfigManager_1.ConfigManager.getInstance().getAllEvolutionRules();
        this.saveManager = SaveManager_1.SaveManager.getInstance();
    }
    tryEvolve(player) {
        for (const baseId of player.ownedBaseWeaponIds) {
            const currentWeaponId = player.currentWeaponByBase[baseId];
            if (currentWeaponId !== baseId) {
                continue;
            }
            const matched = this.rules.find((rule) => {
                if (rule.fromWeaponId !== baseId) {
                    return false;
                }
                if (rule.requiredElement && !player.hasElement(rule.requiredElement)) {
                    return false;
                }
                if (rule.requiredWeaponLevel && player.getWeaponLevel(baseId) < rule.requiredWeaponLevel) {
                    return false;
                }
                return true;
            });
            if (matched) {
                player.evolveWeapon(baseId, matched.toWeaponId);
                this.saveManager.unlockEvolution(matched.id);
                return {
                    rule: matched,
                    fromWeaponId: baseId,
                    toWeaponId: matched.toWeaponId
                };
            }
        }
        return null;
    }
    getRules() {
        return this.rules;
    }
}
exports.EvolutionSystem = EvolutionSystem;
