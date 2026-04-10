"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveManager = void 0;
const SAVE_KEY = "evolution_survivor_save_v1";
const dailyQuestTemplates = [
    {
        type: "kill",
        title: "清理异变体",
        description: "今日累计击杀 120 个敌人。",
        target: 120,
        rewardDna: 90,
        rewardBuffCharge: 0
    },
    {
        type: "survive",
        title: "坚持作战",
        description: "今日累计生存 240 秒。",
        target: 240,
        rewardDna: 100,
        rewardBuffCharge: 0
    },
    {
        type: "evolution",
        title: "完成进化",
        description: "今日触发 2 次武器进化。",
        target: 2,
        rewardDna: 120,
        rewardBuffCharge: 1
    },
    {
        type: "boss_batch",
        title: "首领猎手",
        description: "今日击破 2 批首领。",
        target: 2,
        rewardDna: 120,
        rewardBuffCharge: 0
    },
    {
        type: "fusion",
        title: "基因融合",
        description: "今日触发 2 次人物融合。",
        target: 2,
        rewardDna: 90,
        rewardBuffCharge: 1
    },
    {
        type: "kill",
        title: "暴走清场",
        description: "今日累计击杀 180 个敌人。",
        target: 180,
        rewardDna: 130,
        rewardBuffCharge: 0
    },
    {
        type: "survive",
        title: "长线拉扯",
        description: "今日累计生存 360 秒。",
        target: 360,
        rewardDna: 130,
        rewardBuffCharge: 1
    }
];
const metaUpgradeTemplates = [
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
const defaultMetaUpgradeLevels = {
    damage: 0,
    maxHp: 0,
    moveSpeed: 0,
    pickup: 0
};
const META_RESET_REFUND_RATIO = 0.85;
const starterPlanPriority = ["maxHp", "pickup", "damage", "moveSpeed"];
const hardcorePlanPriority = ["damage", "moveSpeed", "maxHp", "pickup"];
const defaultSaveData = {
    unlockedEvolutionIds: [],
    bestSurvivalTime: 0,
    totalKills: 0,
    totalRuns: 0,
    tutorialSeen: false,
    debugMode: false,
    dailyChestClaimDate: "",
    freeStartBuffCharges: 0,
    dna: 0,
    weaponMasteryExp: {},
    dailyQuestDate: "",
    dailyQuests: [],
    metaUpgradeLevels: Object.assign({}, defaultMetaUpgradeLevels)
};
/**
 * Local persistence for meta progress and debug switches.
 */
class SaveManager {
    constructor() {
        this.data = Object.assign({}, defaultSaveData);
    }
    static getInstance() {
        if (!SaveManager.instance) {
            SaveManager.instance = new SaveManager();
        }
        return SaveManager.instance;
    }
    load() {
        try {
            const raw = wx.getStorageSync(SAVE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.data = Object.assign(Object.assign(Object.assign({}, defaultSaveData), parsed), { unlockedEvolutionIds: Array.isArray(parsed.unlockedEvolutionIds)
                        ? parsed.unlockedEvolutionIds
                        : [], dailyChestClaimDate: typeof parsed.dailyChestClaimDate === "string" ? parsed.dailyChestClaimDate : "", freeStartBuffCharges: typeof parsed.freeStartBuffCharges === "number" && parsed.freeStartBuffCharges > 0
                        ? Math.floor(parsed.freeStartBuffCharges)
                        : 0, dna: typeof parsed.dna === "number" && parsed.dna > 0 ? Math.floor(parsed.dna) : 0, weaponMasteryExp: this.sanitizeMasteryExp(parsed.weaponMasteryExp), dailyQuestDate: typeof parsed.dailyQuestDate === "string" ? parsed.dailyQuestDate : "", dailyQuests: this.sanitizeDailyQuests(parsed.dailyQuests), metaUpgradeLevels: this.sanitizeMetaUpgradeLevels(parsed.metaUpgradeLevels) });
            }
        }
        catch (error) {
            this.data = Object.assign({}, defaultSaveData);
        }
        this.ensureDailyQuests();
    }
    save() {
        try {
            wx.setStorageSync(SAVE_KEY, JSON.stringify(this.data));
        }
        catch (error) {
            // Ignore write errors in MVP.
        }
    }
    getData() {
        this.ensureDailyQuests();
        return this.data;
    }
    isEvolutionUnlocked(id) {
        return this.data.unlockedEvolutionIds.indexOf(id) >= 0;
    }
    unlockEvolution(id) {
        if (!this.isEvolutionUnlocked(id)) {
            this.data.unlockedEvolutionIds.push(id);
            this.save();
        }
    }
    appendRunStats(survivalTime, kills) {
        this.data.totalRuns += 1;
        this.data.totalKills += kills;
        this.data.bestSurvivalTime = Math.max(this.data.bestSurvivalTime, survivalTime);
        this.save();
    }
    markTutorialSeen() {
        this.data.tutorialSeen = true;
        this.save();
    }
    setDebugMode(enabled) {
        this.data.debugMode = enabled;
        this.save();
    }
    resetSave() {
        this.data = Object.assign(Object.assign({}, defaultSaveData), { metaUpgradeLevels: Object.assign({}, defaultMetaUpgradeLevels) });
        this.ensureDailyQuests();
        this.save();
    }
    canClaimDailyChest(now = new Date()) {
        return this.data.dailyChestClaimDate !== this.getDateKey(now);
    }
    claimDailyChest(gain, now = new Date()) {
        if (!this.canClaimDailyChest(now)) {
            return false;
        }
        this.data.dailyChestClaimDate = this.getDateKey(now);
        this.data.freeStartBuffCharges += Math.max(0, Math.floor(gain));
        this.save();
        return true;
    }
    getFreeStartBuffCharges() {
        return Math.max(0, this.data.freeStartBuffCharges || 0);
    }
    consumeFreeStartBuffCharge() {
        if (this.data.freeStartBuffCharges <= 0) {
            return false;
        }
        this.data.freeStartBuffCharges -= 1;
        this.save();
        return true;
    }
    unlockAllEvolutionDebug(allEvolutionIds) {
        this.data.unlockedEvolutionIds = [...allEvolutionIds];
        this.save();
    }
    addDna(amount) {
        if (amount <= 0) {
            return;
        }
        this.data.dna += Math.floor(amount);
        this.save();
    }
    spendDna(amount) {
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
    getMetaUpgradeShopItems() {
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
    purchaseMetaUpgrade(rawId) {
        const id = this.toMetaUpgradeType(rawId);
        if (!id) {
            return { ok: false, reason: "invalid", cost: 0, level: 0 };
        }
        const result = this.purchaseMetaUpgradeByType(id, true);
        return result;
    }
    getMetaUpgradeResetPreview() {
        const spent = this.calcMetaUpgradeTotalSpent();
        return {
            spent,
            refund: Math.floor(spent * META_RESET_REFUND_RATIO),
            ratio: META_RESET_REFUND_RATIO
        };
    }
    resetMetaUpgrades() {
        const preview = this.getMetaUpgradeResetPreview();
        if (preview.spent <= 0) {
            return {
                ok: false,
                spent: 0,
                refund: 0
            };
        }
        this.data.metaUpgradeLevels = Object.assign({}, defaultMetaUpgradeLevels);
        this.data.dna += preview.refund;
        this.save();
        return {
            ok: true,
            spent: preview.spent,
            refund: preview.refund
        };
    }
    applyMetaUpgradePlan(planId) {
        const priorities = planId === "starter" ? starterPlanPriority : hardcorePlanPriority;
        const upgradeCountMap = {
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
    getMetaUpgradeEffects() {
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
    getWeaponMasteryExp(baseWeaponId) {
        return Math.max(0, Math.floor(this.data.weaponMasteryExp[baseWeaponId] || 0));
    }
    addRunWeaponMastery(baseWeaponIds, survivalTime, kills, evolvedBaseIds = []) {
        const result = [];
        if (baseWeaponIds.length <= 0) {
            return result;
        }
        const uniqueBaseIds = Array.from(new Set(baseWeaponIds));
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
    getWeaponMasteryInfo(baseWeaponId) {
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
    getDailyQuests(now = new Date()) {
        this.ensureDailyQuests(now);
        return this.data.dailyQuests;
    }
    applyRunToDailyQuests(summary, now = new Date()) {
        this.ensureDailyQuests(now);
        const newlyCompleted = [];
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
        }
        else {
            this.persistDailyQuestIfNeeded();
        }
        return newlyCompleted;
    }
    claimDailyQuest(questId, now = new Date()) {
        this.ensureDailyQuests(now);
        const quest = this.data.dailyQuests.find((item) => item.id === questId);
        if (!quest || quest.claimed || quest.progress < quest.target) {
            return { ok: false, rewardDna: 0, rewardBuffCharge: 0 };
        }
        quest.claimed = true;
        const rewardDna = Math.max(0, Math.floor(quest.rewardDna));
        const rewardBuffCharge = Math.max(0, Math.floor(quest.rewardBuffCharge));
        if (rewardDna > 0) {
            this.data.dna += rewardDna;
        }
        if (rewardBuffCharge > 0) {
            this.data.freeStartBuffCharges += rewardBuffCharge;
        }
        this.save();
        return {
            ok: true,
            rewardDna,
            rewardBuffCharge
        };
    }
    getMetaUpgradeLevel(id) {
        return Math.max(0, Math.floor(this.data.metaUpgradeLevels[id] || 0));
    }
    getMetaUpgradeCost(template, level) {
        return Math.max(20, Math.floor(template.baseCost * Math.pow(template.costScale, Math.max(0, level))));
    }
    getMetaUpgradeValueText(id, level) {
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
    calcMetaUpgradeTotalSpent() {
        let total = 0;
        for (const template of metaUpgradeTemplates) {
            const level = this.getMetaUpgradeLevel(template.id);
            for (let i = 0; i < level; i += 1) {
                total += this.getMetaUpgradeCost(template, i);
            }
        }
        return total;
    }
    purchaseMetaUpgradeByType(id, autoSave) {
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
    ensureDailyQuests(now = new Date()) {
        const dateKey = this.getDateKey(now);
        if (this.data.dailyQuestDate === dateKey && this.data.dailyQuests.length === 3) {
            return;
        }
        this.data.dailyQuestDate = dateKey;
        this.data.dailyQuests = this.buildDailyQuests(dateKey);
        this.save();
    }
    persistDailyQuestIfNeeded() {
        if (!this.data.dailyQuests || this.data.dailyQuests.length <= 0) {
            return;
        }
        this.save();
    }
    buildDailyQuests(dateKey) {
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
                rewardBuffCharge: template.rewardBuffCharge,
                claimed: false
            };
        });
    }
    getQuestProgressDelta(type, summary) {
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
    sanitizeMasteryExp(raw) {
        if (!raw || typeof raw !== "object") {
            return {};
        }
        const map = {};
        Object.keys(raw).forEach((key) => {
            const value = raw[key];
            if (typeof value === "number" && value > 0) {
                map[key] = Math.floor(value);
            }
        });
        return map;
    }
    sanitizeDailyQuests(raw) {
        if (!Array.isArray(raw)) {
            return [];
        }
        const out = [];
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
                rewardBuffCharge: Math.max(0, Math.floor(typeof item.rewardBuffCharge === "number" ? item.rewardBuffCharge : 0)),
                claimed: !!item.claimed
            });
        }
        return out.slice(0, 3);
    }
    sanitizeMetaUpgradeLevels(raw) {
        const safe = Object.assign({}, defaultMetaUpgradeLevels);
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
    toQuestType(type) {
        if (type === "kill" || type === "survive" || type === "evolution" || type === "boss_batch" || type === "fusion") {
            return type;
        }
        return null;
    }
    toMetaUpgradeType(type) {
        if (type === "damage" || type === "maxHp" || type === "moveSpeed" || type === "pickup") {
            return type;
        }
        return null;
    }
    hashString(text) {
        let hash = 2166136261;
        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }
    nextSeed(seed) {
        const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return next;
    }
    getMasteryNeed(level) {
        return 50 + Math.max(0, level - 1) * 26;
    }
    getDateKey(date) {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, "0");
        const d = date.getDate().toString().padStart(2, "0");
        return `${y}-${m}-${d}`;
    }
}
exports.SaveManager = SaveManager;
