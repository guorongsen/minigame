import { InputManager } from "./core/InputManager";
import { MainLoop } from "./core/MainLoop";
import { SceneManager } from "./core/SceneManager";
import { AnalyticsManager } from "./managers/AnalyticsManager";
import { AntiAddictionManager } from "./managers/AntiAddictionManager";
import { SaveManager } from "./managers/SaveManager";
import { UIManager } from "./managers/UIManager";
import { BattleScene } from "./scenes/BattleScene";

/**
 * Application bootstrap and runtime wiring.
 */
export class Game {
  private readonly canvas: any;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly width: number;
  private readonly height: number;

  private readonly sceneManager: SceneManager;
  private readonly inputManager: InputManager;
  private readonly uiManager: UIManager;
  private readonly analytics = AnalyticsManager.getInstance();
  private readonly antiAddiction = AntiAddictionManager.getInstance();
  private readonly mainLoop: MainLoop;
  private frameErrorCount = 0;
  private frameErrorWindowStart = 0;
  private recoveringFromFrameError = false;

  constructor() {
    try {
      SaveManager.getInstance().load();
    } catch (error) {
      // Save load has internal fallback, but keep constructor resilient.
    }
    this.analytics.load();
    this.antiAddiction.init();

    const systemInfo = wx.getSystemInfoSync();
    this.width = systemInfo.windowWidth;
    this.height = systemInfo.windowHeight;

    const globalCanvas = (globalThis as any).canvas;
    this.canvas = globalCanvas || wx.createCanvas();
    this.canvas.width = this.width * systemInfo.pixelRatio;
    this.canvas.height = this.height * systemInfo.pixelRatio;

    this.ctx = this.canvas.getContext("2d");
    this.ctx.scale(systemInfo.pixelRatio, systemInfo.pixelRatio);

    this.sceneManager = new SceneManager();
    this.inputManager = new InputManager(this.sceneManager);
    this.inputManager.setMoveSensitivity(SaveManager.getInstance().getSettings().moveSensitivity);
    this.uiManager = new UIManager();

    const battleScene = new BattleScene(this.width, this.height, this.inputManager, this.uiManager);
    this.sceneManager.setScene(battleScene);

    this.mainLoop = new MainLoop(
      (dt) => this.update(dt),
      () => this.render(),
      (phase, error) => this.onFrameError(phase, error)
    );

    this.inputManager.init();
    this.bindLifecycle();
    this.bindRuntimeGuards();
  }

  start(): void {
    this.mainLoop.start();
  }

  private update(dt: number): void {
    this.sceneManager.update(dt);
  }

  private render(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.sceneManager.render(this.ctx);
  }

  private bindLifecycle(): void {
    wx.onHide(() => {
      this.antiAddiction.onHide();
      this.mainLoop.stop();
    });

    wx.onShow(() => {
      this.antiAddiction.onShow();
      this.mainLoop.start();
    });
  }

  private bindRuntimeGuards(): void {
    if (typeof wx?.onError === "function") {
      wx.onError((error: any) => {
        this.analytics.logEvent("runtime_error", {
          source: "wx_onError",
          message: this.stringifyError(error)
        });
      });
    }

    if (typeof wx?.onUnhandledRejection === "function") {
      wx.onUnhandledRejection((res: any) => {
        this.analytics.logEvent("runtime_error", {
          source: "wx_onUnhandledRejection",
          message: this.stringifyError(res?.reason || res)
        });
      });
    }

    if (typeof wx?.onMemoryWarning === "function") {
      wx.onMemoryWarning((res: any) => {
        this.analytics.logEvent("memory_warning", {
          level: typeof res?.level === "number" ? res.level : -1
        });
      });
    }
  }

  private onFrameError(phase: "update" | "render", error: any): void {
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
      } catch (toastError) {
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

  private stringifyError(error: any): string {
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
    } catch (jsonError) {
      return String(error);
    }
  }
}

