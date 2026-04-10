import { InputManager } from "./core/InputManager";
import { MainLoop } from "./core/MainLoop";
import { SceneManager } from "./core/SceneManager";
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
  private readonly mainLoop: MainLoop;

  constructor() {
    SaveManager.getInstance().load();

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
    this.uiManager = new UIManager();

    const battleScene = new BattleScene(this.width, this.height, this.inputManager, this.uiManager);
    this.sceneManager.setScene(battleScene);

    this.mainLoop = new MainLoop(
      (dt) => this.update(dt),
      () => this.render()
    );

    this.inputManager.init();
    this.bindLifecycle();
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
      this.mainLoop.stop();
    });

    wx.onShow(() => {
      this.mainLoop.start();
    });
  }
}

