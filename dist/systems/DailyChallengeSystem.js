"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyChallengeSystem = void 0;
const ConfigManager_1 = require("../managers/ConfigManager");
/**
 * Generates deterministic daily challenge from date.
 */
class DailyChallengeSystem {
    constructor() {
        this.cfg = ConfigManager_1.ConfigManager.getInstance();
    }
    getDateKey(now = new Date()) {
        const y = now.getFullYear();
        const m = `${now.getMonth() + 1}`.padStart(2, "0");
        const d = `${now.getDate()}`.padStart(2, "0");
        return `${y}-${m}-${d}`;
    }
    getTodayChallenge(now = new Date()) {
        const dateKey = this.getDateKey(now);
        return this.getChallengeByDateKey(dateKey);
    }
    getChallengeByDateKey(dateKey) {
        const templates = this.cfg.getDailyChallengeTemplates();
        if (templates.length <= 0) {
            return {
                id: "daily_fallback",
                name: "每日试炼",
                description: "生存到目标时间并击败首领。",
                color: "#9fd6ff",
                targetSurviveSeconds: 170,
                bossTime: 100,
                enemyHpMul: 1,
                enemySpeedMul: 1,
                spawnIntervalMul: 1,
                rewardBonusDna: 150
            };
        }
        const seed = this.getDateSeed(dateKey);
        const index = seed % templates.length;
        return templates[index];
    }
    getDateSeed(dateKey) {
        const digits = dateKey.replace(/-/g, "");
        const n = Number(digits);
        if (Number.isFinite(n) && n > 0) {
            return Math.floor(n);
        }
        let hash = 0;
        for (let i = 0; i < dateKey.length; i += 1) {
            hash = (hash * 131 + dateKey.charCodeAt(i)) >>> 0;
        }
        return hash;
    }
}
exports.DailyChallengeSystem = DailyChallengeSystem;
