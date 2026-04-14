import { baseWeaponIds } from "../Data/weaponConfig";
import {
  DailyQuestProgress,
  DailyQuestType,
  GameSettings,
  MetaUpgradeEffects,
  MetaUpgradeShopItem,
  MetaUpgradeType,
  PerformanceMode,
  SaveData,
  WeaponSkillDefinition,
  WeaponUpgradeInfo
} from "../types";

const SAVE_KEY = "evolution_survivor_save_v1";
const SAVE_VERSION = 3;
const LEGACY_START_BUFF_DNA_COMPENSATION = 18;

interface DailyQuestTemplate {
  type: DailyQuestType;
  title: string;
  description: string;
  target: number;
  rewardDna: number;
}

interface DailyQuestRunSummary {
  kills: number;
  survivalTime: number;
  evolutionCount: number;
  endlessBossBatchReached: number;
  fusionCount: number;
}

interface WeaponMasteryInfo {
  level: number;
  progress: number;
  current: number;
  need: number;
  totalExp: number;
}

interface MetaUpgradeTemplate {
  id: MetaUpgradeType;
  title: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costScale: number;
}

interface WeaponUpgradeTemplate {
  baseWeaponId: string;
  maxLevel: number;
  costs: number[];
  damageBonusPerLevel: number;
  skills: WeaponSkillDefinition[];
}

const dailyQuestTemplates: DailyQuestTemplate[] = [
  {
    type: "kill",
    title: "清理异变体",
    description: "今日累计击杀 120 个敌人。",
    target: 120,
    rewardDna: 90
  },
  {
    type: "survive",
    title: "坚持作战",
    description: "今日累计生存 240 秒。",
    target: 240,
    rewardDna: 100
  },
  {
    type: "evolution",
    title: "完成进化",
    description: "今日触发 2 次武器进化。",
    target: 2,
    rewardDna: 120
  },
  {
    type: "boss_batch",
    title: "首领猎手",
    description: "今日击破 2 批首领。",
    target: 2,
    rewardDna: 120
  },
  {
    type: "fusion",
    title: "基因融合",
    description: "今日触发 2 次人物融合。",
    target: 2,
    rewardDna: 90
  },
  {
    type: "kill",
    title: "暴走清场",
    description: "今日累计击杀 180 个敌人。",
    target: 180,
    rewardDna: 130
  },
  {
    type: "survive",
    title: "长线拉扯",
    description: "今日累计生存 360 秒。",
    target: 360,
    rewardDna: 130
  }
];

const metaUpgradeTemplates: MetaUpgradeTemplate[] = [
  {
    id: "damage",
    title: "攻击基因",
    description: "每级伤害 +3%。",
    maxLevel: 20,
    baseCost: 120,
    costScale: 1.31
  },
  {
    id: "maxHp",
    title: "生存外壳",
    description: "每级最大生命 +8。",
    maxLevel: 20,
    baseCost: 110,
    costScale: 1.29
  },
  {
    id: "moveSpeed",
    title: "神经疾行",
    description: "每级移速 +2.5%。",
    maxLevel: 15,
    baseCost: 95,
    costScale: 1.27
  },
  {
    id: "pickup",
    title: "磁吸感应",
    description: "每级拾取范围 +10。",
    maxLevel: 15,
    baseCost: 90,
    costScale: 1.25
  }
];

const weaponUpgradeTemplates: Record<string, WeaponUpgradeTemplate> = {
  knife: {
    baseWeaponId: "knife",
    maxLevel: 5,
    costs: [12, 20, 30, 44, 62],
    damageBonusPerLevel: 0.07,
    skills: [
      {
        id: "split_throw",
        title: "裂刃投掷",
        description: "飞刀改为扇形多发。",
        unlockLevel: 1
      },
      {
        id: "pierce_edge",
        title: "穿刺锋刃",
        description: "飞刀类攻击获得额外穿透。",
        unlockLevel: 2
      },
      {
        id: "swift_throw",
        title: "疾速投掷",
        description: "飞刀飞行速度大幅提升。",
        unlockLevel: 3
      },
      {
        id: "giant_blade",
        title: "巨刃强化",
        description: "飞刀体积和威力提升。",
        unlockLevel: 4
      },
      {
        id: "phantom_orbit",
        title: "幻影环刃",
        description: "每次出手会在身边追加环形刃波。",
        unlockLevel: 5
      }
    ]
  },
  fireball: {
    baseWeaponId: "fireball",
    maxLevel: 5,
    costs: [14, 22, 32, 46, 64],
    damageBonusPerLevel: 0.08,
    skills: [
      {
        id: "blast_core",
        title: "爆裂核心",
        description: "火球爆炸半径提升。",
        unlockLevel: 1
      },
      {
        id: "twin_cast",
        title: "双重咏唱",
        description: "每次施放额外发射一枚副火球。",
        unlockLevel: 2
      },
      {
        id: "ignition_boost",
        title: "点燃增幅",
        description: "火球伤害与速度提升。",
        unlockLevel: 3
      },
      {
        id: "magma_pool",
        title: "熔火残留",
        description: "命中点附近留下短暂灼烧区域。",
        unlockLevel: 4
      },
      {
        id: "meteor_swarm",
        title: "流星齐射",
        description: "额外追加两枚偏转火球。",
        unlockLevel: 5
      }
    ]
  },
  shockwave: {
    baseWeaponId: "shockwave",
    maxLevel: 5,
    costs: [13, 21, 31, 45, 63],
    damageBonusPerLevel: 0.08,
    skills: [
      {
        id: "echo_wave",
        title: "回响冲击",
        description: "冲击波会追加一圈次级震荡。",
        unlockLevel: 1
      },
      {
        id: "wide_field",
        title: "震域扩展",
        description: "冲击波作用范围显著提升。",
        unlockLevel: 2
      },
      {
        id: "seismic_force",
        title: "地震之力",
        description: "冲击波基础伤害提升。",
        unlockLevel: 3
      },
      {
        id: "pulse_chain",
        title: "脉冲连锁",
        description: "冲击波追加更多连续脉冲。",
        unlockLevel: 4
      },
      {
        id: "gravity_well",
        title: "引力井",
        description: "中心区域产生持续压制震场。",
        unlockLevel: 5
      }
    ]
  },
  laser: {
    baseWeaponId: "laser",
    maxLevel: 5,
    costs: [15, 24, 35, 50, 68],
    damageBonusPerLevel: 0.09,
    skills: [
      {
        id: "focus_beam",
        title: "聚焦棱镜",
        description: "激光更粗并附带额外威力。",
        unlockLevel: 1
      },
      {
        id: "side_beam",
        title: "侧向偏振",
        description: "激光额外产生两道侧向副束。",
        unlockLevel: 2
      },
      {
        id: "overcharge_core",
        title: "过载核心",
        description: "激光类攻击伤害进一步提升。",
        unlockLevel: 3
      },
      {
        id: "long_optics",
        title: "长距光学",
        description: "激光射程显著增加。",
        unlockLevel: 4
      },
      {
        id: "prism_burst",
        title: "棱镜爆发",
        description: "激光命中点触发额外爆裂。",
        unlockLevel: 5
      }
    ]
  },
  punch: {
    baseWeaponId: "punch",
    maxLevel: 5,
    costs: [12, 20, 29, 42, 58],
    damageBonusPerLevel: 0.08,
    skills: [
      {
        id: "combo_strike",
        title: "连打拳风",
        description: "每次出拳追加一次补拳。",
        unlockLevel: 1
      },
      {
        id: "guard_wave",
        title: "守势震波",
        description: "出拳时会在身边释放防守震荡。",
        unlockLevel: 2
      },
      {
        id: "heavy_fist",
        title: "重拳压制",
        description: "拳风伤害和范围提升。",
        unlockLevel: 3
      },
      {
        id: "dash_drive",
        title: "突进拳驱",
        description: "拳风前冲距离增加。",
        unlockLevel: 4
      },
      {
        id: "quake_knuckle",
        title: "震地拳骨",
        description: "落点会追加一次震地冲击。",
        unlockLevel: 5
      }
    ]
  }
};

const defaultMetaUpgradeLevels: Record<MetaUpgradeType, number> = {
  damage: 0,
  maxHp: 0,
  moveSpeed: 0,
  pickup: 0
};

const META_RESET_REFUND_RATIO = 0.85;

const starterPlanPriority: MetaUpgradeType[] = ["maxHp", "pickup", "damage", "moveSpeed"];
const hardcorePlanPriority: MetaUpgradeType[] = ["damage", "moveSpeed", "maxHp", "pickup"];

const defaultSettings: GameSettings = {
  sfxEnabled: true,
  vibrationEnabled: true,
  performanceMode: "balanced",
  moveSensitivity: 1
};

const createEmptyWeaponFragments = (): Record<string, number> => {
  const map: Record<string, number> = {};
  for (const baseId of baseWeaponIds) {
    map[baseId] = 0;
  }
  return map;
};

const createEmptyWeaponUpgradeLevels = (): Record<string, number> => {
  const map: Record<string, number> = {};
  for (const baseId of baseWeaponIds) {
    map[baseId] = 0;
  }
  return map;
};

const createEmptyStoryChapterStars = (): Record<string, number> => {
  return {};
};

const defaultSaveData: SaveData = {
  version: SAVE_VERSION,
  unlockedEvolutionIds: [],
  storyUnlockedChapterLevel: 1,
  storyChapterBestStars: createEmptyStoryChapterStars(),
  storyChapterFirstClearIds: [],
  bestSurvivalTime: 0,
  totalKills: 0,
  totalRuns: 0,
  tutorialSeen: false,
  debugMode: false,
  dailyChestClaimDate: "",
  dna: 0,
  weaponFragments: createEmptyWeaponFragments(),
  weaponUpgradeLevels: createEmptyWeaponUpgradeLevels(),
  weaponMasteryExp: {},
  dailyQuestDate: "",
  dailyQuests: [],
  metaUpgradeLevels: { ...defaultMetaUpgradeLevels },
  dailyChallengeRewardClaimDate: "",
  settings: { ...defaultSettings }
};

/**
 * Local persistence for meta progress and debug switches.
 */
export class SaveManager {
  private static instance: SaveManager;
  private data: SaveData = this.createDefaultSaveData();

  static getInstance(): SaveManager {
    if (!SaveManager.instance) {
      SaveManager.instance = new SaveManager();
    }
    return SaveManager.instance;
  }

  load(): void {
    try {
      const raw = wx.getStorageSync(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const migrated = this.migrateSaveData(parsed);
        this.data = {
          ...this.createDefaultSaveData(),
          ...migrated,
          version: SAVE_VERSION,
          unlockedEvolutionIds: Array.isArray(migrated.unlockedEvolutionIds)
            ? migrated.unlockedEvolutionIds.filter((item: any) => typeof item === "string")
            : [],
          storyUnlockedChapterLevel: Math.max(1, this.sanitizeNonNegative(migrated.storyUnlockedChapterLevel) || 1),
          storyChapterBestStars: this.sanitizeStoryChapterBestStars(migrated.storyChapterBestStars),
          storyChapterFirstClearIds: this.sanitizeStoryChapterFirstClearIds(migrated.storyChapterFirstClearIds),
          bestSurvivalTime: this.sanitizeNonNegative(migrated.bestSurvivalTime),
          totalKills: this.sanitizeNonNegative(migrated.totalKills),
          totalRuns: this.sanitizeNonNegative(migrated.totalRuns),
          tutorialSeen: !!migrated.tutorialSeen,
          debugMode: !!migrated.debugMode,
          dailyChestClaimDate: typeof migrated.dailyChestClaimDate === "string" ? migrated.dailyChestClaimDate : "",
          dna: this.sanitizeNonNegative(migrated.dna),
          weaponFragments: this.sanitizeWeaponFragments(migrated.weaponFragments),
          weaponUpgradeLevels: this.sanitizeWeaponUpgradeLevels(migrated.weaponUpgradeLevels),
          weaponMasteryExp: this.sanitizeMasteryExp(migrated.weaponMasteryExp),
          dailyQuestDate: typeof migrated.dailyQuestDate === "string" ? migrated.dailyQuestDate : "",
          dailyQuests: this.sanitizeDailyQuests(migrated.dailyQuests),
          metaUpgradeLevels: this.sanitizeMetaUpgradeLevels(migrated.metaUpgradeLevels),
          dailyChallengeRewardClaimDate:
            typeof migrated.dailyChallengeRewardClaimDate === "string" ? migrated.dailyChallengeRewardClaimDate : "",
          settings: this.sanitizeSettings(migrated.settings)
        };
      }
    } catch (error) {
      this.data = this.createDefaultSaveData();
    }

    this.ensureDailyQuests();
  }

  save(): void {
    try {
      wx.setStorageSync(SAVE_KEY, JSON.stringify(this.data));
    } catch (error) {
      // Ignore write errors in MVP.
    }
  }

  getData(): SaveData {
    this.ensureDailyQuests();
    return this.data;
  }

  isEvolutionUnlocked(id: string): boolean {
    return this.data.unlockedEvolutionIds.indexOf(id) >= 0;
  }

  unlockEvolution(id: string): void {
    if (!this.isEvolutionUnlocked(id)) {
      this.data.unlockedEvolutionIds.push(id);
      this.save();
    }
  }

  getUnlockedStoryChapterLevel(): number {
    return Math.max(1, Math.floor(this.data.storyUnlockedChapterLevel || 1));
  }

  isStoryChapterUnlocked(chapterLevel: number): boolean {
    return Math.max(1, Math.floor(chapterLevel || 1)) <= this.getUnlockedStoryChapterLevel();
  }

  unlockStoryChapter(chapterLevel: number): { changed: boolean; unlockedLevel: number } {
    const target = Math.max(1, Math.floor(chapterLevel || 1));
    if (target <= this.getUnlockedStoryChapterLevel()) {
      return {
        changed: false,
        unlockedLevel: this.getUnlockedStoryChapterLevel()
      };
    }

    this.data.storyUnlockedChapterLevel = target;
    this.save();
    return {
      changed: true,
      unlockedLevel: target
    };
  }

  getStoryChapterBestStars(chapterId: string): number {
    const value = this.data.storyChapterBestStars[chapterId];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(3, Math.floor(value)));
  }

  setStoryChapterBestStars(chapterId: string, stars: number): { updated: boolean; bestStars: number } {
    if (!chapterId) {
      return {
        updated: false,
        bestStars: 0
      };
    }

    const safeStars = Math.max(0, Math.min(3, Math.floor(stars || 0)));
    const before = this.getStoryChapterBestStars(chapterId);
    if (safeStars <= before) {
      return {
        updated: false,
        bestStars: before
      };
    }

    this.data.storyChapterBestStars[chapterId] = safeStars;
    this.save();
    return {
      updated: true,
      bestStars: safeStars
    };
  }

  isStoryChapterFirstCleared(chapterId: string): boolean {
    if (!chapterId) {
      return false;
    }
    return this.data.storyChapterFirstClearIds.indexOf(chapterId) >= 0;
  }

  markStoryChapterFirstCleared(chapterId: string): boolean {
    if (!chapterId || this.isStoryChapterFirstCleared(chapterId)) {
      return false;
    }
    this.data.storyChapterFirstClearIds.push(chapterId);
    this.save();
    return true;
  }

  estimatePlayerPower(): number {
    const basePower = 95;
    const metaLevels = this.data.metaUpgradeLevels || defaultMetaUpgradeLevels;
    const damagePower = Math.max(0, Math.floor(metaLevels.damage || 0)) * 34;
    const hpPower = Math.max(0, Math.floor(metaLevels.maxHp || 0)) * 30;
    const speedPower = Math.max(0, Math.floor(metaLevels.moveSpeed || 0)) * 26;
    const pickupPower = Math.max(0, Math.floor(metaLevels.pickup || 0)) * 18;

    let weaponPower = 0;
    let masteryPower = 0;
    for (const baseWeaponId of baseWeaponIds) {
      const upgradeLevel = Math.max(0, Math.floor(this.data.weaponUpgradeLevels[baseWeaponId] || 0));
      const masteryLevel = this.getWeaponMasteryInfo(baseWeaponId).level;
      weaponPower += upgradeLevel * 44;
      masteryPower += Math.max(0, masteryLevel - 1) * 8;
    }

    return Math.max(
      basePower,
      Math.floor(basePower + damagePower + hpPower + speedPower + pickupPower + weaponPower + masteryPower)
    );
  }

  appendRunStats(survivalTime: number, kills: number): void {
    this.data.totalRuns += 1;
    this.data.totalKills += Math.max(0, Math.floor(kills));
    this.data.bestSurvivalTime = Math.max(this.data.bestSurvivalTime, Math.max(0, Math.floor(survivalTime)));
    this.save();
  }

  markTutorialSeen(): void {
    this.data.tutorialSeen = true;
    this.save();
  }

  setDebugMode(enabled: boolean): void {
    this.data.debugMode = !!enabled;
    this.save();
  }

  getSettings(): GameSettings {
    return {
      ...this.data.settings
    };
  }

  setSfxEnabled(enabled: boolean): void {
    this.data.settings.sfxEnabled = !!enabled;
    this.save();
  }

  setVibrationEnabled(enabled: boolean): void {
    this.data.settings.vibrationEnabled = !!enabled;
    this.save();
  }

  setPerformanceMode(mode: PerformanceMode): void {
    this.data.settings.performanceMode = this.toPerformanceMode(mode) || defaultSettings.performanceMode;
    this.save();
  }

  setMoveSensitivity(value: number): void {
    this.data.settings.moveSensitivity = this.clampMoveSensitivity(value);
    this.save();
  }

  resetSave(): void {
    this.data = this.createDefaultSaveData();
    this.ensureDailyQuests();
    this.save();
  }

  canClaimDailyChest(now = new Date()): boolean {
    return this.data.dailyChestClaimDate !== this.getDateKey(now);
  }

  claimDailyChest(
    now = new Date()
  ): { ok: boolean; rewards: Array<{ baseWeaponId: string; amount: number }> } {
    if (!this.canClaimDailyChest(now)) {
      return {
        ok: false,
        rewards: []
      };
    }

    const rewards = this.rollDailyChestFragmentReward();
    for (const reward of rewards) {
      this.data.weaponFragments[reward.baseWeaponId] = this.getWeaponFragments(reward.baseWeaponId) + reward.amount;
    }
    this.data.dailyChestClaimDate = this.getDateKey(now);
    this.save();

    return {
      ok: true,
      rewards
    };
  }

  rollDailyChestFragmentReward(): Array<{ baseWeaponId: string; amount: number }> {
    const rewards: Array<{ baseWeaponId: string; amount: number }> = [];
    const first = this.pickRandomBaseWeapon();
    rewards.push({
      baseWeaponId: first,
      amount: 6 + Math.floor(Math.random() * 5)
    });

    if (Math.random() < 0.42) {
      const second = this.pickRandomBaseWeapon(first);
      rewards.push({
        baseWeaponId: second,
        amount: 3 + Math.floor(Math.random() * 4)
      });
    }

    return rewards;
  }

  grantRunWeaponFragments(
    baseWeaponIdsInRun: string[],
    survivalTime: number,
    kills: number,
    evolvedBaseIds: string[] = []
  ): Array<{ baseWeaponId: string; amount: number }> {
    if (baseWeaponIdsInRun.length <= 0) {
      return [];
    }

    const uniqueBaseIds = Array.from(
      new Set(baseWeaponIdsInRun.filter((id) => baseWeaponIds.indexOf(id) >= 0))
    );
    if (uniqueBaseIds.length <= 0) {
      return [];
    }

    const evolvedSet = new Set(evolvedBaseIds);
    const baseGain = Math.max(1, 1 + Math.floor(survivalTime / 95) + Math.floor(kills / 70));
    const rewards: Array<{ baseWeaponId: string; amount: number }> = [];

    for (const baseId of uniqueBaseIds) {
      let gain = baseGain;
      if (evolvedSet.has(baseId)) {
        gain += 2;
      }
      if (kills >= 180) {
        gain += 1;
      }
      if (Math.random() < 0.25) {
        gain += 1;
      }

      rewards.push({
        baseWeaponId: baseId,
        amount: Math.max(1, gain)
      });
    }

    for (const reward of rewards) {
      this.data.weaponFragments[reward.baseWeaponId] = this.getWeaponFragments(reward.baseWeaponId) + reward.amount;
    }
    this.save();

    return rewards;
  }

  addWeaponFragments(baseWeaponId: string, amount: number): number {
    if (baseWeaponIds.indexOf(baseWeaponId) < 0) {
      return 0;
    }

    const gain = Math.max(0, Math.floor(amount));
    if (gain <= 0) {
      return this.getWeaponFragments(baseWeaponId);
    }

    this.data.weaponFragments[baseWeaponId] = this.getWeaponFragments(baseWeaponId) + gain;
    this.save();
    return this.data.weaponFragments[baseWeaponId];
  }

  addWeaponFragmentBundle(rewards: Array<{ baseWeaponId: string; amount: number }>): void {
    let changed = false;
    for (const reward of rewards) {
      if (!reward || baseWeaponIds.indexOf(reward.baseWeaponId) < 0) {
        continue;
      }
      const gain = Math.max(0, Math.floor(reward.amount));
      if (gain <= 0) {
        continue;
      }
      this.data.weaponFragments[reward.baseWeaponId] = this.getWeaponFragments(reward.baseWeaponId) + gain;
      changed = true;
    }
    if (changed) {
      this.save();
    }
  }

  getWeaponFragments(baseWeaponId: string): number {
    return Math.max(0, Math.floor(this.data.weaponFragments[baseWeaponId] || 0));
  }

  getWeaponUpgradeInfo(baseWeaponId: string): WeaponUpgradeInfo {
    const template = this.getWeaponUpgradeTemplate(baseWeaponId);
    if (!template) {
      return {
        baseWeaponId,
        level: 0,
        maxLevel: 0,
        fragments: this.getWeaponFragments(baseWeaponId),
        nextCost: 0,
        canUpgrade: false,
        damageBonus: 0,
        unlockedSkills: [],
        nextSkill: null
      };
    }

    const level = Math.max(0, Math.min(template.maxLevel, Math.floor(this.data.weaponUpgradeLevels[baseWeaponId] || 0)));
    const fragments = this.getWeaponFragments(baseWeaponId);
    const nextCost = level >= template.maxLevel ? 0 : template.costs[level] || 0;
    const unlockedSkills = template.skills.filter((item) => level >= item.unlockLevel);
    const nextSkill = template.skills.find((item) => item.unlockLevel > level) || null;

    return {
      baseWeaponId,
      level,
      maxLevel: template.maxLevel,
      fragments,
      nextCost,
      canUpgrade: level < template.maxLevel && nextCost > 0 && fragments >= nextCost,
      damageBonus: level * template.damageBonusPerLevel,
      unlockedSkills,
      nextSkill
    };
  }

  getWeaponUpgradeInfos(): WeaponUpgradeInfo[] {
    return baseWeaponIds.map((baseId) => this.getWeaponUpgradeInfo(baseId));
  }

  tryUpgradeWeapon(baseWeaponId: string): {
    ok: boolean;
    reason?: "invalid" | "max" | "fragment";
    cost: number;
    level: number;
    unlockedSkills: WeaponSkillDefinition[];
    info: WeaponUpgradeInfo;
  } {
    const template = this.getWeaponUpgradeTemplate(baseWeaponId);
    if (!template) {
      const info = this.getWeaponUpgradeInfo(baseWeaponId);
      return {
        ok: false,
        reason: "invalid",
        cost: 0,
        level: info.level,
        unlockedSkills: [],
        info
      };
    }

    const level = this.getWeaponUpgradeInfo(baseWeaponId).level;
    if (level >= template.maxLevel) {
      const info = this.getWeaponUpgradeInfo(baseWeaponId);
      return {
        ok: false,
        reason: "max",
        cost: 0,
        level: info.level,
        unlockedSkills: [],
        info
      };
    }

    const cost = template.costs[level] || 0;
    if (this.getWeaponFragments(baseWeaponId) < cost) {
      const info = this.getWeaponUpgradeInfo(baseWeaponId);
      return {
        ok: false,
        reason: "fragment",
        cost,
        level: info.level,
        unlockedSkills: [],
        info
      };
    }

    this.data.weaponFragments[baseWeaponId] = this.getWeaponFragments(baseWeaponId) - cost;
    this.data.weaponUpgradeLevels[baseWeaponId] = level + 1;
    this.save();

    const info = this.getWeaponUpgradeInfo(baseWeaponId);
    const unlockedSkills = info.unlockedSkills.filter((item) => item.unlockLevel === info.level);
    return {
      ok: true,
      cost,
      level: info.level,
      unlockedSkills,
      info
    };
  }

  getWeaponDamageBonus(baseWeaponId: string): number {
    return this.getWeaponUpgradeInfo(baseWeaponId).damageBonus;
  }

  getWeaponUnlockedSkills(baseWeaponId: string): WeaponSkillDefinition[] {
    return this.getWeaponUpgradeInfo(baseWeaponId).unlockedSkills;
  }

  getWeaponUnlockedSkillIds(baseWeaponId: string): string[] {
    return this.getWeaponUpgradeInfo(baseWeaponId).unlockedSkills.map((item) => item.id);
  }

  canClaimDailyChallengeReward(now = new Date()): boolean {
    return this.data.dailyChallengeRewardClaimDate !== this.getDateKey(now);
  }

  isDailyChallengeRewardClaimed(now = new Date()): boolean {
    return !this.canClaimDailyChallengeReward(now);
  }

  markDailyChallengeRewardClaimed(now = new Date()): void {
    this.data.dailyChallengeRewardClaimDate = this.getDateKey(now);
    this.save();
  }

  unlockAllEvolutionDebug(allEvolutionIds: string[]): void {
    this.data.unlockedEvolutionIds = [...allEvolutionIds];
    this.save();
  }

  addDna(amount: number): void {
    if (amount <= 0) {
      return;
    }
    this.data.dna += Math.floor(amount);
    this.save();
  }

  spendDna(amount: number): boolean {
    const cost = Math.max(0, Math.floor(amount));
    if (cost <= 0) {
      return true;
    }
    if (this.data.dna < cost) {
      return false;
    }
    this.data.dna -= cost;
    this.save();
    return true;
  }

  getMetaUpgradeShopItems(): MetaUpgradeShopItem[] {
    return metaUpgradeTemplates.map((template) => {
      const level = this.getMetaUpgradeLevel(template.id);
      const maxed = level >= template.maxLevel;
      const nextCost = maxed ? 0 : this.getMetaUpgradeCost(template, level);

      return {
        id: template.id,
        title: template.title,
        description: template.description,
        level,
        maxLevel: template.maxLevel,
        nextCost,
        currentValue: this.getMetaUpgradeValueText(template.id, level),
        nextValue: this.getMetaUpgradeValueText(template.id, Math.min(template.maxLevel, level + 1)),
        canBuy: !maxed && this.data.dna >= nextCost
      };
    });
  }

  purchaseMetaUpgrade(
    rawId: string
  ): { ok: boolean; reason?: "invalid" | "max" | "dna"; title?: string; cost: number; level: number } {
    const id = this.toMetaUpgradeType(rawId);
    if (!id) {
      return { ok: false, reason: "invalid", cost: 0, level: 0 };
    }

    const result = this.purchaseMetaUpgradeByType(id, true);
    return result;
  }

  getMetaUpgradeResetPreview(): { spent: number; refund: number; ratio: number } {
    const spent = this.calcMetaUpgradeTotalSpent();
    return {
      spent,
      refund: Math.floor(spent * META_RESET_REFUND_RATIO),
      ratio: META_RESET_REFUND_RATIO
    };
  }

  resetMetaUpgrades(): { ok: boolean; spent: number; refund: number } {
    const preview = this.getMetaUpgradeResetPreview();
    if (preview.spent <= 0) {
      return {
        ok: false,
        spent: 0,
        refund: 0
      };
    }

    this.data.metaUpgradeLevels = { ...defaultMetaUpgradeLevels };
    this.data.dna += preview.refund;
    this.save();

    return {
      ok: true,
      spent: preview.spent,
      refund: preview.refund
    };
  }

  applyMetaUpgradePlan(planId: "starter" | "hardcore"): {
    ok: boolean;
    purchased: number;
    spent: number;
    upgrades: Array<{ id: MetaUpgradeType; count: number }>;
  } {
    const priorities = planId === "starter" ? starterPlanPriority : hardcorePlanPriority;

    const upgradeCountMap: Record<MetaUpgradeType, number> = {
      damage: 0,
      maxHp: 0,
      moveSpeed: 0,
      pickup: 0
    };

    let purchased = 0;
    let spent = 0;

    for (let guard = 0; guard < 260; guard += 1) {
      let boughtThisRound = false;

      for (const type of priorities) {
        const result = this.purchaseMetaUpgradeByType(type, false);
        if (!result.ok) {
          continue;
        }

        boughtThisRound = true;
        purchased += 1;
        spent += result.cost;
        upgradeCountMap[type] += 1;
      }

      if (!boughtThisRound) {
        break;
      }
    }

    if (purchased > 0) {
      this.save();
    }

    return {
      ok: purchased > 0,
      purchased,
      spent,
      upgrades: priorities
        .filter((id) => upgradeCountMap[id] > 0)
        .map((id) => ({ id, count: upgradeCountMap[id] }))
    };
  }

  getMetaUpgradeEffects(): MetaUpgradeEffects {
    const damageLv = this.getMetaUpgradeLevel("damage");
    const hpLv = this.getMetaUpgradeLevel("maxHp");
    const moveLv = this.getMetaUpgradeLevel("moveSpeed");
    const pickupLv = this.getMetaUpgradeLevel("pickup");

    return {
      damageBonus: damageLv * 0.03,
      maxHpBonus: hpLv * 8,
      moveSpeedBonus: moveLv * 0.025,
      pickupBonus: pickupLv * 10
    };
  }

  getWeaponMasteryExp(baseWeaponId: string): number {
    return Math.max(0, Math.floor(this.data.weaponMasteryExp[baseWeaponId] || 0));
  }

  addRunWeaponMastery(
    baseWeaponIdsInRun: string[],
    survivalTime: number,
    kills: number,
    evolvedBaseIds: string[] = []
  ): Array<{ baseWeaponId: string; gain: number; levelBefore: number; levelAfter: number }> {
    const result: Array<{ baseWeaponId: string; gain: number; levelBefore: number; levelAfter: number }> = [];

    if (baseWeaponIdsInRun.length <= 0) {
      return result;
    }

    const uniqueBaseIds = Array.from(new Set(baseWeaponIdsInRun));
    const evolvedSet = new Set(evolvedBaseIds);

    for (const baseWeaponId of uniqueBaseIds) {
      const before = this.getWeaponMasteryInfo(baseWeaponId);
      const baseGain = 12 + Math.floor(survivalTime * 0.28 + kills * 0.42);
      const evolveBonus = evolvedSet.has(baseWeaponId) ? 28 : 0;
      const gain = Math.max(8, baseGain + evolveBonus);

      this.data.weaponMasteryExp[baseWeaponId] = this.getWeaponMasteryExp(baseWeaponId) + gain;

      const after = this.getWeaponMasteryInfo(baseWeaponId);
      result.push({
        baseWeaponId,
        gain,
        levelBefore: before.level,
        levelAfter: after.level
      });
    }

    this.save();
    return result;
  }

  getWeaponMasteryInfo(baseWeaponId: string): WeaponMasteryInfo {
    let remain = this.getWeaponMasteryExp(baseWeaponId);
    let level = 1;
    let need = this.getMasteryNeed(level);

    while (remain >= need && level < 99) {
      remain -= need;
      level += 1;
      need = this.getMasteryNeed(level);
    }

    return {
      level,
      progress: need > 0 ? remain / need : 1,
      current: remain,
      need,
      totalExp: this.getWeaponMasteryExp(baseWeaponId)
    };
  }

  getDailyQuests(now = new Date()): DailyQuestProgress[] {
    this.ensureDailyQuests(now);
    return this.data.dailyQuests;
  }

  applyRunToDailyQuests(summary: DailyQuestRunSummary, now = new Date()): DailyQuestProgress[] {
    this.ensureDailyQuests(now);

    const newlyCompleted: DailyQuestProgress[] = [];

    for (const quest of this.data.dailyQuests) {
      const before = quest.progress;
      const delta = this.getQuestProgressDelta(quest.type, summary);
      if (delta <= 0) {
        continue;
      }

      quest.progress = Math.min(quest.target, quest.progress + delta);
      if (before < quest.target && quest.progress >= quest.target) {
        newlyCompleted.push(quest);
      }
    }

    if (newlyCompleted.length > 0) {
      this.save();
    } else {
      this.persistDailyQuestIfNeeded();
    }

    return newlyCompleted;
  }

  claimDailyQuest(questId: string, now = new Date()): { ok: boolean; rewardDna: number } {
    this.ensureDailyQuests(now);

    const quest = this.data.dailyQuests.find((item) => item.id === questId);
    if (!quest || quest.claimed || quest.progress < quest.target) {
      return { ok: false, rewardDna: 0 };
    }

    quest.claimed = true;
    const rewardDna = Math.max(0, Math.floor(quest.rewardDna));
    if (rewardDna > 0) {
      this.data.dna += rewardDna;
    }

    this.save();
    return {
      ok: true,
      rewardDna
    };
  }

  private migrateSaveData(raw: any): any {
    if (!raw || typeof raw !== "object") {
      return {};
    }

    let out = { ...raw };
    const version = this.detectSaveVersion(out);

    if (version < 2) {
      out = this.migrateV1ToV2(out);
    }
    if (version < 3) {
      out = this.migrateV2ToV3(out);
    }

    out.version = SAVE_VERSION;
    return out;
  }

  private detectSaveVersion(raw: any): number {
    if (typeof raw.version === "number" && Number.isFinite(raw.version)) {
      return Math.max(1, Math.floor(raw.version));
    }

    if (raw.storyUnlockedChapterLevel || raw.storyChapterBestStars || raw.storyChapterFirstClearIds) {
      return 3;
    }

    if (raw.weaponFragments || raw.weaponUpgradeLevels) {
      return 2;
    }

    return 1;
  }

  private migrateV1ToV2(raw: any): any {
    const out = { ...raw };
    if (!out.weaponFragments || typeof out.weaponFragments !== "object") {
      out.weaponFragments = createEmptyWeaponFragments();
    }
    if (!out.weaponUpgradeLevels || typeof out.weaponUpgradeLevels !== "object") {
      out.weaponUpgradeLevels = createEmptyWeaponUpgradeLevels();
    }

    const legacyStartBuffCharges =
      typeof out.freeStartBuffCharges === "number" && Number.isFinite(out.freeStartBuffCharges)
        ? Math.max(0, Math.floor(out.freeStartBuffCharges))
        : 0;
    if (legacyStartBuffCharges > 0) {
      const baseDna = typeof out.dna === "number" && Number.isFinite(out.dna) ? Math.max(0, Math.floor(out.dna)) : 0;
      out.dna = baseDna + legacyStartBuffCharges * LEGACY_START_BUFF_DNA_COMPENSATION;
    }

    delete out.freeStartBuffCharges;
    return out;
  }

  private migrateV2ToV3(raw: any): any {
    const out = { ...raw };
    if (typeof out.storyUnlockedChapterLevel !== "number" || !Number.isFinite(out.storyUnlockedChapterLevel)) {
      out.storyUnlockedChapterLevel = 1;
    }
    if (!out.storyChapterBestStars || typeof out.storyChapterBestStars !== "object") {
      out.storyChapterBestStars = createEmptyStoryChapterStars();
    }
    if (!Array.isArray(out.storyChapterFirstClearIds)) {
      out.storyChapterFirstClearIds = [];
    }
    return out;
  }

  private createDefaultSaveData(): SaveData {
    return {
      ...defaultSaveData,
      version: SAVE_VERSION,
      storyUnlockedChapterLevel: 1,
      storyChapterBestStars: createEmptyStoryChapterStars(),
      storyChapterFirstClearIds: [],
      weaponFragments: createEmptyWeaponFragments(),
      weaponUpgradeLevels: createEmptyWeaponUpgradeLevels(),
      metaUpgradeLevels: { ...defaultMetaUpgradeLevels },
      settings: { ...defaultSettings }
    };
  }

  private getWeaponUpgradeTemplate(baseWeaponId: string): WeaponUpgradeTemplate | null {
    return weaponUpgradeTemplates[baseWeaponId] || null;
  }

  private pickRandomBaseWeapon(exceptId = ""): string {
    const candidates = baseWeaponIds.filter((id) => id !== exceptId);
    if (candidates.length <= 0) {
      return baseWeaponIds[0];
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private getMetaUpgradeLevel(id: MetaUpgradeType): number {
    return Math.max(0, Math.floor(this.data.metaUpgradeLevels[id] || 0));
  }

  private getMetaUpgradeCost(template: MetaUpgradeTemplate, level: number): number {
    return Math.max(20, Math.floor(template.baseCost * Math.pow(template.costScale, Math.max(0, level))));
  }

  private getMetaUpgradeValueText(id: MetaUpgradeType, level: number): string {
    if (id === "damage") {
      return `伤害 +${(level * 3).toFixed(0)}%`;
    }
    if (id === "maxHp") {
      return `最大生命 +${level * 8}`;
    }
    if (id === "moveSpeed") {
      return `移速 +${(level * 2.5).toFixed(1)}%`;
    }
    return `拾取范围 +${level * 10}`;
  }

  private calcMetaUpgradeTotalSpent(): number {
    let total = 0;

    for (const template of metaUpgradeTemplates) {
      const level = this.getMetaUpgradeLevel(template.id);
      for (let i = 0; i < level; i += 1) {
        total += this.getMetaUpgradeCost(template, i);
      }
    }

    return total;
  }

  private purchaseMetaUpgradeByType(
    id: MetaUpgradeType,
    autoSave: boolean
  ): { ok: boolean; reason?: "invalid" | "max" | "dna"; title?: string; cost: number; level: number } {
    const template = metaUpgradeTemplates.find((item) => item.id === id);
    if (!template) {
      return { ok: false, reason: "invalid", cost: 0, level: 0 };
    }

    const level = this.getMetaUpgradeLevel(id);
    if (level >= template.maxLevel) {
      return { ok: false, reason: "max", title: template.title, cost: 0, level };
    }

    const cost = this.getMetaUpgradeCost(template, level);
    if (this.data.dna < cost) {
      return { ok: false, reason: "dna", title: template.title, cost, level };
    }

    this.data.dna -= cost;
    this.data.metaUpgradeLevels[id] = level + 1;

    if (autoSave) {
      this.save();
    }

    return {
      ok: true,
      title: template.title,
      cost,
      level: level + 1
    };
  }

  private ensureDailyQuests(now = new Date()): void {
    const dateKey = this.getDateKey(now);

    if (this.data.dailyQuestDate === dateKey && this.data.dailyQuests.length === 3) {
      return;
    }

    this.data.dailyQuestDate = dateKey;
    this.data.dailyQuests = this.buildDailyQuests(dateKey);
    this.save();
  }

  private persistDailyQuestIfNeeded(): void {
    if (!this.data.dailyQuests || this.data.dailyQuests.length <= 0) {
      return;
    }
    this.save();
  }

  private buildDailyQuests(dateKey: string): DailyQuestProgress[] {
    const indices = dailyQuestTemplates.map((_, index) => index);
    let seed = this.hashString(dateKey);

    for (let i = indices.length - 1; i > 0; i -= 1) {
      seed = this.nextSeed(seed);
      const j = seed % (i + 1);
      const temp = indices[i];
      indices[i] = indices[j];
      indices[j] = temp;
    }

    return indices.slice(0, 3).map((templateIndex, idx) => {
      const template = dailyQuestTemplates[templateIndex];
      return {
        id: `${dateKey}_${template.type}_${idx}`,
        type: template.type,
        title: template.title,
        description: template.description,
        target: template.target,
        progress: 0,
        rewardDna: template.rewardDna,
        claimed: false
      };
    });
  }

  private getQuestProgressDelta(type: DailyQuestType, summary: DailyQuestRunSummary): number {
    if (type === "kill") {
      return Math.max(0, Math.floor(summary.kills));
    }
    if (type === "survive") {
      return Math.max(0, Math.floor(summary.survivalTime));
    }
    if (type === "evolution") {
      return Math.max(0, Math.floor(summary.evolutionCount));
    }
    if (type === "boss_batch") {
      return Math.max(0, Math.floor(summary.endlessBossBatchReached));
    }
    return Math.max(0, Math.floor(summary.fusionCount));
  }

  private sanitizeWeaponFragments(raw: any): Record<string, number> {
    const map = createEmptyWeaponFragments();
    if (!raw || typeof raw !== "object") {
      return map;
    }

    for (const baseId of baseWeaponIds) {
      const value = raw[baseId];
      if (typeof value === "number" && value > 0) {
        map[baseId] = Math.floor(value);
      }
    }
    return map;
  }

  private sanitizeWeaponUpgradeLevels(raw: any): Record<string, number> {
    const map = createEmptyWeaponUpgradeLevels();
    if (!raw || typeof raw !== "object") {
      return map;
    }

    for (const baseId of baseWeaponIds) {
      const value = raw[baseId];
      const template = this.getWeaponUpgradeTemplate(baseId);
      if (typeof value !== "number" || !template) {
        continue;
      }
      map[baseId] = Math.max(0, Math.min(template.maxLevel, Math.floor(value)));
    }
    return map;
  }

  private sanitizeMasteryExp(raw: any): Record<string, number> {
    if (!raw || typeof raw !== "object") {
      return {};
    }

    const map: Record<string, number> = {};
    Object.keys(raw).forEach((key) => {
      const value = raw[key];
      if (typeof value === "number" && value > 0) {
        map[key] = Math.floor(value);
      }
    });
    return map;
  }

  private sanitizeStoryChapterBestStars(raw: any): Record<string, number> {
    const out: Record<string, number> = {};
    if (!raw || typeof raw !== "object") {
      return out;
    }

    Object.keys(raw).forEach((key) => {
      const value = raw[key];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return;
      }
      out[key] = Math.max(0, Math.min(3, Math.floor(value)));
    });
    return out;
  }

  private sanitizeStoryChapterFirstClearIds(raw: any): string[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return Array.from(
      new Set(
        raw
          .filter((item) => typeof item === "string")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      )
    );
  }

  private sanitizeDailyQuests(raw: any): DailyQuestProgress[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    const out: DailyQuestProgress[] = [];

    for (const item of raw) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const type = this.toQuestType(item.type);
      if (!type) {
        continue;
      }

      out.push({
        id: typeof item.id === "string" ? item.id : `${Date.now()}_${Math.random()}`,
        type,
        title: typeof item.title === "string" ? item.title : "每日任务",
        description: typeof item.description === "string" ? item.description : "",
        target: Math.max(1, Math.floor(typeof item.target === "number" ? item.target : 1)),
        progress: Math.max(0, Math.floor(typeof item.progress === "number" ? item.progress : 0)),
        rewardDna: Math.max(0, Math.floor(typeof item.rewardDna === "number" ? item.rewardDna : 0)),
        claimed: !!item.claimed
      });
    }

    return out.slice(0, 3);
  }

  private sanitizeMetaUpgradeLevels(raw: any): Record<MetaUpgradeType, number> {
    const safe = { ...defaultMetaUpgradeLevels };

    if (!raw || typeof raw !== "object") {
      return safe;
    }

    for (const template of metaUpgradeTemplates) {
      const value = raw[template.id];
      if (typeof value !== "number") {
        continue;
      }
      safe[template.id] = Math.max(0, Math.min(template.maxLevel, Math.floor(value)));
    }

    return safe;
  }

  private sanitizeSettings(raw: any): GameSettings {
    if (!raw || typeof raw !== "object") {
      return { ...defaultSettings };
    }

    return {
      sfxEnabled: raw.sfxEnabled !== false,
      vibrationEnabled: raw.vibrationEnabled !== false,
      performanceMode: this.toPerformanceMode(raw.performanceMode) || defaultSettings.performanceMode,
      moveSensitivity: this.clampMoveSensitivity(
        typeof raw.moveSensitivity === "number" ? raw.moveSensitivity : defaultSettings.moveSensitivity
      )
    };
  }

  private sanitizeNonNegative(value: any): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.floor(value));
  }

  private toQuestType(type: any): DailyQuestType | null {
    if (type === "kill" || type === "survive" || type === "evolution" || type === "boss_batch" || type === "fusion") {
      return type;
    }
    return null;
  }

  private toMetaUpgradeType(type: any): MetaUpgradeType | null {
    if (type === "damage" || type === "maxHp" || type === "moveSpeed" || type === "pickup") {
      return type;
    }
    return null;
  }

  private toPerformanceMode(mode: any): PerformanceMode | null {
    if (mode === "quality" || mode === "balanced" || mode === "performance") {
      return mode;
    }
    return null;
  }

  private clampMoveSensitivity(value: number): number {
    return Math.max(0.7, Math.min(1.6, Number.isFinite(value) ? value : 1));
  }

  private hashString(text: string): number {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  private nextSeed(seed: number): number {
    const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return next;
  }

  private getMasteryNeed(level: number): number {
    return 50 + Math.max(0, level - 1) * 26;
  }

  private getDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}
