interface AnalyticsEvent {
  id: number;
  event: string;
  ts: number;
  runId: number;
  runTime: number;
  payload?: Record<string, any>;
}

const ANALYTICS_KEY = "evolution_survivor_analytics_v1";

/**
 * Lightweight telemetry logger for MVP validation.
 */
export class AnalyticsManager {
  private static instance: AnalyticsManager;

  private events: AnalyticsEvent[] = [];
  private runId = 0;
  private runStartTs = 0;
  private nextId = 1;
  private readonly maxEvents = 1800;

  static getInstance(): AnalyticsManager {
    if (!AnalyticsManager.instance) {
      AnalyticsManager.instance = new AnalyticsManager();
    }
    return AnalyticsManager.instance;
  }

  load(): void {
    try {
      const raw = wx.getStorageSync(ANALYTICS_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.events)) {
        this.events = parsed.events;
      }
      if (typeof parsed?.runId === "number") {
        this.runId = parsed.runId;
      }
      const maxExistingId = this.events.reduce((max, item) => Math.max(max, item.id || 0), 0);
      this.nextId = maxExistingId + 1;
    } catch (error) {
      this.events = [];
    }
  }

  startRun(payload?: Record<string, any>): void {
    this.runId += 1;
    this.runStartTs = Date.now();
    this.logEvent("run_start", payload);
  }

  endRun(payload?: Record<string, any>): void {
    this.logEvent("run_end", payload);
    this.runStartTs = 0;
    this.persist();
  }

  logEvent(event: string, payload?: Record<string, any>): void {
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

  getEventCount(): number {
    return this.events.length;
  }

  exportText(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        total: this.events.length,
        runId: this.runId,
        events: this.events
      },
      null,
      2
    );
  }

  async copyToClipboard(text: string): Promise<boolean> {
    try {
      await new Promise<void>((resolve, reject) => {
        wx.setClipboardData({
          data: text,
          success: () => resolve(),
          fail: () => reject(new Error("clipboard fail"))
        });
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  clear(): void {
    this.events = [];
    this.nextId = 1;
    this.persist();
  }

  private persist(): void {
    try {
      wx.setStorageSync(
        ANALYTICS_KEY,
        JSON.stringify({
          runId: this.runId,
          events: this.events
        })
      );
    } catch (error) {
      // Ignore storage write errors for MVP.
    }
  }
}
