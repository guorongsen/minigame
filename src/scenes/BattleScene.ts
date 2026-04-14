import { IScene } from "../core/Scene";
import { InputManager } from "../core/InputManager";
import { Boss } from "../entities/Boss";
import { Enemy } from "../entities/Enemy";
import { Player } from "../entities/Player";
import { AdManager } from "../managers/AdManager";
import { AnalyticsManager } from "../managers/AnalyticsManager";
import { AntiAddictionManager } from "../managers/AntiAddictionManager";
import { ConfigManager } from "../managers/ConfigManager";
import { SaveManager } from "../managers/SaveManager";
import { UIManager } from "../managers/UIManager";
import { ChestSystem } from "../systems/ChestSystem";
import { CharacterMutationSystem } from "../systems/CharacterMutationSystem";
import { CollisionSystem } from "../systems/CollisionSystem";
import { DropSystem } from "../systems/DropSystem";
import { DailyChallengeSystem } from "../systems/DailyChallengeSystem";
import { EffectSystem } from "../systems/EffectSystem";
import { EnemySpawner, SpawnMode } from "../systems/EnemySpawner";
import { EncyclopediaSystem } from "../systems/EncyclopediaSystem";
import { EvolutionSystem } from "../systems/EvolutionSystem";
import { ObstacleSystem } from "../systems/ObstacleSystem";
import { UpgradeApplyHooks, UpgradeSystem } from "../systems/UpgradeSystem";
import { WeaponSystem } from "../systems/WeaponSystem";
import {
  AdGateResult,
  AdPlacement,
  DailyChallengeTemplate,
  PerformanceMode,
  StoryChapterConfig,
  UpgradeOption,
  WeaponUpgradeInfo
} from "../types";
import { clamp } from "../utils/MathUtil";

export type BattlePhase =
  | "start"
  | "running"
  | "pause"
  | "upgrade"
  | "chest"
  | "death"
  | "settlement"
  | "encyclopedia";

type RunMode = SpawnMode;

interface BossHazard {
  id: number;
  x: number;
  y: number;
  radius: number;
  windup: number;
  life: number;
  damage: number;
  color: string;
  exploded: boolean;
}

let bossHazardAutoId = 1;

/**
 * Main playable scene for the MVP.
 */
export class BattleScene implements IScene {
  private phase: BattlePhase = "start";

  private readonly cfg = ConfigManager.getInstance();
  private readonly save = SaveManager.getInstance();
  private readonly ad = AdManager.getInstance();
  private readonly anti = AntiAddictionManager.getInstance();
  private readonly analytics = AnalyticsManager.getInstance();

  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private floorCacheCanvas: any | null = null;
  private floorCacheMode: PerformanceMode | "" = "";
  private floorCacheWidth = 0;
  private floorCacheHeight = 0;
  private floorCacheDisabled = false;
  private readonly playerSpritePath = "assets/characters/char_player_main_v1.png";
  private playerSprite: any | null = null;
  private playerSpriteReady = false;
  private playerSpriteLoadFailed = false;

  private cameraX = 0;
  private cameraY = 0;

  private readonly player: Player;
  private readonly enemies: Enemy[] = [];
  private readonly bossHazards: BossHazard[] = [];

  private readonly obstacleSystem = new ObstacleSystem();
  private readonly enemySpawner: EnemySpawner;
  private readonly weaponSystem = new WeaponSystem();
  private readonly evolutionSystem = new EvolutionSystem();
  private readonly characterMutationSystem = new CharacterMutationSystem();
  private readonly upgradeSystem = new UpgradeSystem();
  private readonly chestSystem = new ChestSystem();
  private readonly dropSystem = new DropSystem();
  private readonly dailyChallengeSystem = new DailyChallengeSystem();
  private readonly collisionSystem = new CollisionSystem();
  private readonly effectSystem = new EffectSystem();
  private readonly encyclopediaSystem = new EncyclopediaSystem();

  private elapsedTime = 0;
  private kills = 0;
  private pendingLevelUps = 0;
  private reviveUsed = false;
  private hasEvolvedThisRun = false;
  private evolutionCountThisRun = 0;
  private fusionCountThisRun = 0;
  private readonly evolvedBaseIdsThisRun = new Set<string>();
  private pityInjectedCount = 0;
  private pityHintShown = false;

  private readonly adListener: (placement: AdPlacement, state: "start" | "success" | "fail") => void;

  private levelUpOptions: UpgradeOption[] = [];
  private extraAdOption: UpgradeOption | null = null;

  private chestWeaponOptions: UpgradeOption[] = [];
  private chestCharacterOptions: UpgradeOption[] = [];
  private chestBoosted = false;

  private settleReward = 0;
  private settleDoubled = false;
  private settleFragmentRewards: Array<{ baseWeaponId: string; amount: number }> = [];
  private settleStoryStars = 0;
  private settleStoryBestStars = 0;
  private settleStoryStarTargetKills = 0;
  private settleStoryChapterLevel = 0;
  private settleStoryFirstClearRewards: Array<{ baseWeaponId: string; amount: number }> = [];

  private toast = "";
  private toastColor = "#ffffff";
  private toastTime = 0;

  private adStateText = "";
  private adStateTime = 0;
  private damageFlashTime = 0;
  private pendingConfirmAction: "reset_save" | "pause_exit" | "shop_reset_points" | "" = "";
  private pendingConfirmTime = 0;

  private evolutionHitStopTime = 0;
  private evolutionFlashTime = 0;
  private evolutionBannerTime = 0;
  private evolutionBannerText = "";
  private evolutionBannerColor = "#ffffff";

  private lobbyTab: "chest" | "home" | "weapon" | "mode" | "settings" = "home";
  private lobbyChestClaimed = false;
  private weaponPage = 0;
  private encyclopediaPage = 0;

  private selectedRunMode: RunMode = "story";
  private selectedStoryChapterLevel = 1;
  private runningStoryChapterLevel = 1;
  private runningStoryChapterName = "净化前线";
  private runningMode: RunMode = "story";
  private endlessBossBatchReached = 0;
  private activeDailyChallenge: DailyChallengeTemplate;
  private dailyChallengeCleared = false;
  private dailyChallengeBonusReward = 0;
  private currentStageLevel = 1;
  private currentStageName = "新手区";


  private storyFinalBossSpawned = false;
  private storyFinalBossKilled = false;
  private storyFinalBossId = 0;
  private storyFinalBossWarningShown = false;
  private perfSampleSeconds = 0;
  private perfSampleFrames = 0;
  private perfSampleFrameMsSum = 0;
  private perfSampleWorstFrameMs = 0;
  private perfFps = 0;
  private perfAvgFrameMs = 0;
  private perfWorstFrameMs = 0;
  private perfUpdateMs = 0;
  private perfRenderMs = 0;
  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly inputManager: InputManager,
    private readonly ui: UIManager
  ) {
    const balance = this.cfg.getBalance();
    this.worldWidth = Math.max(this.width + 220, Math.floor(this.width * (balance.mapWidthMultiplier || 3.2)));
    this.worldHeight = Math.max(this.height + 320, Math.floor(this.height * (balance.mapHeightMultiplier || 3.2)));

    this.player = new Player(this.worldWidth, this.worldHeight, this.cfg.getMaxWeaponsInRun());
    this.loadPlayerSprite();
    this.enemySpawner = new EnemySpawner(this.width, this.height, this.worldWidth, this.worldHeight);
    this.enemySpawner.setObstacleChecker((x, y, radius) => this.obstacleSystem.isCircleBlocked(x, y, radius));

    this.activeDailyChallenge = this.dailyChallengeSystem.getTodayChallenge();
    const chapters = this.getStoryChapters();
    if (chapters.length > 0) {
      const unlockedLevel = this.save.getUnlockedStoryChapterLevel();
      const preferred = chapters.filter((item) => item.level <= unlockedLevel).pop() || chapters[0];
      this.selectedStoryChapterLevel = preferred.level;
      this.runningStoryChapterLevel = preferred.level;
      this.runningStoryChapterName = preferred.name;
    }

    this.analytics.load();

    this.adListener = (placement, state) => {
      this.analytics.logEvent("ad_state", {
        placement,
        state
      });

      if (state === "start") {
        this.showAdState(`广告中：${this.getPlacementLabel(placement)}`);
      } else if (state === "success") {
        this.showAdState(`广告成功：${this.getPlacementLabel(placement)}`);
      } else {
        this.showAdState(`广告失败：${this.getPlacementLabel(placement)}`);
      }
    };

    this.ad.addListener(this.adListener);
    this.updateCamera();
    this.syncLobbyMeta();
    this.applySettingsToRuntime();
  }

  enter(): void {
    this.phase = "start";
    this.activeDailyChallenge = this.dailyChallengeSystem.getTodayChallenge();
    const chapters = this.getStoryChapters();
    if (chapters.length > 0 && !chapters.some((item) => item.level === this.selectedStoryChapterLevel)) {
      const unlockedLevel = this.save.getUnlockedStoryChapterLevel();
      const preferred = chapters.filter((item) => item.level <= unlockedLevel).pop() || chapters[0];
      this.selectedStoryChapterLevel = preferred.level;
    } else if (
      chapters.length > 0 &&
      !this.save.isStoryChapterUnlocked(this.selectedStoryChapterLevel)
    ) {
      const unlockedLevel = this.save.getUnlockedStoryChapterLevel();
      const preferred = chapters.filter((item) => item.level <= unlockedLevel).pop() || chapters[0];
      this.selectedStoryChapterLevel = preferred.level;
    }
    this.syncLobbyMeta();
    this.applySettingsToRuntime();
  }

  exit(): void {
    this.ad.removeListener(this.adListener);
  }

  private loadPlayerSprite(): void {
    const image = this.createRuntimeImage();
    if (!image) {
      this.playerSpriteLoadFailed = true;
      this.playerSpriteReady = false;
      this.playerSprite = null;
      return;
    }

    this.playerSprite = image;
    this.playerSpriteReady = false;
    this.playerSpriteLoadFailed = false;

    image.onload = () => {
      this.playerSpriteReady = true;
      this.playerSpriteLoadFailed = false;
    };

    image.onerror = () => {
      this.playerSpriteReady = false;
      this.playerSpriteLoadFailed = true;
      this.playerSprite = null;
    };

    image.src = this.playerSpritePath;
  }

  private createRuntimeImage(): any | null {
    try {
      const rootCanvas = (globalThis as any).canvas;
      if (rootCanvas && typeof rootCanvas.createImage === "function") {
        return rootCanvas.createImage();
      }
    } catch (error) {
      // Ignore and continue fallback.
    }

    try {
      if (typeof wx !== "undefined" && wx && typeof wx.createImage === "function") {
        return wx.createImage();
      }
    } catch (error) {
      // Ignore unsupported runtime.
    }

    return null;
  }

  update(dt: number): void {
    const debugPerfEnabled = this.save.getData().debugMode;
    const updateStart = debugPerfEnabled ? Date.now() : 0;
    try {
    if (this.toastTime > 0) {
      this.toastTime -= dt;
      if (this.toastTime <= 0) {
        this.toast = "";
      }
    }

    if (this.adStateTime > 0) {
      this.adStateTime -= dt;
      if (this.adStateTime <= 0) {
        this.adStateText = "";
      }
    }

    if (this.damageFlashTime > 0) {
      this.damageFlashTime -= dt;
      if (this.damageFlashTime < 0) {
        this.damageFlashTime = 0;
      }
    }

    if (this.pendingConfirmTime > 0) {
      this.pendingConfirmTime -= dt;
      if (this.pendingConfirmTime <= 0) {
        this.pendingConfirmTime = 0;
        this.pendingConfirmAction = "";
      }
    }

    this.tickEvolutionFeedback(dt);

    if (this.phase !== "running") {
      return;
    }

    if (this.evolutionHitStopTime > 0) {
      return;
    }

    this.elapsedTime += dt;
    const antiGate = this.anti.tickRun(dt);
    if (!antiGate.ok) {
      this.analytics.logEvent("anti_forced_settlement", {
        reason: antiGate.reason || "unknown",
        message: antiGate.message,
        time: this.elapsedTime,
        mode: this.runningMode
      });
      this.showToast(antiGate.message || "防沉迷限制，已结束本局", "#ffb8a6");
      this.finalizeRun(false);
      return;
    }

    if (
      !this.pityHintShown &&
      !this.hasEvolvedThisRun &&
      this.elapsedTime >= this.cfg.getBalance().evolutionPityHintTime
    ) {
      this.pityHintShown = true;
      this.showToast("提示：优先拿元素和武器升级可更快进化", "#a5ddff");
    }

    if (this.runningMode === "story" && !this.storyFinalBossSpawned) {
      const remain = this.getStoryClearTime() - this.elapsedTime;
      const warnLead = this.cfg.getBalance().storyFinalBossWarnLeadTime || 16;
      if (!this.storyFinalBossWarningShown && remain > 0 && remain <= warnLead) {
        this.storyFinalBossWarningShown = true;
        this.showToast(`最终首领将在 ${Math.ceil(remain)} 秒后降临`, "#ffb3c4");
      }
    }
    this.player.update(dt, this.inputManager.getMoveVector());
    this.obstacleSystem.resolveCircle(this.player, this.worldWidth, this.worldHeight);
    this.updateCamera();

    const spawnResult = this.enemySpawner.update(
      dt,
      this.elapsedTime,
      this.enemies,
      this.player.x,
      this.player.y
    );

    if (spawnResult.stageLevel) {
      this.currentStageLevel = spawnResult.stageLevel;
    }
    if (spawnResult.stageName) {
      this.currentStageName = spawnResult.stageName;
    }
    if (spawnResult.stageChanged && this.phase === "running") {
      this.showToast(`关卡${this.currentStageLevel}：${this.currentStageName}`, "#8fd3ff");
      this.analytics.logEvent("stage_advanced", {
        level: this.currentStageLevel,
        name: this.currentStageName,
        mode: this.runningMode,
        time: this.elapsedTime
      });
    }

    if (spawnResult.bossSpawned) {
      this.vibrateShort("medium");
      const spawnMode = spawnResult.mode || this.runningMode;
      const bossBatch = spawnResult.bossBatch || 1;

      this.analytics.logEvent("boss_spawned", {
        time: this.elapsedTime,
        mode: spawnMode,
        batch: bossBatch
      });

      if (spawnMode === "endless") {
        this.endlessBossBatchReached = Math.max(this.endlessBossBatchReached, bossBatch);
        this.showToast(`无尽第${bossBatch}批首领来袭！`, "#ff6d6d");
      } else if (spawnMode === "story") {
        this.storyFinalBossSpawned = true;
        this.storyFinalBossId = spawnResult.spawnedBossId || this.findLatestBossId();
        this.enhanceStoryFinalBoss(this.storyFinalBossId);
        this.showToast("最终首领来袭！", "#ff6d9e");

        this.analytics.logEvent("story_final_boss_spawn", {
          bossId: this.storyFinalBossId,
          time: this.elapsedTime
        });
      } else {
        this.showToast("首领来袭！", "#ff6d6d");
      }
    }
    if (spawnResult.eliteSpawned) {
      this.analytics.logEvent("elite_spawned", {
        time: this.elapsedTime,
        behavior: spawnResult.eliteBehavior || "none"
      });

      if (spawnResult.eliteBehavior === "charge") {
        this.showToast("\u51b2\u950b\u7cbe\u82f1\u51fa\u73b0\uff01", "#ffd879");
      } else if (spawnResult.eliteBehavior === "ranged") {
        this.showToast("\u8fdc\u7a0b\u7cbe\u82f1\u51fa\u73b0\uff01", "#9fe8ff");
      } else {
        this.showToast("\u7cbe\u82f1\u602a\u51fa\u73b0\uff01", "#ffd879");
      }
    }

    const obstacleChecker = (x: number, y: number, radius: number): boolean =>
      this.obstacleSystem.isCircleBlocked(x, y, radius);

    for (const enemy of this.enemies) {
      if (enemy instanceof Boss) {
        const actions = enemy.updateBoss(dt, this.player.x, this.player.y, obstacleChecker);
        for (const action of actions) {
          if (action.type === "phase2") {
            this.analytics.logEvent("boss_phase2", { time: this.elapsedTime });
            this.showToast("首领进入二阶段！", "#ff9fb4");
            this.effectSystem.burst(action.x, action.y, action.color || "#ff9fb4", 22);
          } else if (action.type === "dash") {
            this.effectSystem.burst(action.x, action.y, action.color || "#ff7f95", 12);
          } else if (action.type === "shockwave") {
            this.bossHazards.push({
              id: bossHazardAutoId++,
              x: action.x,
              y: action.y,
              radius: action.radius || 120,
              windup: action.windup || 0.8,
              life: (action.windup || 0.8) + 0.42,
              damage: action.damage || 25,
              color: action.color || "#ff9ab0",
              exploded: false
            });
          }
        }
      } else {
        enemy.update(dt, this.player.x, this.player.y, obstacleChecker);

        const enemyActions = enemy.drainActions();
        for (const action of enemyActions) {
          if (action.type === "elite_charge_start") {
            this.effectSystem.burst(action.x, action.y, action.color || "#ffd879", 10);
          } else if (action.type === "elite_ranged_shot" || action.type === "enemy_ranged_shot") {
            const isNormalRanged = action.type === "enemy_ranged_shot";
            this.bossHazards.push({
              id: bossHazardAutoId++,
              x: action.x,
              y: action.y,
              radius: action.radius || (isNormalRanged ? 50 : 56),
              windup: action.windup || (isNormalRanged ? 0.66 : 0.58),
              life: (action.windup || (isNormalRanged ? 0.66 : 0.58)) + 0.36,
              damage: action.damage || (isNormalRanged ? 10 : 12),
              color: action.color || (isNormalRanged ? "#99d7ff" : "#8feeff"),
              exploded: false
            });
          }
        }
      }

      this.obstacleSystem.resolveCircle(enemy, this.worldWidth, this.worldHeight);
    }

    this.tickEnemyStatus(dt);

    this.weaponSystem.update(dt, this.player, this.enemies, this.effectSystem);

    const hazardDamage = this.updateBossHazards(dt);

    const collision = this.collisionSystem.resolve(
      this.player,
      this.enemies,
      this.weaponSystem.projectiles,
      this.weaponSystem.areas,
      this.cfg.getBalance().contactDamageInterval
    );

    const totalDamageTaken = collision.playerDamageTaken + hazardDamage;
    if (totalDamageTaken > 0) {
      this.effectSystem.addFloatingText(
        this.player.x + 8,
        this.player.y - 12,
        `-${Math.round(totalDamageTaken)}`,
        "#ff7f7f"
      );
      this.damageFlashTime = Math.max(this.damageFlashTime, 0.16);
    }

    for (const dead of collision.killedEnemies) {
      this.onEnemyKilled(dead, "hit");
    }

    const brokenObstacles = this.obstacleSystem.resolveAttacks(
      this.weaponSystem.projectiles,
      this.weaponSystem.areas,
      this.cfg.getBalance().obstacleDamageScale || 0.56
    );

    if (brokenObstacles.length > 0) {
      let expTotal = 0;
      for (const broken of brokenObstacles) {
        expTotal += broken.exp;
        this.dropSystem.spawnExp(broken.x, broken.y, broken.exp);
        this.effectSystem.burst(broken.x, broken.y, "#a9d7ff", 9);
      }

      this.analytics.logEvent("obstacle_broken", {
        count: brokenObstacles.length,
        exp: expTotal,
        time: this.elapsedTime
      });
    }

    const exp = this.dropSystem.update(dt, this.player, this.cfg.getBalance().expPullSpeed);
    if (exp > 0) {
      const levels = this.player.addExp(exp);
      if (levels > 0) {
        this.pendingLevelUps += levels;
      }
    }

    this.chestSystem.update(dt);
    const chest = this.chestSystem.tryPickup(this.player);
    if (chest) {
      this.phase = "chest";
      this.vibrateShort("light");
      this.chestBoosted = false;
      this.buildChestMutationRewards(false);
      this.analytics.logEvent("chest_found", {
        time: this.elapsedTime,
        weaponOptions: this.chestWeaponOptions.map((item) => item.id),
        characterOptions: this.chestCharacterOptions.map((item) => item.id)
      });
      this.showToast("发现宝箱！", "#ffd06f");
    }

    this.effectSystem.update(dt);

    this.tryEvolution();

    if (this.pendingLevelUps > 0 && this.phase === "running") {
      this.openLevelUp();
    }


    if (
      this.phase === "running" &&
      this.runningMode === "daily" &&
      !this.dailyChallengeCleared &&
      this.elapsedTime >= this.activeDailyChallenge.targetSurviveSeconds
    ) {
      this.dailyChallengeCleared = true;
      this.dailyChallengeBonusReward = this.activeDailyChallenge.rewardBonusDna;
      this.analytics.logEvent("daily_challenge_clear", {
        challengeId: this.activeDailyChallenge.id,
        challengeName: this.activeDailyChallenge.name,
        time: this.elapsedTime,
        kills: this.kills
      });
      if (this.save.canClaimDailyChallengeReward()) {
        this.showToast(`每日挑战完成，额外奖励 +${this.dailyChallengeBonusReward} DNA`, "#97ffbe");
      } else {
        this.showToast("每日挑战完成（今日首通奖励已领取）", "#b9cce2");
      }
      this.finalizeRun(true);
      return;
    }

    if (this.phase === "running" && this.runningMode === "story" && this.storyFinalBossKilled) {
      this.finalizeRun(true);
      return;
    }
    if (this.player.isDead()) {
      this.phase = "death";
      this.vibrateShort("medium");
      this.analytics.logEvent("player_dead", {
        time: this.elapsedTime,
        level: this.player.level,
        kills: this.kills,
        hasEvolved: this.hasEvolvedThisRun
      });
      this.showToast("战斗失败", "#ff8080");
    }
    } finally {
      if (debugPerfEnabled) {
        this.perfUpdateMs = Date.now() - updateStart;
        this.updatePerfTelemetry(dt);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const debugPerfEnabled = this.save.getData().debugMode;
    const renderStart = debugPerfEnabled ? Date.now() : 0;
    try {
    this.ui.beginFrame();

    this.drawBackground(ctx);

    if (this.phase !== "start" && this.phase !== "encyclopedia") {
      const settings = this.save.getSettings();
      ctx.save();
      ctx.translate(this.width * 0.5 - this.cameraX, this.height * 0.5 - this.cameraY);
      this.drawBattleWorld(ctx);
      ctx.restore();

      this.ui.drawBattleHud(ctx, this.width, {
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        exp: this.player.exp,
        expToNext: this.player.expToNext,
        level: this.player.level,
        kills: this.kills,
        time: this.elapsedTime,
        elements: Array.from(this.player.elements).map((id) => {
          const item = this.cfg.getElement(id);
          return { name: item.name, color: item.color };
        }),
        weaponSummaries: this.player.ownedBaseWeaponIds.map((baseId) => {
          const weaponId = this.player.currentWeaponByBase[baseId];
          const weapon = this.cfg.getWeapon(weaponId);
          return {
            name: weapon.name,
            level: this.player.getWeaponLevel(baseId),
            color: weapon.color
          };
        }),
        frenzyActive: this.player.isFrenzyActive(),
        objectiveText: this.getBattleObjectiveText(),
        showPauseButton: this.phase === "running"
      });

      if (settings.performanceMode !== "performance") {
        this.drawMiniMap(ctx);
      }
      if (this.phase === "running") {
        this.drawBossDirectionPointer(ctx);
      }
    }

    if (this.phase === "start") {
      this.syncLobbyMeta();
      this.activeDailyChallenge = this.dailyChallengeSystem.getTodayChallenge();
      const save = this.save.getData();
      const settings = this.save.getSettings();
      const weaponUpgradeMap = this.save.getWeaponUpgradeInfos().reduce(
        (map, item) => {
          map[item.baseWeaponId] = item;
          return map;
        },
        {} as Record<string, WeaponUpgradeInfo>
      );
      const weaponCards = this.cfg.getBaseWeaponIds().map((baseId) => {
        const weapon = this.cfg.getWeapon(baseId);
        const mastery = this.save.getWeaponMasteryInfo(baseId);
        const upgradeInfo = weaponUpgradeMap[baseId];
        return {
          id: baseId,
          name: weapon.name,
          color: weapon.color,
          description: weapon.description,
          upgradeLevel: upgradeInfo ? upgradeInfo.level : 0,
          maxUpgradeLevel: upgradeInfo ? upgradeInfo.maxLevel : 0,
          fragmentCount: upgradeInfo ? upgradeInfo.fragments : 0,
          nextUpgradeCost: upgradeInfo ? upgradeInfo.nextCost : 0,
          canUpgrade: upgradeInfo ? upgradeInfo.canUpgrade : false,
          damageBonus: upgradeInfo ? upgradeInfo.damageBonus : 0,
          unlockedSkills: upgradeInfo ? upgradeInfo.unlockedSkills.map((item) => item.title) : [],
          nextSkillTitle: upgradeInfo && upgradeInfo.nextSkill ? `下一技能: ${upgradeInfo.nextSkill.title}` : "技能已满",
          masteryLevel: mastery.level,
          masteryProgress: mastery.progress,
          masteryCurrent: mastery.current,
          masteryNeed: mastery.need
        };
      });
      const weaponPageCount = Math.max(1, Math.ceil(weaponCards.length / 4));
      this.weaponPage = clamp(this.weaponPage, 0, weaponPageCount - 1);
      const dailyQuests = this.save.getDailyQuests();
      const claimableQuestCount = dailyQuests.filter((q) => !q.claimed && q.progress >= q.target).length;
      const totalFragments = Object.values(save.weaponFragments || {}).reduce(
        (sum, value) => sum + Math.max(0, Math.floor(value || 0)),
        0
      );
      const selectedStoryChapter = this.getSelectedStoryChapter();
      const chapterCount = this.getStoryChapters().length;
      const chapterUnlocked = this.save.isStoryChapterUnlocked(selectedStoryChapter.level);
      const chapterBestStars = this.save.getStoryChapterBestStars(selectedStoryChapter.id);
      const chapterRecommendedPower = this.getChapterRecommendedPower(selectedStoryChapter);
      const chapterFirstClear = this.save.isStoryChapterFirstCleared(selectedStoryChapter.id);
      const chapterRewardPreview = this.formatFragmentRewards(this.getStoryChapterFirstClearRewards(selectedStoryChapter));
      const chapterStarGoalSummary = this.getStoryStarGoalSummary(selectedStoryChapter);
      const playerPower = this.save.estimatePlayerPower();
      const startGate = this.getStartRunGate();
      const antiSnapshot = this.anti.getStatusSnapshot();

      this.ui.drawStartPanel(ctx, this.width, this.height, {
        bestTime: save.bestSurvivalTime,
        totalRuns: save.totalRuns,
        totalKills: save.totalKills,
        debug: save.debugMode,
        activeTab: this.lobbyTab,
        chestClaimed: this.lobbyChestClaimed,
        totalFragments,
        dna: save.dna,
        weaponCards,
        weaponPage: this.weaponPage,
        weaponPageCount,
        dailyQuests,
        claimableQuestCount,
        shopItems: this.save.getMetaUpgradeShopItems(),
        shopResetRefund: this.save.getMetaUpgradeResetPreview().refund,
        unlockedEvolutionCount: save.unlockedEvolutionIds.length,
        totalEvolutionCount: this.cfg.getAllEvolutionRules().length,
        selectedMode: this.selectedRunMode,
        currentModeLabel: this.getModeLabel(this.selectedRunMode),
        selectedStoryChapterLevel: selectedStoryChapter.level,
        selectedStoryChapterName: selectedStoryChapter.name,
        selectedStoryChapterDescription: selectedStoryChapter.description,
        storyChapterCount: chapterCount,
        storyUnlockedChapterLevel: this.save.getUnlockedStoryChapterLevel(),
        selectedStoryChapterUnlocked: chapterUnlocked,
        selectedStoryChapterBestStars: chapterBestStars,
        selectedStoryChapterRecommendedPower: chapterRecommendedPower,
        selectedStoryChapterFirstClear: chapterFirstClear,
        selectedStoryChapterFirstClearRewardPreview: chapterRewardPreview,
        selectedStoryChapterStarGoalSummary: chapterStarGoalSummary,
        playerPower,
        canStartRun: startGate.ok,
        startBlockedReason: startGate.reason,
        antiEnabled: antiSnapshot.enabled,
        antiStatusText: antiSnapshot.authStatusText,
        antiPlaytimeText:
          antiSnapshot.enabled && antiSnapshot.isMinor
            ? `今日时长 ${Math.floor(antiSnapshot.playtimeTodaySeconds / 60)} / ${Math.floor(antiSnapshot.playtimeLimitSeconds / 60)} 分钟`
            : antiSnapshot.enabled
              ? "成人账号不受时长限制"
              : "防沉迷未启用",
        antiNeedRealname: antiSnapshot.enabled && !antiSnapshot.realnameVerified,
        antiNeedFaceVerify: antiSnapshot.enabled && antiSnapshot.needFaceVerify,
        antiGateMessage: antiSnapshot.gate.ok ? "" : antiSnapshot.gate.message,
        endlessBossInterval: this.cfg.getBalance().endlessBossInterval || 78,
        dailyChallengeName: this.activeDailyChallenge.name,
        dailyChallengeDescription: this.activeDailyChallenge.description,
        dailyChallengeTarget: this.activeDailyChallenge.targetSurviveSeconds,
        dailyChallengeReward: this.activeDailyChallenge.rewardBonusDna,
        dailyChallengeRewardClaimed: this.save.isDailyChallengeRewardClaimed(),
        storyClearTime: this.getStoryClearTime(),
        settingsSfxEnabled: settings.sfxEnabled,
        settingsVibrationEnabled: settings.vibrationEnabled,
        settingsPerformanceMode: settings.performanceMode,
        settingsMoveSensitivity: settings.moveSensitivity
      });
    } else if (this.phase === "pause") {
      this.ui.drawPausePanel(ctx, this.width, this.height, {
        kills: this.kills,
        time: this.elapsedTime
      });
    } else if (this.phase === "upgrade") {
      this.ui.drawUpgradePanel(
        ctx,
        this.width,
        this.height,
        this.levelUpOptions,
        this.extraAdOption,
        !!this.extraAdOption && this.canOfferAd("extraUpgrade")
      );
    } else if (this.phase === "chest") {
      this.ui.drawChestPanel(
        ctx,
        this.width,
        this.height,
        this.chestWeaponOptions,
        this.chestCharacterOptions,
        this.chestBoosted,
        this.canOfferAd("chestBoost")
      );
    } else if (this.phase === "death") {
      this.ui.drawDeathPanel(ctx, this.width, this.height, {
        kills: this.kills,
        time: this.elapsedTime,
        reviveUsed: this.reviveUsed
      });
    } else if (this.phase === "settlement") {
      this.ui.drawSettlementPanel(ctx, this.width, this.height, {
        kills: this.kills,
        time: this.elapsedTime,
        reward: this.settleReward,
        doubled: this.settleDoubled,
        fragmentSummary: this.formatFragmentRewards(this.settleFragmentRewards),
        storySummary: this.getSettlementStorySummary(),
        storyFirstClearSummary:
          this.settleStoryFirstClearRewards.length > 0
            ? `章节首通奖励: ${this.formatFragmentRewards(this.settleStoryFirstClearRewards)}`
            : ""
      });
    } else if (this.phase === "encyclopedia") {
      const entries = this.encyclopediaSystem.getEntries();
      const pageCount = Math.max(1, Math.ceil(entries.length / 16));
      this.encyclopediaPage = clamp(this.encyclopediaPage, 0, pageCount - 1);
      this.ui.drawEncyclopediaPanel(
        ctx,
        this.width,
        this.height,
        entries,
        this.save.getData().debugMode,
        this.encyclopediaPage,
        pageCount
      );
    }

    this.drawEvolutionFeedback(ctx);
    this.drawDamageFlash(ctx);

    if (debugPerfEnabled && this.phase !== "start") {
      this.drawPerformanceOverlay(ctx);
    }

    if (this.toast) {
      this.ui.drawToast(ctx, this.width, this.toast, this.toastColor);
    }

    if (this.adStateText) {
      this.ui.drawAdState(ctx, this.width, this.adStateText);
    }
    } finally {
      if (debugPerfEnabled) {
        this.perfRenderMs = Date.now() - renderStart;
      }
    }
  }

  onTap(x: number, y: number): void {
    const button = this.ui.hitTest(x, y);
    if (!button) {
      return;
    }

    const id = button.id;

    if (id === "pause_run" && this.phase === "running") {
      this.phase = "pause";
      this.analytics.logEvent("run_pause", {
        time: this.elapsedTime,
        kills: this.kills
      });
      return;
    }

    if (id === "pause_resume" && this.phase === "pause") {
      this.phase = "running";
      this.analytics.logEvent("run_resume", {
        time: this.elapsedTime,
        kills: this.kills
      });
      return;
    }

    if (id === "pause_exit" && this.phase === "pause") {
      if (!this.confirmAction("pause_exit", "退出本局")) {
        return;
      }
      this.analytics.logEvent("run_abandon", {
        time: this.elapsedTime,
        kills: this.kills,
        mode: this.runningMode
      });
      this.analytics.endRun({
        time: this.elapsedTime,
        kills: this.kills,
        mode: this.runningMode,
        abandoned: true
      });
      this.anti.onRunEnd();
      this.phase = "start";
      this.lobbyTab = "home";
      this.syncLobbyMeta();
      this.showToast("已退出本局", "#c7dff9");
      return;
    }

    if (id === "tab_chest") {
      this.lobbyTab = "chest";
      return;
    }

    if (id === "tab_home") {
      this.lobbyTab = "home";
      return;
    }

    if (id === "tab_weapon") {
      this.lobbyTab = "weapon";
      return;
    }

    if (id === "tab_mode") {
      this.lobbyTab = "mode";
      return;
    }

    if (id === "tab_settings") {
      this.lobbyTab = "settings";
      return;
    }

    if (id === "claim_chest") {
      const claim = this.save.claimDailyChest();
      if (!claim.ok) {
        this.syncLobbyMeta();
        this.showToast("宝箱今日已领取", "#ffd7a0");
        return;
      }

      this.syncLobbyMeta();
      const rewardText = this.formatFragmentRewards(claim.rewards);
      this.analytics.logEvent("lobby_chest_claim", {
        rewards: claim.rewards
      });
      this.showToast(`领取成功：${rewardText}`, "#ffe38f");
      return;
    }

    if (id === "start_run") {
      const gate = this.getStartRunGate(true);
      if (!gate.ok) {
        this.showToast(gate.reason, "#ffb9a6");
        return;
      }
      this.startRun(false);
      return;
    }

    if (id === "start_buff_ad") {
      const gate = this.getStartRunGate(true);
      if (!gate.ok) {
        this.showToast(gate.reason, "#ffb9a6");
        return;
      }
      this.playAdStartBuff();
      return;
    }

    if (id === "anti_realname_auth") {
      this.handleAntiRealnameAuth();
      return;
    }

    if (id === "anti_face_verify") {
      this.handleAntiFaceVerify();
      return;
    }

    if (id === "daily_claim_all") {
      const quests = this.save.getDailyQuests();
      let claimedCount = 0;
      let totalDna = 0;

      for (const quest of quests) {
        if (quest.claimed || quest.progress < quest.target) {
          continue;
        }
        const claim = this.save.claimDailyQuest(quest.id);
        if (!claim.ok) {
          continue;
        }
        claimedCount += 1;
        totalDna += claim.rewardDna;
      }

      if (claimedCount <= 0) {
        this.showToast("当前没有可领取的任务奖励", "#bcd2e8");
        return;
      }

      this.syncLobbyMeta();
      this.analytics.logEvent("daily_quest_claim_all", {
        claimedCount,
        rewardDna: totalDna
      });

      const text = `已领取 ${claimedCount} 个任务奖励：DNA+${totalDna}`;
      this.showToast(text, "#8fffc1");
      return;
    }

    if (id.startsWith("daily_claim_")) {
      const index = Number(id.split("_")[2]);
      const quests = this.save.getDailyQuests();
      const quest = quests[index];
      if (!quest) {
        return;
      }

      const claim = this.save.claimDailyQuest(quest.id);
      if (claim.ok) {
        this.syncLobbyMeta();
        this.analytics.logEvent("daily_quest_claim", {
          questId: quest.id,
          rewardDna: claim.rewardDna
        });

        const rewardText = `领取成功：DNA+${claim.rewardDna}`;
        this.showToast(rewardText, "#8fffc1");
      } else {
        this.showToast("任务未完成或已领取", "#ffd3a8");
      }
      return;
    }

    if (id.startsWith("weapon_upgrade_")) {
      const baseWeaponId = id.slice("weapon_upgrade_".length);
      const upgrade = this.save.tryUpgradeWeapon(baseWeaponId);
      if (upgrade.ok) {
        const weapon = this.cfg.getWeapon(baseWeaponId);
        let text = `${weapon.name}强化 Lv.${upgrade.level}，伤害+${(upgrade.info.damageBonus * 100).toFixed(0)}%`;
        if (upgrade.unlockedSkills.length > 0) {
          text += `，解锁：${upgrade.unlockedSkills.map((item) => item.title).join("、")}`;
        }
        this.analytics.logEvent("weapon_upgrade", {
          baseWeaponId,
          level: upgrade.level,
          cost: upgrade.cost,
          unlockedSkillIds: upgrade.unlockedSkills.map((item) => item.id),
          damageBonus: upgrade.info.damageBonus
        });
        this.showToast(text, "#8fffd0");
      } else if (upgrade.reason === "fragment") {
        this.showToast("碎片不足，无法升级", "#ffb8a8");
      } else if (upgrade.reason === "max") {
        this.showToast("该武器已满级", "#bde8ff");
      } else {
        this.showToast("升级失败", "#ffb8a8");
      }
      return;
    }


    if (id.startsWith("shop_buy_")) {
      const shopId = id.slice("shop_buy_".length);
      const buy = this.save.purchaseMetaUpgrade(shopId);
      if (buy.ok) {
        this.analytics.logEvent("meta_upgrade_buy", {
          upgradeId: shopId,
          level: buy.level,
          cost: buy.cost,
          dnaLeft: this.save.getData().dna
        });
        this.showToast(`${buy.title} 升至 Lv.${buy.level}`, "#8fffd0");
      } else if (buy.reason === "dna") {
        this.showToast("DNA 不足", "#ffb8a8");
      } else if (buy.reason === "max") {
        this.showToast("该强化已满级", "#bde8ff");
      } else {
        this.showToast("无法购买该强化", "#ffb8a8");
      }
      return;
    }


    if (id === "shop_reset_points") {
      if (!this.confirmAction("shop_reset_points", "重置加点")) {
        return;
      }
      const reset = this.save.resetMetaUpgrades();
      if (reset.ok) {
        this.analytics.logEvent("meta_upgrade_reset", {
          spent: reset.spent,
          refund: reset.refund,
          dnaLeft: this.save.getData().dna
        });
        this.showToast(`加点已重置，返还 DNA ${reset.refund}`, "#a9ffd4");
      } else {
        this.showToast("暂无可重置的加点", "#b6d8ef");
      }
      return;
    }

    if (id === "shop_plan_starter" || id === "shop_plan_hardcore") {
      const planId = id === "shop_plan_starter" ? "starter" : "hardcore";
      const result = this.save.applyMetaUpgradePlan(planId);
      if (result.ok) {
        this.analytics.logEvent("meta_upgrade_plan_apply", {
          planId,
          purchased: result.purchased,
          spent: result.spent,
          upgrades: result.upgrades,
          dnaLeft: this.save.getData().dna
        });
        const planName = planId === "starter" ? "新手" : "高难";
        this.showToast(`${planName}方案已购买 ${result.purchased} 项强化`, "#9fe9ff");
      } else {
        this.showToast("DNA不足或强化已满级", "#ffbda8");
      }
      return;
    }

    if (id === "mode_story") {
      this.selectedRunMode = "story";
      const chapter = this.getSelectedStoryChapter();
      if (this.save.isStoryChapterUnlocked(chapter.level)) {
        this.showToast(`已切换：标准模式 第${chapter.level}章`, "#9fd8ff");
      } else {
        this.showToast(`第${chapter.level}章未解锁，先通关上一章`, "#ffbfaa");
      }
      return;
    }

    if (id === "mode_endless") {
      this.selectedRunMode = "endless";
      this.showToast("已切换：无尽模式", "#a99bff");
      return;
    }

    if (id === "mode_daily") {
      this.activeDailyChallenge = this.dailyChallengeSystem.getTodayChallenge();
      this.selectedRunMode = "daily";
      this.showToast(`已切换：每日挑战 - ${this.activeDailyChallenge.name}`, this.activeDailyChallenge.color);
      return;
    }

    if (id === "mode_bossrush") {
      this.showToast("该模式开发中，敬请期待", "#b6b2ff");
      return;
    }

    if (id === "story_chapter_prev" || id === "story_chapter_next") {
      const chapters = this.getStoryChapters();
      if (chapters.length <= 0) {
        this.showToast("暂无可用章节", "#b9cce2");
        return;
      }
      if (this.selectedRunMode !== "story") {
        this.selectedRunMode = "story";
      }

      let idx = chapters.findIndex((item) => item.level === this.selectedStoryChapterLevel);
      if (idx < 0) {
        idx = 0;
      }
      const delta = id === "story_chapter_next" ? 1 : -1;
      idx = clamp(idx + delta, 0, chapters.length - 1);

      const chapter = chapters[idx];
      this.selectedStoryChapterLevel = chapter.level;
      if (this.save.isStoryChapterUnlocked(chapter.level)) {
        this.showToast(`已选择第${chapter.level}章：${chapter.name}`, "#8fd3ff");
      } else {
        this.showToast(`第${chapter.level}章未解锁，先通关上一章`, "#ffbfaa");
      }
      return;
    }

    if (id === "weapon_page_prev") {
      this.weaponPage = Math.max(0, this.weaponPage - 1);
      return;
    }

    if (id === "weapon_page_next") {
      const total = Math.max(1, Math.ceil(this.cfg.getBaseWeaponIds().length / 4));
      this.weaponPage = Math.min(total - 1, this.weaponPage + 1);
      return;
    }

    if (id === "open_encyclopedia") {
      this.encyclopediaPage = 0;
      this.phase = "encyclopedia";
      return;
    }

    if (id === "toggle_debug") {
      const current = this.save.getData().debugMode;
      this.save.setDebugMode(!current);
      if (!current) {
        this.resetPerfTelemetry();
      }
      this.analytics.logEvent("debug_toggle", { enabled: !current });
      this.showToast(`调试模式${!current ? "开启" : "关闭"}`, "#ffd38a");
      return;
    }

    if (id === "reset_save") {
      if (!this.confirmAction("reset_save", "重置存档")) {
        return;
      }
      this.save.resetSave();
      this.applySettingsToRuntime();
      this.syncLobbyMeta();
      this.analytics.logEvent("save_reset");
      this.showToast("存档已重置", "#ff9c9c");
      return;
    }

    if (id === "export_analytics") {
      this.exportAnalytics();
      return;
    }

    if (id === "clear_analytics") {
      this.analytics.clear();
      this.showToast("埋点已清空", "#9fd8ff");
      return;
    }

    if (id === "setting_toggle_sfx") {
      const next = !this.save.getSettings().sfxEnabled;
      this.save.setSfxEnabled(next);
      this.showToast(`音效已${next ? "开启" : "关闭"}`, "#9fd8ff");
      return;
    }

    if (id === "setting_toggle_vibration") {
      const next = !this.save.getSettings().vibrationEnabled;
      this.save.setVibrationEnabled(next);
      this.showToast(`震动已${next ? "开启" : "关闭"}`, "#9fd8ff");
      if (next) {
        this.vibrateShort("light");
      }
      return;
    }

    if (id === "setting_perf_quality" || id === "setting_perf_balanced" || id === "setting_perf_performance") {
      const mode: PerformanceMode =
        id === "setting_perf_quality" ? "quality" : id === "setting_perf_performance" ? "performance" : "balanced";
      this.save.setPerformanceMode(mode);
      this.applySettingsToRuntime();
      this.showToast(`性能档位：${this.getPerformanceLabel(mode)}`, "#a9dfff");
      return;
    }

    if (id === "setting_sensitivity_dec" || id === "setting_sensitivity_inc") {
      const settings = this.save.getSettings();
      const delta = id === "setting_sensitivity_inc" ? 0.05 : -0.05;
      const next = Math.round((settings.moveSensitivity + delta) * 100) / 100;
      this.save.setMoveSensitivity(next);
      this.applySettingsToRuntime();
      this.showToast(`灵敏度 ${this.save.getSettings().moveSensitivity.toFixed(2)}`, "#a9dfff");
      return;
    }

    if (id === "close_encyclopedia") {
      this.phase = "start";
      this.lobbyTab = "weapon";
      return;
    }

    if (id === "encyclopedia_prev") {
      this.encyclopediaPage = Math.max(0, this.encyclopediaPage - 1);
      return;
    }

    if (id === "encyclopedia_next") {
      const total = Math.max(1, Math.ceil(this.encyclopediaSystem.getEntries().length / 16));
      this.encyclopediaPage = Math.min(total - 1, this.encyclopediaPage + 1);
      return;
    }

    if (id === "debug_unlock_all") {
      this.encyclopediaSystem.unlockAllDebug();
      this.analytics.logEvent("debug_unlock_all_evolution");
      this.showToast("已解锁全部进化", "#9fff9f");
      return;
    }

    if (id === "upgrade_extra_ad") {
      this.playAdExtraUpgrade();
      return;
    }

    if (id.startsWith("upgrade_")) {
      const index = Number(id.split("_")[1]);
      const option = this.levelUpOptions[index];
      if (option) {
        this.analytics.logEvent("upgrade_pick", {
          optionId: option.id,
          category: option.category,
          source: "levelup",
          level: this.player.level,
          time: this.elapsedTime
        });
        option.apply();
        this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
        this.tryEvolution();
        if (this.pendingLevelUps > 0) {
          this.openLevelUp();
        } else {
          this.phase = "running";
        }
      }
      return;
    }
    if (id.startsWith("chest_weapon_")) {
      const index = Number(id.split("_")[2]);
      const option = this.chestWeaponOptions[index];
      if (option) {
        this.analytics.logEvent("upgrade_pick", {
          optionId: option.id,
          category: option.category,
          source: "chest_weapon",
          time: this.elapsedTime
        });
        option.apply();
        this.tryEvolution();
      }
      this.phase = "running";
      return;
    }

    if (id.startsWith("chest_character_")) {
      const index = Number(id.split("_")[2]);
      const option = this.chestCharacterOptions[index];
      if (option) {
        this.analytics.logEvent("upgrade_pick", {
          optionId: option.id,
          category: option.category,
          source: "chest_character",
          time: this.elapsedTime
        });
        option.apply();
        this.tryCharacterMutationFusion();
      }
      this.phase = "running";
      return;
    }

    if (id === "chest_boost_ad") {
      this.playAdChestBoost();
      return;
    }

    if (id === "revive_ad") {
      this.playAdRevive();
      return;
    }

    if (id === "to_settlement") {
      this.finalizeRun();
      return;
    }

    if (id === "double_reward_ad") {
      this.playAdDoubleReward();
      return;
    }

    if (id === "back_to_start") {
      this.phase = "start";
      this.lobbyTab = "home";
      this.syncLobbyMeta();
      return;
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
    gradient.addColorStop(0, "#163f54");
    gradient.addColorStop(0.55, "#2f6474");
    gradient.addColorStop(1, "#46362a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    const t = this.elapsedTime;
    const orbA = ctx.createRadialGradient(
      this.width * (0.2 + 0.04 * Math.sin(t * 0.25)),
      this.height * 0.18,
      0,
      this.width * (0.2 + 0.04 * Math.sin(t * 0.25)),
      this.height * 0.18,
      this.width * 0.58
    );
    orbA.addColorStop(0, "rgba(118, 232, 255, 0.26)");
    orbA.addColorStop(1, "rgba(118, 232, 255, 0)");
    ctx.fillStyle = orbA;
    ctx.fillRect(0, 0, this.width, this.height);

    const orbB = ctx.createRadialGradient(
      this.width * (0.86 - 0.05 * Math.cos(t * 0.3)),
      this.height * 0.86,
      0,
      this.width * (0.86 - 0.05 * Math.cos(t * 0.3)),
      this.height * 0.86,
      this.width * 0.64
    );
    orbB.addColorStop(0, "rgba(255, 198, 123, 0.2)");
    orbB.addColorStop(1, "rgba(255, 198, 123, 0)");
    ctx.fillStyle = orbB;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = "rgba(211, 234, 255, 0.08)";
    ctx.lineWidth = 1;
    const stripeGap = 34;
    const drift = (t * 12) % stripeGap;
    for (let y = -stripeGap; y <= this.height + stripeGap; y += stripeGap) {
      ctx.beginPath();
      ctx.moveTo(0, y + drift);
      ctx.lineTo(this.width, y + drift + 20);
      ctx.stroke();
    }
  }

  private drawBattleWorld(ctx: CanvasRenderingContext2D): void {
    this.drawWorldFloor(ctx);
    this.obstacleSystem.render(ctx);

    this.dropSystem.render(ctx);
    this.chestSystem.render(ctx);
    this.weaponSystem.render(ctx);

    this.renderBossHazards(ctx);

    for (const enemy of this.enemies) {
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();

      const overlay = enemy.getStatusOverlayColor();
      if (overlay) {
        ctx.globalAlpha = 0.42;
        ctx.fillStyle = overlay;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const archetype = enemy.getArchetype();
      if (archetype === "ranged" && !enemy.isBoss) {
        ctx.fillStyle = "#cfeeff";
        ctx.fillRect(enemy.x - 3, enemy.y - enemy.radius - 12, 6, 6);
      } else if (archetype === "swift" && !enemy.isBoss) {
        ctx.strokeStyle = "#ffd2f3";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(enemy.x - enemy.radius - 4, enemy.y - 4);
        ctx.lineTo(enemy.x - enemy.radius - 10, enemy.y - 7);
        ctx.moveTo(enemy.x - enemy.radius - 4, enemy.y + 3);
        ctx.lineTo(enemy.x - enemy.radius - 10, enemy.y + 6);
        ctx.stroke();
      } else if (archetype === "shield" && !enemy.isBoss) {
        ctx.globalAlpha = enemy.isShieldActive() ? 0.6 : 0.24;
        ctx.strokeStyle = "#8de7f0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 3.5, -0.55, 0.55);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (enemy.isElite) {
        const behavior = enemy.getEliteBehavior();
        ctx.strokeStyle = behavior === "ranged" ? "#9fe8ff" : "#ffd979";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 4, 0, Math.PI * 2);
        ctx.stroke();

        if (behavior === "ranged") {
          ctx.fillStyle = "#d8f5ff";
          ctx.beginPath();
          ctx.arc(enemy.x, enemy.y - enemy.radius - 7, 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (behavior === "charge") {
          ctx.fillStyle = "#ffe3aa";
          ctx.beginPath();
          ctx.moveTo(enemy.x, enemy.y - enemy.radius - 9);
          ctx.lineTo(enemy.x - 3.6, enemy.y - enemy.radius - 3.5);
          ctx.lineTo(enemy.x + 3.6, enemy.y - enemy.radius - 3.5);
          ctx.closePath();
          ctx.fill();
        }
      }

      if (enemy.isBoss) {
        const boss = enemy as Boss;
        ctx.strokeStyle = boss.isPhaseTwo() ? "#ff9ab0" : "#fff0f0";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
      const hpBarY = enemy.y - enemy.radius - 10;

      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(enemy.x - enemy.radius, hpBarY, enemy.radius * 2, 4);
      ctx.fillStyle = enemy.isBoss ? "#ff7b7b" : enemy.isElite ? "#ffd879" : "#8bff8b";
      ctx.fillRect(enemy.x - enemy.radius, hpBarY, enemy.radius * 2 * hpRatio, 4);

      if (enemy.hasShield()) {
        const shieldRatio = enemy.getShieldRatio();
        const shieldY = hpBarY - 5;
        ctx.fillStyle = "rgba(8, 24, 34, 0.75)";
        ctx.fillRect(enemy.x - enemy.radius, shieldY, enemy.radius * 2, 3);
        ctx.fillStyle = shieldRatio > 0.01 ? "#73e9f5" : "#3f6f7d";
        ctx.fillRect(enemy.x - enemy.radius, shieldY, enemy.radius * 2 * shieldRatio, 3);
      }
    }

    this.drawPlayerBody(ctx);

    if (this.player.isDamageImmune()) {
      const pulse = 0.72 + 0.28 * Math.sin(this.elapsedTime * 15);
      const ratio = this.player.getDamageImmuneRatio();

      ctx.globalAlpha = 0.16 + pulse * 0.26;
      ctx.fillStyle = "#9fe8ff";
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, this.player.radius + 9 + (1 - ratio) * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = "#d8f7ff";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, this.player.radius + 11 + pulse * 2.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#dff8ff";
      ctx.font = "11px Microsoft YaHei";
      ctx.fillText("\u65E0\u654C", this.player.x - 12, this.player.y + this.player.radius + 18);
    }

    this.drawPlayerHeadBars(ctx);

    this.effectSystem.render(ctx);
  }

  private drawPlayerBody(ctx: CanvasRenderingContext2D): void {
    if (this.playerSprite && this.playerSpriteReady) {
      const spriteRadius = this.player.radius * 1.42;
      ctx.drawImage(
        this.playerSprite,
        this.player.x - spriteRadius,
        this.player.y - spriteRadius,
        spriteRadius * 2,
        spriteRadius * 2
      );
    } else {
      ctx.fillStyle = "#7fc4ff";
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "#d7f0ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, this.player.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawWorldFloor(ctx: CanvasRenderingContext2D): void {
    const perfMode = this.save.getSettings().performanceMode;
    this.ensureWorldFloorCache(perfMode);
    if (this.floorCacheCanvas) {
      ctx.drawImage(this.floorCacheCanvas, 0, 0);
      return;
    }

    this.paintWorldFloor(ctx, perfMode);
  }

  private ensureWorldFloorCache(mode: PerformanceMode): void {
    if (this.floorCacheDisabled) {
      return;
    }

    const needRebuild =
      !this.floorCacheCanvas ||
      this.floorCacheMode !== mode ||
      this.floorCacheWidth !== this.worldWidth ||
      this.floorCacheHeight !== this.worldHeight;
    if (!needRebuild) {
      return;
    }

    const cacheCanvas = this.createFloorCacheCanvas(this.worldWidth, this.worldHeight);
    if (!cacheCanvas) {
      this.floorCacheDisabled = true;
      this.floorCacheCanvas = null;
      return;
    }

    const cacheCtx = cacheCanvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!cacheCtx) {
      this.floorCacheDisabled = true;
      this.floorCacheCanvas = null;
      return;
    }

    this.paintWorldFloor(cacheCtx, mode);

    this.floorCacheCanvas = cacheCanvas;
    this.floorCacheMode = mode;
    this.floorCacheWidth = this.worldWidth;
    this.floorCacheHeight = this.worldHeight;
  }

  private createFloorCacheCanvas(width: number, height: number): any | null {
    try {
      if (typeof wx !== "undefined" && wx && typeof wx.createOffscreenCanvas === "function") {
        const offscreen = wx.createOffscreenCanvas({
          type: "2d",
          width,
          height
        });
        if (offscreen) {
          offscreen.width = width;
          offscreen.height = height;
        }
        return offscreen;
      }
    } catch (error) {
      // ignore and fallback
    }

    const offscreenCtor = (globalThis as any).OffscreenCanvas;
    if (typeof offscreenCtor === "function") {
      return new offscreenCtor(width, height);
    }

    return null;
  }

  private paintWorldFloor(ctx: CanvasRenderingContext2D, mode: PerformanceMode): void {
    ctx.clearRect(0, 0, this.worldWidth, this.worldHeight);
    const floorBase = ctx.createLinearGradient(0, 0, this.worldWidth, this.worldHeight);
    floorBase.addColorStop(0, "#184254");
    floorBase.addColorStop(0.5, "#2b5f6f");
    floorBase.addColorStop(1, "#3c3428");
    ctx.fillStyle = floorBase;
    ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);

    const focalGlow = ctx.createRadialGradient(
      this.worldWidth * 0.5,
      this.worldHeight * 0.45,
      0,
      this.worldWidth * 0.5,
      this.worldHeight * 0.45,
      Math.max(this.worldWidth, this.worldHeight) * 0.58
    );
    focalGlow.addColorStop(0, "rgba(122, 238, 255, 0.12)");
    focalGlow.addColorStop(1, "rgba(122, 238, 255, 0)");
    ctx.fillStyle = focalGlow;
    ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);

    ctx.strokeStyle = "rgba(200, 238, 255, 0.11)";
    ctx.lineWidth = 1;
    const step = mode === "quality" ? 72 : mode === "performance" ? 128 : 96;

    for (let x = 0; x <= this.worldWidth; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.worldHeight);
      ctx.stroke();
    }

    for (let y = 0; y <= this.worldHeight; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.worldWidth, y);
      ctx.stroke();
    }

    if (mode === "quality") {
      ctx.strokeStyle = "rgba(255, 213, 153, 0.12)";
      ctx.lineWidth = 1.5;
      const ringRadius = Math.max(140, Math.min(this.worldWidth, this.worldHeight) * 0.18);
      for (let i = 0; i < 6; i += 1) {
        ctx.beginPath();
        ctx.arc(
          this.worldWidth * (0.14 + (i % 3) * 0.34),
          this.worldHeight * (0.18 + Math.floor(i / 3) * 0.38),
          ringRadius * (0.7 + (i % 2) * 0.18),
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
    }

    if (mode !== "performance") {
      ctx.strokeStyle = "rgba(188, 231, 255, 0.3)";
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, this.worldWidth - 6, this.worldHeight - 6);
    }
  }

  private renderBossHazards(ctx: CanvasRenderingContext2D): void {
    for (const hazard of this.bossHazards) {
      if (!hazard.exploded) {
        const t = Math.max(0, hazard.windup / 0.85);
        ctx.globalAlpha = 0.22 + (1 - t) * 0.18;
        ctx.fillStyle = hazard.color;
        ctx.beginPath();
        ctx.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = "#ffe6ec";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.globalAlpha = 0.42;
        ctx.strokeStyle = "#ffbac8";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(hazard.x, hazard.y, hazard.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawPlayerHeadBars(ctx: CanvasRenderingContext2D): void {
    const barWidth = 74;
    const barHeight = 6;
    const x = this.player.x - barWidth * 0.5;
    const y = this.player.y - this.player.radius - 30;

    const hpRatio = clamp(this.player.hp / Math.max(1, this.player.maxHp), 0, 1);
    const expRatio = clamp(this.player.exp / Math.max(1, this.player.expToNext), 0, 1);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x - 1, y - 1, barWidth + 2, barHeight + 2);
    ctx.fillStyle = "#522428";
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = "#ff6e7c";
    ctx.fillRect(x, y, barWidth * hpRatio, barHeight);

    const expY = y + barHeight + 4;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x - 1, expY - 1, barWidth + 2, barHeight + 2);
    ctx.fillStyle = "#18314d";
    ctx.fillRect(x, expY, barWidth, barHeight);
    ctx.fillStyle = "#6dc9ff";
    ctx.fillRect(x, expY, barWidth * expRatio, barHeight);

    ctx.fillStyle = "#e9f7ff";
    ctx.font = "11px Microsoft YaHei";
    ctx.fillText(`Lv.${this.player.level}`, this.player.x - 13, y - 4);
  }

  private drawMiniMap(ctx: CanvasRenderingContext2D): void {
    const mapWidth = 132;
    const mapHeight = 132;
    const padding = 12;
    const x = this.width - mapWidth - padding;
    const y = 96;

    const scaleX = mapWidth / this.worldWidth;
    const scaleY = mapHeight / this.worldHeight;

    const toMapX = (worldX: number): number => x + worldX * scaleX;
    const toMapY = (worldY: number): number => y + worldY * scaleY;

    ctx.fillStyle = "rgba(6, 10, 16, 0.72)";
    ctx.fillRect(x, y, mapWidth, mapHeight);
    ctx.strokeStyle = "rgba(164, 206, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, mapWidth, mapHeight);

    for (const obstacle of this.obstacleSystem.obstacles) {
      ctx.fillStyle = "rgba(120, 146, 174, 0.72)";
      ctx.fillRect(
        toMapX(obstacle.x),
        toMapY(obstacle.y),
        Math.max(1, obstacle.w * scaleX),
        Math.max(1, obstacle.h * scaleY)
      );
    }

    const elitePulse = 0.58 + 0.42 * Math.sin(this.elapsedTime * 6.2);
    const bossPulse = 0.55 + 0.45 * Math.sin(this.elapsedTime * 9.5);

    for (const enemy of this.enemies) {
      const mx = toMapX(enemy.x);
      const my = toMapY(enemy.y);

      let radius = 1.6;
      let color = "#ff988f";
      let alpha = 0.8;

      if (enemy.isElite) {
        radius = 2.0 + elitePulse * 0.7;
        color = "#ffd97b";
        alpha = 0.78 + 0.22 * elitePulse;
      }

      if (enemy.isBoss) {
        radius = 2.8 + bossPulse * 1.1;
        color = "#ff8da7";
        alpha = 0.76 + 0.24 * bossPulse;
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx, my, radius, 0, Math.PI * 2);
      ctx.fill();

      if (enemy.isBoss) {
        ctx.globalAlpha = 0.35 + 0.35 * bossPulse;
        ctx.strokeStyle = "#ffd5df";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(mx, my, radius + 1.8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;

    const visibleW = Math.min(this.width, this.worldWidth);
    const visibleH = Math.min(this.height, this.worldHeight);
    const camLeft = clamp(this.cameraX - visibleW * 0.5, 0, Math.max(0, this.worldWidth - visibleW));
    const camTop = clamp(this.cameraY - visibleH * 0.5, 0, Math.max(0, this.worldHeight - visibleH));
    ctx.strokeStyle = "rgba(130, 221, 255, 0.95)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(toMapX(camLeft), toMapY(camTop), visibleW * scaleX, visibleH * scaleY);

    ctx.fillStyle = "#79ddff";
    ctx.beginPath();
    ctx.arc(toMapX(this.player.x), toMapY(this.player.y), 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#bcd9ff";
    ctx.font = "12px Microsoft YaHei";
    ctx.fillText("小地图", x + 8, y - 6);
  }
  private getPrimaryBoss(): Boss | null {
    for (const enemy of this.enemies) {
      if (enemy.isBoss) {
        return enemy as Boss;
      }
    }
    return null;
  }

  private drawBossDirectionPointer(ctx: CanvasRenderingContext2D): void {
    const boss = this.getPrimaryBoss();
    if (!boss) {
      return;
    }

    const screenX = this.width * 0.5 + (boss.x - this.cameraX);
    const screenY = this.height * 0.5 + (boss.y - this.cameraY);

    const margin = 34;
    if (
      screenX >= margin &&
      screenX <= this.width - margin &&
      screenY >= margin &&
      screenY <= this.height - margin
    ) {
      return;
    }

    const dx = boss.x - this.player.x;
    const dy = boss.y - this.player.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const nx = dx / dist;
    const ny = dy / dist;
    const radius = Math.min(this.width, this.height) * 0.43;

    const threatRange = Math.min(this.worldWidth, this.worldHeight) * 0.6;
    const nearRatio = clamp(1 - dist / Math.max(420, threatRange), 0, 1);

    const pulseSpeed = 7 + nearRatio * 9;
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsedTime * pulseSpeed);

    const jitterAmp = nearRatio * (3.2 + pulse * 2.4);
    const jx = Math.sin(this.elapsedTime * (17 + nearRatio * 8)) * jitterAmp;
    const jy = Math.cos(this.elapsedTime * (15 + nearRatio * 7)) * jitterAmp * 0.75;

    const px = clamp(this.width * 0.5 + nx * radius + jx, margin, this.width - margin);
    const py = clamp(this.height * 0.5 + ny * radius + jy, margin + 12, this.height - margin);

    const angle = Math.atan2(ny, nx);

    const farR = 255;
    const farG = 147;
    const farB = 173;
    const nearR = 255;
    const nearG = 70;
    const nearB = 82;

    const cr = Math.round(farR + (nearR - farR) * nearRatio);
    const cg = Math.round(farG + (nearG - farG) * nearRatio);
    const cb = Math.round(farB + (nearB - farB) * nearRatio);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);

    ctx.globalAlpha = 0.7 + 0.3 * pulse;
    ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -7);
    ctx.lineTo(-8, 7);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 0.55 + 0.35 * pulse;
    ctx.strokeStyle = "#ffe3ea";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-2, 0, 11 + nearRatio * 3, -0.9, 0.9);
    ctx.stroke();

    ctx.restore();

    const distMeter = Math.max(1, Math.floor(dist / 10));
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = nearRatio > 0.66 ? "#ffd2d9" : "#ffdbe4";
    ctx.font = "12px Microsoft YaHei";
    ctx.fillText(`首领 ${distMeter}m`, px - 28, py + 20);
    ctx.globalAlpha = 1;
  }

  private startRun(withStartBuff: boolean): void {
    const antiGate = this.anti.getGameplayGate(new Date(), true);
    if (!antiGate.ok) {
      this.phase = "start";
      this.showToast(antiGate.message || "当前不可开始游戏", "#ffb9a6");
      return;
    }

    this.phase = "running";
    this.elapsedTime = 0;
    this.kills = 0;
    this.pendingLevelUps = 0;
    this.reviveUsed = false;
    this.hasEvolvedThisRun = false;
    this.evolutionCountThisRun = 0;
    this.fusionCountThisRun = 0;
    this.evolvedBaseIdsThisRun.clear();
    this.pityInjectedCount = 0;
    this.pityHintShown = false;

    this.runningMode = this.selectedRunMode;
    let selectedStoryChapter = this.getSelectedStoryChapter();
    if (this.runningMode === "story" && !this.save.isStoryChapterUnlocked(selectedStoryChapter.level)) {
      selectedStoryChapter = this.getHighestUnlockedStoryChapter();
      this.selectedStoryChapterLevel = selectedStoryChapter.level;
    }
    this.runningStoryChapterLevel = selectedStoryChapter.level;
    this.runningStoryChapterName = selectedStoryChapter.name;
    this.endlessBossBatchReached = 0;
    this.dailyChallengeCleared = false;
    this.dailyChallengeBonusReward = 0;
    this.storyFinalBossSpawned = false;
    this.storyFinalBossKilled = false;
    this.storyFinalBossId = 0;
    this.storyFinalBossWarningShown = false;
    this.settleFragmentRewards = [];
    this.settleStoryStars = 0;
    this.settleStoryBestStars = 0;
    this.settleStoryStarTargetKills = 0;
    this.settleStoryChapterLevel = 0;
    this.settleStoryFirstClearRewards = [];
    const stages = this.cfg.getStageConfigs();
    if (stages.length > 0) {
      const targetStage = this.runningMode === "story"
        ? stages.find((item) => item.level >= selectedStoryChapter.startStageLevel) || stages[stages.length - 1]
        : stages[0];
      this.currentStageLevel = targetStage.level;
      this.currentStageName = targetStage.name;
    } else {
      this.currentStageLevel = 1;
      this.currentStageName = "默认关卡";
    }

    const dailyChallenge = this.runningMode === "daily" ? this.dailyChallengeSystem.getTodayChallenge() : null;
    if (dailyChallenge) {
      this.activeDailyChallenge = dailyChallenge;
    }

    this.player.setBounds(this.worldWidth, this.worldHeight);
    this.player.reset();

    const metaEffects = this.save.getMetaUpgradeEffects();
    this.player.applyMetaUpgrades(metaEffects);
    this.applyWeaponUpgradeRuntimeToPlayer();

    if (dailyChallenge) {
      if (dailyChallenge.playerDamageMul && dailyChallenge.playerDamageMul > 0) {
        this.player.passives.damageMultiplier *= dailyChallenge.playerDamageMul;
      }
      if (dailyChallenge.startElement) {
        this.player.addElement(dailyChallenge.startElement);
      }
    }

    this.obstacleSystem.generate(
      this.worldWidth,
      this.worldHeight,
      this.cfg.getBalance().mapObstacleCount || 16,
      this.player.x,
      this.player.y,
      {
        countMin: this.cfg.getBalance().mapObstacleCountMin,
        countMax: this.cfg.getBalance().mapObstacleCountMax,
        minWidth: this.cfg.getBalance().mapObstacleMinWidth,
        maxWidth: this.cfg.getBalance().mapObstacleMaxWidth,
        minHeight: this.cfg.getBalance().mapObstacleMinHeight,
        maxHeight: this.cfg.getBalance().mapObstacleMaxHeight,
        safeRadiusRatio: 0.16,
        overlapPadding: 8
      }
    );
    this.obstacleSystem.resolveCircle(this.player, this.worldWidth, this.worldHeight);

    this.enemies.length = 0;
    this.bossHazards.length = 0;

    const dailyEnemyDamageMul = dailyChallenge
      ? Math.max(0.92, 1 + (dailyChallenge.enemyHpMul - 1) * 0.35)
      : 1;
    const storyEnemyDamageMul = this.runningMode === "story" ? selectedStoryChapter.enemyDamageMul : 1;

    const storyBossTime = this.runningMode === "story"
      ? selectedStoryChapter.storyClearTime
      : dailyChallenge
        ? dailyChallenge.bossTime
        : this.cfg.getBalance().bossSpawnTime;
    const chapterEnemyWeightMulById =
      this.runningMode === "story" ? this.getChapterEnemyWeightMulById(selectedStoryChapter) : undefined;
    this.enemySpawner.reset({
      mode: this.runningMode,
      storyBossTime: storyBossTime,
      endlessBossFirstTime: this.cfg.getBalance().endlessBossFirstTime || 72,
      endlessBossInterval: this.cfg.getBalance().endlessBossInterval || 78,
      endlessBossHpBatchScale: this.cfg.getBalance().endlessBossHpBatchScale || 0.16,
      enemyHpMul: dailyChallenge
        ? dailyChallenge.enemyHpMul
        : this.runningMode === "story"
          ? selectedStoryChapter.enemyHpMul
          : 1,
      enemySpeedMul: dailyChallenge
        ? dailyChallenge.enemySpeedMul
        : this.runningMode === "story"
          ? selectedStoryChapter.enemySpeedMul
          : 1,
      enemyDamageMul: dailyChallenge ? dailyEnemyDamageMul : storyEnemyDamageMul,
      spawnIntervalMul: dailyChallenge
        ? dailyChallenge.spawnIntervalMul
        : this.runningMode === "story"
          ? selectedStoryChapter.spawnIntervalMul
          : 1,
      maxEnemyCount: this.getEnemyCapByPerformance(this.save.getSettings().performanceMode),
      startStageLevel: this.runningMode === "story" ? selectedStoryChapter.startStageLevel : 1,
      chapterEnemyWeightMulById
    });

    this.weaponSystem.reset(this.player);
    this.chestSystem.clear();
    this.chestWeaponOptions = [];
    this.chestCharacterOptions = [];
    this.chestBoosted = false;
    this.dropSystem.clear();
    this.effectSystem.floatingTexts.length = 0;
    this.effectSystem.particles.length = 0;
    this.effectSystem.ringPulses.length = 0;
    this.applySettingsToRuntime();
    this.ad.resetRunState();
    this.anti.onRunStart();

    this.damageFlashTime = 0;
    this.evolutionHitStopTime = 0;
    this.evolutionFlashTime = 0;
    this.evolutionBannerTime = 0;
    this.evolutionBannerText = "";

    this.updateCamera();

    this.analytics.startRun({
      withStartBuff,
      mode: this.runningMode,
      dailyChallengeId: dailyChallenge ? dailyChallenge.id : "",
      dailyChallengeTarget: dailyChallenge ? dailyChallenge.targetSurviveSeconds : 0,
      storyChapterLevel: this.runningMode === "story" ? selectedStoryChapter.level : 0,
      storyChapterName: this.runningMode === "story" ? selectedStoryChapter.name : ""
    });

    if (withStartBuff) {
      this.player.activateFrenzy(this.cfg.getBalance().startBuffDuration);
      this.showToast("开局增益已激活", "#ffd56f");
    }

    if (this.runningMode === "endless") {
      const firstBoss = this.cfg.getBalance().endlessBossFirstTime || 72;
      this.showToast(`无尽模式：${firstBoss}秒后首批首领`, "#a99bff");
    } else if (this.runningMode === "daily" && dailyChallenge) {
      this.showToast(`每日挑战：${dailyChallenge.name}`, dailyChallenge.color);
      this.effectSystem.addFloatingText(
        this.player.x,
        this.player.y - this.player.radius - 10,
        `目标 ${Math.ceil(dailyChallenge.targetSurviveSeconds)}s`,
        dailyChallenge.color
      );
    } else if (this.runningMode === "story") {
      this.showToast(
        `第${selectedStoryChapter.level}章：${selectedStoryChapter.name}（${Math.ceil(selectedStoryChapter.storyClearTime)}秒首领）`,
        "#9fd8ff"
      );
      const playerPower = this.save.estimatePlayerPower();
      const recommendedPower = this.getChapterRecommendedPower(selectedStoryChapter);
      if (playerPower < recommendedPower) {
        this.showToast(`当前战力${playerPower}，低于推荐${recommendedPower}`, "#ffc4a8");
      }
    }

    if (!this.save.getData().tutorialSeen) {
      this.showToast("拖动控制移动，攻击会自动释放", "#9fd6ff");
      this.save.markTutorialSeen();
    }
  }
  private openLevelUp(): void {
    this.phase = "upgrade";

    const forceEvolutionAssist = this.shouldForceEvolutionAssist();
    const roll = this.upgradeSystem.generateLevelUpOptions(this.player, this.getUpgradeHooks(), 3, {
      forceEvolutionAssist
    });

    this.levelUpOptions = roll.options;

    if (roll.forcedEvolutionAssist) {
      this.pityInjectedCount += 1;
      this.analytics.logEvent("evolution_pity_injected", {
        source: "levelup",
        time: this.elapsedTime,
        level: this.player.level
      });
      this.showToast("进化保底生效：出现进化相关选项", "#8fd8ff");
    }

    const ids = this.levelUpOptions.map((item) => item.id);
    this.extraAdOption = this.canOfferAd("extraUpgrade")
      ? this.upgradeSystem.generateExtraAdOption(this.player, this.getUpgradeHooks(), ids)
      : null;

    this.analytics.logEvent("upgrade_panel_open", {
      options: this.levelUpOptions.map((item) => item.id),
      hasExtraAdOption: !!this.extraAdOption,
      forceEvolutionAssist,
      level: this.player.level,
      time: this.elapsedTime
    });
  }

  private finalizeRun(cleared = false): void {
    this.phase = "settlement";
    this.anti.onRunEnd();

    const baseReward = Math.floor(this.kills * 2 + this.elapsedTime * 1.5);
    const canClaimDailyBonus =
      this.runningMode === "daily" && this.dailyChallengeCleared && this.save.canClaimDailyChallengeReward();
    const dailyBonus = canClaimDailyBonus ? this.dailyChallengeBonusReward : 0;
    this.settleReward = baseReward + dailyBonus;
    this.settleDoubled = false;
    this.settleStoryStars = 0;
    this.settleStoryBestStars = 0;
    this.settleStoryStarTargetKills = 0;
    this.settleStoryChapterLevel = 0;
    this.settleStoryFirstClearRewards = [];
    const runningStoryChapter = this.getRunningStoryChapter();
    const chapterKillStarTarget = this.getChapterKillStarTarget(runningStoryChapter);
    if (this.runningMode === "story") {
      this.settleStoryChapterLevel = runningStoryChapter.level;
      this.settleStoryStarTargetKills = chapterKillStarTarget;
    }

    this.save.appendRunStats(this.elapsedTime, this.kills);
    this.save.addDna(this.settleReward);
    if (dailyBonus > 0) {
      this.save.markDailyChallengeRewardClaimed();
    }

    this.settleFragmentRewards = this.save.grantRunWeaponFragments(
      this.player.ownedBaseWeaponIds,
      this.elapsedTime,
      this.kills,
      Array.from(this.evolvedBaseIdsThisRun)
    );
    const fragmentRewardTotal = this.settleFragmentRewards.reduce((sum, item) => sum + item.amount, 0);

    if (this.runningMode === "story" && cleared) {
      const storyStars = this.calcStoryStars(chapterKillStarTarget);
      const starUpdate = this.save.setStoryChapterBestStars(runningStoryChapter.id, storyStars);
      this.settleStoryStars = storyStars;
      this.settleStoryBestStars = starUpdate.bestStars;

      if (!this.save.isStoryChapterFirstCleared(runningStoryChapter.id)) {
        this.settleStoryFirstClearRewards = this.getStoryChapterFirstClearRewards(runningStoryChapter);
        this.save.addWeaponFragmentBundle(this.settleStoryFirstClearRewards);
        this.save.markStoryChapterFirstCleared(runningStoryChapter.id);
      }

      const nextChapter = this.getStoryChapters().find((item) => item.level === runningStoryChapter.level + 1);
      if (nextChapter) {
        const unlockResult = this.save.unlockStoryChapter(nextChapter.level);
        if (unlockResult.changed) {
          this.selectedStoryChapterLevel = nextChapter.level;
        }
      }
    }

    const masteryResult = this.save.addRunWeaponMastery(
      this.player.ownedBaseWeaponIds,
      this.elapsedTime,
      this.kills,
      Array.from(this.evolvedBaseIdsThisRun)
    );

    const completedQuests = this.save.applyRunToDailyQuests({
      kills: this.kills,
      survivalTime: this.elapsedTime,
      evolutionCount: this.evolutionCountThisRun,
      endlessBossBatchReached: this.endlessBossBatchReached,
      fusionCount: this.fusionCountThisRun
    });

    if (completedQuests.length > 0) {
      this.showToast(`每日任务完成 +${completedQuests.length}`, "#8fffb8");
    }

    if (dailyBonus > 0) {
      this.showToast(`每日挑战奖励 +${dailyBonus} DNA`, "#9df3b8");
    } else if (this.runningMode === "daily" && this.dailyChallengeCleared) {
      this.showToast("今日挑战首通奖励已领取", "#b9cce2");
    }

    const leveledMastery = masteryResult.filter((item) => item.levelAfter > item.levelBefore);
    if (leveledMastery.length > 0) {
      const first = leveledMastery[0];
      const weapon = this.cfg.getWeapon(first.baseWeaponId);
      this.showToast(`熟练度提升：${weapon.name} Lv.${first.levelAfter}`, "#9fe6ff");
    }
    if (this.settleFragmentRewards.length > 0) {
      this.showToast(`碎片奖励：${this.formatFragmentRewards(this.settleFragmentRewards)}`, "#9fe6ff");
    }
    if (this.settleStoryStars > 0) {
      const starText = this.formatStars(this.settleStoryStars);
      this.showToast(`章节评分：${starText}`, "#ffdca1");
    }
    if (this.settleStoryFirstClearRewards.length > 0) {
      this.showToast(`章节首通奖励：${this.formatFragmentRewards(this.settleStoryFirstClearRewards)}`, "#9df4b4");
    }

    this.analytics.logEvent("settlement_open", {
      time: this.elapsedTime,
      kills: this.kills,
      reward: this.settleReward,
      fragmentRewardTotal,
      fragmentRewards: this.settleFragmentRewards,
      mode: this.runningMode,
      endlessBossBatchReached: this.endlessBossBatchReached,
      evolved: this.hasEvolvedThisRun,
      evolutionCount: this.evolutionCountThisRun,
      fusionCount: this.fusionCountThisRun,
      completedDailyQuestCount: completedQuests.length,
      masteryLevelUpCount: leveledMastery.length,
      pityInjectedCount: this.pityInjectedCount,
      dailyChallengeId: this.runningMode === "daily" ? this.activeDailyChallenge.id : "",
      dailyChallengeCleared: this.dailyChallengeCleared,
      dailyChallengeBonus: dailyBonus,
      storyStars: this.settleStoryStars,
      storyBestStars: this.settleStoryBestStars,
      storyFirstClearReward: this.settleStoryFirstClearRewards,
      cleared
    });

    this.analytics.endRun({
      time: this.elapsedTime,
      kills: this.kills,
      reward: this.settleReward,
      fragmentRewardTotal,
      fragmentRewards: this.settleFragmentRewards,
      mode: this.runningMode,
      endlessBossBatchReached: this.endlessBossBatchReached,
      evolved: this.hasEvolvedThisRun,
      evolutionCount: this.evolutionCountThisRun,
      fusionCount: this.fusionCountThisRun,
      completedDailyQuestCount: completedQuests.length,
      masteryLevelUpCount: leveledMastery.length,
      pityInjectedCount: this.pityInjectedCount,
      dailyChallengeId: this.runningMode === "daily" ? this.activeDailyChallenge.id : "",
      dailyChallengeCleared: this.dailyChallengeCleared,
      dailyChallengeBonus: dailyBonus,
      storyStars: this.settleStoryStars,
      storyBestStars: this.settleStoryBestStars,
      storyFirstClearReward: this.settleStoryFirstClearRewards,
      cleared
    });
  }

  private buildChestMutationRewards(boosted: boolean): void {
    const chestRoll = this.upgradeSystem.generateChestMutationOptions(this.player, this.getUpgradeHooks(), boosted, {
      forceEvolutionAssist: this.shouldForceEvolutionAssist()
    });

    this.chestWeaponOptions = chestRoll.weaponOptions;
    this.chestCharacterOptions = chestRoll.characterOptions;

    if (chestRoll.forcedWeaponEvolutionAssist) {
      this.pityInjectedCount += 1;
      this.analytics.logEvent("evolution_pity_injected", {
        source: boosted ? "chest_boost" : "chest",
        time: this.elapsedTime
      });
    }
  }

  private tryCharacterMutationFusion(): void {
    let safety = 0;
    let fusion = this.characterMutationSystem.tryFuse(this.player);

    while (fusion && safety < 6) {
      this.analytics.logEvent("character_fusion_triggered", {
        fusionId: fusion.id,
        name: fusion.name,
        time: this.elapsedTime,
        level: this.player.level
      });
      this.showToast(`人物融合：${fusion.name}`, fusion.color);
      this.effectSystem.burst(this.player.x, this.player.y, fusion.color, 16);

      this.fusionCountThisRun += 1;
      safety += 1;
      fusion = this.characterMutationSystem.tryFuse(this.player);
    }
  }

  private tryEvolution(): void {
    const evo = this.evolutionSystem.tryEvolve(this.player);
    if (evo) {
      const targetWeapon = this.cfg.getWeapon(evo.toWeaponId);
      this.hasEvolvedThisRun = true;
      this.evolutionCountThisRun += 1;
      this.evolvedBaseIdsThisRun.add(evo.fromWeaponId);
      this.analytics.logEvent("evolution_triggered", {
        evolutionId: evo.rule.id,
        fromWeaponId: evo.fromWeaponId,
        toWeaponId: evo.toWeaponId,
        name: targetWeapon.name,
        level: this.player.level,
        time: this.elapsedTime
      });
      this.showToast(`完成进化：${targetWeapon.name}`, targetWeapon.color);
      this.triggerEvolutionFeedback(targetWeapon.name, targetWeapon.color);
    }
  }


  private tickEvolutionFeedback(dt: number): void {
    if (this.evolutionHitStopTime > 0) {
      this.evolutionHitStopTime -= dt;
      if (this.evolutionHitStopTime < 0) {
        this.evolutionHitStopTime = 0;
      }
    }

    if (this.evolutionFlashTime > 0) {
      this.evolutionFlashTime -= dt;
      if (this.evolutionFlashTime < 0) {
        this.evolutionFlashTime = 0;
      }
    }

    if (this.evolutionBannerTime > 0) {
      this.evolutionBannerTime -= dt;
      if (this.evolutionBannerTime < 0) {
        this.evolutionBannerTime = 0;
        this.evolutionBannerText = "";
      }
    }
  }

  private triggerEvolutionFeedback(name: string, color: string): void {
    this.evolutionHitStopTime = Math.max(this.evolutionHitStopTime, 0.085);
    this.evolutionFlashTime = Math.max(this.evolutionFlashTime, 0.28);
    this.evolutionBannerTime = 1.1;
    this.evolutionBannerText = `\u8FDB\u5316\u89C9\u9192:${name}`;
    this.evolutionBannerColor = color;
    this.vibrateShort("medium");

    this.player.activateDamageImmunity(this.cfg.getBalance().evolutionInvulnerableDuration || 0.7);

    this.effectSystem.burst(this.player.x, this.player.y, color, 26);
    this.effectSystem.pulseRing(
      this.player.x,
      this.player.y,
      color,
      this.player.radius + 10,
      this.player.radius + 162,
      0.52,
      5
    );
  }

  private updatePerfTelemetry(dt: number): void {
    const frameMs = dt * 1000;
    this.perfSampleSeconds += dt;
    this.perfSampleFrames += 1;
    this.perfSampleFrameMsSum += frameMs;
    this.perfSampleWorstFrameMs = Math.max(this.perfSampleWorstFrameMs, frameMs);

    if (this.perfSampleSeconds < 0.45) {
      return;
    }

    const frames = Math.max(1, this.perfSampleFrames);
    this.perfFps = frames / this.perfSampleSeconds;
    this.perfAvgFrameMs = this.perfSampleFrameMsSum / frames;
    this.perfWorstFrameMs = this.perfSampleWorstFrameMs;

    this.perfSampleSeconds = 0;
    this.perfSampleFrames = 0;
    this.perfSampleFrameMsSum = 0;
    this.perfSampleWorstFrameMs = 0;
  }

  private resetPerfTelemetry(): void {
    this.perfSampleSeconds = 0;
    this.perfSampleFrames = 0;
    this.perfSampleFrameMsSum = 0;
    this.perfSampleWorstFrameMs = 0;
    this.perfFps = 0;
    this.perfAvgFrameMs = 0;
    this.perfWorstFrameMs = 0;
    this.perfUpdateMs = 0;
    this.perfRenderMs = 0;
  }

  private drawPerformanceOverlay(ctx: CanvasRenderingContext2D): void {
    const panelX = 14;
    const panelY = 126;
    const panelW = 232;
    const panelH = 94;

    ctx.fillStyle = "rgba(5, 11, 19, 0.78)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "rgba(113, 198, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = "#dff2ff";
    ctx.font = "13px Microsoft YaHei";
    ctx.fillText("性能监控(调试)", panelX + 10, panelY + 17);

    ctx.fillStyle = "#9ad9ff";
    ctx.font = "12px Microsoft YaHei";
    ctx.fillText(
      `FPS ${this.perfFps.toFixed(1)} | 帧耗 ${this.perfAvgFrameMs.toFixed(1)}ms`,
      panelX + 10,
      panelY + 37
    );
    ctx.fillText(`最差帧 ${this.perfWorstFrameMs.toFixed(1)}ms`, panelX + 10, panelY + 55);
    ctx.fillText(
      `更新 ${this.perfUpdateMs.toFixed(1)}ms | 渲染 ${this.perfRenderMs.toFixed(1)}ms`,
      panelX + 10,
      panelY + 73
    );
    ctx.fillText(
      `怪物 ${this.enemies.length} | 弹幕 ${this.weaponSystem.projectiles.length} | 区域 ${this.weaponSystem.areas.length}`,
      panelX + 10,
      panelY + 91
    );
  }

  private drawDamageFlash(ctx: CanvasRenderingContext2D): void {
    if (this.damageFlashTime <= 0) {
      return;
    }

    const alpha = clamp(this.damageFlashTime / 0.16, 0, 1) * 0.26;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ff3b48";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalAlpha = 1;
  }

  private drawEvolutionFeedback(ctx: CanvasRenderingContext2D): void {
    if (this.evolutionFlashTime > 0) {
      const flashAlpha = clamp(this.evolutionFlashTime / 0.28, 0, 1) * 0.33;
      ctx.globalAlpha = flashAlpha;
      ctx.fillStyle = this.evolutionBannerColor;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalAlpha = 1;
    }

    if (this.evolutionBannerTime <= 0 || !this.evolutionBannerText) {
      return;
    }

    const ratio = clamp(this.evolutionBannerTime / 1.1, 0, 1);
    let alpha = 1;
    if (ratio > 0.78) {
      alpha = (1 - ratio) / 0.22;
    } else if (ratio < 0.2) {
      alpha = ratio / 0.2;
    }
    alpha = clamp(alpha, 0, 1);

    const panelW = this.width * 0.78;
    const panelH = 54;
    const panelX = (this.width - panelW) * 0.5;
    const panelY = 100 + (1 - alpha) * 18;

    ctx.globalAlpha = Math.max(0.22, alpha);
    ctx.fillStyle = "rgba(7, 14, 25, 0.86)";
    ctx.fillRect(panelX, panelY, panelW, panelH);

    ctx.strokeStyle = this.evolutionBannerColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = "#f2f8ff";
    ctx.font = "21px Microsoft YaHei";
    ctx.fillText(this.evolutionBannerText, panelX + 16, panelY + 34);
    ctx.globalAlpha = 1;
  }

  private shouldForceEvolutionAssist(): boolean {
    if (this.hasEvolvedThisRun) {
      return false;
    }
    return this.elapsedTime >= this.cfg.getBalance().evolutionPityStartTime;
  }

  private tickEnemyStatus(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      const dotDamage = enemy.updateStatus(dt);

      if (dotDamage > 1.2 && Math.random() < 0.12) {
        this.effectSystem.addFloatingText(
          enemy.x + 6,
          enemy.y - 8,
          `-${Math.round(dotDamage)}`,
          enemy.getStatusOverlayColor() || "#ffffff"
        );
      }

      if (enemy.isDead()) {
        const dead = this.removeEnemyAt(i);
        if (dead) {
          this.onEnemyKilled(dead, "dot");
        }
      }
    }
  }

  private updateBossHazards(dt: number): number {
    let playerDamage = 0;

    for (let i = this.bossHazards.length - 1; i >= 0; i -= 1) {
      const hazard = this.bossHazards[i];
      hazard.windup -= dt;

      if (!hazard.exploded && hazard.windup <= 0) {
        hazard.exploded = true;
        this.effectSystem.burst(hazard.x, hazard.y, hazard.color, 20);

        const dx = this.player.x - hazard.x;
        const dy = this.player.y - hazard.y;
        const hitRadius = hazard.radius + this.player.radius;
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          const tookDamage = this.player.receiveDamage(hazard.damage);
          if (tookDamage) {
            playerDamage += hazard.damage;
          }
        }
      }

      hazard.life -= dt;
      if (hazard.life <= 0) {
        this.removeBossHazardAt(i);
      }
    }

    return playerDamage;
  }

  private removeEnemyAt(index: number): Enemy | null {
    if (index < 0 || index >= this.enemies.length) {
      return null;
    }
    const lastIndex = this.enemies.length - 1;
    const removed = this.enemies[index];
    if (index !== lastIndex) {
      this.enemies[index] = this.enemies[lastIndex];
    }
    this.enemies.pop();
    return removed || null;
  }

  private removeBossHazardAt(index: number): void {
    if (index < 0 || index >= this.bossHazards.length) {
      return;
    }
    const lastIndex = this.bossHazards.length - 1;
    if (index !== lastIndex) {
      this.bossHazards[index] = this.bossHazards[lastIndex];
    }
    this.bossHazards.pop();
  }

  private onEnemyKilled(dead: Enemy, cause: "hit" | "dot"): void {
    this.kills += 1;
    this.dropSystem.spawnExp(dead.x, dead.y, dead.expDrop);
    this.chestSystem.onEnemyKilled(
      dead.x,
      dead.y,
      dead.isBoss,
      dead.isElite,
      this.cfg.getBalance().chestDropChance,
      this.cfg.getBalance().eliteChestDropBonus,
      this.cfg.getBalance().chestSpawnMinGap || 0
    );

    if (dead.isElite) {
      this.showToast("精英怪已击败！", "#ffd879");
      this.analytics.logEvent("elite_killed", {
        time: this.elapsedTime,
        level: this.player.level,
        cause
      });
    }

    if (dead.isBoss) {
      this.vibrateShort("medium");
      this.showToast("首领已击败！", "#ff9fb4");
      this.analytics.logEvent("boss_killed", {
        time: this.elapsedTime,
        level: this.player.level,
        cause
      });

      if (
        this.runningMode === "story" &&
        this.storyFinalBossSpawned &&
        !this.storyFinalBossKilled &&
        dead.id === this.storyFinalBossId
      ) {
        this.storyFinalBossKilled = true;
        this.showToast("最终首领已击败，通关成功！", "#9dffbe");
        this.analytics.logEvent("story_clear", {
          time: this.elapsedTime,
          kills: this.kills,
          level: this.player.level
        });
      }
    }

    this.effectSystem.burst(dead.x, dead.y, dead.color, dead.isBoss ? 26 : dead.isElite ? 18 : 10);
  }

  private getStoryClearTime(): number {
    const chapter = this.phase === "running" ? this.getRunningStoryChapter() : this.getSelectedStoryChapter();
    return Math.max(90, chapter.storyClearTime || this.cfg.getBalance().storyClearTime || 180);
  }

  private getBattleObjectiveText(): string {
    if (this.phase !== "running") {
      return "";
    }

    const stageLabel = `关卡${this.currentStageLevel}·${this.currentStageName}`;

    if (this.runningMode === "story") {
      const chapterLabel = `第${this.runningStoryChapterLevel}章`;
      if (this.storyFinalBossKilled) {
        return `${chapterLabel} | ${stageLabel} | 目标完成：最终首领已击败`;
      }

      if (this.storyFinalBossSpawned) {
        return `${chapterLabel} | ${stageLabel} | 目标：击败最终首领`;
      }

      const remain = Math.max(0, this.getStoryClearTime() - this.elapsedTime);
      return `${chapterLabel} | ${stageLabel} | 目标：${Math.ceil(remain)}秒后最终首领降临`;
    }

    if (this.runningMode === "daily") {
      const remain = Math.max(0, this.activeDailyChallenge.targetSurviveSeconds - this.elapsedTime);
      return `${stageLabel} | 挑战目标：生存${Math.ceil(remain)}秒`;
    }

    return `${stageLabel} | 无尽目标：持续生存并击败批次首领`;
  }

  private findLatestBossId(): number {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      if (this.enemies[i].isBoss) {
        return this.enemies[i].id;
      }
    }
    return 0;
  }

  private enhanceStoryFinalBoss(bossId: number): void {
    if (bossId <= 0) {
      return;
    }

    const boss = this.enemies.find((item) => item.id === bossId && item.isBoss);
    if (!boss) {
      return;
    }

    const balance = this.cfg.getBalance();
    const chapter = this.getRunningStoryChapter();
    const chapterBossTuning = this.getChapterBossTuning(chapter);
    const hpMul = Math.max(1.1, (balance.storyFinalBossHpScale || 1.62) * chapterBossTuning.hpMul);
    const speedMul = Math.max(1, (balance.storyFinalBossSpeedMul || 1.08) * chapterBossTuning.speedMul);
    const damageMul = Math.max(1, (balance.storyFinalBossDamageMul || 1.24) * chapterBossTuning.damageMul);

    boss.maxHp *= hpMul;
    boss.hp *= hpMul;
    boss.speed *= speedMul;
    boss.damage *= damageMul;
    boss.expDrop = Math.round(boss.expDrop * 1.8);
  }
  private getUpgradeHooks(): UpgradeApplyHooks {
    return {
      onWeaponAdded: (baseWeaponId: string) => {
        this.weaponSystem.onWeaponAdded(baseWeaponId);
      },
      onFeedback: (text: string, color = "#ffffff") => {
        this.showToast(text, color);
      }
    };
  }

  private canOfferAd(placement: AdPlacement): boolean {
    const gate = this.ad.canShowRewardedVideo(placement, this.elapsedTime);
    return gate.ok;
  }

  private async requestAd(placement: AdPlacement): Promise<boolean> {
    const gate = this.ad.canShowRewardedVideo(placement, this.elapsedTime);
    if (!gate.ok) {
      this.analytics.logEvent("ad_blocked", {
        placement,
        reason: gate.reason,
        remainSeconds: gate.remainSeconds,
        time: this.elapsedTime
      });
      this.showToast(this.getAdGateMessage(placement, gate), "#ffb6a3");
      return false;
    }

    this.analytics.logEvent("ad_request", {
      placement,
      time: this.elapsedTime
    });

    const success = await this.ad.showRewardedVideo(placement, this.elapsedTime);

    this.analytics.logEvent("ad_result", {
      placement,
      success,
      time: this.elapsedTime
    });

    return success;
  }

  private async playAdStartBuff(): Promise<void> {
    if (this.ad.isPlaying()) {
      return;
    }
    const success = await this.requestAd("startBuff");
    this.startRun(success);
    if (!success) {
      this.showToast("广告未完成，按普通开局进入战斗", "#ffb9a6");
    }
  }

  private async playAdExtraUpgrade(): Promise<void> {
    if (this.ad.isPlaying() || !this.extraAdOption) {
      return;
    }

    const success = await this.requestAd("extraUpgrade");
    if (success && this.extraAdOption) {
      this.analytics.logEvent("upgrade_pick", {
        optionId: this.extraAdOption.id,
        category: this.extraAdOption.category,
        source: "levelup_ad",
        level: this.player.level,
        time: this.elapsedTime
      });

      this.extraAdOption.apply();
      this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
      this.tryEvolution();
      if (this.pendingLevelUps > 0) {
        this.openLevelUp();
      } else {
        this.phase = "running";
      }
    }
  }

  private async playAdChestBoost(): Promise<void> {
    if (this.ad.isPlaying()) {
      return;
    }

    const success = await this.requestAd("chestBoost");
    if (success) {
      this.chestBoosted = true;
      this.buildChestMutationRewards(true);
      this.analytics.logEvent("chest_boosted", {
        options: [
          ...this.chestWeaponOptions.map((item) => item.id),
          ...this.chestCharacterOptions.map((item) => item.id)
        ],
        time: this.elapsedTime
      });
      this.showToast("宝箱强化成功", "#ffd671");
    }
  }

  private async playAdRevive(): Promise<void> {
    if (this.ad.isPlaying() || this.reviveUsed) {
      return;
    }

    const success = await this.requestAd("revive");
    if (success) {
      this.reviveUsed = true;
      this.player.setHpRatio(this.cfg.getBalance().reviveHpRatio);
      this.player.activateDamageImmunity(this.cfg.getBalance().reviveInvulnerableDuration || 1.15);

      const removeCount = Math.floor(this.enemies.length * 0.45);
      this.enemies.splice(0, removeCount);

      this.phase = "running";
      this.analytics.logEvent("revive_success", {
        hp: this.player.hp,
        time: this.elapsedTime
      });
      this.showToast("\u590D\u6D3B\u6210\u529F\uFF1A\u77ED\u6682\u65E0\u654C", "#8fffaa");
    }
  }

  private async playAdDoubleReward(): Promise<void> {
    if (this.ad.isPlaying() || this.settleDoubled) {
      return;
    }

    const success = await this.requestAd("doubleReward");
    if (success) {
      const bonus = this.settleReward;
      this.settleReward += bonus;
      this.save.addDna(bonus);
      this.settleDoubled = true;
      this.analytics.logEvent("double_reward_success", {
        reward: this.settleReward,
        bonus,
        time: this.elapsedTime
      });
      this.showToast("奖励翻倍", "#ffe38a");
    }
  }

  private async exportAnalytics(): Promise<void> {
    const text = this.analytics.exportText();
    const success = await this.analytics.copyToClipboard(text);
    if (success) {
      this.showToast(`埋点已复制（${this.analytics.getEventCount()}条）`, "#8fd8ff");
    } else {
      console.log(text);
      this.showToast("复制失败，已输出到控制台", "#ffb6a3");
    }
  }

  private async handleAntiRealnameAuth(): Promise<void> {
    const result = await this.anti.requestRealNameAuth("manual");
    if (result.ok) {
      this.showToast(result.message || "实名认证成功", "#9df4b4");
      return;
    }
    this.showToast(result.message || "实名认证失败", "#ffb6a3");
  }

  private async handleAntiFaceVerify(): Promise<void> {
    const result = await this.anti.requestFaceVerify("manual");
    if (result.ok) {
      this.showToast(result.message || "人脸核验成功", "#9df4b4");
      return;
    }
    this.showToast(result.message || "人脸核验失败", "#ffb6a3");
  }

  private getAdGateMessage(placement: AdPlacement, gate: AdGateResult): string {
    const placementLabel = this.getPlacementLabel(placement);
    if (gate.reason === "playing") {
      return "广告播放中，请稍候";
    }
    if (gate.reason === "disabled") {
      return `${placementLabel}已关闭`;
    }
    if (gate.reason === "unsupported") {
      return "当前环境不支持广告能力";
    }
    if (gate.reason === "ad_unit_missing") {
      return `${placementLabel}未配置广告位`;
    }
    if (gate.reason === "min_run_time") {
      return `${placementLabel}需在${Math.ceil(gate.remainSeconds || 0)}秒后可用`;
    }
    if (gate.reason === "cooldown") {
      return `${placementLabel}冷却中(${Math.ceil(gate.remainSeconds || 0)}秒)`;
    }
    return `${placementLabel}当前不可用`;
  }

  private getPlacementLabel(placement: AdPlacement): string {
    const map: Record<AdPlacement, string> = {
      revive: "复活",
      chestBoost: "宝箱强化",
      startBuff: "开局增益",
      extraUpgrade: "额外升级选项",
      doubleReward: "结算双倍"
    };
    return map[placement] || placement;
  }

  private confirmAction(action: "reset_save" | "pause_exit" | "shop_reset_points", label: string): boolean {
    if (this.pendingConfirmAction === action && this.pendingConfirmTime > 0) {
      this.pendingConfirmAction = "";
      this.pendingConfirmTime = 0;
      return true;
    }

    this.pendingConfirmAction = action;
    this.pendingConfirmTime = 2.4;
    this.showToast(`再次点击以确认${label}`, "#ffd0a8");
    return false;
  }

  private applySettingsToRuntime(): void {
    const settings = this.save.getSettings();
    this.inputManager.setMoveSensitivity(settings.moveSensitivity);
    this.effectSystem.setPerformanceMode(settings.performanceMode);
    this.enemySpawner.setMaxEnemyCount(this.getEnemyCapByPerformance(settings.performanceMode));
  }

  private getPerformanceLabel(mode: PerformanceMode): string {
    if (mode === "quality") {
      return "高画质";
    }
    if (mode === "performance") {
      return "性能";
    }
    return "均衡";
  }

  private getEnemyCapByPerformance(mode: PerformanceMode): number {
    if (mode === "quality") {
      return 176;
    }
    if (mode === "performance") {
      return 112;
    }
    return 144;
  }

  private vibrateShort(type: "light" | "medium" = "light"): void {
    if (!this.save.getSettings().vibrationEnabled) {
      return;
    }

    try {
      wx.vibrateShort({
        type: type === "medium" ? "medium" : "light"
      });
    } catch (error) {
      // Ignore unsupported vibration environments.
    }
  }

  private updateCamera(): void {
    const halfW = this.width * 0.5;
    const halfH = this.height * 0.5;

    if (this.worldWidth <= this.width) {
      this.cameraX = this.worldWidth * 0.5;
    } else {
      this.cameraX = clamp(this.player.x, halfW, this.worldWidth - halfW);
    }

    if (this.worldHeight <= this.height) {
      this.cameraY = this.worldHeight * 0.5;
    } else {
      this.cameraY = clamp(this.player.y, halfH, this.worldHeight - halfH);
    }
  }

  private applyWeaponUpgradeRuntimeToPlayer(): void {
    const infos = this.save.getWeaponUpgradeInfos();
    for (const info of infos) {
      this.player.setWeaponUpgradeRuntime(
        info.baseWeaponId,
        info.damageBonus,
        info.unlockedSkills.map((item) => item.id)
      );
    }
  }

  private formatFragmentRewards(rewards: Array<{ baseWeaponId: string; amount: number }>): string {
    if (rewards.length <= 0) {
      return "无";
    }

    return rewards
      .map((item) => {
        const weapon = this.cfg.getWeapon(item.baseWeaponId);
        return `${weapon.name}碎片+${item.amount}`;
      })
      .join("，");
  }

  private getStartRunGate(recordBlocked = false): { ok: boolean; reason: string } {
    const antiGate = this.anti.getGameplayGate(new Date(), recordBlocked);
    if (!antiGate.ok) {
      return {
        ok: false,
        reason: antiGate.message || "当前不可开始游戏"
      };
    }

    if (this.selectedRunMode !== "story") {
      return {
        ok: true,
        reason: ""
      };
    }

    const chapter = this.getSelectedStoryChapter();
    if (this.save.isStoryChapterUnlocked(chapter.level)) {
      return {
        ok: true,
        reason: ""
      };
    }

    return {
      ok: false,
      reason: `第${chapter.level}章未解锁，请先通关第${Math.max(1, chapter.level - 1)}章`
    };
  }

  private getHighestUnlockedStoryChapter(): StoryChapterConfig {
    const chapters = this.getStoryChapters();
    if (chapters.length <= 0) {
      return this.getSelectedStoryChapter();
    }

    const unlockedLevel = this.save.getUnlockedStoryChapterLevel();
    return chapters.filter((item) => item.level <= unlockedLevel).pop() || chapters[0];
  }

  private getChapterRecommendedPower(chapter: StoryChapterConfig): number {
    if (typeof chapter.recommendedPower === "number" && Number.isFinite(chapter.recommendedPower)) {
      return Math.max(100, Math.floor(chapter.recommendedPower));
    }
    const level = Math.max(1, chapter.level);
    return Math.floor(120 + level * level * 4.5 + level * 28);
  }

  private getChapterKillStarTarget(chapter: StoryChapterConfig): number {
    const configured = chapter.starGoals?.killTarget;
    if (typeof configured === "number" && Number.isFinite(configured)) {
      return Math.max(50, Math.floor(configured));
    }
    const level = Math.max(1, chapter.level);
    return Math.floor(90 + level * 12 + level * level * 0.52);
  }

  private getStoryStarGoalSummary(chapter: StoryChapterConfig): string {
    return `通关 | 无复活通关 | 击杀≥${this.getChapterKillStarTarget(chapter)}`;
  }

  private getStoryChapterFirstClearRewards(chapter: StoryChapterConfig): Array<{ baseWeaponId: string; amount: number }> {
    if (Array.isArray(chapter.firstClearFragmentRewards) && chapter.firstClearFragmentRewards.length > 0) {
      return chapter.firstClearFragmentRewards
        .map((item) => ({
          baseWeaponId: item.baseWeaponId,
          amount: Math.max(1, Math.floor(item.amount || 0))
        }))
        .filter((item) => !!item.baseWeaponId && item.amount > 0);
    }

    const ids = this.cfg.getBaseWeaponIds();
    if (ids.length <= 0) {
      return [];
    }

    const level = Math.max(1, chapter.level);
    const mainIndex = (level - 1) % ids.length;
    const subIndex = (mainIndex + 1) % ids.length;
    const rewards: Array<{ baseWeaponId: string; amount: number }> = [
      {
        baseWeaponId: ids[mainIndex],
        amount: 10 + level * 2
      },
      {
        baseWeaponId: ids[subIndex],
        amount: 6 + Math.floor(level * 1.4)
      }
    ];

    if (level >= 8) {
      const extraIndex = (mainIndex + 2) % ids.length;
      rewards.push({
        baseWeaponId: ids[extraIndex],
        amount: 4 + Math.floor(level * 0.8)
      });
    }

    return rewards;
  }

  private getChapterEnemyWeightMulById(chapter: StoryChapterConfig): Record<string, number> {
    if (chapter.enemyWeightMulById && Object.keys(chapter.enemyWeightMulById).length > 0) {
      return chapter.enemyWeightMulById;
    }

    const progress = clamp((Math.max(1, chapter.level) - 1) / 19, 0, 1);
    return {
      slime: Math.max(0.24, 1 - progress * 0.74),
      hound: 1 + progress * 0.34,
      spitter: chapter.level >= 3 ? 0.9 + progress * 0.62 : 0.45,
      brute: chapter.level >= 4 ? 0.82 + progress * 0.86 : 0.38,
      shield_guard: chapter.level >= 5 ? 0.74 + progress * 1.02 : 0.35,
      swift_stalker: chapter.level >= 6 ? 0.68 + progress * 1.22 : 0.32
    };
  }

  private getChapterBossTuning(chapter: StoryChapterConfig): { hpMul: number; speedMul: number; damageMul: number } {
    if (chapter.bossTuning) {
      return {
        hpMul: Math.max(1, chapter.bossTuning.hpMul || 1),
        speedMul: Math.max(1, chapter.bossTuning.speedMul || 1),
        damageMul: Math.max(1, chapter.bossTuning.damageMul || 1)
      };
    }

    const pressure = Math.max(0, chapter.level - 1);
    return {
      hpMul: 1 + pressure * 0.045,
      speedMul: 1 + pressure * 0.008,
      damageMul: 1 + pressure * 0.04
    };
  }

  private calcStoryStars(killTarget: number): number {
    let stars = 1;
    if (!this.reviveUsed) {
      stars += 1;
    }
    if (this.kills >= killTarget) {
      stars += 1;
    }
    return Math.max(1, Math.min(3, stars));
  }

  private formatStars(stars: number): string {
    const safe = Math.max(0, Math.min(3, Math.floor(stars || 0)));
    return `${"★".repeat(safe)}${"☆".repeat(Math.max(0, 3 - safe))}`;
  }

  private getSettlementStorySummary(): string {
    if (this.runningMode !== "story" || this.settleStoryChapterLevel <= 0 || this.settleStoryStars <= 0) {
      return "";
    }

    const starText = this.formatStars(this.settleStoryStars);
    const bestText = this.settleStoryBestStars > 0 ? `历史最高 ${this.formatStars(this.settleStoryBestStars)}` : "";
    const killText = `击杀目标 ${this.kills}/${this.settleStoryStarTargetKills}`;
    return `第${this.settleStoryChapterLevel}章评分 ${starText} | ${killText}${bestText ? ` | ${bestText}` : ""}`;
  }

  private getStoryChapters(): StoryChapterConfig[] {
    return this.cfg
      .getStoryChapters()
      .slice()
      .sort((a, b) => a.level - b.level);
  }

  private getSelectedStoryChapter(): StoryChapterConfig {
    const chapters = this.getStoryChapters();
    if (chapters.length <= 0) {
      return {
        id: "chapter_fallback",
        level: 1,
        name: "默认章节",
        description: "默认标准局",
        storyClearTime: this.cfg.getBalance().storyClearTime || 180,
        startStageLevel: 1,
        enemyHpMul: 1,
        enemySpeedMul: 1,
        enemyDamageMul: 1,
        spawnIntervalMul: 1
      };
    }

    const exact = chapters.find((item) => item.level === this.selectedStoryChapterLevel);
    if (exact) {
      return exact;
    }
    return chapters.filter((item) => item.level <= this.selectedStoryChapterLevel).pop() || chapters[0];
  }

  private getRunningStoryChapter(): StoryChapterConfig {
    const chapters = this.getStoryChapters();
    if (chapters.length <= 0) {
      return this.getSelectedStoryChapter();
    }
    const exact = chapters.find((item) => item.level === this.runningStoryChapterLevel);
    if (exact) {
      return exact;
    }
    return chapters.filter((item) => item.level <= this.runningStoryChapterLevel).pop() || chapters[0];
  }

  private syncLobbyMeta(): void {
    this.lobbyChestClaimed = !this.save.canClaimDailyChest();
  }

  private showToast(text: string, color = "#ffffff"): void {
    this.toast = text;
    this.toastColor = color;
    this.toastTime = 1.8;
  }

  private showAdState(text: string): void {
    this.adStateText = text;
    this.adStateTime = 1.4;
  }

  private getModeLabel(mode: RunMode): string {
    if (mode === "endless") {
      return "无尽模式";
    }
    if (mode === "daily") {
      return "每日挑战";
    }
    const chapter = this.getSelectedStoryChapter();
    const locked = !this.save.isStoryChapterUnlocked(chapter.level);
    return locked ? `标准模式（第${chapter.level}章·未解锁）` : `标准模式（第${chapter.level}章）`;
  }
}













































































