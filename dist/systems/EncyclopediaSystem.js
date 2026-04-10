"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncyclopediaSystem = void 0;
const ConfigManager_1 = require("../managers/ConfigManager");
const SaveManager_1 = require("../managers/SaveManager");
/**
 * Read-only helper for evolution collection UI.
 */
class EncyclopediaSystem {
    constructor() {
        this.config = ConfigManager_1.ConfigManager.getInstance();
        this.save = SaveManager_1.SaveManager.getInstance();
    }
    getEntries() {
        return this.config.getAllEvolutionRules().map((rule) => ({
            id: rule.id,
            name: rule.name,
            description: rule.description,
            unlocked: this.save.isEvolutionUnlocked(rule.id),
            color: rule.color
        }));
    }
    unlockAllDebug() {
        const allIds = this.config.getAllEvolutionRules().map((rule) => rule.id);
        this.save.unlockAllEvolutionDebug(allIds);
    }
}
exports.EncyclopediaSystem = EncyclopediaSystem;
