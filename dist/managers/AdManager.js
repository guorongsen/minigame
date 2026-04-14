"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdManager = void 0;
const ConfigManager_1 = require("./ConfigManager");
/**
 * Rewarded ad manager with real-wx integration and mock fallback.
 */
class AdManager {
    constructor() {
        this.listeners = [];
        this.playing = false;
        this.nextForcedResult = null;
        this.lastShownTimestampByPlacement = {};
        this.rewardedAdByPlacement = {};
        this.realAdTimeoutMs = 42000;
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
        const config = this.getAdRuntimeConfig();
        const hasRealSupport = this.hasWxRewardedVideoSupport();
        const canUseReal = hasRealSupport && !!this.getAdUnitId(placement);
        if (config.mode === "disabled") {
            return {
                ok: false,
                reason: "disabled"
            };
        }
        if (config.mode === "real" && !canUseReal && !config.allowMockFallback) {
            return {
                ok: false,
                reason: hasRealSupport ? "ad_unit_missing" : "unsupported"
            };
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
        const config = this.getAdRuntimeConfig();
        const realResult = await this.playRealRewardedVideo(placement);
        let result = realResult;
        if (result === null) {
            if (config.mode === "disabled") {
                result = false;
            }
            else if (config.mode === "real" && !config.allowMockFallback) {
                result = false;
            }
            else {
                result = await this.playMockRewardedVideo();
            }
        }
        this.playing = false;
        this.emit(placement, result ? "success" : "fail");
        return result;
    }
    async playRealRewardedVideo(placement) {
        const config = this.getAdRuntimeConfig();
        if (config.mode === "mock" || config.mode === "disabled") {
            return null;
        }
        const adUnitId = this.getAdUnitId(placement);
        if (!adUnitId || !this.hasWxRewardedVideoSupport()) {
            return null;
        }
        const ad = this.getOrCreateRewardedAd(placement, adUnitId);
        if (!ad) {
            return null;
        }
        return new Promise((resolve) => {
            var _a, _b, _c;
            let settled = false;
            let timerId = 0;
            const cleanup = () => {
                var _a, _b;
                if (timerId) {
                    clearTimeout(timerId);
                    timerId = 0;
                }
                try {
                    (_a = ad.offClose) === null || _a === void 0 ? void 0 : _a.call(ad, onClose);
                }
                catch (error) {
                    // Ignore listener detach errors.
                }
                try {
                    (_b = ad.offError) === null || _b === void 0 ? void 0 : _b.call(ad, onError);
                }
                catch (error) {
                    // Ignore listener detach errors.
                }
            };
            const finish = (ok) => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                resolve(ok);
            };
            const onClose = (res) => {
                const ended = !res || typeof res.isEnded === "undefined" || !!res.isEnded;
                finish(ended);
            };
            const onError = () => {
                finish(false);
            };
            try {
                (_a = ad.onClose) === null || _a === void 0 ? void 0 : _a.call(ad, onClose);
                (_b = ad.onError) === null || _b === void 0 ? void 0 : _b.call(ad, onError);
            }
            catch (error) {
                finish(false);
                return;
            }
            timerId = setTimeout(() => finish(false), this.realAdTimeoutMs);
            Promise.resolve((_c = ad.load) === null || _c === void 0 ? void 0 : _c.call(ad))
                .catch(() => undefined)
                .then(() => { var _a; return Promise.resolve((_a = ad.show) === null || _a === void 0 ? void 0 : _a.call(ad)); })
                .catch(() => { var _a; return Promise.resolve((_a = ad.load) === null || _a === void 0 ? void 0 : _a.call(ad)).then(() => { var _a; return Promise.resolve((_a = ad.show) === null || _a === void 0 ? void 0 : _a.call(ad)); }); })
                .catch(() => {
                finish(false);
            });
        });
    }
    async playMockRewardedVideo() {
        const successRate = ConfigManager_1.ConfigManager.getInstance().getBalance().adSuccessRate;
        return new Promise((resolve) => {
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
    }
    hasWxRewardedVideoSupport() {
        return typeof (wx === null || wx === void 0 ? void 0 : wx.createRewardedVideoAd) === "function";
    }
    getAdUnitId(placement) {
        const raw = this.getAdRuntimeConfig().adUnitIdByPlacement[placement];
        return typeof raw === "string" ? raw.trim() : "";
    }
    getOrCreateRewardedAd(placement, adUnitId) {
        const cache = this.rewardedAdByPlacement[placement];
        if (cache && cache.__adUnitId === adUnitId) {
            return cache;
        }
        try {
            const created = wx.createRewardedVideoAd({
                adUnitId
            });
            if (!created) {
                return null;
            }
            created.__adUnitId = adUnitId;
            this.rewardedAdByPlacement[placement] = created;
            return created;
        }
        catch (error) {
            return null;
        }
    }
    getAdRuntimeConfig() {
        const balance = ConfigManager_1.ConfigManager.getInstance().getBalance();
        const rawMode = balance.adRuntimeMode;
        let mode = "mock";
        if (rawMode === "real" || rawMode === "auto" || rawMode === "mock" || rawMode === "disabled") {
            mode = rawMode;
        }
        const adUnitIdByPlacement = {};
        const rawMap = balance.adUnitIdByPlacement || {};
        const placements = ["revive", "chestBoost", "startBuff", "extraUpgrade", "doubleReward"];
        for (const placement of placements) {
            const value = rawMap[placement];
            if (typeof value === "string") {
                adUnitIdByPlacement[placement] = value.trim();
            }
        }
        return {
            mode,
            allowMockFallback: balance.adMockFallbackOnError !== false,
            adUnitIdByPlacement
        };
    }
    emit(placement, state) {
        for (const listener of this.listeners) {
            listener(placement, state);
        }
    }
}
exports.AdManager = AdManager;
