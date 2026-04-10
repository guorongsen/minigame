import { IScene } from "../core/Scene";
import { InputManager } from "../core/InputManager";
import { Boss } from "../entities/Boss";
import { Enemy } from "../entities/Enemy";
import { Player } from "../entities/Player";
import { AdManager } from "../managers/AdManager";
import { AnalyticsManager } from "../managers/AnalyticsManager";
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
import { AdGateResult, AdPlacement, DailyChallengeTemplate, UpgradeOption } from "../types";
import { clamp } from "../utils/MathUtil";

export type BattlePhase =
  | "start"
  | "running"
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
  private readonly analytics = AnalyticsManager.getInstance();

  private readonly worldWidth: number;
  private readonly worldHeight: number;

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

  private toast = "";
  private toastColor = "#ffffff";
  private toastTime = 0;

  private adStateText = "";
  private adStateTime = 0;
  private damageFlashTime = 0;

  private evolutionHitStopTime = 0;
  private evolutionFlashTime = 0;
  private evolutionBannerTime = 0;
  private evolutionBannerText = "";
  private evolutionBannerColor = "#ffffff";

  private lobbyTab: "chest" | "home" | "weapon" | "mode" = "home";
  private lobbyChestClaimed = false;
  private freeStartBuffCharges = 0;

  private selectedRunMode: RunMode = "story";
  private runningMode: RunMode = "story";
  private endlessBossBatchReached = 0;
  private activeDailyChallenge: DailyChallengeTemplate;
  private dailyChallengeCleared = false;
  private dailyChallengeBonusReward = 0;


  private storyFinalBossSpawned = false;
  private storyFinalBossKilled = false;
  private storyFinalBossId = 0;
  private storyFinalBossWarningShown = false;
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
    this.enemySpawner = new EnemySpawner(this.width, this.height, this.worldWidth, this.worldHeight);
    this.enemySpawner.setObstacleChecker((x, y, radius) => this.obstacleSystem.isCircleBlocked(x, y, radius));

    this.activeDailyChallenge = this.dailyChallengeSystem.getTodayChallenge();

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
  }

  enter(): void {
    this.phase = "start";
    this.activeDailyChallenge = this.dailyChallengeSystem.getTodayChallenge();
    this.syncLobbyMeta();
  }

  exit(): void {
    this.ad.removeListener(this.adListener);
  }

  update(dt: number): void {
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

    this.tickEvolutionFeedback(dt);

    if (this.phase !== "running") {
      return;
    }

    if (this.evolutionHitStopTime > 0) {
      return;
    }

    this.elapsedTime += dt;

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

    if (spawnResult.bossSpawned) {
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
      this.showToast(`每日挑战完成，额外奖励 +${this.dailyChallengeBonusReward} DNA`, "#97ffbe");
      this.finalizeRun(true);
      return;
    }

    if (this.phase === "running" && this.runningMode === "story" && this.storyFinalBossKilled) {
      this.finalizeRun(true);
      return;
    }
    if (this.player.isDead()) {
      this.phase = "death";
      this.analytics.logEvent("player_dead", {
        time: this.elapsedTime,
        level: this.player.level,
        kills: this.kills,
        hasEvolved: this.hasEvolvedThisRun
      });
      this.showToast("战斗失败", "#ff8080");
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.ui.beginFrame();

    this.drawBackground(ctx);

    if (this.phase !== "start" && this.phase !== "encyclopedia") {
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
        objectiveText: this.getBattleObjectiveText()
      });

      this.drawMiniMap(ctx);
      if (this.phase === "running") {
        this.drawBossDirectionPointer(ctx);
      }
    }

    if (this.phase === "start") {
      this.syncLobbyMeta();
      this.activeDailyChallenge = this.dailyChallengeSystem.getTodayChallenge();
      const save = this.save.getData();
      this.ui.drawStartPanel(ctx, this.width, this.height, {
        bestTime: save.bestSurvivalTime,
        totalRuns: save.totalRuns,
        totalKills: save.totalKills,
        debug: save.debugMode,
        activeTab: this.lobbyTab,
        chestClaimed: this.lobbyChestClaimed,
        freeBuffCharges: this.freeStartBuffCharges,
        dna: save.dna,
        weaponCards: this.cfg.getBaseWeaponIds().map((baseId) => {
          const weapon = this.cfg.getWeapon(baseId);
          const mastery = this.save.getWeaponMasteryInfo(baseId);
          return {
            id: baseId,
            name: weapon.name,
            color: weapon.color,
            description: weapon.description,
            masteryLevel: mastery.level,
            masteryProgress: mastery.progress,
            masteryCurrent: mastery.current,
            masteryNeed: mastery.need
          };
        }),
        dailyQuests: this.save.getDailyQuests(),
        shopItems: this.save.getMetaUpgradeShopItems(),
        shopResetRefund: this.save.getMetaUpgradeResetPreview().refund,
        unlockedEvolutionCount: save.unlockedEvolutionIds.length,
        totalEvolutionCount: this.cfg.getAllEvolutionRules().length,
        selectedMode: this.selectedRunMode,
        currentModeLabel: this.getModeLabel(this.selectedRunMode),
        endlessBossInterval: this.cfg.getBalance().endlessBossInterval || 78,
        dailyChallengeName: this.activeDailyChallenge.name,
        dailyChallengeDescription: this.activeDailyChallenge.description,
        dailyChallengeTarget: this.activeDailyChallenge.targetSurviveSeconds,
        dailyChallengeReward: this.activeDailyChallenge.rewardBonusDna,
        storyClearTime: this.getStoryClearTime()
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
        doubled: this.settleDoubled
      });
    } else if (this.phase === "encyclopedia") {
      this.ui.drawEncyclopediaPanel(
        ctx,
        this.width,
        this.height,
        this.encyclopediaSystem.getEntries(),
        this.save.getData().debugMode
      );
    }

    this.drawEvolutionFeedback(ctx);
    this.drawDamageFlash(ctx);

    if (this.toast) {
      this.ui.drawToast(ctx, this.width, this.toast, this.toastColor);
    }

    if (this.adStateText) {
      this.ui.drawAdState(ctx, this.width, this.adStateText);
    }
  }

  onTap(x: number, y: number): void {
    const button = this.ui.hitTest(x, y);
    if (!button) {
      return;
    }

    const id = button.id;

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

    if (id === "claim_chest") {
      if (!this.save.canClaimDailyChest()) {
        this.syncLobbyMeta();
        this.showToast("宝箱今日已领取", "#ffd7a0");
        return;
      }

      const gain = Math.random() < 0.24 ? 2 : 1;
      this.save.claimDailyChest(gain);
      this.syncLobbyMeta();
      this.analytics.logEvent("lobby_chest_claim", {
        gain,
        freeStartBuffCharges: this.freeStartBuffCharges
      });
      this.showToast(`领取成功：开局增益券 x${gain}`, "#ffe38f");
      return;
    }

    if (id === "start_run") {
      const useFreeBuff = this.save.consumeFreeStartBuffCharge();
      this.syncLobbyMeta();
      if (useFreeBuff) {
        this.showToast("已消耗增益券，本局开局获得狂热", "#ffe38f");
      }
      this.startRun(useFreeBuff);
      return;
    }

    if (id === "start_buff_ad") {
      this.playAdStartBuff();
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
          rewardDna: claim.rewardDna,
          rewardBuffCharge: claim.rewardBuffCharge
        });

        let rewardText = `领取成功：DNA+${claim.rewardDna}`;
        if (claim.rewardBuffCharge > 0) {
          rewardText += `，增益券+${claim.rewardBuffCharge}`;
        }
        this.showToast(rewardText, "#8fffc1");
      } else {
        this.showToast("任务未完成或已领取", "#ffd3a8");
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
      this.showToast("已切换：标准模式", "#9fd8ff");
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

    if (id === "open_encyclopedia") {
      this.phase = "encyclopedia";
      return;
    }

    if (id === "toggle_debug") {
      const current = this.save.getData().debugMode;
      this.save.setDebugMode(!current);
      this.analytics.logEvent("debug_toggle", { enabled: !current });
      this.showToast(`调试模式${!current ? "开启" : "关闭"}`, "#ffd38a");
      return;
    }

    if (id === "reset_save") {
      this.save.resetSave();
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

    if (id === "close_encyclopedia") {
      this.phase = "start";
      this.lobbyTab = "weapon";
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
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, "#0f1a2a");
    grad.addColorStop(1, "#0b111a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
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

    ctx.fillStyle = "#7fc4ff";
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#d7f0ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, this.player.radius + 4, 0, Math.PI * 2);
    ctx.stroke();

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
      ctx.font = "11px sans-serif";
      ctx.fillText("\u65E0\u654C", this.player.x - 12, this.player.y + this.player.radius + 18);
    }

    this.drawPlayerHeadBars(ctx);

    this.effectSystem.render(ctx);
  }

  private drawWorldFloor(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#111d2d";
    ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);

    ctx.strokeStyle = "rgba(110, 142, 178, 0.1)";
    ctx.lineWidth = 1;
    const step = 72;

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

    ctx.strokeStyle = "rgba(180, 220, 255, 0.3)";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, this.worldWidth - 4, this.worldHeight - 4);
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
    ctx.font = "11px sans-serif";
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
    ctx.font = "12px sans-serif";
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
    ctx.font = "12px sans-serif";
    ctx.fillText(`首领 ${distMeter}m`, px - 28, py + 20);
    ctx.globalAlpha = 1;
  }

  private startRun(withStartBuff: boolean): void {
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
    this.endlessBossBatchReached = 0;
    this.dailyChallengeCleared = false;
    this.dailyChallengeBonusReward = 0;
    this.storyFinalBossSpawned = false;
    this.storyFinalBossKilled = false;
    this.storyFinalBossId = 0;
    this.storyFinalBossWarningShown = false;

    const dailyChallenge = this.runningMode === "daily" ? this.dailyChallengeSystem.getTodayChallenge() : null;
    if (dailyChallenge) {
      this.activeDailyChallenge = dailyChallenge;
    }

    this.player.setBounds(this.worldWidth, this.worldHeight);
    this.player.reset();

    const metaEffects = this.save.getMetaUpgradeEffects();
    this.player.applyMetaUpgrades(metaEffects);

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

    const storyBossTime = this.runningMode === "story"
      ? this.getStoryClearTime()
      : dailyChallenge
        ? dailyChallenge.bossTime
        : this.cfg.getBalance().bossSpawnTime;
    this.enemySpawner.reset({
      mode: this.runningMode,
      storyBossTime: storyBossTime,
      endlessBossFirstTime: this.cfg.getBalance().endlessBossFirstTime || 72,
      endlessBossInterval: this.cfg.getBalance().endlessBossInterval || 78,
      endlessBossHpBatchScale: this.cfg.getBalance().endlessBossHpBatchScale || 0.16,
      enemyHpMul: dailyChallenge ? dailyChallenge.enemyHpMul : 1,
      enemySpeedMul: dailyChallenge ? dailyChallenge.enemySpeedMul : 1,
      enemyDamageMul: dailyEnemyDamageMul,
      spawnIntervalMul: dailyChallenge ? dailyChallenge.spawnIntervalMul : 1
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
    this.ad.resetRunState();

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
      dailyChallengeTarget: dailyChallenge ? dailyChallenge.targetSurviveSeconds : 0
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
      this.showToast(`标准模式：${Math.ceil(this.getStoryClearTime())}秒后最终首领登场`, "#9fd8ff");
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

    const baseReward = Math.floor(this.kills * 2 + this.elapsedTime * 1.5);
    const dailyBonus = this.runningMode === "daily" && this.dailyChallengeCleared ? this.dailyChallengeBonusReward : 0;
    this.settleReward = baseReward + dailyBonus;
    this.settleDoubled = false;

    this.save.appendRunStats(this.elapsedTime, this.kills);
    this.save.addDna(this.settleReward);

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
    }

    const leveledMastery = masteryResult.filter((item) => item.levelAfter > item.levelBefore);
    if (leveledMastery.length > 0) {
      const first = leveledMastery[0];
      const weapon = this.cfg.getWeapon(first.baseWeaponId);
      this.showToast(`熟练度提升：${weapon.name} Lv.${first.levelAfter}`, "#9fe6ff");
    }

    this.analytics.logEvent("settlement_open", {
      time: this.elapsedTime,
      kills: this.kills,
      reward: this.settleReward,
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
      cleared
    });

    this.analytics.endRun({
      time: this.elapsedTime,
      kills: this.kills,
      reward: this.settleReward,
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
    ctx.font = "21px sans-serif";
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
        this.enemies.splice(i, 1);
        this.onEnemyKilled(enemy, "dot");
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
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= hazard.radius + this.player.radius) {
          const tookDamage = this.player.receiveDamage(hazard.damage);
          if (tookDamage) {
            playerDamage += hazard.damage;
          }
        }
      }

      hazard.life -= dt;
      if (hazard.life <= 0) {
        this.bossHazards.splice(i, 1);
      }
    }

    return playerDamage;
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
      this.cfg.getBalance().eliteChestDropBonus
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
    return Math.max(90, this.cfg.getBalance().storyClearTime || 180);
  }

  private getBattleObjectiveText(): string {
    if (this.phase !== "running") {
      return "";
    }

    if (this.runningMode === "story") {
      if (this.storyFinalBossKilled) {
        return "目标完成：最终首领已击败";
      }

      if (this.storyFinalBossSpawned) {
        return "目标：击败最终首领";
      }

      const remain = Math.max(0, this.getStoryClearTime() - this.elapsedTime);
      return `目标：${Math.ceil(remain)}秒后最终首领降临`;
    }

    if (this.runningMode === "daily") {
      const remain = Math.max(0, this.activeDailyChallenge.targetSurviveSeconds - this.elapsedTime);
      return `挑战目标：生存${Math.ceil(remain)}秒`;
    }

    return "无尽目标：持续生存并击败批次首领";
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
    const hpMul = Math.max(1.1, balance.storyFinalBossHpScale || 1.62);
    const speedMul = Math.max(1, balance.storyFinalBossSpeedMul || 1.08);
    const damageMul = Math.max(1, balance.storyFinalBossDamageMul || 1.24);

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

  private getAdGateMessage(placement: AdPlacement, gate: AdGateResult): string {
    const placementLabel = this.getPlacementLabel(placement);
    if (gate.reason === "playing") {
      return "广告播放中，请稍候";
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

  private syncLobbyMeta(): void {
    this.lobbyChestClaimed = !this.save.canClaimDailyChest();
    this.freeStartBuffCharges = this.save.getFreeStartBuffCharges();
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
    return "标准模式";
  }
}












































































