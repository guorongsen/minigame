"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainLoop = void 0;
/**
 * Fixed heartbeat driven by requestAnimationFrame.
 */
class MainLoop {
    constructor(updateFn, renderFn, onFrameError) {
        this.updateFn = updateFn;
        this.renderFn = renderFn;
        this.onFrameError = onFrameError;
        this.running = false;
        this.lastTime = 0;
        this.rafId = 0;
    }
    start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.lastTime = Date.now();
        this.rafId = requestAnimationFrame(() => this.tick());
    }
    stop() {
        this.running = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = 0;
        }
    }
    tick() {
        var _a, _b;
        if (!this.running) {
            return;
        }
        const now = Date.now();
        const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
        this.lastTime = now;
        try {
            this.updateFn(dt);
        }
        catch (error) {
            (_a = this.onFrameError) === null || _a === void 0 ? void 0 : _a.call(this, "update", error);
        }
        try {
            this.renderFn();
        }
        catch (error) {
            (_b = this.onFrameError) === null || _b === void 0 ? void 0 : _b.call(this, "render", error);
        }
        this.rafId = requestAnimationFrame(() => this.tick());
    }
}
exports.MainLoop = MainLoop;
