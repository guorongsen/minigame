"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnemySpawner = void 0;
const MathUtil_1 = require("../utils/MathUtil");
const ConfigManager_1 = require("../managers/ConfigManager");
const Boss_1 = require("../entities/Boss");
const Enemy_1 = require("../entities/Enemy");
/**
 * Enemy and boss wave progression.
 */
class EnemySpawner {
    constructor(viewWidth, viewHeight, worldWidth, worldHeight) {
        this.viewWidth = viewWidth;
        this.viewHeight = viewHeight;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.spawnTimer = 0.6;
        this.bossSpawned = false;
        this.eliteTimer = 32;
        this.obstacleChecker = null;
        this.mode = "story";
        this.storyBossTime = 110;
        this.endlessBossFirstTime = 78;
        this.endlessBossInterval = 78;
        this.endlessBossHpBatchScale = 0.16;
        this.endlessBossBatch = 0;
        this.endlessNextBossTime = 78;
        this.enemyHpMul = 1;
        this.enemySpeedMul = 1;
        this.enemyDamageMul = 1;
        this.spawnIntervalMul = 1;
        this.maxEnemyCount = 140;
        this.stageConfigs = [];
        this.currentStageIndex = 0;
        this.stageTimeOffset = 0;
        this.chapterEnemyWeightMulById = {};
    }
    setObstacleChecker(checker) {
        this.obstacleChecker = checker;
    }
    setMaxEnemyCount(count) {
        this.maxEnemyCount = Math.max(40, Math.floor(count));
    }
    reset(options) {
        var _a;
        this.spawnTimer = 0.6;
        this.bossSpawned = false;
        this.mode = (options === null || options === void 0 ? void 0 : options.mode) || "story";
        this.storyBossTime = Math.max(40, (options === null || options === void 0 ? void 0 : options.storyBossTime) || 110);
        this.endlessBossFirstTime = Math.max(40, (options === null || options === void 0 ? void 0 : options.endlessBossFirstTime) || 78);
        this.endlessBossInterval = Math.max(42, (options === null || options === void 0 ? void 0 : options.endlessBossInterval) || 78);
        this.endlessBossHpBatchScale = Math.max(0.04, (options === null || options === void 0 ? void 0 : options.endlessBossHpBatchScale) || 0.16);
        this.endlessBossBatch = 0;
        this.endlessNextBossTime = this.endlessBossFirstTime;
        this.enemyHpMul = Math.max(0.5, (options === null || options === void 0 ? void 0 : options.enemyHpMul) || 1);
        this.enemySpeedMul = Math.max(0.65, (options === null || options === void 0 ? void 0 : options.enemySpeedMul) || 1);
        this.enemyDamageMul = Math.max(0.65, (options === null || options === void 0 ? void 0 : options.enemyDamageMul) || 1);
        this.spawnIntervalMul = Math.max(0.72, (options === null || options === void 0 ? void 0 : options.spawnIntervalMul) || 1);
        this.maxEnemyCount = Math.max(40, Math.floor((options === null || options === void 0 ? void 0 : options.maxEnemyCount) || this.maxEnemyCount || 140));
        this.chapterEnemyWeightMulById = this.sanitizeWeightMap(options === null || options === void 0 ? void 0 : options.chapterEnemyWeightMulById);
        const cfg = ConfigManager_1.ConfigManager.getInstance();
        this.stageConfigs = cfg
            .getStageConfigs()
            .slice()
            .sort((a, b) => a.startTime - b.startTime);
        if (this.stageConfigs.length <= 0) {
            const fallbackIds = cfg.getEnemyPool().map((enemy) => enemy.id);
            this.stageConfigs = [
                {
                    id: "stage_fallback",
                    level: 1,
                    name: "默认关卡",
                    startTime: 0,
                    enemyIds: fallbackIds,
                    enemyHpMul: 1,
                    enemySpeedMul: 1,
                    enemyDamageMul: 1,
                    spawnIntervalMul: 1,
                    eliteIntervalMul: 1,
                    spawnCountBonus: 0
                }
            ];
        }
        const requestedStageLevel = Math.max(1, Math.floor((options === null || options === void 0 ? void 0 : options.startStageLevel) || 1));
        this.currentStageIndex = this.resolveStageIndexByLevel(requestedStageLevel);
        this.stageTimeOffset = ((_a = this.stageConfigs[this.currentStageIndex]) === null || _a === void 0 ? void 0 : _a.startTime) || 0;
        const stage = this.stageConfigs[this.currentStageIndex];
        this.eliteTimer = this.calcNextEliteDelay(stage);
    }
    update(dt, elapsedTime, enemies, playerX, playerY) {
        const cfg = ConfigManager_1.ConfigManager.getInstance();
        const balance = cfg.getBalance();
        let bossSpawnThisFrame = false;
        let eliteSpawnThisFrame = false;
        let eliteBehaviorThisFrame;
        let bossBatchThisFrame;
        let spawnedBossId;
        const stageElapsed = elapsedTime + this.stageTimeOffset;
        const stageIndex = this.resolveStageIndex(stageElapsed);
        const stageChanged = stageIndex !== this.currentStageIndex;
        if (stageChanged) {
            this.currentStageIndex = stageIndex;
            const nextStage = this.stageConfigs[this.currentStageIndex];
            this.eliteTimer = Math.min(this.eliteTimer, this.calcNextEliteDelay(nextStage));
        }
        const stage = this.stageConfigs[this.currentStageIndex];
        const stageHpMul = stage ? stage.enemyHpMul : 1;
        const stageSpeedMul = stage ? stage.enemySpeedMul : 1;
        const stageDamageMul = stage ? stage.enemyDamageMul : 1;
        const stageSpawnIntervalMul = stage ? stage.spawnIntervalMul : 1;
        const stageEliteIntervalMul = stage ? stage.eliteIntervalMul : 1;
        const stageSpawnBonus = stage ? Math.max(0, Math.floor(stage.spawnCountBonus || 0)) : 0;
        if (this.mode === "endless") {
            if (elapsedTime >= this.endlessNextBossTime) {
                this.endlessBossBatch += 1;
                const bossPos = this.randomSpawnPos(playerX, playerY, 42);
                const hpScale = (1 + elapsedTime * 0.003 + (this.endlessBossBatch - 1) * this.endlessBossHpBatchScale) *
                    this.enemyHpMul *
                    stageHpMul;
                const boss = new Boss_1.Boss(cfg.getBossConfig(), bossPos.x, bossPos.y, hpScale);
                this.applySpawnTuning(boss, this.enemySpeedMul * stageSpeedMul, this.enemyDamageMul * stageDamageMul);
                enemies.push(boss);
                spawnedBossId = boss.id;
                bossSpawnThisFrame = true;
                bossBatchThisFrame = this.endlessBossBatch;
                while (this.endlessNextBossTime <= elapsedTime) {
                    this.endlessNextBossTime += this.endlessBossInterval;
                }
            }
        }
        else {
            if (!this.bossSpawned && elapsedTime >= this.storyBossTime) {
                const bossPos = this.randomSpawnPos(playerX, playerY, 42);
                const boss = new Boss_1.Boss(cfg.getBossConfig(), bossPos.x, bossPos.y, (1 + elapsedTime * 0.003) * this.enemyHpMul * stageHpMul);
                this.applySpawnTuning(boss, this.enemySpeedMul * stageSpeedMul, this.enemyDamageMul * stageDamageMul);
                enemies.push(boss);
                spawnedBossId = boss.id;
                this.bossSpawned = true;
                bossSpawnThisFrame = true;
                bossBatchThisFrame = 1;
            }
        }
        this.eliteTimer -= dt;
        if (elapsedTime >= 26 && this.eliteTimer <= 0) {
            const eliteType = enemies.length < this.maxEnemyCount ? this.pickEnemyType(stageElapsed, stage) : null;
            if (eliteType && enemies.length < this.maxEnemyCount) {
                const pos = this.randomSpawnPos(playerX, playerY, 24);
                const hpScale = (1 + elapsedTime * balance.enemyGrowthPerSecond) * this.enemyHpMul * stageHpMul;
                const eliteScale = hpScale * (1.15 + elapsedTime * 0.0018);
                const elite = new Enemy_1.Enemy(eliteType, pos.x, pos.y, eliteScale, true);
                this.applySpawnTuning(elite, this.enemySpeedMul * stageSpeedMul, this.enemyDamageMul * stageDamageMul);
                enemies.push(elite);
                eliteSpawnThisFrame = true;
                eliteBehaviorThisFrame = elite.getEliteBehavior();
            }
            const nextElite = Math.max(24, 46 - elapsedTime * 0.07 + (0, MathUtil_1.randomRange)(-5, 5));
            this.eliteTimer += Math.max(12, nextElite * this.spawnIntervalMul * stageEliteIntervalMul);
        }
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            const remainCapacity = Math.max(0, this.maxEnemyCount - enemies.length);
            const spawnCount = Math.min(remainCapacity, 1 + Math.floor(elapsedTime / 55) + stageSpawnBonus);
            for (let i = 0; i < spawnCount; i += 1) {
                const type = this.pickEnemyType(stageElapsed, stage);
                if (!type) {
                    continue;
                }
                const pos = this.randomSpawnPos(playerX, playerY, 18);
                const hpScale = (1 + elapsedTime * balance.enemyGrowthPerSecond) * this.enemyHpMul * stageHpMul;
                const enemy = new Enemy_1.Enemy(type, pos.x, pos.y, hpScale);
                this.applySpawnTuning(enemy, this.enemySpeedMul * stageSpeedMul, this.enemyDamageMul * stageDamageMul);
                enemies.push(enemy);
            }
            const nextInterval = Math.max(balance.spawnIntervalMin, balance.spawnIntervalStart - elapsedTime * 0.0055);
            const tunedInterval = Math.max(0.12, nextInterval * this.spawnIntervalMul * stageSpawnIntervalMul);
            this.spawnTimer += tunedInterval;
        }
        return {
            bossSpawned: bossSpawnThisFrame,
            bossBatch: bossBatchThisFrame,
            mode: this.mode,
            eliteSpawned: eliteSpawnThisFrame,
            eliteBehavior: eliteBehaviorThisFrame,
            spawnedBossId,
            stageLevel: stage ? stage.level : 1,
            stageName: stage ? stage.name : "默认关卡",
            stageChanged
        };
    }
    calcNextEliteDelay(stage) {
        return (30 + Math.random() * 8) * this.spawnIntervalMul * Math.max(0.6, stage.eliteIntervalMul || 1);
    }
    resolveStageIndex(elapsedTime) {
        if (this.stageConfigs.length <= 0) {
            return 0;
        }
        let idx = 0;
        for (let i = 1; i < this.stageConfigs.length; i += 1) {
            if (elapsedTime >= this.stageConfigs[i].startTime) {
                idx = i;
            }
            else {
                break;
            }
        }
        return idx;
    }
    resolveStageIndexByLevel(level) {
        if (this.stageConfigs.length <= 0) {
            return 0;
        }
        let idx = 0;
        for (let i = 0; i < this.stageConfigs.length; i += 1) {
            if (this.stageConfigs[i].level <= level) {
                idx = i;
            }
        }
        return idx;
    }
    applySpawnTuning(enemy, speedMul, damageMul) {
        enemy.speed *= speedMul;
        enemy.damage *= damageMul;
    }
    pickEnemyType(elapsedTime, stage) {
        var _a, _b;
        const allEnemies = ConfigManager_1.ConfigManager.getInstance().getEnemyPool();
        let pool = allEnemies.filter((enemy) => {
            return (stage.enemyIds.includes(enemy.id) &&
                elapsedTime >= enemy.minTime &&
                elapsedTime <= enemy.maxTime);
        });
        if (pool.length === 0) {
            pool = allEnemies.filter((enemy) => stage.enemyIds.includes(enemy.id));
        }
        if (pool.length === 0) {
            pool = allEnemies.filter((enemy) => elapsedTime >= enemy.minTime && elapsedTime <= enemy.maxTime);
        }
        if (pool.length === 0) {
            return null;
        }
        const weightedPool = [];
        let totalWeight = 0;
        for (const enemy of pool) {
            const stageWeight = stage.weightByEnemyId ? (_a = stage.weightByEnemyId[enemy.id]) !== null && _a !== void 0 ? _a : 1 : 1;
            const chapterWeight = (_b = this.chapterEnemyWeightMulById[enemy.id]) !== null && _b !== void 0 ? _b : 1;
            const weight = Math.max(0, enemy.spawnWeight * stageWeight * chapterWeight);
            if (weight <= 0) {
                continue;
            }
            weightedPool.push({ enemy, weight });
            totalWeight += weight;
        }
        if (weightedPool.length <= 0 || totalWeight <= 0.0001) {
            return pool[Math.floor(Math.random() * pool.length)] || null;
        }
        let r = Math.random() * totalWeight;
        for (const item of weightedPool) {
            r -= item.weight;
            if (r <= 0) {
                return item.enemy;
            }
        }
        return weightedPool[weightedPool.length - 1].enemy;
    }
    randomSpawnPos(playerX, playerY, radius) {
        for (let i = 0; i < 16; i += 1) {
            const angle = Math.random() * Math.PI * 2;
            const dist = (0, MathUtil_1.randomRange)(Math.min(this.viewWidth, this.viewHeight) * 0.56, Math.max(this.viewWidth, this.viewHeight) * 0.85);
            let x = playerX + Math.cos(angle) * dist;
            let y = playerY + Math.sin(angle) * dist;
            x = Math.max(radius + 8, Math.min(this.worldWidth - radius - 8, x));
            y = Math.max(radius + 8, Math.min(this.worldHeight - radius - 8, y));
            if (!this.obstacleChecker || !this.obstacleChecker(x, y, radius)) {
                return { x, y };
            }
        }
        return {
            x: Math.max(radius + 8, Math.min(this.worldWidth - radius - 8, playerX + (0, MathUtil_1.randomRange)(-100, 100))),
            y: Math.max(radius + 8, Math.min(this.worldHeight - radius - 8, playerY + (0, MathUtil_1.randomRange)(-100, 100)))
        };
    }
    sanitizeWeightMap(raw) {
        if (!raw || typeof raw !== "object") {
            return {};
        }
        const out = {};
        Object.keys(raw).forEach((key) => {
            const value = raw[key];
            if (typeof value !== "number" || !Number.isFinite(value)) {
                return;
            }
            out[key] = Math.max(0.1, Math.min(3.2, value));
        });
        return out;
    }
}
exports.EnemySpawner = EnemySpawner;
