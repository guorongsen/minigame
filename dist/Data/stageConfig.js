"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stageConfigList = void 0;
exports.stageConfigList = [
    {
        id: "stage_1",
        level: 1,
        name: "新手区",
        startTime: 0,
        enemyIds: ["slime"],
        enemyHpMul: 1,
        enemySpeedMul: 1,
        enemyDamageMul: 1,
        spawnIntervalMul: 1,
        eliteIntervalMul: 1,
        spawnCountBonus: 0,
        weightByEnemyId: {
            slime: 1
        }
    },
    {
        id: "stage_2",
        level: 2,
        name: "变异前线",
        startTime: 35,
        enemyIds: ["slime", "hound"],
        enemyHpMul: 1.08,
        enemySpeedMul: 1.05,
        enemyDamageMul: 1.08,
        spawnIntervalMul: 0.94,
        eliteIntervalMul: 0.96,
        spawnCountBonus: 0,
        weightByEnemyId: {
            slime: 0.78,
            hound: 1.22
        }
    },
    {
        id: "stage_3",
        level: 3,
        name: "火力试炼",
        startTime: 68,
        enemyIds: ["slime", "hound", "spitter"],
        enemyHpMul: 1.18,
        enemySpeedMul: 1.08,
        enemyDamageMul: 1.16,
        spawnIntervalMul: 0.88,
        eliteIntervalMul: 0.9,
        spawnCountBonus: 1,
        weightByEnemyId: {
            slime: 0.6,
            hound: 1,
            spitter: 1.2
        }
    },
    {
        id: "stage_4",
        level: 4,
        name: "重装压制",
        startTime: 102,
        enemyIds: ["slime", "hound", "spitter", "brute"],
        enemyHpMul: 1.32,
        enemySpeedMul: 1.12,
        enemyDamageMul: 1.26,
        spawnIntervalMul: 0.82,
        eliteIntervalMul: 0.86,
        spawnCountBonus: 1,
        weightByEnemyId: {
            slime: 0.45,
            hound: 0.9,
            spitter: 1.05,
            brute: 1.25
        }
    },
    {
        id: "stage_5",
        level: 5,
        name: "盾甲军团",
        startTime: 136,
        enemyIds: ["slime", "hound", "spitter", "brute", "shield_guard"],
        enemyHpMul: 1.5,
        enemySpeedMul: 1.16,
        enemyDamageMul: 1.38,
        spawnIntervalMul: 0.76,
        eliteIntervalMul: 0.82,
        spawnCountBonus: 2,
        weightByEnemyId: {
            slime: 0.32,
            hound: 0.75,
            spitter: 1,
            brute: 1.25,
            shield_guard: 1.28
        }
    },
    {
        id: "stage_6",
        level: 6,
        name: "极速围猎",
        startTime: 170,
        enemyIds: ["slime", "hound", "spitter", "brute", "shield_guard", "swift_stalker"],
        enemyHpMul: 1.72,
        enemySpeedMul: 1.22,
        enemyDamageMul: 1.52,
        spawnIntervalMul: 0.7,
        eliteIntervalMul: 0.78,
        spawnCountBonus: 2,
        weightByEnemyId: {
            slime: 0.22,
            hound: 0.64,
            spitter: 0.95,
            brute: 1.15,
            shield_guard: 1.2,
            swift_stalker: 1.35
        }
    },
    {
        id: "stage_7",
        level: 7,
        name: "终末猎场",
        startTime: 210,
        enemyIds: ["slime", "hound", "spitter", "brute", "shield_guard", "swift_stalker"],
        enemyHpMul: 1.98,
        enemySpeedMul: 1.28,
        enemyDamageMul: 1.68,
        spawnIntervalMul: 0.64,
        eliteIntervalMul: 0.74,
        spawnCountBonus: 3,
        weightByEnemyId: {
            slime: 0.16,
            hound: 0.5,
            spitter: 0.92,
            brute: 1.16,
            shield_guard: 1.24,
            swift_stalker: 1.46
        }
    }
];
