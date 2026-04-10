"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdManager = void 0;
const ConfigManager_1 = require("./ConfigManager");
/**
 * Mock ad layer for business logic integration.
 */
class AdManager {
    constructor() {
        this.listeners = [];
        this.playing = false;
        this.nextForcedResult = null;
        this.lastShownTimestampByPlacement = {};
    }
    static getInstance() {
        if (!AdManager.instance) {
            AdManager.instance = new AdManager();
        }
        return AdManager.instance;
    }
    addListener(listener) {
        if (this.listeners.indexOf(listener) < 0) {
            this.listeners.push(listener);
        }
    }
    removeListener(listener) {
        this.listeners = this.listeners.filter((item) => item !== listener);
    }
    isPlaying() {
        return this.playing;
    }
    forceNextResult(success) {
        this.nextForcedResult = success;
    }
    resetRunState() {
        this.lastShownTimestampByPlacement = {};
    }
    canShowRewardedVideo(placement, runTimeSec) {
        var _a;
        if (this.playing) {
            return { ok: false, reason: "playing" };
        }
        const rules = (_a = ConfigManager_1.ConfigManager.getInstance().getBalance().adPlacementRules) === null || _a === void 0 ? void 0 : _a[placement];
        if (!rules) {
            return { ok: true };
        }
        if (runTimeSec < rules.minRunTime) {
            return {
                ok: false,
                reason: "min_run_time",
                remainSeconds: Math.max(0, rules.minRunTime - runTimeSec)
            };
        }
        const lastTs = this.lastShownTimestampByPlacement[placement];
        if (lastTs && rules.cooldown > 0) {
            const elapsed = (Date.now() - lastTs) / 1000;
            const remain = rules.cooldown - elapsed;
            if (remain > 0) {
                return {
                    ok: false,
                    reason: "cooldown",
                    remainSeconds: remain
                };
            }
        }
        return { ok: true };
    }
    async showRewardedVideo(placement, runTimeSec = 0) {
        const gate = this.canShowRewardedVideo(placement, runTimeSec);
        if (!gate.ok) {
            return false;
        }
        this.playing = true;
        this.lastShownTimestampByPlacement[placement] = Date.now();
        this.emit(placement, "start");
        const successRate = ConfigManager_1.ConfigManager.getInstance().getBalance().adSuccessRate;
        const result = await new Promise((resolve) => {
            setTimeout(() => {
                let success;
                if (this.nextForcedResult !== null) {
                    success = this.nextForcedResult;
                    this.nextForcedResult = null;
                }
                else {
                    success = Math.random() < successRate;
                }
                resolve(success);
            }, 900 + Math.random() * 500);
        });
        this.playing = false;
        this.emit(placement, result ? "success" : "fail");
        return result;
    }
    emit(placement, state) {
        for (const listener of this.listeners) {
            listener(placement, state);
        }
    }
}
exports.AdManager = AdManager;
