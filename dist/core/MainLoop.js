"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainLoop = void 0;
/**
 * Fixed heartbeat driven by requestAnimationFrame.
 */
class MainLoop {
    constructor(updateFn, renderFn) {
        this.updateFn = updateFn;
        this.renderFn = renderFn;
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
        if (!this.running) {
            return;
        }
        const now = Date.now();
        const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
        this.lastTime = now;
        this.updateFn(dt);
        this.renderFn();
        this.rafId = requestAnimationFrame(() => this.tick());
    }
}
exports.MainLoop = MainLoop;
