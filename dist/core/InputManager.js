"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputManager = void 0;
const MathUtil_1 = require("../utils/MathUtil");
/**
 * Converts touch events into movement vector and tap signals.
 */
class InputManager {
    constructor(sceneManager) {
        this.touching = false;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this.startTime = 0;
        this.moveVec = { x: 0, y: 0 };
        this.deadZone = 6;
        this.maxRadius = 60;
        this.moveSensitivity = 1;
        this.sceneManager = sceneManager;
    }
    init() {
        wx.onTouchStart((event) => this.handleTouchStart(event));
        wx.onTouchMove((event) => this.handleTouchMove(event));
        wx.onTouchEnd((event) => this.handleTouchEnd(event));
        wx.onTouchCancel((event) => this.handleTouchEnd(event));
    }
    getMoveVector() {
        return this.moveVec;
    }
    isTouching() {
        return this.touching;
    }
    getTouchPosition() {
        return { x: this.currentX, y: this.currentY };
    }
    setMoveSensitivity(value) {
        if (!Number.isFinite(value)) {
            return;
        }
        this.moveSensitivity = Math.max(0.7, Math.min(1.6, value));
    }
    handleTouchStart(event) {
        var _a;
        const point = this.readTouchPoint(event);
        if (!point) {
            return;
        }
        this.touching = true;
        this.startX = point.x;
        this.startY = point.y;
        this.currentX = point.x;
        this.currentY = point.y;
        this.startTime = Date.now();
        this.moveVec = { x: 0, y: 0 };
        const scene = this.sceneManager.getCurrentScene();
        (_a = scene === null || scene === void 0 ? void 0 : scene.onTouchStart) === null || _a === void 0 ? void 0 : _a.call(scene, point.x, point.y);
    }
    handleTouchMove(event) {
        var _a;
        if (!this.touching) {
            return;
        }
        const point = this.readTouchPoint(event);
        if (!point) {
            return;
        }
        this.currentX = point.x;
        this.currentY = point.y;
        const dx = this.currentX - this.startX;
        const dy = this.currentY - this.startY;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < this.deadZone) {
            this.moveVec = { x: 0, y: 0 };
        }
        else {
            const clamped = (0, MathUtil_1.clamp)(len, 0, this.maxRadius);
            const intensity = (0, MathUtil_1.clamp)((clamped / this.maxRadius) * this.moveSensitivity, 0, 1);
            this.moveVec = {
                x: (dx / len) * intensity,
                y: (dy / len) * intensity
            };
        }
        const scene = this.sceneManager.getCurrentScene();
        (_a = scene === null || scene === void 0 ? void 0 : scene.onTouchMove) === null || _a === void 0 ? void 0 : _a.call(scene, point.x, point.y);
    }
    handleTouchEnd(event) {
        var _a, _b;
        const point = this.readTouchPoint(event) || { x: this.currentX, y: this.currentY };
        const dt = Date.now() - this.startTime;
        const dx = point.x - this.startX;
        const dy = point.y - this.startY;
        const moved = Math.sqrt(dx * dx + dy * dy);
        const scene = this.sceneManager.getCurrentScene();
        (_a = scene === null || scene === void 0 ? void 0 : scene.onTouchEnd) === null || _a === void 0 ? void 0 : _a.call(scene, point.x, point.y);
        if (dt <= 220 && moved <= 12) {
            (_b = scene === null || scene === void 0 ? void 0 : scene.onTap) === null || _b === void 0 ? void 0 : _b.call(scene, point.x, point.y);
        }
        this.touching = false;
        this.moveVec = { x: 0, y: 0 };
    }
    readTouchPoint(event) {
        var _a, _b, _c, _d;
        const touch = ((event === null || event === void 0 ? void 0 : event.touches) && event.touches[0]) ||
            ((event === null || event === void 0 ? void 0 : event.changedTouches) && event.changedTouches[0]) ||
            null;
        if (!touch) {
            return null;
        }
        return {
            x: (_b = (_a = touch.clientX) !== null && _a !== void 0 ? _a : touch.x) !== null && _b !== void 0 ? _b : 0,
            y: (_d = (_c = touch.clientY) !== null && _c !== void 0 ? _c : touch.y) !== null && _d !== void 0 ? _d : 0
        };
    }
}
exports.InputManager = InputManager;
