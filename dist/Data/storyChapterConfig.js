"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storyChapterConfigList = void 0;
const weaponConfig_1 = require("./weaponConfig");
const chapterNameList = [
    "净化前线",
    "裂变街区",
    "火线高塔",
    "重装封锁",
    "钢盾回廊",
    "极速猎场",
    "终末坍缩",
    "裂隙风暴",
    "深渊打击",
    "虚空包围",
    "湮灭回响",
    "终焉审判",
    "雷霆裂谷",
    "风暴哨站",
    "熔火高压",
    "断域风暴",
    "深层崩解",
    "灭界边缘",
    "终极裂击",
    "终焉之门"
];
const chapterDescList = [
    "基础怪潮，熟悉移动与攻击节奏。",
    "机动单位增多，开始考验走位。",
    "远程压力提升，注意规避弹道。",
    "高血量敌人增多，需要更高输出。",
    "护盾单位开始成型，容错下降。",
    "高速围猎阶段，节奏明显加快。",
    "全维度增强，进入高压对局。",
    "高密度混编怪潮，注意拉扯空间。",
    "高伤敌群登场，容错持续下降。",
    "怪潮与首领压制同步提升。",
    "持续高压阶段，阵容构筑更关键。",
    "章节中后段门槛，考验综合能力。",
    "密集刷新与追击并存，输出要求提高。",
    "高速与远程同时施压，站位更重要。",
    "持续压制型战斗，操作失误代价更高。",
    "多方向夹击，要求更稳定的循环。",
    "极限生存测试，需完整体系支撑。",
    "高频高伤并行，恢复与躲避都重要。",
    "终局前压测章节，检验完整Build。",
    "标准模式顶点挑战。"
];
const chapterCount = 20;
const baseStoryChapterConfigList = Array.from({ length: chapterCount }, (_, index) => {
    const level = index + 1;
    return {
        id: `chapter_${level}`,
        level,
        name: chapterNameList[index] || `第${level}章`,
        description: chapterDescList[index] || `标准模式章节 ${level}`,
        storyClearTime: 170 + index * 5,
        startStageLevel: Math.min(7, 1 + Math.floor(index / 2)),
        enemyHpMul: 1,
        enemySpeedMul: 1,
        enemyDamageMul: 1,
        spawnIntervalMul: 1
    };
});
const calcRecommendedPower = (level) => {
    const lv = Math.max(1, Math.floor(level));
    return Math.floor(120 + lv * lv * 4 + lv * 24);
};
const calcKillTarget = (level) => {
    const lv = Math.max(1, Math.floor(level));
    return Math.floor(85 + lv * 10 + lv * lv * 0.45);
};
const calcBossTuning = (level) => {
    const pressure = Math.max(0, Math.floor(level) - 1);
    return {
        hpMul: 1 + pressure * 0.04,
        speedMul: 1 + pressure * 0.007,
        damageMul: 1 + pressure * 0.034
    };
};
const calcEnemyWeightMulById = (level) => {
    const progress = Math.max(0, Math.min(1, (Math.max(1, Math.floor(level)) - 1) / 19));
    return {
        slime: Math.max(0.24, 1 - progress * 0.74),
        hound: 1 + progress * 0.34,
        spitter: level >= 3 ? 0.9 + progress * 0.62 : 0.45,
        brute: level >= 4 ? 0.82 + progress * 0.86 : 0.38,
        shield_guard: level >= 5 ? 0.74 + progress * 1.02 : 0.35,
        swift_stalker: level >= 6 ? 0.68 + progress * 1.22 : 0.32
    };
};
const calcFirstClearRewards = (level) => {
    if (weaponConfig_1.baseWeaponIds.length <= 0) {
        return [];
    }
    const lv = Math.max(1, Math.floor(level));
    const mainIndex = (lv - 1) % weaponConfig_1.baseWeaponIds.length;
    const subIndex = (mainIndex + 1) % weaponConfig_1.baseWeaponIds.length;
    const rewards = [
        {
            baseWeaponId: weaponConfig_1.baseWeaponIds[mainIndex],
            amount: 10 + lv * 2
        },
        {
            baseWeaponId: weaponConfig_1.baseWeaponIds[subIndex],
            amount: 6 + Math.floor(lv * 1.4)
        }
    ];
    if (lv >= 8) {
        const extraIndex = (mainIndex + 2) % weaponConfig_1.baseWeaponIds.length;
        rewards.push({
            baseWeaponId: weaponConfig_1.baseWeaponIds[extraIndex],
            amount: 4 + Math.floor(lv * 0.8)
        });
    }
    return rewards;
};
const round3 = (value) => Math.round(value * 1000) / 1000;
const calcChapterCombatScale = (level) => {
    const lv = Math.max(1, Math.floor(level));
    const t = Math.max(0, Math.min(1, (lv - 1) / 19));
    const smooth = t * t * (3 - 2 * t);
    // Smooth threshold curve: keep progression while reducing overall pressure.
    const enemyHpMul = 1 + t * 2.25 + smooth * 1.75;
    const enemyDamageMul = 1 + t * 2.45 + smooth * 1.6;
    const enemySpeedMul = 1 + t * 0.42 + smooth * 0.24;
    const spawnIntervalMul = 1 - t * 0.29 - smooth * 0.23;
    return {
        startStageLevel: Math.min(7, 1 + Math.floor((lv - 1) / 2)),
        enemyHpMul: round3(enemyHpMul),
        enemySpeedMul: round3(enemySpeedMul),
        enemyDamageMul: round3(enemyDamageMul),
        spawnIntervalMul: round3(Math.max(0.48, spawnIntervalMul))
    };
};
exports.storyChapterConfigList = baseStoryChapterConfigList.map((chapter) => (Object.assign(Object.assign(Object.assign({}, chapter), calcChapterCombatScale(chapter.level)), { recommendedPower: calcRecommendedPower(chapter.level), starGoals: {
        killTarget: calcKillTarget(chapter.level)
    }, firstClearFragmentRewards: calcFirstClearRewards(chapter.level), enemyWeightMulById: calcEnemyWeightMulById(chapter.level), bossTuning: calcBossTuning(chapter.level) })));
