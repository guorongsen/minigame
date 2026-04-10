"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsManager = void 0;
const ANALYTICS_KEY = "evolution_survivor_analytics_v1";
/**
 * Lightweight telemetry logger for MVP validation.
 */
class AnalyticsManager {
    constructor() {
        this.events = [];
        this.runId = 0;
        this.runStartTs = 0;
        this.nextId = 1;
        this.maxEvents = 1800;
    }
    static getInstance() {
        if (!AnalyticsManager.instance) {
            AnalyticsManager.instance = new AnalyticsManager();
        }
        return AnalyticsManager.instance;
    }
    load() {
        try {
            const raw = wx.getStorageSync(ANALYTICS_KEY);
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.events)) {
                this.events = parsed.events;
            }
            if (typeof (parsed === null || parsed === void 0 ? void 0 : parsed.runId) === "number") {
                this.runId = parsed.runId;
            }
            const maxExistingId = this.events.reduce((max, item) => Math.max(max, item.id || 0), 0);
            this.nextId = maxExistingId + 1;
        }
        catch (error) {
            this.events = [];
        }
    }
    startRun(payload) {
        this.runId += 1;
        this.runStartTs = Date.now();
        this.logEvent("run_start", payload);
    }
    endRun(payload) {
        this.logEvent("run_end", payload);
        this.runStartTs = 0;
        this.persist();
    }
    logEvent(event, payload) {
        const now = Date.now();
        const runTime = this.runStartTs > 0 ? (now - this.runStartTs) / 1000 : 0;
        this.events.push({
            id: this.nextId++,
            event,
            ts: now,
            runId: this.runId,
            runTime,
            payload
        });
        if (this.events.length > this.maxEvents) {
            this.events.splice(0, this.events.length - this.maxEvents);
        }
        if (this.events.length % 20 === 0) {
            this.persist();
        }
    }
    getEventCount() {
        return this.events.length;
    }
    exportText() {
        return JSON.stringify({
            exportedAt: new Date().toISOString(),
            total: this.events.length,
            runId: this.runId,
            events: this.events
        }, null, 2);
    }
    async copyToClipboard(text) {
        try {
            await new Promise((resolve, reject) => {
                wx.setClipboardData({
                    data: text,
                    success: () => resolve(),
                    fail: () => reject(new Error("clipboard fail"))
                });
            });
            return true;
        }
        catch (error) {
            return false;
        }
    }
    clear() {
        this.events = [];
        this.nextId = 1;
        this.persist();
    }
    persist() {
        try {
            wx.setStorageSync(ANALYTICS_KEY, JSON.stringify({
                runId: this.runId,
                events: this.events
            }));
        }
        catch (error) {
            // Ignore storage write errors for MVP.
        }
    }
}
exports.AnalyticsManager = AnalyticsManager;
