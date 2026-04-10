"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneManager = void 0;
/**
 * Handles scene switching.
 */
class SceneManager {
    constructor() {
        this.currentScene = null;
    }
    setScene(scene) {
        var _a;
        if ((_a = this.currentScene) === null || _a === void 0 ? void 0 : _a.exit) {
            this.currentScene.exit();
        }
        this.currentScene = scene;
        if (this.currentScene.enter) {
            this.currentScene.enter();
        }
    }
    getCurrentScene() {
        return this.currentScene;
    }
    update(dt) {
        var _a;
        (_a = this.currentScene) === null || _a === void 0 ? void 0 : _a.update(dt);
    }
    render(ctx) {
        var _a;
        (_a = this.currentScene) === null || _a === void 0 ? void 0 : _a.render(ctx);
    }
}
exports.SceneManager = SceneManager;
