"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = void 0;
const ConfigManager_1 = require("../managers/ConfigManager");
const MathUtil_1 = require("../utils/MathUtil");
/**
 * Player runtime model.
 */
class Player {
    constructor(width, height, maxWeapons) {
        this.maxWeapons = maxWeapons;
        this.x = 0;
        this.y = 0;
        this.radius = 18;
        this.maxHp = 120;
        this.hp = 120;
        this.baseSpeed = 220;
        this.level = 1;
        this.exp = 0;
        this.expToNext = 22;
        this.elements = new Set();
        this.ownedBaseWeaponIds = [];
        this.currentWeaponByBase = {};
        this.weaponLevelByBase = {};
        this.mutationGenes = new Set();
        this.appliedCharacterFusionIds = new Set();
        this.passives = {
            damageMultiplier: 1,
            cooldownMultiplier: 1,
            moveSpeedMultiplier: 1,
            pickupRange: 70,
            maxHpBonus: 0
        };
        this.lastMoveDir = { x: 1, y: 0 };
        this.frenzyTime = 0;
        this.damageImmuneTime = 0;
        this.damageImmuneMaxTime = 0;
        this.weaponDamageBonusByBase = {};
        this.weaponSkillIdsByBase = {};
        this.boundWidth = width;
        this.boundHeight = height;
        this.reset();
    }
    setBounds(width, height) {
        this.boundWidth = width;
        this.boundHeight = height;
        this.x = (0, MathUtil_1.clamp)(this.x, this.radius + 6, this.boundWidth - this.radius - 6);
        this.y = (0, MathUtil_1.clamp)(this.y, this.radius + 6, this.boundHeight - this.radius - 6);
    }
    reset() {
        this.x = this.boundWidth * 0.5;
        this.y = this.boundHeight * 0.5;
        this.radius = 18;
        this.maxHp = 120;
        this.hp = this.maxHp;
        this.baseSpeed = 220;
        this.level = 1;
        this.exp = 0;
        this.expToNext = ConfigManager_1.ConfigManager.getInstance().getLevelExp(1);
        this.elements.clear();
        this.ownedBaseWeaponIds.length = 0;
        Object.keys(this.currentWeaponByBase).forEach((key) => delete this.currentWeaponByBase[key]);
        Object.keys(this.weaponLevelByBase).forEach((key) => delete this.weaponLevelByBase[key]);
        this.mutationGenes.clear();
        this.appliedCharacterFusionIds.clear();
        this.passives.damageMultiplier = 1;
        this.passives.cooldownMultiplier = 1;
        this.passives.moveSpeedMultiplier = 1;
        this.passives.pickupRange = 70;
        this.passives.maxHpBonus = 0;
        this.lastMoveDir = { x: 1, y: 0 };
        this.frenzyTime = 0;
        this.damageImmuneTime = 0;
        this.damageImmuneMaxTime = 0;
        this.weaponDamageBonusByBase = {};
        this.weaponSkillIdsByBase = {};
        this.addWeapon("knife");
    }
    update(dt, moveVec) {
        if (moveVec.x !== 0 || moveVec.y !== 0) {
            this.lastMoveDir = Object.assign({}, moveVec);
        }
        const speed = this.getMoveSpeed();
        this.x += moveVec.x * speed * dt;
        this.y += moveVec.y * speed * dt;
        this.x = (0, MathUtil_1.clamp)(this.x, this.radius + 6, this.boundWidth - this.radius - 6);
        this.y = (0, MathUtil_1.clamp)(this.y, this.radius + 6, this.boundHeight - this.radius - 6);
        if (this.frenzyTime > 0) {
            this.frenzyTime -= dt;
            if (this.frenzyTime < 0) {
                this.frenzyTime = 0;
            }
        }
        if (this.damageImmuneTime > 0) {
            this.damageImmuneTime -= dt;
            if (this.damageImmuneTime <= 0) {
                this.damageImmuneTime = 0;
                this.damageImmuneMaxTime = 0;
            }
        }
    }
    isDead() {
        return this.hp <= 0;
    }
    receiveDamage(amount) {
        if (amount <= 0 || this.isDead() || this.damageImmuneTime > 0) {
            return false;
        }
        this.hp = Math.max(0, this.hp - amount);
        return true;
    }
    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }
    setHpRatio(ratio) {
        this.hp = Math.max(1, this.maxHp * ratio);
    }
    addExp(amount) {
        this.exp += amount;
        let levelUps = 0;
        while (this.exp >= this.expToNext) {
            this.exp -= this.expToNext;
            this.level += 1;
            levelUps += 1;
            this.expToNext = ConfigManager_1.ConfigManager.getInstance().getLevelExp(this.level);
        }
        return levelUps;
    }
    addWeapon(baseWeaponId) {
        if (this.ownedBaseWeaponIds.indexOf(baseWeaponId) >= 0) {
            return this.levelWeapon(baseWeaponId);
        }
        if (this.ownedBaseWeaponIds.length >= this.maxWeapons) {
            return false;
        }
        this.ownedBaseWeaponIds.push(baseWeaponId);
        this.currentWeaponByBase[baseWeaponId] = baseWeaponId;
        this.weaponLevelByBase[baseWeaponId] = 1;
        return true;
    }
    levelWeapon(baseWeaponId) {
        if (this.ownedBaseWeaponIds.indexOf(baseWeaponId) < 0) {
            return false;
        }
        const currentWeaponId = this.currentWeaponByBase[baseWeaponId];
        const maxLevel = ConfigManager_1.ConfigManager.getInstance().getWeapon(currentWeaponId).maxLevel;
        if (this.weaponLevelByBase[baseWeaponId] >= maxLevel) {
            return false;
        }
        this.weaponLevelByBase[baseWeaponId] += 1;
        return true;
    }
    evolveWeapon(baseWeaponId, evolvedWeaponId) {
        this.currentWeaponByBase[baseWeaponId] = evolvedWeaponId;
    }
    getCurrentWeaponIds() {
        return this.ownedBaseWeaponIds.map((baseId) => this.currentWeaponByBase[baseId]);
    }
    getWeaponLevel(baseWeaponId) {
        var _a;
        return (_a = this.weaponLevelByBase[baseWeaponId]) !== null && _a !== void 0 ? _a : 0;
    }
    hasElement(element) {
        return this.elements.has(element);
    }
    addElement(element) {
        if (this.elements.has(element)) {
            return false;
        }
        this.elements.add(element);
        return true;
    }
    applyPassive(id) {
        if (id === "passive_damage_1") {
            this.passives.damageMultiplier += 0.12;
            return true;
        }
        if (id === "passive_cooldown_1") {
            this.passives.cooldownMultiplier *= 0.9;
            return true;
        }
        if (id === "passive_movespeed_1") {
            this.passives.moveSpeedMultiplier += 0.12;
            return true;
        }
        if (id === "passive_pickup_1") {
            this.passives.pickupRange += 18;
            return true;
        }
        if (id === "passive_maxhp_1") {
            this.passives.maxHpBonus += 20;
            this.maxHp += 20;
            this.hp += 20;
            return true;
        }
        return false;
    }
    hasMutationGene(geneId) {
        return this.mutationGenes.has(geneId);
    }
    addMutationGene(geneId) {
        if (this.mutationGenes.has(geneId)) {
            return false;
        }
        this.mutationGenes.add(geneId);
        return true;
    }
    hasCharacterFusion(fusionId) {
        return this.appliedCharacterFusionIds.has(fusionId);
    }
    applyCharacterFusion(fusionId, effects) {
        if (this.appliedCharacterFusionIds.has(fusionId)) {
            return false;
        }
        this.appliedCharacterFusionIds.add(fusionId);
        if (effects.damageAdd) {
            this.passives.damageMultiplier += effects.damageAdd;
        }
        if (effects.cooldownMul) {
            this.passives.cooldownMultiplier *= effects.cooldownMul;
        }
        if (effects.moveSpeedAdd) {
            this.passives.moveSpeedMultiplier += effects.moveSpeedAdd;
        }
        if (effects.pickupAdd) {
            this.passives.pickupRange += effects.pickupAdd;
        }
        if (effects.maxHpAdd) {
            this.passives.maxHpBonus += effects.maxHpAdd;
            this.maxHp += effects.maxHpAdd;
            this.hp += effects.maxHpAdd;
        }
        if (effects.heal) {
            this.heal(effects.heal);
        }
        return true;
    }
    applyMetaUpgrades(effects) {
        if (effects.damageBonus > 0) {
            this.passives.damageMultiplier += effects.damageBonus;
        }
        if (effects.moveSpeedBonus > 0) {
            this.passives.moveSpeedMultiplier += effects.moveSpeedBonus;
        }
        if (effects.pickupBonus > 0) {
            this.passives.pickupRange += effects.pickupBonus;
        }
        if (effects.maxHpBonus > 0) {
            this.passives.maxHpBonus += effects.maxHpBonus;
            this.maxHp += effects.maxHpBonus;
            this.hp += effects.maxHpBonus;
        }
    }
    activateFrenzy(duration) {
        this.frenzyTime = Math.max(this.frenzyTime, duration);
    }
    isFrenzyActive() {
        return this.frenzyTime > 0;
    }
    activateDamageImmunity(duration) {
        if (duration <= 0) {
            return;
        }
        this.damageImmuneTime = Math.max(this.damageImmuneTime, duration);
        this.damageImmuneMaxTime = Math.max(this.damageImmuneMaxTime, this.damageImmuneTime);
    }
    isDamageImmune() {
        return this.damageImmuneTime > 0;
    }
    getDamageImmuneRatio() {
        if (this.damageImmuneMaxTime <= 0) {
            return 0;
        }
        return (0, MathUtil_1.clamp)(this.damageImmuneTime / this.damageImmuneMaxTime, 0, 1);
    }
    getDamageMultiplier() {
        const frenzyMul = this.isFrenzyActive() ? ConfigManager_1.ConfigManager.getInstance().getBalance().frenzyDamageMul : 1;
        return this.passives.damageMultiplier * frenzyMul;
    }
    setWeaponUpgradeRuntime(baseWeaponId, damageBonus, unlockedSkillIds) {
        this.weaponDamageBonusByBase[baseWeaponId] = Math.max(0, damageBonus || 0);
        this.weaponSkillIdsByBase[baseWeaponId] = new Set(unlockedSkillIds || []);
    }
    getWeaponDamageMultiplier(baseWeaponId) {
        return 1 + Math.max(0, this.weaponDamageBonusByBase[baseWeaponId] || 0);
    }
    hasWeaponSkill(baseWeaponId, skillId) {
        const set = this.weaponSkillIdsByBase[baseWeaponId];
        if (!set) {
            return false;
        }
        return set.has(skillId);
    }
    getCooldownMultiplier() {
        const frenzyMul = this.isFrenzyActive() ? ConfigManager_1.ConfigManager.getInstance().getBalance().frenzyCooldownMul : 1;
        return this.passives.cooldownMultiplier * frenzyMul;
    }
    getMoveSpeed() {
        return this.baseSpeed * this.passives.moveSpeedMultiplier;
    }
}
exports.Player = Player;
