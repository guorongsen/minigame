"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Game = void 0;
const InputManager_1 = require("./core/InputManager");
const MainLoop_1 = require("./core/MainLoop");
const SceneManager_1 = require("./core/SceneManager");
const AnalyticsManager_1 = require("./managers/AnalyticsManager");
const AntiAddictionManager_1 = require("./managers/AntiAddictionManager");
const SaveManager_1 = require("./managers/SaveManager");
const UIManager_1 = require("./managers/UIManager");
const BattleScene_1 = require("./scenes/BattleScene");
/**
 * Application bootstrap and runtime wiring.
 */
class Game {
    constructor() {
        this.analytics = AnalyticsManager_1.AnalyticsManager.getInstance();
        this.antiAddiction = AntiAddictionManager_1.AntiAddictionManager.getInstance();
        this.frameErrorCount = 0;
        this.frameErrorWindowStart = 0;
        this.recoveringFromFrameError = false;
        try {
            SaveManager_1.SaveManager.getInstance().load();
        }
        catch (error) {
            // Save load has internal fallback, but keep constructor resilient.
        }
        this.analytics.load();
        this.antiAddiction.init();
        const systemInfo = wx.getSystemInfoSync();
        this.width = systemInfo.windowWidth;
        this.height = systemInfo.windowHeight;
        const globalCanvas = globalThis.canvas;
        this.canvas = globalCanvas || wx.createCanvas();
        this.canvas.width = this.width * systemInfo.pixelRatio;
        this.canvas.height = this.height * systemInfo.pixelRatio;
        this.ctx = this.canvas.getContext("2d");
        this.ctx.scale(systemInfo.pixelRatio, systemInfo.pixelRatio);
        this.sceneManager = new SceneManager_1.SceneManager();
        this.inputManager = new InputManager_1.InputManager(this.sceneManager);
        this.inputManager.setMoveSensitivity(SaveManager_1.SaveManager.getInstance().getSettings().moveSensitivity);
        this.uiManager = new UIManager_1.UIManager();
        const battleScene = new BattleScene_1.BattleScene(this.width, this.height, this.inputManager, this.uiManager);
        this.sceneManager.setScene(battleScene);
        this.mainLoop = new MainLoop_1.MainLoop((dt) => this.update(dt), () => this.render(), (phase, error) => this.onFrameError(phase, error));
        this.inputManager.init();
        this.bindLifecycle();
        this.bindRuntimeGuards();
    }
    start() {
        this.mainLoop.start();
    }
    update(dt) {
        this.sceneManager.update(dt);
    }
    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.sceneManager.render(this.ctx);
    }
    bindLifecycle() {
        wx.onHide(() => {
            this.antiAddiction.onHide();
            this.mainLoop.stop();
        });
        wx.onShow(() => {
            this.antiAddiction.onShow();
            this.mainLoop.start();
        });
    }
    bindRuntimeGuards() {
        if (typeof (wx === null || wx === void 0 ? void 0 : wx.onError) === "function") {
            wx.onError((error) => {
                this.analytics.logEvent("runtime_error", {
                    source: "wx_onError",
                    message: this.stringifyError(error)
                });
            });
        }
        if (typeof (wx === null || wx === void 0 ? void 0 : wx.onUnhandledRejection) === "function") {
            wx.onUnhandledRejection((res) => {
                this.analytics.logEvent("runtime_error", {
                    source: "wx_onUnhandledRejection",
                    message: this.stringifyError((res === null || res === void 0 ? void 0 : res.reason) || res)
                });
            });
        }
        if (typeof (wx === null || wx === void 0 ? void 0 : wx.onMemoryWarning) === "function") {
            wx.onMemoryWarning((res) => {
                this.analytics.logEvent("memory_warning", {
                    level: typeof (res === null || res === void 0 ? void 0 : res.level) === "number" ? res.level : -1
                });
            });
        }
    }
    onFrameError(phase, error) {
        const now = Date.now();
        if (now - this.frameErrorWindowStart > 10000) {
            this.frameErrorWindowStart = now;
            this.frameErrorCount = 0;
        }
        this.frameErrorCount += 1;
        this.analytics.logEvent("runtime_frame_error", {
            phase,
            countInWindow: this.frameErrorCount,
            message: this.stringifyError(error)
        });
        if (this.frameErrorCount >= 10 && !this.recoveringFromFrameError) {
            this.recoveringFromFrameError = true;
            this.mainLoop.stop();
            try {
                wx.showToast({
                    title: "检测到异常，正在恢复",
                    icon: "none",
                    duration: 1200
                });
            }
            catch (toastError) {
                // Ignore unavailable toast api.
            }
            setTimeout(() => {
                this.frameErrorCount = 0;
                this.frameErrorWindowStart = Date.now();
                this.recoveringFromFrameError = false;
                this.mainLoop.start();
            }, 900);
        }
    }
    stringifyError(error) {
        if (!error) {
            return "unknown";
        }
        if (typeof error === "string") {
            return error;
        }
        if (typeof error.message === "string") {
            return error.message;
        }
        try {
            return JSON.stringify(error);
        }
        catch (jsonError) {
            return String(error);
        }
    }
}
exports.Game = Game;
