import { Vec2 } from "../types";
import { clamp } from "../utils/MathUtil";
import { SceneManager } from "./SceneManager";

/**
 * Converts touch events into movement vector and tap signals.
 */
export class InputManager {
  private sceneManager: SceneManager;
  private touching = false;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private startTime = 0;
  private moveVec: Vec2 = { x: 0, y: 0 };
  private readonly deadZone = 6;
  private readonly maxRadius = 60;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
  }

  init(): void {
    wx.onTouchStart((event: any) => this.handleTouchStart(event));
    wx.onTouchMove((event: any) => this.handleTouchMove(event));
    wx.onTouchEnd((event: any) => this.handleTouchEnd(event));
    wx.onTouchCancel((event: any) => this.handleTouchEnd(event));
  }

  getMoveVector(): Vec2 {
    return this.moveVec;
  }

  isTouching(): boolean {
    return this.touching;
  }

  getTouchPosition(): Vec2 {
    return { x: this.currentX, y: this.currentY };
  }

  private handleTouchStart(event: any): void {
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
    scene?.onTouchStart?.(point.x, point.y);
  }

  private handleTouchMove(event: any): void {
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
    } else {
      const clamped = clamp(len, 0, this.maxRadius);
      this.moveVec = {
        x: (dx / len) * (clamped / this.maxRadius),
        y: (dy / len) * (clamped / this.maxRadius)
      };
    }

    const scene = this.sceneManager.getCurrentScene();
    scene?.onTouchMove?.(point.x, point.y);
  }

  private handleTouchEnd(event: any): void {
    const point = this.readTouchPoint(event) || { x: this.currentX, y: this.currentY };

    const dt = Date.now() - this.startTime;
    const dx = point.x - this.startX;
    const dy = point.y - this.startY;
    const moved = Math.sqrt(dx * dx + dy * dy);

    const scene = this.sceneManager.getCurrentScene();
    scene?.onTouchEnd?.(point.x, point.y);

    if (dt <= 220 && moved <= 12) {
      scene?.onTap?.(point.x, point.y);
    }

    this.touching = false;
    this.moveVec = { x: 0, y: 0 };
  }

  private readTouchPoint(event: any): { x: number; y: number } | null {
    const touch =
      (event?.touches && event.touches[0]) ||
      (event?.changedTouches && event.changedTouches[0]) ||
      null;

    if (!touch) {
      return null;
    }

    return {
      x: touch.clientX ?? touch.x ?? 0,
      y: touch.clientY ?? touch.y ?? 0
    };
  }
}
