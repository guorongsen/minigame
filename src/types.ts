export interface Vec2 {
  x: number;
  y: number;
}

export type ElementType = "fire" | "ice" | "lightning" | "poison";

export type WeaponPattern =
  | "knife"
  | "fireball"
  | "shockwave"
  | "laser"
  | "punch"
  | "blade_storm"
  | "chain_fireball"
  | "ice_quake"
  | "corrosion_laser"
  | "flame_punch"
  | "arc_knives"
  | "frostfire_orb"
  | "toxic_wave"
  | "solar_laser"
  | "storm_punch"
  | "prism_laser"
  | "shadow_daggers";

export interface WeaponConfig {
  id: string;
  baseId: string;
  name: string;
  color: string;
  pattern: WeaponPattern;
  description: string;
  isEvolution?: boolean;
  cooldown: number;
  damage: number;
  speed?: number;
  projectileRadius?: number;
  pierce?: number;
  life?: number;
  range?: number;
  radius?: number;
  beamWidth?: number;
  shots?: number;
  maxLevel: number;
}

export interface ElementConfig {
  id: ElementType;
  name: string;
  color: string;
  description: string;
}

export interface EvolutionConfig {
  id: string;
  name: string;
  fromWeaponId: string;
  toWeaponId: string;
  requiredElement?: ElementType;
  requiredWeaponLevel?: number;
  description: string;
  color: string;
}

export interface CharacterMutationGeneConfig {
  id: string;
  name: string;
  color: string;
  description: string;
}

export interface CharacterMutationFusionEffects {
  damageAdd?: number;
  cooldownMul?: number;
  moveSpeedAdd?: number;
  maxHpAdd?: number;
  pickupAdd?: number;
  heal?: number;
}

export interface CharacterMutationFusionConfig {
  id: string;
  name: string;
  requiresGeneIds: string[];
  color: string;
  description: string;
  effects: CharacterMutationFusionEffects;
}

export type EnemyArchetype = "normal" | "swift" | "ranged" | "shield";

export interface EnemyConfig {
  id: string;
  name: string;
  color: string;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  expDrop: number;
  spawnWeight: number;
  minTime: number;
  maxTime: number;
  archetype?: EnemyArchetype;
  shieldRatio?: number;
  isBoss?: boolean;
}

export interface StageConfig {
  id: string;
  level: number;
  name: string;
  startTime: number;
  enemyIds: string[];
  enemyHpMul: number;
  enemySpeedMul: number;
  enemyDamageMul: number;
  spawnIntervalMul: number;
  eliteIntervalMul: number;
  spawnCountBonus: number;
  weightByEnemyId?: Record<string, number>;
}

export interface FragmentReward {
  baseWeaponId: string;
  amount: number;
}

export interface StoryChapterStarGoals {
  killTarget: number;
}

export interface StoryChapterBossTuning {
  hpMul: number;
  speedMul: number;
  damageMul: number;
}

export interface StoryChapterConfig {
  id: string;
  level: number;
  name: string;
  description: string;
  storyClearTime: number;
  startStageLevel: number;
  enemyHpMul: number;
  enemySpeedMul: number;
  enemyDamageMul: number;
  spawnIntervalMul: number;
  recommendedPower?: number;
  starGoals?: StoryChapterStarGoals;
  firstClearFragmentRewards?: FragmentReward[];
  enemyWeightMulById?: Record<string, number>;
  bossTuning?: StoryChapterBossTuning;
}

export type UpgradeCategory =
  | "new_weapon"
  | "weapon_level"
  | "element"
  | "passive"
  | "recovery"
  | "temp_buff";

export interface UpgradeDefinition {
  id: string;
  category: UpgradeCategory;
  title: string;
  description: string;
  color: string;
  weight: number;
}

export interface UpgradeOption {
  id: string;
  title: string;
  description: string;
  category: UpgradeCategory;
  color: string;
  apply: () => void;
  requiresAd?: boolean;
  adPlacement?: AdPlacement;
}

export interface ChestMutationRollResult {
  weaponOptions: UpgradeOption[];
  characterOptions: UpgradeOption[];
  forcedWeaponEvolutionAssist: boolean;
}

export interface Projectile {
  id: number;
  weaponId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  color: string;
  pierce: number;
  element?: ElementType;
  splashRadius?: number;
  hitIds: Set<number>;
}

export type AreaShape = "circle" | "line";

export interface AreaAttack {
  id: number;
  weaponId: string;
  shape: AreaShape;
  x: number;
  y: number;
  radius?: number;
  x2?: number;
  y2?: number;
  width?: number;
  damage: number;
  life: number;
  color: string;
  element?: ElementType;
  hitIds: Set<number>;
}

export interface ExpOrb {
  id: number;
  x: number;
  y: number;
  value: number;
  radius: number;
  life: number;
}

export interface Chest {
  id: number;
  x: number;
  y: number;
  radius: number;
  life: number;
  opened: boolean;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
}

export interface PassiveStats {
  damageMultiplier: number;
  cooldownMultiplier: number;
  moveSpeedMultiplier: number;
  pickupRange: number;
  maxHpBonus: number;
}

export type AdPlacement =
  | "revive"
  | "chestBoost"
  | "startBuff"
  | "extraUpgrade"
  | "doubleReward";

export interface AdGateResult {
  ok: boolean;
  reason?: "playing" | "min_run_time" | "cooldown" | "unsupported" | "ad_unit_missing" | "disabled";
  remainSeconds?: number;
}

export type DailyQuestType = "kill" | "survive" | "evolution" | "boss_batch" | "fusion";

export interface DailyChallengeTemplate {
  id: string;
  name: string;
  description: string;
  color: string;
  targetSurviveSeconds: number;
  bossTime: number;
  enemyHpMul: number;
  enemySpeedMul: number;
  spawnIntervalMul: number;
  playerDamageMul?: number;
  startElement?: ElementType;
  rewardBonusDna: number;
}

export interface DailyQuestProgress {
  id: string;
  type: DailyQuestType;
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardDna: number;
  claimed: boolean;
}

export type MetaUpgradeType = "damage" | "maxHp" | "moveSpeed" | "pickup";

export interface MetaUpgradeShopItem {
  id: MetaUpgradeType;
  title: string;
  description: string;
  level: number;
  maxLevel: number;
  nextCost: number;
  currentValue: string;
  nextValue: string;
  canBuy: boolean;
}

export interface MetaUpgradeEffects {
  damageBonus: number;
  maxHpBonus: number;
  moveSpeedBonus: number;
  pickupBonus: number;
}

export type PerformanceMode = "quality" | "balanced" | "performance";

export interface GameSettings {
  sfxEnabled: boolean;
  vibrationEnabled: boolean;
  performanceMode: PerformanceMode;
  moveSensitivity: number;
}

export interface SaveData {
  version: number;
  unlockedEvolutionIds: string[];
  storyUnlockedChapterLevel: number;
  storyChapterBestStars: Record<string, number>;
  storyChapterFirstClearIds: string[];
  bestSurvivalTime: number;
  totalKills: number;
  totalRuns: number;
  tutorialSeen: boolean;
  debugMode: boolean;
  dailyChestClaimDate: string;
  dna: number;
  weaponFragments: Record<string, number>;
  weaponUpgradeLevels: Record<string, number>;
  weaponMasteryExp: Record<string, number>;
  dailyQuestDate: string;
  dailyQuests: DailyQuestProgress[];
  metaUpgradeLevels: Record<MetaUpgradeType, number>;
  dailyChallengeRewardClaimDate: string;
  settings: GameSettings;
}

export interface WeaponSkillDefinition {
  id: string;
  title: string;
  description: string;
  unlockLevel: number;
}

export interface WeaponUpgradeInfo {
  baseWeaponId: string;
  level: number;
  maxLevel: number;
  fragments: number;
  nextCost: number;
  canUpgrade: boolean;
  damageBonus: number;
  unlockedSkills: WeaponSkillDefinition[];
  nextSkill: WeaponSkillDefinition | null;
}

export interface UIButton {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  textColor?: string;
}

export type AntiAddictionAgeGroup = "unknown" | "under8" | "age8to15" | "age16to17" | "adult";

export type AntiAddictionBlockReason =
  | "realname_required"
  | "face_verify_required"
  | "curfew"
  | "playtime_limit";

export interface AntiAddictionGateResult {
  ok: boolean;
  reason?: AntiAddictionBlockReason;
  message: string;
  remainSeconds?: number;
}

export interface AntiAddictionStatusSnapshot {
  enabled: boolean;
  realnameVerified: boolean;
  isMinor: boolean;
  needFaceVerify: boolean;
  ageGroup: AntiAddictionAgeGroup;
  authStatusText: string;
  playtimeTodaySeconds: number;
  playtimeLimitSeconds: number;
  playtimeRemainSeconds: number;
  gate: AntiAddictionGateResult;
}

export interface RuntimeStats {
  kills: number;
  survivalTime: number;
  level: number;
}




