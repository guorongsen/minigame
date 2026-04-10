"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bossConfig = exports.enemyConfigList = void 0;
exports.enemyConfigList = [
    {
        id: "slime",
        name: "史莱姆",
        color: "#8cff7f",
        hp: 24,
        speed: 52,
        radius: 16,
        damage: 8,
        expDrop: 5,
        spawnWeight: 1,
        minTime: 0,
        maxTime: 999,
        archetype: "normal"
    },
    {
        id: "hound",
        name: "变异猎犬",
        color: "#ff9b7a",
        hp: 38,
        speed: 82,
        radius: 14,
        damage: 10,
        expDrop: 8,
        spawnWeight: 0.78,
        minTime: 16,
        maxTime: 999,
        archetype: "swift"
    },
    {
        id: "spitter",
        name: "脉冲远射体",
        color: "#84d6ff",
        hp: 48,
        speed: 56,
        radius: 15,
        damage: 12,
        expDrop: 10,
        spawnWeight: 0.62,
        minTime: 26,
        maxTime: 999,
        archetype: "ranged"
    },
    {
        id: "brute",
        name: "重装异变体",
        color: "#b7b7ff",
        hp: 98,
        speed: 46,
        radius: 24,
        damage: 16,
        expDrop: 15,
        spawnWeight: 0.42,
        minTime: 45,
        maxTime: 999,
        archetype: "normal"
    },
    {
        id: "shield_guard",
        name: "盾甲守卫",
        color: "#7dd6d6",
        hp: 116,
        speed: 42,
        radius: 22,
        damage: 14,
        expDrop: 18,
        spawnWeight: 0.34,
        minTime: 58,
        maxTime: 999,
        archetype: "shield",
        shieldRatio: 0.85
    },
    {
        id: "swift_stalker",
        name: "极速猎手",
        color: "#ff86d8",
        hp: 56,
        speed: 104,
        radius: 13,
        damage: 14,
        expDrop: 13,
        spawnWeight: 0.32,
        minTime: 72,
        maxTime: 999,
        archetype: "swift"
    }
];
exports.bossConfig = {
    id: "boss_aberrant",
    name: "畸变巨像",
    color: "#ff4a65",
    hp: 1800,
    speed: 40,
    radius: 46,
    damage: 26,
    expDrop: 250,
    spawnWeight: 1,
    minTime: 110,
    maxTime: 999,
    isBoss: true,
    archetype: "normal"
};
