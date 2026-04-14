import { DailyQuestProgress, MetaUpgradeShopItem, PerformanceMode, UIButton, UpgradeOption } from "../types";

interface HudData {
  hp: number;
  maxHp: number;
  exp: number;
  expToNext: number;
  level: number;
  kills: number;
  time: number;
  elements: Array<{ name: string; color: string }>;
  weaponSummaries: Array<{ name: string; level: number; color: string }>;
  frenzyActive: boolean;
  objectiveText?: string;
  showPauseButton?: boolean;
}

interface StartWeaponCard {
  id: string;
  name: string;
  color: string;
  description: string;
  upgradeLevel: number;
  maxUpgradeLevel: number;
  fragmentCount: number;
  nextUpgradeCost: number;
  canUpgrade: boolean;
  damageBonus: number;
  unlockedSkills: string[];
  nextSkillTitle: string;
  masteryLevel: number;
  masteryProgress: number;
  masteryCurrent: number;
  masteryNeed: number;
}

interface StartPanelData {
  bestTime: number;
  totalRuns: number;
  totalKills: number;
  debug: boolean;
  activeTab: "chest" | "home" | "weapon" | "mode" | "settings";
  chestClaimed: boolean;
  totalFragments: number;
  dna: number;
  weaponCards: StartWeaponCard[];
  weaponPage: number;
  weaponPageCount: number;
  dailyQuests: DailyQuestProgress[];
  claimableQuestCount: number;
  shopItems: MetaUpgradeShopItem[];
  shopResetRefund: number;
  unlockedEvolutionCount: number;
  totalEvolutionCount: number;
  selectedMode: "story" | "endless" | "daily";
  currentModeLabel: string;
  selectedStoryChapterLevel: number;
  selectedStoryChapterName: string;
  selectedStoryChapterDescription: string;
  storyChapterCount: number;
  storyUnlockedChapterLevel: number;
  selectedStoryChapterUnlocked: boolean;
  selectedStoryChapterBestStars: number;
  selectedStoryChapterRecommendedPower: number;
  selectedStoryChapterFirstClear: boolean;
  selectedStoryChapterFirstClearRewardPreview: string;
  selectedStoryChapterStarGoalSummary: string;
  playerPower: number;
  canStartRun: boolean;
  startBlockedReason: string;
  antiEnabled: boolean;
  antiStatusText: string;
  antiPlaytimeText: string;
  antiNeedRealname: boolean;
  antiNeedFaceVerify: boolean;
  antiGateMessage: string;
  endlessBossInterval: number;
  dailyChallengeName: string;
  dailyChallengeDescription: string;
  dailyChallengeTarget: number;
  dailyChallengeReward: number;
  dailyChallengeRewardClaimed: boolean;
  storyClearTime: number;
  settingsSfxEnabled: boolean;
  settingsVibrationEnabled: boolean;
  settingsPerformanceMode: PerformanceMode;
  settingsMoveSensitivity: number;
}

/**
 * Responsible for drawing UI overlays and button hit tests.
 */
export class UIManager {
  private buttons: UIButton[] = [];
  private uiClock = 0;

  beginFrame(): void {
    this.buttons.length = 0;
    this.uiClock = Date.now() * 0.001;
  }

  hitTest(x: number, y: number): UIButton | null {
    for (let i = this.buttons.length - 1; i >= 0; i -= 1) {
      const b = this.buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return b;
      }
    }
    return null;
  }

  drawBattleHud(ctx: CanvasRenderingContext2D, width: number, data: HudData): void {
    const hasObjective = !!data.objectiveText;
    const panelH = hasObjective ? 132 : 112;
    const panelX = 12;
    const panelY = 12;
    const panelW = width - 24;

    this.drawGlassSurface(ctx, panelX, panelY, panelW, panelH, 14, "#6acfff");

    const infoText = `${this.formatTime(data.time)}  击杀:${data.kills}`;
    ctx.fillStyle = "#f4fbff";
    ctx.font = "19px Microsoft YaHei";
    ctx.fillText(`Lv.${data.level}`, panelX + 14, panelY + 30);
    ctx.font = "16px Microsoft YaHei";
    ctx.fillText(infoText, panelX + panelW - 14 - ctx.measureText(infoText).width, panelY + 30);

    const hpRatio = data.maxHp > 0 ? Math.max(0, Math.min(1, data.hp / data.maxHp)) : 0;
    const expRatio = data.expToNext > 0 ? Math.max(0, Math.min(1, data.exp / data.expToNext)) : 0;
    const barX = panelX + 14;
    const barW = panelW - 28;
    this.drawMeter(ctx, barX, panelY + 38, barW, 12, hpRatio, "#ff8a7a", "#ff5a6d");
    this.drawMeter(ctx, barX, panelY + 54, barW, 10, expRatio, "#7fe9ff", "#4da9ff");

    ctx.fillStyle = "#dbedf8";
    ctx.font = "11px Microsoft YaHei";
    const hpText = `HP ${Math.max(0, Math.round(data.hp))}/${Math.max(1, Math.round(data.maxHp))}`;
    ctx.fillText(hpText, barX + 6, panelY + 48);
    const expText = `EXP ${Math.max(0, Math.round(data.exp))}/${Math.max(1, Math.round(data.expToNext))}`;
    ctx.fillText(expText, barX + 6, panelY + 62);

    const left = panelX + 12;
    const right = panelX + panelW - 12;
    let wx = left;
    let wy = panelY + 80;
    const lineGap = 18;
    const maxWeaponRows = hasObjective ? 2 : 3;
    let row = 0;
    for (const weapon of data.weaponSummaries) {
      const weaponText = `${weapon.name} ${weapon.level}级`;
      ctx.font = "12px Microsoft YaHei";
      const itemW = 26 + ctx.measureText(weaponText).width;

      if (wx + itemW > right - 40) {
        row += 1;
        if (row >= maxWeaponRows) {
          break;
        }
        wy += lineGap;
        wx = left;
      }

      this.fillRoundedRect(ctx, wx, wy - 10, 18, 16, 4, weapon.color);
      ctx.fillStyle = "#eff9ff";
      this.drawTruncatedText(ctx, weaponText, wx + 18, wy + 12, Math.max(38, right - wx - 18), 12);
      wx += itemW + 12;
    }

    if (data.elements.length > 0) {
      let ex = right - 4;
      for (const element of data.elements) {
        ex -= 22;
        ctx.fillStyle = "rgba(11, 22, 32, 0.72)";
        ctx.beginPath();
        ctx.arc(ex, panelY + 82, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = element.color;
        ctx.beginPath();
        ctx.arc(ex, panelY + 82, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (data.frenzyActive) {
      this.fillRoundedRect(ctx, right - 74, panelY + 95, 62, 24, 10, "#ffcc75");
      ctx.fillStyle = "#312000";
      ctx.font = "14px Microsoft YaHei";
      ctx.fillText("狂热", right - 56, panelY + 112);
    }

    if (data.objectiveText) {
      ctx.fillStyle = "#ffe8bd";
      ctx.font = "13px Microsoft YaHei";
      this.drawTruncatedText(ctx, data.objectiveText, panelX + 14, panelY + panelH - 12, panelW - 28, 13);
    }

    if (data.showPauseButton) {
      const pauseButton: UIButton = {
        id: "pause_run",
        text: "暂停",
        x: width - 92,
        y: 16,
        w: 68,
        h: 30,
        color: "#8ad4ff",
        textColor: "#08131f"
      };
      this.addButton(pauseButton);
      this.drawButton(ctx, pauseButton, 14);
    }
  }
  drawStartPanel(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    stats: StartPanelData
  ): void {
    const cardX = 14;
    const cardY = 14;
    const navHeight = 82;
    const cardW = width - 28;
    const cardH = height - navHeight - 24;
    const contentLeft = cardX + 24;
    const contentRight = cardX + cardW - 24;
    const contentBottom = cardY + cardH - 14;
    const actionW = cardW * 0.72;
    const actionX = cardX + (cardW - actionW) * 0.5;

    this.drawMenuBackdrop(ctx, width, height);
    this.drawGlassSurface(ctx, cardX, cardY, cardW, cardH, 24, "#61d5ff");

    ctx.fillStyle = "#f6fcff";
    ctx.font = "31px Microsoft YaHei";
    ctx.fillText("进化幸存者", cardX + 22, cardY + 44);

    ctx.fillStyle = "#cde2f6";
    ctx.font = "14px Microsoft YaHei";
    ctx.fillText("轻度动作 | 自动攻击 | 进化合成", cardX + 22, cardY + 66);

    const dnaText = `DNA ${stats.dna}`;
    ctx.font = "16px Microsoft YaHei";
    const dnaW = 26 + ctx.measureText(dnaText).width;
    this.fillRoundedRect(ctx, cardX + cardW - dnaW - 20, cardY + 20, dnaW, 30, 14, "#35b6d6");
    ctx.fillStyle = "#ecfbff";
    ctx.fillText(dnaText, cardX + cardW - dnaW - 7, cardY + 41);

    if (stats.activeTab === "home") {
      ctx.fillStyle = "#d7e9ff";
      ctx.font = "20px Microsoft YaHei";
      ctx.fillText("关卡页", cardX + 24, cardY + 98);
      ctx.fillStyle = "#b6d0ef";
      ctx.font = "16px Microsoft YaHei";
      ctx.fillText(`当前模式: ${stats.currentModeLabel}`, cardX + 24, cardY + 124);

      const bossHint =
        stats.selectedMode === "endless"
          ? `无尽批次: 每${stats.endlessBossInterval}秒刷新一批首领`
          : stats.selectedMode === "daily"
            ? `每日挑战: ${stats.dailyChallengeName}`
            : `标准模式: ${this.formatTime(stats.storyClearTime)}后最终首领登场`;
      ctx.fillText(bossHint, cardX + 24, cardY + 148);

      if (stats.selectedMode === "story") {
        ctx.fillStyle = stats.selectedStoryChapterUnlocked ? "#a7dbff" : "#ffbfae";
        ctx.font = "14px Microsoft YaHei";
        const lockText = stats.selectedStoryChapterUnlocked
          ? `章节进度：已解锁至第${stats.storyUnlockedChapterLevel}章`
          : `章节未解锁：需先通关第${Math.max(1, stats.selectedStoryChapterLevel - 1)}章`;
        this.drawTruncatedText(ctx, lockText, cardX + 24, cardY + 170, cardW - 52, 14);

        ctx.fillStyle = "#a6c9e8";
        const starText = `章节星级：${"★".repeat(stats.selectedStoryChapterBestStars)}${"☆".repeat(
          Math.max(0, 3 - stats.selectedStoryChapterBestStars)
        )}`;
        this.drawTruncatedText(ctx, starText, cardX + 24, cardY + 190, cardW - 52, 13);

        const powerColor = stats.playerPower >= stats.selectedStoryChapterRecommendedPower ? "#9df4b4" : "#ffd19f";
        ctx.fillStyle = powerColor;
        const powerText = `战力 ${stats.playerPower} / 推荐 ${stats.selectedStoryChapterRecommendedPower}`;
        this.drawTruncatedText(ctx, powerText, cardX + 24, cardY + 208, cardW - 52, 13);
      }

      if (stats.selectedMode === "daily") {
        ctx.fillText(
          `目标生存: ${this.formatTime(stats.dailyChallengeTarget)}  奖励 +${stats.dailyChallengeReward} DNA`,
          cardX + 24,
          cardY + 172
        );
        ctx.fillStyle = "#9ed5ff";
        ctx.font = "14px Microsoft YaHei";
        ctx.fillText(stats.dailyChallengeDescription, cardX + 24, cardY + 196);
        ctx.fillStyle = stats.dailyChallengeRewardClaimed ? "#aebfd1" : "#9df4b4";
        ctx.fillText(
          stats.dailyChallengeRewardClaimed ? "今日挑战首通奖励：已领取" : "今日挑战首通奖励：可领取",
          cardX + 24,
          cardY + 218
        );
        ctx.fillStyle = "#b6d0ef";
        ctx.font = "16px Microsoft YaHei";
      } else {
        ctx.fillText(`最高生存: ${this.formatTime(stats.bestTime)}`, cardX + 24, cardY + 172);
        ctx.fillText(`总对局: ${stats.totalRuns}  总击杀: ${stats.totalKills}`, cardX + 24, cardY + 196);
      }

      const startButtonY = cardY + Math.floor(cardH * 0.34);
      this.addButton({
        id: "start_run",
        text: stats.canStartRun ? "开始战斗" : "当前不可开始",
        x: actionX,
        y: startButtonY,
        w: actionW,
        h: 52,
        color: stats.canStartRun ? "#35db88" : "#6d7d90"
      });

      this.addButton({
        id: "start_buff_ad",
        text: stats.canStartRun ? "广告开局增益" : "广告开局增益（不可用）",
        x: actionX,
        y: startButtonY + 62,
        w: actionW,
        h: 42,
        color: stats.canStartRun ? "#ffca67" : "#6d7d90",
        textColor: stats.canStartRun ? "#281300" : "#d7e4ef"
      });

      let antiSectionBottom = startButtonY + 112;
      ctx.fillStyle = stats.antiEnabled ? "#a3d8ff" : "#8ba0b8";
      ctx.font = "13px Microsoft YaHei";
      this.drawTruncatedText(ctx, stats.antiStatusText, cardX + 24, antiSectionBottom, cardW - 48, 13);

      antiSectionBottom += 18;
      ctx.fillStyle = "#98bad8";
      this.drawTruncatedText(ctx, stats.antiPlaytimeText, cardX + 24, antiSectionBottom, cardW - 48, 12);

      let actionY = antiSectionBottom + 8;
      if (stats.antiNeedRealname) {
        this.addButton({
          id: "anti_realname_auth",
          text: "去实名认证",
          x: cardX + 24,
          y: actionY,
          w: Math.min(160, actionW * 0.46),
          h: 28,
          color: "#75d7a0",
          textColor: "#062617"
        });
        actionY += 34;
      }

      if (stats.antiNeedFaceVerify) {
        this.addButton({
          id: "anti_face_verify",
          text: "去人脸核验",
          x: cardX + 24,
          y: actionY,
          w: Math.min(160, actionW * 0.46),
          h: 28,
          color: "#79c8ff",
          textColor: "#072236"
        });
        actionY += 34;
      }

      if (stats.antiGateMessage) {
        ctx.fillStyle = "#ffb8a6";
        ctx.font = "12px Microsoft YaHei";
        this.drawTruncatedText(ctx, `限制提示：${stats.antiGateMessage}`, cardX + 24, actionY + 4, cardW - 48, 12);
        actionY += 20;
      }

      if (!stats.canStartRun && stats.startBlockedReason) {
        ctx.fillStyle = "#ffb9a8";
        ctx.font = "13px Microsoft YaHei";
        this.drawTruncatedText(ctx, stats.startBlockedReason, cardX + 24, actionY + 2, cardW - 48, 13);
        actionY += 20;
      }

      const questY = actionY + 12;
      ctx.fillStyle = "#ffe8ad";
      ctx.font = "18px Microsoft YaHei";
      ctx.fillText("每日任务", cardX + 24, questY);
      if (stats.claimableQuestCount > 0) {
        this.addButton({
          id: "daily_claim_all",
          text: `一键领取(${stats.claimableQuestCount})`,
          x: contentRight - 118,
          y: questY - 20,
          w: 106,
          h: 28,
          color: "#7de6ac",
          textColor: "#0b2a1b"
        });
      }

      let rowY = questY + 12;
      const rowH = 52;
      for (let i = 0; i < stats.dailyQuests.length; i += 1) {
        if (rowY + rowH > contentBottom - 8) {
          break;
        }
        const quest = stats.dailyQuests[i];
        const complete = quest.progress >= quest.target;

        ctx.fillStyle = "rgba(12, 22, 38, 0.86)";
        ctx.fillRect(cardX + 20, rowY, cardW - 40, rowH);
        ctx.strokeStyle = complete ? "#7ee7a1" : "#4f6785";
        ctx.lineWidth = 2;
        ctx.strokeRect(cardX + 20, rowY, cardW - 40, rowH);

        ctx.fillStyle = complete ? "#d7ffe6" : "#d7e9ff";
        ctx.font = "14px Microsoft YaHei";
        const progressText = `${Math.min(quest.progress, quest.target)}/${quest.target}`;
        ctx.fillText(`${quest.title}  ${progressText}`, cardX + 32, rowY + 19);

        ctx.fillStyle = "#9db9d8";
        ctx.font = "12px Microsoft YaHei";
        const rewardText = `奖励 DNA ${quest.rewardDna}`;
        ctx.fillText(rewardText, cardX + 32, rowY + 38);

        if (quest.claimed) {
          ctx.fillStyle = "#9de8aa";
          ctx.font = "13px Microsoft YaHei";
          ctx.fillText("已领取", cardX + cardW - 86, rowY + 33);
        } else if (complete) {
          this.addButton({
            id: `daily_claim_${i}`,
            text: "领取",
            x: cardX + cardW - 96,
            y: rowY + 11,
            w: 68,
            h: 30,
            color: "#6ce7a1"
          });
        } else {
          ctx.fillStyle = "#7f9ab8";
          ctx.font = "12px Microsoft YaHei";
          ctx.fillText("未完成", cardX + cardW - 92, rowY + 33);
        }

        rowY += rowH + 8;
      }
    } else if (stats.activeTab === "chest") {
      ctx.fillStyle = "#ffe8b7";
      ctx.font = "20px Microsoft YaHei";
      ctx.fillText("领取宝箱", cardX + 24, cardY + 98);

      ctx.fillStyle = "#dfc995";
      ctx.font = "16px Microsoft YaHei";
      ctx.fillText("每日登录可领取一次启动宝箱", cardX + 24, cardY + 126);
      ctx.fillText("奖励内容：随机武器碎片（主奖6~10，额外3~6）", cardX + 24, cardY + 150);

      if (stats.chestClaimed) {
        ctx.fillStyle = "#9de8aa";
        ctx.fillText("今日已领取，明天再来。", cardX + 24, cardY + 184);
      } else {
        this.addButton({
          id: "claim_chest",
          text: "立即领取宝箱",
          x: width * 0.18,
          y: height * 0.46,
          w: width * 0.64,
          h: 52,
          color: "#ffd36f"
        });
      }

      ctx.fillStyle = "#b6d0ef";
      ctx.fillText(`当前碎片库存总计: ${stats.totalFragments}`, cardX + 24, cardY + 216);
    } else if (stats.activeTab === "weapon") {
      ctx.fillStyle = "#d8ecff";
      ctx.font = "20px Microsoft YaHei";
      ctx.fillText("武器页", cardX + 24, cardY + 98);

      ctx.fillStyle = "#b6d0ef";
      ctx.font = "16px Microsoft YaHei";
      ctx.fillText(
        `进化解锁：${stats.unlockedEvolutionCount}/${stats.totalEvolutionCount}`,
        cardX + 24,
        cardY + 124
      );

      const cardsPerPage = 4;
      const currentPage = Math.max(0, Math.min(stats.weaponPage, Math.max(0, stats.weaponPageCount - 1)));
      const startIndex = currentPage * cardsPerPage;
      const pageCards = stats.weaponCards.slice(startIndex, startIndex + cardsPerPage);

      let rowY = cardY + 146;
      const rowH = 92;
      for (let i = 0; i < pageCards.length; i += 1) {
        const weapon = pageCards[i];

        ctx.fillStyle = "rgba(11, 20, 35, 0.9)";
        ctx.fillRect(cardX + 20, rowY, cardW - 40, rowH);
        ctx.strokeStyle = "#4a6c91";
        ctx.lineWidth = 2;
        ctx.strokeRect(cardX + 20, rowY, cardW - 40, rowH);

        ctx.fillStyle = weapon.color;
        ctx.fillRect(cardX + 30, rowY + 10, 12, 12);

        ctx.fillStyle = "#e8f4ff";
        ctx.font = "14px Microsoft YaHei";
        ctx.fillText(`${weapon.name}  强化 Lv.${weapon.upgradeLevel}/${weapon.maxUpgradeLevel}`, cardX + 48, rowY + 21);

        ctx.fillStyle = "#9fb8d8";
        ctx.font = "12px Microsoft YaHei";
        this.drawTruncatedText(ctx, weapon.description, cardX + 48, rowY + 38, cardW - 180, 12);

        ctx.fillStyle = "#b8d9ff";
        ctx.fillText(
          `碎片 ${weapon.fragmentCount}  |  伤害加成 +${(weapon.damageBonus * 100).toFixed(0)}%`,
          cardX + 48,
          rowY + 56
        );

        ctx.fillStyle = "#94b9de";
        const skillText = weapon.unlockedSkills.length > 0
          ? `已解锁: ${weapon.unlockedSkills.join("、")}`
          : "已解锁: 无";
        this.drawTruncatedText(ctx, skillText, cardX + 48, rowY + 73, cardW - 180, 12);

        const nextText =
          weapon.nextUpgradeCost > 0
            ? `下级消耗 ${weapon.nextUpgradeCost} 碎片 | ${weapon.nextSkillTitle}`
            : "已满级，全部技能解锁";
        ctx.fillStyle = "#7ea4ca";
        this.drawTruncatedText(ctx, nextText, cardX + 48, rowY + 88, cardW - 180, 11);

        this.addButton({
          id: `weapon_upgrade_${weapon.id}`,
          text:
            weapon.upgradeLevel >= weapon.maxUpgradeLevel ? "满级" : weapon.canUpgrade ? "升级" : "碎片不足",
          x: cardX + cardW - 114,
          y: rowY + 26,
          w: 84,
          h: 38,
          color:
            weapon.upgradeLevel >= weapon.maxUpgradeLevel
              ? "#5d7388"
              : weapon.canUpgrade
                ? "#6de6a6"
                : "#6d7d90",
          textColor:
            weapon.upgradeLevel >= weapon.maxUpgradeLevel
              ? "#d4e0ec"
              : weapon.canUpgrade
                ? "#082417"
                : "#d5e1ed"
        });

        rowY += rowH + 10;
      }

      ctx.fillStyle = "#9ec5e8";
      ctx.font = "13px Microsoft YaHei";
      ctx.fillText(`页码 ${currentPage + 1}/${Math.max(1, stats.weaponPageCount)}`, cardX + 24, height * 0.72);

      this.addButton({
        id: "weapon_page_prev",
        text: "上一页",
        x: width * 0.18,
        y: height * 0.74,
        w: width * 0.28,
        h: 34,
        color: currentPage > 0 ? "#75a8d9" : "#546d86",
        textColor: currentPage > 0 ? "#071524" : "#a8bfd6"
      });
      this.addButton({
        id: "weapon_page_next",
        text: "下一页",
        x: width * 0.54,
        y: height * 0.74,
        w: width * 0.28,
        h: 34,
        color: currentPage + 1 < stats.weaponPageCount ? "#75a8d9" : "#546d86",
        textColor: currentPage + 1 < stats.weaponPageCount ? "#071524" : "#a8bfd6"
      });

      this.addButton({
        id: "open_encyclopedia",
        text: "查看进化图鉴",
        x: actionX,
        y: Math.min(contentBottom - 48, cardY + cardH - 70),
        w: actionW,
        h: 44,
        color: "#67b8ff"
      });
    } else if (stats.activeTab === "mode") {
      ctx.fillStyle = "#e5ddff";
      ctx.font = "20px Microsoft YaHei";
      ctx.fillText("其他模式", cardX + 24, cardY + 98);

      ctx.fillStyle = "#b9b0d6";
      ctx.font = "15px Microsoft YaHei";
      ctx.fillText(`当前模式: ${stats.currentModeLabel}`, cardX + 24, cardY + 124);
      const storyActive = stats.selectedMode === "story";
      const endlessActive = stats.selectedMode === "endless";
      const dailyActive = stats.selectedMode === "daily";

      if (storyActive) {
        ctx.fillText(
          `标准章节: 第${stats.selectedStoryChapterLevel}/${stats.storyChapterCount}章 ${stats.selectedStoryChapterName}`,
          cardX + 24,
          cardY + 148
        );
        ctx.fillStyle = "#d4ccf3";
        ctx.font = "13px Microsoft YaHei";
        this.drawTruncatedText(ctx, stats.selectedStoryChapterDescription, cardX + 24, cardY + 168, cardW - 180, 13);

        const chapterUnlockedText = stats.selectedStoryChapterUnlocked
          ? `状态：已解锁（最高第${stats.storyUnlockedChapterLevel}章）`
          : `状态：未解锁（先通关第${Math.max(1, stats.selectedStoryChapterLevel - 1)}章）`;
        ctx.fillStyle = stats.selectedStoryChapterUnlocked ? "#a3f2c5" : "#ffbfae";
        this.drawTruncatedText(ctx, chapterUnlockedText, cardX + 24, cardY + 188, cardW - 180, 13);

        ctx.fillStyle = "#dcd4fb";
        const chapterStarText = `星级：${"★".repeat(stats.selectedStoryChapterBestStars)}${"☆".repeat(
          Math.max(0, 3 - stats.selectedStoryChapterBestStars)
        )}`;
        this.drawTruncatedText(ctx, chapterStarText, cardX + 24, cardY + 206, cardW - 180, 13);

        const powerText = `战力 ${stats.playerPower} / 推荐 ${stats.selectedStoryChapterRecommendedPower}`;
        ctx.fillStyle = stats.playerPower >= stats.selectedStoryChapterRecommendedPower ? "#9df4b4" : "#ffd29f";
        this.drawTruncatedText(ctx, powerText, cardX + 24, cardY + 224, cardW - 180, 13);

        ctx.fillStyle = "#cabdf2";
        this.drawTruncatedText(ctx, `三星目标：${stats.selectedStoryChapterStarGoalSummary}`, cardX + 24, cardY + 242, cardW - 180, 12);
        this.drawTruncatedText(
          ctx,
          `首通奖励：${stats.selectedStoryChapterFirstClearRewardPreview}${
            stats.selectedStoryChapterFirstClear ? "（已领取）" : ""
          }`,
          cardX + 24,
          cardY + 258,
          cardW - 180,
          12
        );

        this.addButton({
          id: "story_chapter_prev",
          text: "上一章",
          x: width * 0.58,
          y: cardY + 120,
          w: width * 0.14,
          h: 28,
          color: stats.selectedStoryChapterLevel > 1 ? "#7fb5e6" : "#5c7088",
          textColor: stats.selectedStoryChapterLevel > 1 ? "#081524" : "#a7bfd8"
        });
        const nextChapterUnlocked = stats.selectedStoryChapterLevel + 1 <= stats.storyUnlockedChapterLevel;
        this.addButton({
          id: "story_chapter_next",
          text: nextChapterUnlocked ? "下一章" : "下一章(锁)",
          x: width * 0.74,
          y: cardY + 120,
          w: width * 0.14,
          h: 28,
          color:
            stats.selectedStoryChapterLevel < stats.storyChapterCount
              ? nextChapterUnlocked
                ? "#7fb5e6"
                : "#8a7268"
              : "#5c7088",
          textColor:
            stats.selectedStoryChapterLevel < stats.storyChapterCount
              ? nextChapterUnlocked
                ? "#081524"
                : "#ffe1d0"
              : "#a7bfd8"
        });
      } else if (endlessActive) {
        ctx.fillText(`无尽模式首领周期: ${stats.endlessBossInterval}秒/批`, cardX + 24, cardY + 148);
      } else {
        ctx.fillText(`每日挑战: ${stats.dailyChallengeName}`, cardX + 24, cardY + 148);
      }

      ctx.fillStyle = "#d4ccf3";
      ctx.font = "13px Microsoft YaHei";
      ctx.fillText(`今日挑战: ${stats.dailyChallengeName}`, cardX + 24, cardY + 286);
      ctx.fillText(
        `目标${this.formatTime(stats.dailyChallengeTarget)} | 奖励+${stats.dailyChallengeReward} DNA`,
        cardX + 24,
        cardY + 304
      );

      this.addButton({
        id: "mode_story",
        text: storyActive ? "标准模式（已启用）" : "切换到标准模式",
        x: width * 0.16,
        y: height * 0.35,
        w: width * 0.68,
        h: 40,
        color: storyActive ? "#6ab8ff" : "#6f87a5",
        textColor: storyActive ? "#071524" : "#d7ebff"
      });
      this.addButton({
        id: "mode_endless",
        text: endlessActive ? "无尽模式（已启用）" : "切换到无尽模式",
        x: width * 0.16,
        y: height * 0.42,
        w: width * 0.68,
        h: 40,
        color: endlessActive ? "#8f7dff" : "#9487d9",
        textColor: endlessActive ? "#0f0a2b" : "#ece8ff"
      });
      this.addButton({
        id: "mode_bossrush",
        text: "首领突袭（开发中）",
        x: width * 0.16,
        y: height * 0.49,
        w: width * 0.68,
        h: 40,
        color: "#8f83cf"
      });
      this.addButton({
        id: "mode_daily",
        text: dailyActive ? "每日挑战（已启用）" : "切换到每日挑战",
        x: width * 0.16,
        y: height * 0.56,
        w: width * 0.68,
        h: 40,
        color: dailyActive ? "#ffb070" : "#b4886d",
        textColor: dailyActive ? "#2d1405" : "#ffeedd"
      });

      ctx.fillStyle = "#d7e9ff";
      ctx.font = "16px Microsoft YaHei";
      ctx.fillText("DNA商店（局外永久强化）", cardX + 24, cardY + 356);

      const shopBaseY = cardY + 372;
      const shopCardW = (cardW - 58) * 0.5;
      const shopCardH = 72;

      for (let i = 0; i < stats.shopItems.length; i += 1) {
        const item = stats.shopItems[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cardLeft = cardX + 20 + col * (shopCardW + 18);
        const cardTop = shopBaseY + row * (shopCardH + 12);

        ctx.fillStyle = "rgba(15, 18, 36, 0.92)";
        ctx.fillRect(cardLeft, cardTop, shopCardW, shopCardH);
        ctx.strokeStyle = item.canBuy ? "#8bc7ff" : "#5f6d87";
        ctx.lineWidth = 2;
        ctx.strokeRect(cardLeft, cardTop, shopCardW, shopCardH);

        ctx.fillStyle = item.canBuy ? "#e6f3ff" : "#bac8db";
        ctx.font = "14px Microsoft YaHei";
        ctx.fillText(`${item.title} Lv.${item.level}/${item.maxLevel}`, cardLeft + 8, cardTop + 19);

        ctx.fillStyle = "#9fc0de";
        ctx.font = "12px Microsoft YaHei";
        ctx.fillText(item.currentValue, cardLeft + 8, cardTop + 37);

        if (item.level >= item.maxLevel) {
          ctx.fillStyle = "#8fffc0";
          ctx.fillText("已满级", cardLeft + 8, cardTop + 50);
        } else {
          ctx.fillStyle = "#ffdf99";
          ctx.fillText(`下级: ${item.nextValue}`, cardLeft + 8, cardTop + 50);

          this.addButton({
            id: `shop_buy_${item.id}`,
            text: `升级 ${item.nextCost} DNA`,
            x: cardLeft + 8,
            y: cardTop + 52,
            w: shopCardW - 16,
            h: 16,
            color: item.canBuy ? "#6ce4a7" : "#58708a",
            textColor: item.canBuy ? "#082218" : "#d7e3ef"
          });
        }
      }

      this.addButton({
        id: "shop_plan_starter",
        text: "新手推荐加点",
        x: cardX + cardW * 0.16,
        y: height * 0.69,
        w: cardW * 0.32,
        h: 34,
        color: "#7ee2ff",
        textColor: "#0d2232"
      });
      this.addButton({
        id: "shop_plan_hardcore",
        text: "高难推荐加点",
        x: cardX + cardW * 0.52,
        y: height * 0.69,
        w: cardW * 0.32,
        h: 34,
        color: "#ffb870",
        textColor: "#2f1600"
      });

      this.addButton({
        id: "shop_reset_points",
        text: stats.shopResetRefund > 0 ? `重置加点（返还${stats.shopResetRefund} DNA）` : "重置加点（暂无返还）",
        x: width * 0.16,
        y: height * 0.73,
        w: width * 0.68,
        h: 32,
        color: stats.shopResetRefund > 0 ? "#8debb9" : "#5d7388",
        textColor: stats.shopResetRefund > 0 ? "#0b251a" : "#d3dfeb"
      });

      this.addButton({
        id: "toggle_debug",
        text: `切换调试(${stats.debug ? "开" : "关"})`,
        x: width * 0.16,
        y: height * 0.77,
        w: width * 0.32,
        h: 36,
        color: "#9f86e8"
      });
      this.addButton({
        id: "reset_save",
        text: "重置存档",
        x: width * 0.52,
        y: height * 0.77,
        w: width * 0.32,
        h: 36,
        color: "#d27b7b"
      });
      this.addButton({
        id: "export_analytics",
        text: "导出埋点",
        x: width * 0.16,
        y: height * 0.85,
        w: width * 0.32,
        h: 34,
        color: "#75cfff"
      });
      this.addButton({
        id: "clear_analytics",
        text: "清空埋点",
        x: width * 0.52,
        y: height * 0.85,
        w: width * 0.32,
        h: 34,
        color: "#ec9797"
      });
    } else {
      ctx.fillStyle = "#dff0ff";
      ctx.font = "20px Microsoft YaHei";
      ctx.fillText("设置中心", cardX + 24, cardY + 98);

      ctx.fillStyle = "#b6d0ef";
      ctx.font = "15px Microsoft YaHei";
      ctx.fillText("战斗反馈", cardX + 24, cardY + 132);

      this.addButton({
        id: "setting_toggle_sfx",
        text: `音效：${stats.settingsSfxEnabled ? "开" : "关"}`,
        x: width * 0.16,
        y: height * 0.3,
        w: width * 0.3,
        h: 38,
        color: stats.settingsSfxEnabled ? "#7fd9ff" : "#5a6d82",
        textColor: stats.settingsSfxEnabled ? "#062133" : "#d5e2ef"
      });

      this.addButton({
        id: "setting_toggle_vibration",
        text: `震动：${stats.settingsVibrationEnabled ? "开" : "关"}`,
        x: width * 0.54,
        y: height * 0.3,
        w: width * 0.3,
        h: 38,
        color: stats.settingsVibrationEnabled ? "#91f0b6" : "#5a6d82",
        textColor: stats.settingsVibrationEnabled ? "#062816" : "#d5e2ef"
      });

      ctx.fillStyle = "#b6d0ef";
      ctx.font = "15px Microsoft YaHei";
      ctx.fillText("性能档位", cardX + 24, cardY + 220);

      const qualityActive = stats.settingsPerformanceMode === "quality";
      const balancedActive = stats.settingsPerformanceMode === "balanced";
      const perfActive = stats.settingsPerformanceMode === "performance";

      this.addButton({
        id: "setting_perf_quality",
        text: qualityActive ? "高画质（已选）" : "高画质",
        x: width * 0.16,
        y: height * 0.43,
        w: width * 0.22,
        h: 36,
        color: qualityActive ? "#8cc7ff" : "#5f7590",
        textColor: qualityActive ? "#07182a" : "#dbe7f4"
      });
      this.addButton({
        id: "setting_perf_balanced",
        text: balancedActive ? "均衡（已选）" : "均衡",
        x: width * 0.4,
        y: height * 0.43,
        w: width * 0.22,
        h: 36,
        color: balancedActive ? "#9ce6cc" : "#5f7590",
        textColor: balancedActive ? "#042016" : "#dbe7f4"
      });
      this.addButton({
        id: "setting_perf_performance",
        text: perfActive ? "性能（已选）" : "性能",
        x: width * 0.64,
        y: height * 0.43,
        w: width * 0.2,
        h: 36,
        color: perfActive ? "#ffc48e" : "#5f7590",
        textColor: perfActive ? "#2d1702" : "#dbe7f4"
      });

      const sensitivityText = stats.settingsMoveSensitivity.toFixed(2);
      ctx.fillStyle = "#b6d0ef";
      ctx.font = "15px Microsoft YaHei";
      ctx.fillText(`移动灵敏度：${sensitivityText}`, cardX + 24, cardY + 320);

      this.addButton({
        id: "setting_sensitivity_dec",
        text: "-",
        x: width * 0.22,
        y: height * 0.58,
        w: width * 0.18,
        h: 40,
        color: "#7f94ad",
        textColor: "#091524"
      });
      this.addButton({
        id: "setting_sensitivity_inc",
        text: "+",
        x: width * 0.6,
        y: height * 0.58,
        w: width * 0.18,
        h: 40,
        color: "#7f94ad",
        textColor: "#091524"
      });

      ctx.fillStyle = "#95b3d5";
      ctx.font = "13px Microsoft YaHei";
      ctx.fillText("高画质：完整特效与迷你地图", cardX + 24, cardY + 382);
      ctx.fillText("均衡：适中粒子数量", cardX + 24, cardY + 404);
      ctx.fillText("性能：减少特效并隐藏迷你地图", cardX + 24, cardY + 426);
    }

    const navY = height - navHeight + 10;
    const navW = width - 24;
    const itemW = navW / 5;
    const tabs: Array<{ id: string; text: string; active: boolean }> = [
      { id: "tab_chest", text: "领取宝箱", active: stats.activeTab === "chest" },
      { id: "tab_home", text: "首页", active: stats.activeTab === "home" },
      { id: "tab_weapon", text: "武器", active: stats.activeTab === "weapon" },
      { id: "tab_mode", text: "其他模式", active: stats.activeTab === "mode" },
      { id: "tab_settings", text: "设置", active: stats.activeTab === "settings" }
    ];

    this.drawGlassSurface(ctx, 12, height - navHeight, navW, navHeight - 4, 18, "#5cc6ea");

    for (let i = 0; i < tabs.length; i += 1) {
      const tab = tabs[i];
      this.addButton({
        id: tab.id,
        text: tab.text,
        x: 12 + i * itemW,
        y: navY,
        w: itemW,
        h: 48,
        color: tab.active ? "#79e8ff" : "#315c74",
        textColor: tab.active ? "#06202d" : "#d6ebf6"
      });
    }

    this.renderButtons(ctx);
  }

  drawUpgradePanel(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: UpgradeOption[],
    extraOption: UpgradeOption | null,
    canShowAdOption: boolean
  ): void {
    this.drawPanel(ctx, width * 0.07, height * 0.14, width * 0.86, height * 0.72, "#182232", "#5a87cc");

    ctx.fillStyle = "#ffffff";
    ctx.font = "24px Microsoft YaHei";
    const title = "升级 - 三选一";
    ctx.fillText(title, width * 0.5 - ctx.measureText(title).width * 0.5, height * 0.21);

    const startY = height * 0.3;
    const gap = 88;

    options.forEach((option, index) => {
      this.addButton({
        id: `upgrade_${index}`,
        text: `${option.title} | ${option.description}`,
        x: width * 0.12,
        y: startY + index * gap,
        w: width * 0.76,
        h: 68,
        color: option.color
      });
    });

    if (extraOption && canShowAdOption) {
      this.addButton({
        id: "upgrade_extra_ad",
        text: `广告额外选项: ${extraOption.title}`,
        x: width * 0.12,
        y: height * 0.67,
        w: width * 0.76,
        h: 46,
        color: "#ffd97a"
      });
    }

    this.renderButtons(ctx);
  }

  drawChestPanel(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    weaponOptions: UpgradeOption[],
    characterOptions: UpgradeOption[],
    boosted: boolean,
    canShowBoostAd: boolean
  ): void {
    this.drawPanel(ctx, width * 0.07, height * 0.14, width * 0.86, height * 0.72, "#2a1d12", "#c1914c");

    ctx.fillStyle = "#ffe7b1";
    ctx.font = "24px Microsoft YaHei";
    const title = "宝箱变异";
    ctx.fillText(title, width * 0.5 - ctx.measureText(title).width * 0.5, height * 0.22);

    let y = height * 0.29;

    ctx.fillStyle = "#ffd58b";
    ctx.font = "17px Microsoft YaHei";
    ctx.fillText("武器变异", width * 0.15, y);
    y += 14;

    weaponOptions.forEach((option, index) => {
      this.addButton({
        id: `chest_weapon_${index}`,
        text: option.title,
        x: width * 0.14,
        y,
        w: width * 0.72,
        h: 50,
        color: option.color
      });
      y += 60;
    });

    y += 6;
    ctx.fillStyle = "#b4ffe2";
    ctx.font = "17px Microsoft YaHei";
    ctx.fillText("人物变异", width * 0.15, y);
    y += 14;

    characterOptions.forEach((option, index) => {
      this.addButton({
        id: `chest_character_${index}`,
        text: option.title,
        x: width * 0.14,
        y,
        w: width * 0.72,
        h: 50,
        color: option.color
      });
      y += 60;
    });

    if (!boosted && canShowBoostAd) {
      this.addButton({
        id: "chest_boost_ad",
        text: "看广告强化宝箱（变异+1）",
        x: width * 0.14,
        y: height * 0.76,
        w: width * 0.72,
        h: 40,
        color: "#ffd66a"
      });
    }

    this.renderButtons(ctx);
  }

  drawDeathPanel(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    info: { kills: number; time: number; reviveUsed: boolean }
  ): void {
    this.drawPanel(ctx, width * 0.12, height * 0.24, width * 0.76, height * 0.5, "#301b1b", "#d17777");

    ctx.fillStyle = "#ffd5d5";
    ctx.font = "30px Microsoft YaHei";
    const title = "你已阵亡";
    ctx.fillText(title, width * 0.5 - ctx.measureText(title).width * 0.5, height * 0.33);

    ctx.font = "18px Microsoft YaHei";
    ctx.fillText(`生存时间: ${this.formatTime(info.time)}`, width * 0.24, height * 0.41);
    ctx.fillText(`击杀数: ${info.kills}`, width * 0.24, height * 0.46);

    if (!info.reviveUsed) {
      this.addButton({
        id: "revive_ad",
        text: "看广告立即复活",
        x: width * 0.2,
        y: height * 0.53,
        w: width * 0.6,
        h: 46,
        color: "#ffd06f"
      });
    }

    this.addButton({
      id: "to_settlement",
      text: "结算",
      x: width * 0.2,
      y: height * 0.61,
      w: width * 0.6,
      h: 44,
      color: "#6ab3ff"
    });

    this.renderButtons(ctx);
  }

  drawPausePanel(ctx: CanvasRenderingContext2D, width: number, height: number, info: { time: number; kills: number }): void {
    this.drawPanel(ctx, width * 0.14, height * 0.24, width * 0.72, height * 0.46, "#1c2737", "#7fa7d1");

    ctx.fillStyle = "#e6f3ff";
    ctx.font = "30px Microsoft YaHei";
    const title = "已暂停";
    ctx.fillText(title, width * 0.5 - ctx.measureText(title).width * 0.5, height * 0.33);

    ctx.fillStyle = "#bed6ef";
    ctx.font = "17px Microsoft YaHei";
    ctx.fillText(`当前时间: ${this.formatTime(info.time)}`, width * 0.26, height * 0.42);
    ctx.fillText(`击杀数: ${info.kills}`, width * 0.26, height * 0.47);

    this.addButton({
      id: "pause_resume",
      text: "继续战斗",
      x: width * 0.22,
      y: height * 0.55,
      w: width * 0.56,
      h: 44,
      color: "#7ce4a2",
      textColor: "#0a2616"
    });

    this.addButton({
      id: "pause_exit",
      text: "退出本局",
      x: width * 0.22,
      y: height * 0.62,
      w: width * 0.56,
      h: 40,
      color: "#d99090",
      textColor: "#2f0f0f"
    });

    this.renderButtons(ctx);
  }

  drawSettlementPanel(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    info: {
      kills: number;
      time: number;
      reward: number;
      doubled: boolean;
      fragmentSummary?: string;
      storySummary?: string;
      storyFirstClearSummary?: string;
    }
  ): void {
    this.drawPanel(ctx, width * 0.1, height * 0.2, width * 0.8, height * 0.58, "#1d2a1d", "#7dc77d");

    ctx.fillStyle = "#d9ffd9";
    ctx.font = "28px Microsoft YaHei";
    const title = "战斗结算";
    ctx.fillText(title, width * 0.5 - ctx.measureText(title).width * 0.5, height * 0.29);

    ctx.font = "18px Microsoft YaHei";
    ctx.fillText(`生存时长: ${this.formatTime(info.time)}`, width * 0.22, height * 0.38);
    ctx.fillText(`击杀总数: ${info.kills}`, width * 0.22, height * 0.43);
    ctx.fillText(`获得DNA: ${info.reward}${info.doubled ? "（x2）" : ""}`, width * 0.22, height * 0.48);
    if (info.fragmentSummary) {
      this.drawTruncatedText(ctx, `获得碎片: ${info.fragmentSummary}`, width * 0.22, height * 0.53, width * 0.56, 14);
    }
    if (info.storySummary) {
      this.drawTruncatedText(ctx, info.storySummary, width * 0.22, height * 0.57, width * 0.56, 13);
    }
    if (info.storyFirstClearSummary) {
      this.drawTruncatedText(ctx, info.storyFirstClearSummary, width * 0.22, height * 0.61, width * 0.56, 13);
    }

    if (!info.doubled) {
      this.addButton({
        id: "double_reward_ad",
        text: "看广告双倍奖励",
        x: width * 0.2,
        y: height * 0.64,
        w: width * 0.6,
        h: 46,
        color: "#ffd86a"
      });
    }

    this.addButton({
      id: "back_to_start",
      text: "返回开始",
      x: width * 0.2,
      y: height * 0.73,
      w: width * 0.6,
      h: 44,
      color: "#68b2ff"
    });

    this.renderButtons(ctx);
  }

  drawEncyclopediaPanel(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    entries: Array<{ id: string; name: string; description: string; unlocked: boolean; color: string }>,
    debugMode: boolean,
    page: number,
    pageCount: number
  ): void {
    this.drawPanel(ctx, width * 0.05, height * 0.06, width * 0.9, height * 0.88, "#14212f", "#4d7fb5");

    ctx.fillStyle = "#d5e8ff";
    ctx.font = "24px Microsoft YaHei";
    const title = "进化图鉴";
    ctx.fillText(title, width * 0.5 - ctx.measureText(title).width * 0.5, height * 0.12);

    const clampedPage = Math.max(0, Math.min(page, Math.max(0, pageCount - 1)));
    const entriesPerPage = 16;
    const startIndex = clampedPage * entriesPerPage;
    const pageEntries = entries.slice(startIndex, startIndex + entriesPerPage);

    let y = height * 0.18;
    for (let i = 0; i < pageEntries.length; i += 1) {
      const entry = pageEntries[i];
      ctx.fillStyle = entry.unlocked ? entry.color : "#4b5e72";
      ctx.fillRect(width * 0.1, y - 16, 14, 14);
      ctx.fillStyle = entry.unlocked ? "#f1f8ff" : "#93a1b4";
      ctx.font = "14px Microsoft YaHei";
      const text = `${entry.unlocked ? "[已解锁]" : "[未解锁]"} ${entry.name}`;
      this.drawTruncatedText(ctx, text, width * 0.14, y - 4, width * 0.72, 14);
      y += 24;
    }

    ctx.fillStyle = "#a7c7eb";
    ctx.font = "13px Microsoft YaHei";
    ctx.fillText(`页码 ${clampedPage + 1}/${Math.max(1, pageCount)}`, width * 0.41, height * 0.78);

    this.addButton({
      id: "encyclopedia_prev",
      text: "上一页",
      x: width * 0.12,
      y: height * 0.79,
      w: width * 0.24,
      h: 34,
      color: clampedPage > 0 ? "#739fce" : "#4e6680",
      textColor: clampedPage > 0 ? "#071524" : "#9fb5cd"
    });
    this.addButton({
      id: "encyclopedia_next",
      text: "下一页",
      x: width * 0.64,
      y: height * 0.79,
      w: width * 0.24,
      h: 34,
      color: clampedPage + 1 < pageCount ? "#739fce" : "#4e6680",
      textColor: clampedPage + 1 < pageCount ? "#071524" : "#9fb5cd"
    });

    this.addButton({
      id: "close_encyclopedia",
      text: "关闭",
      x: width * 0.18,
      y: height * 0.85,
      w: width * 0.28,
      h: 40,
      color: "#5aa3ff"
    });

    if (debugMode) {
      this.addButton({
        id: "debug_unlock_all",
        text: "调试：全部解锁",
        x: width * 0.52,
        y: height * 0.85,
        w: width * 0.3,
        h: 40,
        color: "#ffd06f"
      });
    }

    this.renderButtons(ctx);
  }

  drawToast(ctx: CanvasRenderingContext2D, width: number, text: string, color: string): void {
    this.fillRoundedRect(ctx, width * 0.16, 110, width * 0.68, 44, 12, "rgba(6, 14, 22, 0.78)");
    ctx.strokeStyle = "rgba(156, 223, 255, 0.56)";
    ctx.lineWidth = 1.5;
    this.strokeRoundedRect(ctx, width * 0.16, 110, width * 0.68, 44, 12);
    ctx.fillStyle = color;
    ctx.font = "17px Microsoft YaHei";
    this.drawTruncatedText(ctx, text, width * 0.19, 138, width * 0.62, 17);
  }

  drawAdState(ctx: CanvasRenderingContext2D, width: number, text: string): void {
    this.fillRoundedRect(ctx, width * 0.22, 160, width * 0.56, 34, 10, "rgba(6, 12, 18, 0.8)");
    ctx.strokeStyle = "rgba(253, 210, 117, 0.6)";
    ctx.lineWidth = 1.5;
    this.strokeRoundedRect(ctx, width * 0.22, 160, width * 0.56, 34, 10);
    ctx.fillStyle = "#ffd271";
    ctx.font = "16px Microsoft YaHei";
    this.drawTruncatedText(ctx, text, width * 0.25, 183, width * 0.5, 16);
  }

  private addButton(button: UIButton): void {
    this.buttons.push(button);
  }

  private renderButtons(ctx: CanvasRenderingContext2D): void {
    for (const button of this.buttons) {
      this.drawButton(ctx, button);
    }
  }

  private drawPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    bg: string,
    border: string
  ): void {
    ctx.fillStyle = "rgba(3, 8, 14, 0.62)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, this.tintColor(bg, 18));
    grad.addColorStop(1, this.tintColor(bg, -18));
    this.fillRoundedRect(ctx, x, y, w, h, 22, grad);

    const edgeGlow = ctx.createLinearGradient(x, y, x + w, y);
    edgeGlow.addColorStop(0, "rgba(255, 255, 255, 0.2)");
    edgeGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
    this.fillRoundedRect(ctx, x + 2, y + 2, w - 4, Math.max(14, h * 0.18), 18, edgeGlow);

    ctx.strokeStyle = this.withAlpha(border, 0.86);
    ctx.lineWidth = 2.5;
    this.strokeRoundedRect(ctx, x, y, w, h, 22);
    ctx.strokeStyle = "rgba(226, 244, 255, 0.14)";
    ctx.lineWidth = 1.2;
    this.strokeRoundedRect(ctx, x + 3, y + 3, w - 6, h - 6, 19);
  }

  private drawButton(ctx: CanvasRenderingContext2D, button: UIButton, fontSize = 16): void {
    const radius = Math.max(8, Math.min(14, button.h * 0.34));
    const topColor = this.tintColor(button.color, 20);
    const bottomColor = this.tintColor(button.color, -16);
    const bg = ctx.createLinearGradient(button.x, button.y, button.x, button.y + button.h);
    bg.addColorStop(0, topColor);
    bg.addColorStop(1, bottomColor);

    ctx.shadowColor = this.withAlpha(button.color, 0.4);
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    this.fillRoundedRect(ctx, button.x, button.y, button.w, button.h, radius, bg);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.lineWidth = 1.5;
    this.strokeRoundedRect(ctx, button.x, button.y, button.w, button.h, radius);

    const shine = ctx.createLinearGradient(button.x, button.y, button.x, button.y + button.h * 0.45);
    shine.addColorStop(0, "rgba(255, 255, 255, 0.35)");
    shine.addColorStop(1, "rgba(255, 255, 255, 0)");
    this.fillRoundedRect(ctx, button.x + 1.4, button.y + 1.4, button.w - 2.8, Math.max(8, button.h * 0.4), radius - 2, shine);

    ctx.fillStyle = button.textColor || "#0e1726";
    let drawSize = fontSize;
    const maxTextWidth = Math.max(20, button.w - 12);

    while (drawSize > 11) {
      ctx.font = `${drawSize}px Microsoft YaHei`;
      if (ctx.measureText(button.text).width <= maxTextWidth) {
        break;
      }
      drawSize -= 1;
    }

    ctx.font = `${drawSize}px Microsoft YaHei`;
    const text = this.truncateText(ctx, button.text, maxTextWidth);
    const textWidth = ctx.measureText(text).width;
    const textX = button.x + (button.w - textWidth) * 0.5;
    const textY = button.y + button.h * 0.5 + drawSize * 0.35;
    ctx.fillText(text, textX, textY);
  }

  private drawTruncatedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number
  ): void {
    ctx.font = `${fontSize}px Microsoft YaHei`;
    ctx.fillText(this.truncateText(ctx, text, Math.max(8, maxWidth)), x, y);
  }

  private drawMenuBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#164056");
    gradient.addColorStop(0.52, "#2c6171");
    gradient.addColorStop(1, "#3b3123");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const orbShift = Math.sin(this.uiClock * 0.72);
    this.drawSoftOrb(ctx, width * (0.22 + 0.04 * orbShift), height * 0.18, width * 0.46, "#70f3ff", 0.22);
    this.drawSoftOrb(ctx, width * (0.84 - 0.03 * orbShift), height * 0.86, width * 0.58, "#ffcf8e", 0.2);
    this.drawSoftOrb(ctx, width * 0.52, height * (0.54 + 0.02 * Math.cos(this.uiClock)), width * 0.5, "#7cb7ff", 0.16);

    ctx.strokeStyle = "rgba(206, 234, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 7; i += 1) {
      const y = (height / 7) * i + (this.uiClock * 8 + i * 11) % 18;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y + 18);
      ctx.stroke();
    }
  }

  private drawGlassSurface(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    accentColor: string
  ): void {
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, "rgba(8, 18, 26, 0.9)");
    gradient.addColorStop(1, "rgba(6, 12, 20, 0.86)");
    this.fillRoundedRect(ctx, x, y, w, h, radius, gradient);

    const highlight = ctx.createLinearGradient(x, y, x, y + h * 0.32);
    highlight.addColorStop(0, "rgba(220, 244, 255, 0.26)");
    highlight.addColorStop(1, "rgba(220, 244, 255, 0)");
    this.fillRoundedRect(ctx, x + 2, y + 2, w - 4, Math.max(16, h * 0.24), Math.max(8, radius - 3), highlight);

    ctx.strokeStyle = this.withAlpha(accentColor, 0.72);
    ctx.lineWidth = 2;
    this.strokeRoundedRect(ctx, x, y, w, h, radius);
    ctx.strokeStyle = "rgba(240, 251, 255, 0.12)";
    ctx.lineWidth = 1;
    this.strokeRoundedRect(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(8, radius - 2));
  }

  private drawMeter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    ratio: number,
    fromColor: string,
    toColor: string
  ): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    const radius = Math.max(3, h * 0.5);
    this.fillRoundedRect(ctx, x, y, w, h, radius, "rgba(8, 14, 22, 0.9)");
    if (clamped > 0.002) {
      const fill = ctx.createLinearGradient(x, y, x + w, y);
      fill.addColorStop(0, fromColor);
      fill.addColorStop(1, toColor);
      this.fillRoundedRect(ctx, x + 1, y + 1, (w - 2) * clamped, h - 2, Math.max(2, radius - 1), fill);
    }
    ctx.strokeStyle = "rgba(206, 232, 255, 0.24)";
    ctx.lineWidth = 1;
    this.strokeRoundedRect(ctx, x, y, w, h, radius);
  }

  private drawSoftOrb(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string,
    alpha: number
  ): void {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, this.withAlpha(color, alpha));
    glow.addColorStop(1, this.withAlpha(color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  private fillRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    fill: string | CanvasGradient
  ): void {
    this.roundedRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  private strokeRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number
  ): void {
    this.roundedRectPath(ctx, x, y, w, h, radius);
    ctx.stroke();
  }

  private roundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number
  ): void {
    const safeRadius = Math.max(0, Math.min(radius, Math.min(w, h) * 0.5));
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + w - safeRadius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + safeRadius);
    ctx.lineTo(x + w, y + h - safeRadius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - safeRadius, y + h);
    ctx.lineTo(x + safeRadius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
  }

  private tintColor(color: string, delta: number): string {
    const rgb = this.parseHexColor(color);
    if (!rgb) {
      return color;
    }
    const clampChannel = (value: number): number => Math.max(0, Math.min(255, value));
    const r = clampChannel(rgb.r + delta);
    const g = clampChannel(rgb.g + delta);
    const b = clampChannel(rgb.b + delta);
    return `rgb(${r}, ${g}, ${b})`;
  }

  private withAlpha(color: string, alpha: number): string {
    const rgb = this.parseHexColor(color);
    if (!rgb) {
      return color;
    }
    const clamped = Math.max(0, Math.min(1, alpha));
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamped})`;
  }

  private parseHexColor(color: string): { r: number; g: number; b: number } | null {
    const hex = color.trim();
    if (!hex.startsWith("#")) {
      return null;
    }
    if (hex.length === 4) {
      const r = parseInt(hex[1] + hex[1], 16);
      const g = parseInt(hex[2] + hex[2], 16);
      const b = parseInt(hex[3] + hex[3], 16);
      if ([r, g, b].some((item) => Number.isNaN(item))) {
        return null;
      }
      return { r, g, b };
    }
    if (hex.length === 7) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      if ([r, g, b].some((item) => Number.isNaN(item))) {
        return null;
      }
      return { r, g, b };
    }
    return null;
  }

  private truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) {
      return text;
    }

    const suffix = "...";
    let end = text.length;
    while (end > 1) {
      const candidate = text.slice(0, end) + suffix;
      if (ctx.measureText(candidate).width <= maxWidth) {
        return candidate;
      }
      end -= 1;
    }
    return suffix;
  }

  private formatTime(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  }
}














