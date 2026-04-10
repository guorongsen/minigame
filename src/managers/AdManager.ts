import { AdGateResult, AdPlacement } from "../types";
import { ConfigManager } from "./ConfigManager";

type AdListener = (placement: AdPlacement, state: "start" | "success" | "fail") => void;

/**
 * Mock ad layer for business logic integration.
 */
export class AdManager {
  private static instance: AdManager;
  private listeners: AdListener[] = [];
  private playing = false;
  private nextForcedResult: boolean | null = null;
  private lastShownTimestampByPlacement: Partial<Record<AdPlacement, number>> = {};

  static getInstance(): AdManager {
    if (!AdManager.instance) {
      AdManager.instance = new AdManager();
    }
    return AdManager.instance;
  }

  addListener(listener: AdListener): void {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener);
    }
  }

  removeListener(listener: AdListener): void {
    this.listeners = this.listeners.filter((item) => item !== listener);
  }

  isPlaying(): boolean {
    return this.playing;
  }

  forceNextResult(success: boolean): void {
    this.nextForcedResult = success;
  }

  resetRunState(): void {
    this.lastShownTimestampByPlacement = {};
  }

  canShowRewardedVideo(placement: AdPlacement, runTimeSec: number): AdGateResult {
    if (this.playing) {
      return { ok: false, reason: "playing" };
    }

    const rules = ConfigManager.getInstance().getBalance().adPlacementRules?.[placement];
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

  async showRewardedVideo(placement: AdPlacement, runTimeSec = 0): Promise<boolean> {
    const gate = this.canShowRewardedVideo(placement, runTimeSec);
    if (!gate.ok) {
      return false;
    }

    this.playing = true;
    this.lastShownTimestampByPlacement[placement] = Date.now();
    this.emit(placement, "start");

    const successRate = ConfigManager.getInstance().getBalance().adSuccessRate;
    const result = await new Promise<boolean>((resolve) => {
      setTimeout(() => {
        let success: boolean;
        if (this.nextForcedResult !== null) {
          success = this.nextForcedResult;
          this.nextForcedResult = null;
        } else {
          success = Math.random() < successRate;
        }
        resolve(success);
      }, 900 + Math.random() * 500);
    });

    this.playing = false;
    this.emit(placement, result ? "success" : "fail");
    return result;
  }

  private emit(placement: AdPlacement, state: "start" | "success" | "fail"): void {
    for (const listener of this.listeners) {
      listener(placement, state);
    }
  }
}
