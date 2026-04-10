"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UIManager = void 0;
/**
 * Responsible for drawing UI overlays and button hit tests.
 */
class UIManager {
    constructor() {
        this.buttons = [];
    }
    beginFrame() {
        this.buttons.length = 0;
    }
    hitTest(x, y) {
        for (let i = this.buttons.length - 1; i >= 0; i -= 1) {
            const b = this.buttons[i];
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                return b;
            }
        }
        return null;
    }
    drawBattleHud(ctx, width, data) {
        const panelH = data.objectiveText ? 96 : 74;
        ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
        ctx.fillRect(12, 12, width - 24, panelH);
        ctx.fillStyle = "#ffffff";
        ctx.font = "18px sans-serif";
        ctx.fillText(`等级${data.level}`, 24, 38);
        ctx.fillText(`${this.formatTime(data.time)}  击杀:${data.kills}`, width - 210, 38);
        let wx = 24;
        const wy = 58;
        for (const weapon of data.weaponSummaries) {
            ctx.fillStyle = weapon.color;
            ctx.fillRect(wx, wy, 14, 14);
            ctx.fillStyle = "#ffffff";
            ctx.font = "12px sans-serif";
            ctx.fillText(`${weapon.name} ${weapon.level}级`, wx + 18, wy + 12);
            wx += 128;
        }
        if (data.elements.length > 0) {
            let ex = width - 24;
            for (const element of data.elements) {
                ex -= 18;
                ctx.fillStyle = element.color;
                ctx.beginPath();
                ctx.arc(ex, 58, 7, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        if (data.frenzyActive) {
            ctx.fillStyle = "#ffd37a";
            ctx.font = "14px sans-serif";
            ctx.fillText("狂热", width - 90, 58);
        }
        if (data.objectiveText) {
            ctx.fillStyle = "#ffe5a8";
            ctx.font = "13px sans-serif";
            ctx.fillText(data.objectiveText, 24, 87);
        }
    }
    drawStartPanel(ctx, width, height, stats) {
        const cardX = 14;
        const cardY = 14;
        const navHeight = 78;
        const cardW = width - 28;
        const cardH = height - navHeight - 24;
        ctx.fillStyle = "rgba(5, 10, 20, 0.48)";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#17263b";
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.strokeStyle = "#4f7aad";
        ctx.lineWidth = 3;
        ctx.strokeRect(cardX, cardY, cardW, cardH);
        ctx.fillStyle = "#ffffff";
        ctx.font = "30px sans-serif";
        ctx.fillText("进化幸存者", cardX + 22, cardY + 44);
        ctx.fillStyle = "#a9c6ef";
        ctx.font = "14px sans-serif";
        ctx.fillText("轻度动作 | 自动攻击 | 进化合成", cardX + 22, cardY + 66);
        ctx.fillStyle = "#7ee7ff";
        ctx.font = "16px sans-serif";
        ctx.fillText(`DNA: ${stats.dna}`, cardX + cardW - 130, cardY + 44);
        if (stats.activeTab === "home") {
            ctx.fillStyle = "#d7e9ff";
            ctx.font = "20px sans-serif";
            ctx.fillText("关卡页", cardX + 24, cardY + 98);
            ctx.fillStyle = "#b6d0ef";
            ctx.font = "16px sans-serif";
            ctx.fillText(`当前模式: ${stats.currentModeLabel}`, cardX + 24, cardY + 124);
            const bossHint = stats.selectedMode === "endless"
                ? `无尽批次: 每${stats.endlessBossInterval}秒刷新一批首领`
                : stats.selectedMode === "daily"
                    ? `每日挑战: ${stats.dailyChallengeName}`
                    : `标准模式: ${this.formatTime(stats.storyClearTime)}后最终首领登场`;
            ctx.fillText(bossHint, cardX + 24, cardY + 148);
            if (stats.selectedMode === "daily") {
                ctx.fillText(`目标生存: ${this.formatTime(stats.dailyChallengeTarget)}  奖励 +${stats.dailyChallengeReward} DNA`, cardX + 24, cardY + 172);
                ctx.fillStyle = "#9ed5ff";
                ctx.font = "14px sans-serif";
                ctx.fillText(stats.dailyChallengeDescription, cardX + 24, cardY + 196);
                ctx.fillStyle = "#b6d0ef";
                ctx.font = "16px sans-serif";
            }
            else {
                ctx.fillText(`最高生存: ${this.formatTime(stats.bestTime)}`, cardX + 24, cardY + 172);
                ctx.fillText(`总对局: ${stats.totalRuns}  总击杀: ${stats.totalKills}`, cardX + 24, cardY + 196);
            }
            if (stats.freeBuffCharges > 0) {
                ctx.fillStyle = "#ffe08d";
                ctx.fillText(`已持有开局增益券 x${stats.freeBuffCharges}`, cardX + 24, cardY + 220);
            }
            this.addButton({
                id: "start_run",
                text: stats.freeBuffCharges > 0 ? "开始战斗（自动消耗增益券）" : "开始战斗",
                x: width * 0.14,
                y: height * 0.36,
                w: width * 0.72,
                h: 52,
                color: "#35db88"
            });
            this.addButton({
                id: "start_buff_ad",
                text: "广告开局增益",
                x: width * 0.14,
                y: height * 0.44,
                w: width * 0.72,
                h: 42,
                color: "#ffca67"
            });
            const questY = height * 0.53;
            ctx.fillStyle = "#ffe8ad";
            ctx.font = "18px sans-serif";
            ctx.fillText("每日任务", cardX + 24, questY);
            let rowY = questY + 12;
            const rowH = 52;
            for (let i = 0; i < stats.dailyQuests.length; i += 1) {
                const quest = stats.dailyQuests[i];
                const complete = quest.progress >= quest.target;
                ctx.fillStyle = "rgba(12, 22, 38, 0.86)";
                ctx.fillRect(cardX + 20, rowY, cardW - 40, rowH);
                ctx.strokeStyle = complete ? "#7ee7a1" : "#4f6785";
                ctx.lineWidth = 2;
                ctx.strokeRect(cardX + 20, rowY, cardW - 40, rowH);
                ctx.fillStyle = complete ? "#d7ffe6" : "#d7e9ff";
                ctx.font = "14px sans-serif";
                const progressText = `${Math.min(quest.progress, quest.target)}/${quest.target}`;
                ctx.fillText(`${quest.title}  ${progressText}`, cardX + 32, rowY + 19);
                ctx.fillStyle = "#9db9d8";
                ctx.font = "12px sans-serif";
                const rewardText = `奖励 DNA ${quest.rewardDna}${quest.rewardBuffCharge > 0 ? ` + 增益券x${quest.rewardBuffCharge}` : ""}`;
                ctx.fillText(rewardText, cardX + 32, rowY + 38);
                if (quest.claimed) {
                    ctx.fillStyle = "#9de8aa";
                    ctx.font = "13px sans-serif";
                    ctx.fillText("已领取", cardX + cardW - 86, rowY + 33);
                }
                else if (complete) {
                    this.addButton({
                        id: `daily_claim_${i}`,
                        text: "领取",
                        x: cardX + cardW - 96,
                        y: rowY + 11,
                        w: 68,
                        h: 30,
                        color: "#6ce7a1"
                    });
                }
                else {
                    ctx.fillStyle = "#7f9ab8";
                    ctx.font = "12px sans-serif";
                    ctx.fillText("未完成", cardX + cardW - 92, rowY + 33);
                }
                rowY += rowH + 8;
            }
        }
        else if (stats.activeTab === "chest") {
            ctx.fillStyle = "#ffe8b7";
            ctx.font = "20px sans-serif";
            ctx.fillText("领取宝箱", cardX + 24, cardY + 98);
            ctx.fillStyle = "#dfc995";
            ctx.font = "16px sans-serif";
            ctx.fillText("每日登录可领取一次启动宝箱", cardX + 24, cardY + 126);
            ctx.fillText("奖励内容：开局增益券（1~2张）", cardX + 24, cardY + 150);
            if (stats.chestClaimed) {
                ctx.fillStyle = "#9de8aa";
                ctx.fillText("今日已领取，明天再来。", cardX + 24, cardY + 184);
            }
            else {
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
            ctx.fillText(`当前增益券: x${stats.freeBuffCharges}`, cardX + 24, cardY + 216);
        }
        else if (stats.activeTab === "weapon") {
            ctx.fillStyle = "#d8ecff";
            ctx.font = "20px sans-serif";
            ctx.fillText("武器页", cardX + 24, cardY + 98);
            ctx.fillStyle = "#b6d0ef";
            ctx.font = "16px sans-serif";
            ctx.fillText(`进化解锁：${stats.unlockedEvolutionCount}/${stats.totalEvolutionCount}`, cardX + 24, cardY + 124);
            let rowY = cardY + 146;
            for (let i = 0; i < stats.weaponCards.length; i += 1) {
                const weapon = stats.weaponCards[i];
                ctx.fillStyle = "rgba(11, 20, 35, 0.9)";
                ctx.fillRect(cardX + 20, rowY, cardW - 40, 60);
                ctx.strokeStyle = "#4a6c91";
                ctx.lineWidth = 2;
                ctx.strokeRect(cardX + 20, rowY, cardW - 40, 60);
                ctx.fillStyle = weapon.color;
                ctx.fillRect(cardX + 30, rowY + 10, 12, 12);
                ctx.fillStyle = "#e8f4ff";
                ctx.font = "14px sans-serif";
                ctx.fillText(`${weapon.name}  Lv.${weapon.masteryLevel}`, cardX + 48, rowY + 21);
                ctx.fillStyle = "#9fb8d8";
                ctx.font = "12px sans-serif";
                ctx.fillText(weapon.description, cardX + 48, rowY + 38);
                const barX = cardX + 48;
                const barY = rowY + 44;
                const barW = cardW - 130;
                const barH = 8;
                ctx.fillStyle = "#1d2b3f";
                ctx.fillRect(barX, barY, barW, barH);
                ctx.fillStyle = weapon.color;
                ctx.fillRect(barX, barY, barW * Math.max(0, Math.min(1, weapon.masteryProgress)), barH);
                ctx.strokeStyle = "#5f85b3";
                ctx.lineWidth = 1;
                ctx.strokeRect(barX, barY, barW, barH);
                ctx.fillStyle = "#b7d7ff";
                ctx.font = "11px sans-serif";
                ctx.fillText(`熟练度 ${weapon.masteryCurrent}/${weapon.masteryNeed}`, barX + barW - 94, rowY + 55);
                rowY += 66;
                if (rowY > cardY + cardH - 140) {
                    break;
                }
            }
            this.addButton({
                id: "open_encyclopedia",
                text: "查看进化图鉴",
                x: width * 0.18,
                y: height * 0.73,
                w: width * 0.64,
                h: 44,
                color: "#67b8ff"
            });
        }
        else {
            ctx.fillStyle = "#e5ddff";
            ctx.font = "20px sans-serif";
            ctx.fillText("其他模式", cardX + 24, cardY + 98);
            ctx.fillStyle = "#b9b0d6";
            ctx.font = "15px sans-serif";
            ctx.fillText(`当前模式: ${stats.currentModeLabel}`, cardX + 24, cardY + 124);
            ctx.fillText(`无尽模式首领周期: ${stats.endlessBossInterval}秒/批`, cardX + 24, cardY + 148);
            ctx.fillStyle = "#d4ccf3";
            ctx.font = "13px sans-serif";
            ctx.fillText(`今日挑战: ${stats.dailyChallengeName}`, cardX + 24, cardY + 170);
            ctx.fillText(`目标${this.formatTime(stats.dailyChallengeTarget)} | 奖励+${stats.dailyChallengeReward} DNA`, cardX + 24, cardY + 190);
            const storyActive = stats.selectedMode === "story";
            const endlessActive = stats.selectedMode === "endless";
            const dailyActive = stats.selectedMode === "daily";
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
            ctx.font = "16px sans-serif";
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
                ctx.font = "14px sans-serif";
                ctx.fillText(`${item.title} Lv.${item.level}/${item.maxLevel}`, cardLeft + 8, cardTop + 19);
                ctx.fillStyle = "#9fc0de";
                ctx.font = "12px sans-serif";
                ctx.fillText(item.currentValue, cardLeft + 8, cardTop + 37);
                if (item.level >= item.maxLevel) {
                    ctx.fillStyle = "#8fffc0";
                    ctx.fillText("已满级", cardLeft + 8, cardTop + 50);
                }
                else {
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
                x: width * 0.16,
                y: height * 0.69,
                w: width * 0.32,
                h: 34,
                color: "#7ee2ff",
                textColor: "#0d2232"
            });
            this.addButton({
                id: "shop_plan_hardcore",
                text: "高难推荐加点",
                x: width * 0.52,
                y: height * 0.69,
                w: width * 0.32,
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
        }
        const navY = height - navHeight + 10;
        const navW = width - 24;
        const itemW = navW / 4;
        const tabs = [
            { id: "tab_chest", text: "领取宝箱", active: stats.activeTab === "chest" },
            { id: "tab_home", text: "首页", active: stats.activeTab === "home" },
            { id: "tab_weapon", text: "武器", active: stats.activeTab === "weapon" },
            { id: "tab_mode", text: "其他模式", active: stats.activeTab === "mode" }
        ];
        ctx.fillStyle = "rgba(8, 14, 24, 0.86)";
        ctx.fillRect(12, height - navHeight, navW, navHeight - 4);
        ctx.strokeStyle = "#395a80";
        ctx.lineWidth = 2;
        ctx.strokeRect(12, height - navHeight, navW, navHeight - 4);
        for (let i = 0; i < tabs.length; i += 1) {
            const tab = tabs[i];
            this.addButton({
                id: tab.id,
                text: tab.text,
                x: 12 + i * itemW,
                y: navY,
                w: itemW,
                h: 48,
                color: tab.active ? "#6ab8ff" : "#2d3f57",
                textColor: tab.active ? "#071524" : "#c3d8ef"
            });
        }
        this.renderButtons(ctx);
    }
    drawUpgradePanel(ctx, width, height, options, extraOption, canShowAdOption) {
        this.drawPanel(ctx, width * 0.07, height * 0.14, width * 0.86, height * 0.72, "#182232", "#5a87cc");
        ctx.fillStyle = "#ffffff";
        ctx.font = "24px sans-serif";
        ctx.fillText("升级 - 三选一", width * 0.28, height * 0.21);
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
    drawChestPanel(ctx, width, height, weaponOptions, characterOptions, boosted, canShowBoostAd) {
        this.drawPanel(ctx, width * 0.07, height * 0.14, width * 0.86, height * 0.72, "#2a1d12", "#c1914c");
        ctx.fillStyle = "#ffe7b1";
        ctx.font = "24px sans-serif";
        ctx.fillText("宝箱变异", width * 0.38, height * 0.22);
        let y = height * 0.29;
        ctx.fillStyle = "#ffd58b";
        ctx.font = "17px sans-serif";
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
        ctx.font = "17px sans-serif";
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
    drawDeathPanel(ctx, width, height, info) {
        this.drawPanel(ctx, width * 0.12, height * 0.24, width * 0.76, height * 0.5, "#301b1b", "#d17777");
        ctx.fillStyle = "#ffd5d5";
        ctx.font = "30px sans-serif";
        ctx.fillText("你已阵亡", width * 0.35, height * 0.33);
        ctx.font = "18px sans-serif";
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
    drawSettlementPanel(ctx, width, height, info) {
        this.drawPanel(ctx, width * 0.1, height * 0.2, width * 0.8, height * 0.58, "#1d2a1d", "#7dc77d");
        ctx.fillStyle = "#d9ffd9";
        ctx.font = "28px sans-serif";
        ctx.fillText("战斗结算", width * 0.33, height * 0.29);
        ctx.font = "18px sans-serif";
        ctx.fillText(`生存时长: ${this.formatTime(info.time)}`, width * 0.22, height * 0.38);
        ctx.fillText(`击杀总数: ${info.kills}`, width * 0.22, height * 0.43);
        ctx.fillText(`获得DNA: ${info.reward}${info.doubled ? "（x2）" : ""}`, width * 0.22, height * 0.48);
        if (!info.doubled) {
            this.addButton({
                id: "double_reward_ad",
                text: "看广告双倍奖励",
                x: width * 0.2,
                y: height * 0.56,
                w: width * 0.6,
                h: 46,
                color: "#ffd86a"
            });
        }
        this.addButton({
            id: "back_to_start",
            text: "返回开始",
            x: width * 0.2,
            y: height * 0.64,
            w: width * 0.6,
            h: 44,
            color: "#68b2ff"
        });
        this.renderButtons(ctx);
    }
    drawEncyclopediaPanel(ctx, width, height, entries, debugMode) {
        this.drawPanel(ctx, width * 0.05, height * 0.06, width * 0.9, height * 0.88, "#14212f", "#4d7fb5");
        ctx.fillStyle = "#d5e8ff";
        ctx.font = "24px sans-serif";
        ctx.fillText("进化图鉴", width * 0.38, height * 0.12);
        let y = height * 0.18;
        for (let i = 0; i < entries.length; i += 1) {
            const entry = entries[i];
            ctx.fillStyle = entry.unlocked ? entry.color : "#4b5e72";
            ctx.fillRect(width * 0.1, y - 16, 14, 14);
            ctx.fillStyle = entry.unlocked ? "#f1f8ff" : "#93a1b4";
            ctx.font = "14px sans-serif";
            const text = `${entry.unlocked ? "[已解锁]" : "[未解锁]"} ${entry.name}`;
            ctx.fillText(text, width * 0.14, y - 4);
            y += 24;
            if (y > height * 0.78) {
                break;
            }
        }
        this.addButton({
            id: "close_encyclopedia",
            text: "关闭",
            x: width * 0.18,
            y: height * 0.84,
            w: width * 0.28,
            h: 40,
            color: "#5aa3ff"
        });
        if (debugMode) {
            this.addButton({
                id: "debug_unlock_all",
                text: "调试：全部解锁",
                x: width * 0.52,
                y: height * 0.84,
                w: width * 0.3,
                h: 40,
                color: "#ffd06f"
            });
        }
        this.renderButtons(ctx);
    }
    drawToast(ctx, width, text, color) {
        ctx.fillStyle = "rgba(8, 12, 20, 0.7)";
        ctx.fillRect(width * 0.18, 118, width * 0.64, 36);
        ctx.fillStyle = color;
        ctx.font = "18px sans-serif";
        ctx.fillText(text, width * 0.2, 142);
    }
    drawAdState(ctx, width, text) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(width * 0.24, 162, width * 0.52, 30);
        ctx.fillStyle = "#ffd271";
        ctx.font = "16px sans-serif";
        ctx.fillText(text, width * 0.28, 183);
    }
    addButton(button) {
        this.buttons.push(button);
    }
    renderButtons(ctx) {
        for (const button of this.buttons) {
            this.drawButton(ctx, button);
        }
    }
    drawPanel(ctx, x, y, w, h, bg, border) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = bg;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = border;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
    }
    drawButton(ctx, button) {
        ctx.fillStyle = button.color;
        ctx.fillRect(button.x, button.y, button.w, button.h);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
        ctx.lineWidth = 2;
        ctx.strokeRect(button.x, button.y, button.w, button.h);
        ctx.fillStyle = button.textColor || "#0e1726";
        ctx.font = "16px sans-serif";
        const textY = button.y + button.h * 0.58;
        ctx.fillText(button.text, button.x + 12, textY);
    }
    formatTime(seconds) {
        const s = Math.max(0, Math.floor(seconds));
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    }
}
exports.UIManager = UIManager;
