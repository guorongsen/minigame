import { DailyChallengeTemplate } from "../types";

/**
 * Rotating daily challenge presets. One challenge is selected by date.
 */
export const dailyChallengeTemplates: DailyChallengeTemplate[] = [
  {
    id: "daily_firestorm",
    name: "烈焰围城",
    description: "开局附带火元素，敌人更硬更快，提前迎战首领。",
    color: "#ff9a63",
    targetSurviveSeconds: 170,
    bossTime: 95,
    enemyHpMul: 1.1,
    enemySpeedMul: 1.08,
    spawnIntervalMul: 0.94,
    playerDamageMul: 1.08,
    startElement: "fire",
    rewardBonusDna: 160
  },
  {
    id: "daily_frost_field",
    name: "寒域突围",
    description: "开局附带冰元素，怪潮更密集，生存到极限时间。",
    color: "#8fdcff",
    targetSurviveSeconds: 180,
    bossTime: 112,
    enemyHpMul: 1.18,
    enemySpeedMul: 0.94,
    spawnIntervalMul: 0.9,
    playerDamageMul: 1.08,
    startElement: "ice",
    rewardBonusDna: 180
  },
  {
    id: "daily_thunder_hunt",
    name: "雷猎快攻",
    description: "开局附带电元素，敌人极快涌入，击杀节奏更激进。",
    color: "#ffe278",
    targetSurviveSeconds: 165,
    bossTime: 88,
    enemyHpMul: 1.05,
    enemySpeedMul: 1.2,
    spawnIntervalMul: 0.86,
    playerDamageMul: 1.12,
    startElement: "lightning",
    rewardBonusDna: 170
  },
  {
    id: "daily_toxic_core",
    name: "毒核实验",
    description: "开局附带毒元素，敌方生命更高，但你拥有更高输出。",
    color: "#87dd6f",
    targetSurviveSeconds: 175,
    bossTime: 102,
    enemyHpMul: 1.24,
    enemySpeedMul: 1,
    spawnIntervalMul: 0.92,
    playerDamageMul: 1.18,
    startElement: "poison",
    rewardBonusDna: 190
  },
  {
    id: "daily_glass_blitz",
    name: "玻璃闪击",
    description: "敌人更脆但刷怪更快，短时高压挑战操作与走位。",
    color: "#ff92c7",
    targetSurviveSeconds: 155,
    bossTime: 84,
    enemyHpMul: 0.92,
    enemySpeedMul: 1.25,
    spawnIntervalMul: 0.82,
    playerDamageMul: 1.28,
    rewardBonusDna: 165
  },
  {
    id: "daily_siege_line",
    name: "攻城战线",
    description: "无初始元素，敌潮与首领都更厚重，适合融合流派。",
    color: "#c7b9ff",
    targetSurviveSeconds: 185,
    bossTime: 108,
    enemyHpMul: 1.3,
    enemySpeedMul: 0.98,
    spawnIntervalMul: 0.95,
    playerDamageMul: 1.12,
    rewardBonusDna: 210
  }
];
