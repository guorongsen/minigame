"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Game = void 0;
const InputManager_1 = require("./core/InputManager");
const MainLoop_1 = require("./core/MainLoop");
const SceneManager_1 = require("./core/SceneManager");
const SaveManager_1 = require("./managers/SaveManager");
const UIManager_1 = require("./managers/UIManager");
const BattleScene_1 = require("./scenes/BattleScene");
/**
 * Application bootstrap and runtime wiring.
 */
class Game {
    constructor() {
        SaveManager_1.SaveManager.getInstance().load();
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
        this.uiManager = new UIManager_1.UIManager();
        const battleScene = new BattleScene_1.BattleScene(this.width, this.height, this.inputManager, this.uiManager);
        this.sceneManager.setScene(battleScene);
        this.mainLoop = new MainLoop_1.MainLoop((dt) => this.update(dt), () => this.render());
        this.inputManager.init();
        this.bindLifecycle();
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
            this.mainLoop.stop();
        });
        wx.onShow(() => {
            this.mainLoop.start();
        });
    }
}
exports.Game = Game;
