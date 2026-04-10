import { IScene } from "./Scene";

/**
 * Handles scene switching.
 */
export class SceneManager {
  private currentScene: IScene | null = null;

  setScene(scene: IScene): void {
    if (this.currentScene?.exit) {
      this.currentScene.exit();
    }
    this.currentScene = scene;
    if (this.currentScene.enter) {
      this.currentScene.enter();
    }
  }

  getCurrentScene(): IScene | null {
    return this.currentScene;
  }

  update(dt: number): void {
    this.currentScene?.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.currentScene?.render(ctx);
  }
}
