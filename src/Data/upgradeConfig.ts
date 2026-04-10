import { UpgradeDefinition } from "../types";

export const levelExpTable: number[] = [
  0,
  22,
  34,
  48,
  64,
  82,
  102,
  124,
  148,
  174,
  202,
  232,
  264,
  298,
  334,
  372,
  412,
  454,
  498,
  544,
  592,
  642,
  694,
  748,
  804,
  862,
  922,
  984,
  1048,
  1114,
  1182
];

export const upgradeDefinitions: UpgradeDefinition[] = [
  {
    id: "passive_damage_1",
    category: "passive",
    title: "伤害核心",
    description: "所有伤害 +12%。",
    color: "#ffad7a",
    weight: 1.2
  },
  {
    id: "passive_cooldown_1",
    category: "passive",
    title: "速射模块",
    description: "攻击冷却 -10%。",
    color: "#7ad9ff",
    weight: 1.2
  },
  {
    id: "passive_movespeed_1",
    category: "passive",
    title: "疾行基因",
    description: "移动速度 +12%。",
    color: "#9bffb0",
    weight: 1
  },
  {
    id: "passive_pickup_1",
    category: "passive",
    title: "磁吸核心",
    description: "拾取范围 +18。",
    color: "#f7ff9a",
    weight: 0.8
  },
  {
    id: "passive_maxhp_1",
    category: "passive",
    title: "生命外壳",
    description: "最大生命 +20。",
    color: "#ff93b1",
    weight: 0.7
  },
  {
    id: "recovery_heal_30",
    category: "recovery",
    title: "紧急治疗",
    description: "立刻恢复 30 点生命。",
    color: "#7affbe",
    weight: 0.9
  },
  {
    id: "temp_buff_frenzy",
    category: "temp_buff",
    title: "狂热 12秒",
    description: "伤害与攻速大幅提升。",
    color: "#ffd37a",
    weight: 0.8
  }
];

export const categoryBaseWeight = {
  new_weapon: 3.4,
  weapon_level: 3.1,
  element: 2.6,
  passive: 2.2,
  recovery: 1.1,
  temp_buff: 1.2
};

export const maxWeaponsInRun = 3;

export const gameBalanceConfig = {
  targetRunMinutes: 4,
  storyClearTime: 180,
  storyFinalBossWarnLeadTime: 16,
  storyFinalBossHpScale: 1.62,
  storyFinalBossSpeedMul: 1.08,
  storyFinalBossDamageMul: 1.24,
  bossSpawnTime: 110,
  endlessBossFirstTime: 72,
  endlessBossInterval: 78,
  endlessBossHpBatchScale: 0.16,
  chestDropChance: 0.06,
  eliteChestDropBonus: 0.12,
  expPullSpeed: 180,
  enemyGrowthPerSecond: 0.0045,
  spawnIntervalStart: 0.95,
  spawnIntervalMin: 0.22,
  contactDamageInterval: 0.6,
  obstacleDamageScale: 0.56,
  reviveHpRatio: 0.45,
  evolutionInvulnerableDuration: 0.72,
  reviveInvulnerableDuration: 1.2,
  startBuffDuration: 20,
  frenzyDuration: 12,
  frenzyDamageMul: 1.35,
  frenzyCooldownMul: 0.78,
  adSuccessRate: 0.82,
  mapWidthMultiplier: 3.2,
  mapHeightMultiplier: 3.2,
  mapObstacleCount: 8,
  mapObstacleCountMin: 5,
  mapObstacleCountMax: 10,
  mapObstacleMinWidth: 18,
  mapObstacleMaxWidth: 54,
  mapObstacleMinHeight: 16,
  mapObstacleMaxHeight: 42,
  evolutionPityStartTime: 62,
  evolutionPityHintTime: 92,
  adPlacementRules: {
    revive: { minRunTime: 0, cooldown: 9999 },
    chestBoost: { minRunTime: 35, cooldown: 40 },
    startBuff: { minRunTime: 0, cooldown: 0 },
    extraUpgrade: { minRunTime: 28, cooldown: 28 },
    doubleReward: { minRunTime: 0, cooldown: 9999 }
  }
};








