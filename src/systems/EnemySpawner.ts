import { EnemyConfig } from "../types";
import { randomRange } from "../utils/MathUtil";
import { ConfigManager } from "../managers/ConfigManager";
import { Boss } from "../entities/Boss";
import { EliteBehavior, Enemy } from "../entities/Enemy";

export type SpawnMode = "story" | "endless" | "daily";

export interface SpawnerResetOptions {
  mode?: SpawnMode;
  storyBossTime?: number;
  endlessBossFirstTime?: number;
  endlessBossInterval?: number;
  endlessBossHpBatchScale?: number;
  enemyHpMul?: number;
  enemySpeedMul?: number;
  enemyDamageMul?: number;
  spawnIntervalMul?: number;
}

export interface SpawnUpdateResult {
  bossSpawned: boolean;
  eliteSpawned: boolean;
  eliteBehavior?: EliteBehavior;
  bossBatch?: number;
  mode?: SpawnMode;
  spawnedBossId?: number;
}

/**
 * Enemy and boss wave progression.
 */
export class EnemySpawner {
  private spawnTimer = 0.6;
  private bossSpawned = false;
  private eliteTimer = 32;
  private obstacleChecker: ((x: number, y: number, radius: number) => boolean) | null = null;

  private mode: SpawnMode = "story";
  private storyBossTime = 110;

  private endlessBossFirstTime = 78;
  private endlessBossInterval = 78;
  private endlessBossHpBatchScale = 0.16;
  private endlessBossBatch = 0;
  private endlessNextBossTime = 78;

  private enemyHpMul = 1;
  private enemySpeedMul = 1;
  private enemyDamageMul = 1;
  private spawnIntervalMul = 1;

  constructor(
    private readonly viewWidth: number,
    private readonly viewHeight: number,
    private readonly worldWidth: number,
    private readonly worldHeight: number
  ) {}

  setObstacleChecker(checker: (x: number, y: number, radius: number) => boolean): void {
    this.obstacleChecker = checker;
  }

  reset(options?: SpawnerResetOptions): void {
    this.spawnTimer = 0.6;
    this.bossSpawned = false;

    this.mode = options?.mode || "story";
    this.storyBossTime = Math.max(40, options?.storyBossTime || 110);

    this.endlessBossFirstTime = Math.max(40, options?.endlessBossFirstTime || 78);
    this.endlessBossInterval = Math.max(42, options?.endlessBossInterval || 78);
    this.endlessBossHpBatchScale = Math.max(0.04, options?.endlessBossHpBatchScale || 0.16);
    this.endlessBossBatch = 0;
    this.endlessNextBossTime = this.endlessBossFirstTime;

    this.enemyHpMul = Math.max(0.5, options?.enemyHpMul || 1);
    this.enemySpeedMul = Math.max(0.65, options?.enemySpeedMul || 1);
    this.enemyDamageMul = Math.max(0.65, options?.enemyDamageMul || 1);
    this.spawnIntervalMul = Math.max(0.72, options?.spawnIntervalMul || 1);

    this.eliteTimer = (30 + Math.random() * 8) * this.spawnIntervalMul;
  }

  update(
    dt: number,
    elapsedTime: number,
    enemies: Enemy[],
    playerX: number,
    playerY: number
  ): SpawnUpdateResult {
    const cfg = ConfigManager.getInstance();
    const balance = cfg.getBalance();

    let bossSpawnThisFrame = false;
    let eliteSpawnThisFrame = false;
    let eliteBehaviorThisFrame: EliteBehavior | undefined;
    let bossBatchThisFrame: number | undefined;
    let spawnedBossId: number | undefined;

    if (this.mode === "endless") {
      if (elapsedTime >= this.endlessNextBossTime) {
        this.endlessBossBatch += 1;
        const bossPos = this.randomSpawnPos(playerX, playerY, 42);
        const hpScale =
          (1 + elapsedTime * 0.003 + (this.endlessBossBatch - 1) * this.endlessBossHpBatchScale) * this.enemyHpMul;
        const boss = new Boss(cfg.getBossConfig(), bossPos.x, bossPos.y, hpScale);
        this.applySpawnTuning(boss);
        enemies.push(boss);
        spawnedBossId = boss.id;

        bossSpawnThisFrame = true;
        bossBatchThisFrame = this.endlessBossBatch;

        while (this.endlessNextBossTime <= elapsedTime) {
          this.endlessNextBossTime += this.endlessBossInterval;
        }
      }
    } else {
      if (!this.bossSpawned && elapsedTime >= this.storyBossTime) {
        const bossPos = this.randomSpawnPos(playerX, playerY, 42);
        const boss = new Boss(cfg.getBossConfig(), bossPos.x, bossPos.y, (1 + elapsedTime * 0.003) * this.enemyHpMul);
        this.applySpawnTuning(boss);
        enemies.push(boss);
        spawnedBossId = boss.id;

        this.bossSpawned = true;
        bossSpawnThisFrame = true;
        bossBatchThisFrame = 1;
      }
    }

    this.eliteTimer -= dt;
    if (elapsedTime >= 26 && this.eliteTimer <= 0) {
      const eliteType = this.pickEnemyType(elapsedTime);
      if (eliteType) {
        const pos = this.randomSpawnPos(playerX, playerY, 24);
        const hpScale = (1 + elapsedTime * balance.enemyGrowthPerSecond) * this.enemyHpMul;
        const eliteScale = hpScale * (1.15 + elapsedTime * 0.0018);
        const elite = new Enemy(eliteType, pos.x, pos.y, eliteScale, true);
        this.applySpawnTuning(elite);
        enemies.push(elite);

        eliteSpawnThisFrame = true;
        eliteBehaviorThisFrame = elite.getEliteBehavior();
      }

      const nextElite = Math.max(24, 46 - elapsedTime * 0.07 + randomRange(-5, 5));
      this.eliteTimer += Math.max(12, nextElite * this.spawnIntervalMul);
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const spawnCount = 1 + Math.floor(elapsedTime / 55);
      for (let i = 0; i < spawnCount; i += 1) {
        const type = this.pickEnemyType(elapsedTime);
        if (!type) {
          continue;
        }

        const pos = this.randomSpawnPos(playerX, playerY, 18);
        const hpScale = (1 + elapsedTime * balance.enemyGrowthPerSecond) * this.enemyHpMul;
        const enemy = new Enemy(type, pos.x, pos.y, hpScale);
        this.applySpawnTuning(enemy);
        enemies.push(enemy);
      }

      const nextInterval = Math.max(
        balance.spawnIntervalMin,
        balance.spawnIntervalStart - elapsedTime * 0.0055
      );
      const tunedInterval = Math.max(0.12, nextInterval * this.spawnIntervalMul);
      this.spawnTimer += tunedInterval;
    }

    return {
      bossSpawned: bossSpawnThisFrame,
      bossBatch: bossBatchThisFrame,
      mode: this.mode,
      eliteSpawned: eliteSpawnThisFrame,
      eliteBehavior: eliteBehaviorThisFrame,
      spawnedBossId
    };
  }

  private applySpawnTuning(enemy: Enemy): void {
    enemy.speed *= this.enemySpeedMul;
    enemy.damage *= this.enemyDamageMul;
  }

  private pickEnemyType(elapsedTime: number): EnemyConfig | null {
    const pool = ConfigManager.getInstance()
      .getEnemyPool()
      .filter((enemy) => {
        return elapsedTime >= enemy.minTime && elapsedTime <= enemy.maxTime;
      });

    if (pool.length === 0) {
      return null;
    }

    let total = 0;
    for (const enemy of pool) {
      total += enemy.spawnWeight;
    }

    let r = Math.random() * total;
    for (const enemy of pool) {
      r -= enemy.spawnWeight;
      if (r <= 0) {
        return enemy;
      }
    }
    return pool[pool.length - 1];
  }

  private randomSpawnPos(playerX: number, playerY: number, radius: number): { x: number; y: number } {
    for (let i = 0; i < 16; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const dist = randomRange(
        Math.min(this.viewWidth, this.viewHeight) * 0.56,
        Math.max(this.viewWidth, this.viewHeight) * 0.85
      );

      let x = playerX + Math.cos(angle) * dist;
      let y = playerY + Math.sin(angle) * dist;

      x = Math.max(radius + 8, Math.min(this.worldWidth - radius - 8, x));
      y = Math.max(radius + 8, Math.min(this.worldHeight - radius - 8, y));

      if (!this.obstacleChecker || !this.obstacleChecker(x, y, radius)) {
        return { x, y };
      }
    }

    return {
      x: Math.max(radius + 8, Math.min(this.worldWidth - radius - 8, playerX + randomRange(-100, 100))),
      y: Math.max(radius + 8, Math.min(this.worldHeight - radius - 8, playerY + randomRange(-100, 100)))
    };
  }
}
