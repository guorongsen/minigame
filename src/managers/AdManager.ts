import { AdGateResult, AdPlacement } from "../types";
import { ConfigManager } from "./ConfigManager";

type AdListener = (placement: AdPlacement, state: "start" | "success" | "fail") => void;
type AdRuntimeMode = "mock" | "real" | "auto" | "disabled";

/**
 * Rewarded ad manager with real-wx integration and mock fallback.
 */
export class AdManager {
  private static instance: AdManager;
  private listeners: AdListener[] = [];
  private playing = false;
  private nextForcedResult: boolean | null = null;
  private lastShownTimestampByPlacement: Partial<Record<AdPlacement, number>> = {};
  private readonly rewardedAdByPlacement: Partial<Record<AdPlacement, any>> = {};
  private readonly realAdTimeoutMs = 42000;

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

    const config = this.getAdRuntimeConfig();
    const realResult = await this.playRealRewardedVideo(placement);
    let result = realResult;

    if (result === null) {
      if (config.mode === "disabled") {
        result = false;
      } else if (config.mode === "real" && !config.allowMockFallback) {
        result = false;
      } else {
        result = await this.playMockRewardedVideo();
      }
    }

    this.playing = false;
    this.emit(placement, result ? "success" : "fail");
    return result;
  }

  private async playRealRewardedVideo(placement: AdPlacement): Promise<boolean | null> {
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

    return new Promise<boolean>((resolve) => {
      let settled = false;
      let timerId = 0;

      const cleanup = () => {
        if (timerId) {
          clearTimeout(timerId);
          timerId = 0;
        }
        try {
          ad.offClose?.(onClose);
        } catch (error) {
          // Ignore listener detach errors.
        }
        try {
          ad.offError?.(onError);
        } catch (error) {
          // Ignore listener detach errors.
        }
      };

      const finish = (ok: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(ok);
      };

      const onClose = (res: any) => {
        const ended = !res || typeof res.isEnded === "undefined" || !!res.isEnded;
        finish(ended);
      };

      const onError = () => {
        finish(false);
      };

      try {
        ad.onClose?.(onClose);
        ad.onError?.(onError);
      } catch (error) {
        finish(false);
        return;
      }

      timerId = setTimeout(() => finish(false), this.realAdTimeoutMs) as unknown as number;

      Promise.resolve(ad.load?.())
        .catch(() => undefined)
        .then(() => Promise.resolve(ad.show?.()))
        .catch(() => Promise.resolve(ad.load?.()).then(() => Promise.resolve(ad.show?.())))
        .catch(() => {
          finish(false);
        });
    });
  }

  private async playMockRewardedVideo(): Promise<boolean> {
    const successRate = ConfigManager.getInstance().getBalance().adSuccessRate;
    return new Promise<boolean>((resolve) => {
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
  }

  private hasWxRewardedVideoSupport(): boolean {
    return typeof wx?.createRewardedVideoAd === "function";
  }

  private getAdUnitId(placement: AdPlacement): string {
    const raw = this.getAdRuntimeConfig().adUnitIdByPlacement[placement];
    return typeof raw === "string" ? raw.trim() : "";
  }

  private getOrCreateRewardedAd(placement: AdPlacement, adUnitId: string): any | null {
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
    } catch (error) {
      return null;
    }
  }

  private getAdRuntimeConfig(): {
    mode: AdRuntimeMode;
    allowMockFallback: boolean;
    adUnitIdByPlacement: Partial<Record<AdPlacement, string>>;
  } {
    const balance = ConfigManager.getInstance().getBalance();
    const rawMode = balance.adRuntimeMode;

    let mode: AdRuntimeMode = "mock";
    if (rawMode === "real" || rawMode === "auto" || rawMode === "mock" || rawMode === "disabled") {
      mode = rawMode;
    }

    const adUnitIdByPlacement: Partial<Record<AdPlacement, string>> = {};
    const rawMap = balance.adUnitIdByPlacement || {};
    const placements: AdPlacement[] = ["revive", "chestBoost", "startBuff", "extraUpgrade", "doubleReward"];
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

  private emit(placement: AdPlacement, state: "start" | "success" | "fail"): void {
    for (const listener of this.listeners) {
      listener(placement, state);
    }
  }
}
