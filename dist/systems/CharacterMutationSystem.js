"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CharacterMutationSystem = void 0;
const ConfigManager_1 = require("../managers/ConfigManager");
/**
 * Character mutation fusion system: checks gene combinations and applies fused effects.
 */
class CharacterMutationSystem {
    constructor() {
        this.cfg = ConfigManager_1.ConfigManager.getInstance();
    }
    tryFuse(player) {
        for (const rule of this.cfg.getCharacterMutationFusions()) {
            if (player.hasCharacterFusion(rule.id)) {
                continue;
            }
            const ready = rule.requiresGeneIds.every((geneId) => player.hasMutationGene(geneId));
            if (!ready) {
                continue;
            }
            player.applyCharacterFusion(rule.id, rule.effects);
            return rule;
        }
        return null;
    }
}
exports.CharacterMutationSystem = CharacterMutationSystem;
