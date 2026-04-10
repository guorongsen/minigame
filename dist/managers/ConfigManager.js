"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const enemyConfig_1 = require("../Data/enemyConfig");
const elementConfig_1 = require("../Data/elementConfig");
const evolutionConfig_1 = require("../Data/evolutionConfig");
const dailyChallengeConfig_1 = require("../Data/dailyChallengeConfig");
const characterMutationConfig_1 = require("../Data/characterMutationConfig");
const upgradeConfig_1 = require("../Data/upgradeConfig");
const weaponConfig_1 = require("../Data/weaponConfig");
/**
 * Centralized read-only game data registry.
 */
class ConfigManager {
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    getWeapon(id) {
        return weaponConfig_1.weaponConfigMap[id];
    }
    getAllWeapons() {
        return weaponConfig_1.weaponConfigList;
    }
    getBaseWeaponIds() {
        return weaponConfig_1.baseWeaponIds;
    }
    getElement(id) {
        return elementConfig_1.elementConfigMap[id];
    }
    getAllElements() {
        return elementConfig_1.elementConfigList;
    }
    getAllEvolutionRules() {
        return evolutionConfig_1.evolutionConfigList;
    }
    getDailyChallengeTemplates() {
        return dailyChallengeConfig_1.dailyChallengeTemplates;
    }
    getCharacterMutationGenes() {
        return characterMutationConfig_1.characterMutationGenes;
    }
    getCharacterMutationFusions() {
        return characterMutationConfig_1.characterMutationFusions;
    }
    getEnemyPool() {
        return enemyConfig_1.enemyConfigList;
    }
    getBossConfig() {
        return enemyConfig_1.bossConfig;
    }
    getUpgradeDefinitions() {
        return upgradeConfig_1.upgradeDefinitions;
    }
    getCategoryBaseWeight() {
        return upgradeConfig_1.categoryBaseWeight;
    }
    getMaxWeaponsInRun() {
        return upgradeConfig_1.maxWeaponsInRun;
    }
    getLevelExp(level) {
        if (level < upgradeConfig_1.levelExpTable.length) {
            return upgradeConfig_1.levelExpTable[level];
        }
        const extra = level - (upgradeConfig_1.levelExpTable.length - 1);
        return upgradeConfig_1.levelExpTable[upgradeConfig_1.levelExpTable.length - 1] + extra * 80;
    }
    getBalance() {
        return upgradeConfig_1.gameBalanceConfig;
    }
}
exports.ConfigManager = ConfigManager;
