import { EnemyConfig } from "../types";
import { Enemy, EnemyBlockChecker } from "./Enemy";

export type BossActionType = "phase2" | "dash" | "shockwave";

export interface BossAction {
  type: BossActionType;
  x: number;
  y: number;
  radius?: number;
  windup?: number;
  damage?: number;
  color?: string;
}

/**
 * Boss with phase-2 dash and shockwave skills.
 */
export class Boss extends Enemy {
  private phase = 1;
  private dashCooldown = 3.8;
  private shockwaveCooldown = 4.8;

  private dashingTime = 0;
  private dashDirX = 0;
  private dashDirY = 0;
  private dashSpeed = 330;

  constructor(config: EnemyConfig, x: number, y: number, hpScale = 1) {
    super(config, x, y, hpScale, false);
  }

  updateBoss(
    dt: number,
    targetX: number,
    targetY: number,
    blockChecker?: EnemyBlockChecker
  ): BossAction[] {
    const actions: BossAction[] = [];

    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      this.dashCooldown = 1.6;
      this.shockwaveCooldown = 2.2;
      this.dashSpeed = 380;
      actions.push({
        type: "phase2",
        x: this.x,
        y: this.y,
        color: "#ff96a8"
      });
    }

    if (this.dashingTime > 0) {
      this.dashingTime -= dt;
      this.x += this.dashDirX * this.dashSpeed * dt;
      this.y += this.dashDirY * this.dashSpeed * dt;
    } else {
      super.update(dt, targetX, targetY, blockChecker);
    }

    if (this.phase >= 2) {
      this.dashCooldown -= dt;
      this.shockwaveCooldown -= dt;

      if (this.dashCooldown <= 0) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        this.dashDirX = dx / len;
        this.dashDirY = dy / len;
        this.dashingTime = 0.36;
        this.dashCooldown = 5.2;

        actions.push({
          type: "dash",
          x: this.x,
          y: this.y,
          color: "#ff7f95"
        });
      }

      if (this.shockwaveCooldown <= 0) {
        this.shockwaveCooldown = 6.6;
        actions.push({
          type: "shockwave",
          x: this.x,
          y: this.y,
          radius: 138,
          windup: 0.85,
          damage: this.damage * 1.45,
          color: "#ff98af"
        });
      }
    }

    return actions;
  }

  update(dt: number, targetX: number, targetY: number, blockChecker?: EnemyBlockChecker): void {
    this.updateBoss(dt, targetX, targetY, blockChecker);
  }

  isPhaseTwo(): boolean {
    return this.phase >= 2;
  }
}
