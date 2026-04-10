import { ConfigManager } from "../managers/ConfigManager";
import { CharacterMutationFusionEffects, ElementType, MetaUpgradeEffects, PassiveStats, Vec2 } from "../types";
import { clamp } from "../utils/MathUtil";

/**
 * Player runtime model.
 */
export class Player {
  x = 0;
  y = 0;
  radius = 18;

  maxHp = 120;
  hp = 120;
  baseSpeed = 220;

  level = 1;
  exp = 0;
  expToNext = 22;

  readonly elements = new Set<ElementType>();
  readonly ownedBaseWeaponIds: string[] = [];
  readonly currentWeaponByBase: Record<string, string> = {};
  readonly weaponLevelByBase: Record<string, number> = {};

  readonly mutationGenes = new Set<string>();
  readonly appliedCharacterFusionIds = new Set<string>();

  readonly passives: PassiveStats = {
    damageMultiplier: 1,
    cooldownMultiplier: 1,
    moveSpeedMultiplier: 1,
    pickupRange: 70,
    maxHpBonus: 0
  };

  lastMoveDir: Vec2 = { x: 1, y: 0 };

  private frenzyTime = 0;
  private damageImmuneTime = 0;
  private damageImmuneMaxTime = 0;

  private boundWidth: number;
  private boundHeight: number;

  constructor(width: number, height: number, private readonly maxWeapons: number) {
    this.boundWidth = width;
    this.boundHeight = height;
    this.reset();
  }

  setBounds(width: number, height: number): void {
    this.boundWidth = width;
    this.boundHeight = height;

    this.x = clamp(this.x, this.radius + 6, this.boundWidth - this.radius - 6);
    this.y = clamp(this.y, this.radius + 6, this.boundHeight - this.radius - 6);
  }

  reset(): void {
    this.x = this.boundWidth * 0.5;
    this.y = this.boundHeight * 0.5;
    this.radius = 18;

    this.maxHp = 120;
    this.hp = this.maxHp;
    this.baseSpeed = 220;

    this.level = 1;
    this.exp = 0;
    this.expToNext = ConfigManager.getInstance().getLevelExp(1);

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

    this.addWeapon("knife");
  }

  update(dt: number, moveVec: Vec2): void {
    if (moveVec.x !== 0 || moveVec.y !== 0) {
      this.lastMoveDir = { ...moveVec };
    }

    const speed = this.getMoveSpeed();
    this.x += moveVec.x * speed * dt;
    this.y += moveVec.y * speed * dt;

    this.x = clamp(this.x, this.radius + 6, this.boundWidth - this.radius - 6);
    this.y = clamp(this.y, this.radius + 6, this.boundHeight - this.radius - 6);

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

  isDead(): boolean {
    return this.hp <= 0;
  }

  receiveDamage(amount: number): boolean {
    if (amount <= 0 || this.isDead() || this.damageImmuneTime > 0) {
      return false;
    }
    this.hp = Math.max(0, this.hp - amount);
    return true;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  setHpRatio(ratio: number): void {
    this.hp = Math.max(1, this.maxHp * ratio);
  }

  addExp(amount: number): number {
    this.exp += amount;
    let levelUps = 0;
    while (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.level += 1;
      levelUps += 1;
      this.expToNext = ConfigManager.getInstance().getLevelExp(this.level);
    }
    return levelUps;
  }

  addWeapon(baseWeaponId: string): boolean {
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

  levelWeapon(baseWeaponId: string): boolean {
    if (this.ownedBaseWeaponIds.indexOf(baseWeaponId) < 0) {
      return false;
    }
    const currentWeaponId = this.currentWeaponByBase[baseWeaponId];
    const maxLevel = ConfigManager.getInstance().getWeapon(currentWeaponId).maxLevel;
    if (this.weaponLevelByBase[baseWeaponId] >= maxLevel) {
      return false;
    }
    this.weaponLevelByBase[baseWeaponId] += 1;
    return true;
  }

  evolveWeapon(baseWeaponId: string, evolvedWeaponId: string): void {
    this.currentWeaponByBase[baseWeaponId] = evolvedWeaponId;
  }

  getCurrentWeaponIds(): string[] {
    return this.ownedBaseWeaponIds.map((baseId) => this.currentWeaponByBase[baseId]);
  }

  getWeaponLevel(baseWeaponId: string): number {
    return this.weaponLevelByBase[baseWeaponId] ?? 0;
  }

  hasElement(element: ElementType): boolean {
    return this.elements.has(element);
  }

  addElement(element: ElementType): boolean {
    if (this.elements.has(element)) {
      return false;
    }
    this.elements.add(element);
    return true;
  }

  applyPassive(id: string): boolean {
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

  hasMutationGene(geneId: string): boolean {
    return this.mutationGenes.has(geneId);
  }

  addMutationGene(geneId: string): boolean {
    if (this.mutationGenes.has(geneId)) {
      return false;
    }
    this.mutationGenes.add(geneId);
    return true;
  }

  hasCharacterFusion(fusionId: string): boolean {
    return this.appliedCharacterFusionIds.has(fusionId);
  }

  applyCharacterFusion(fusionId: string, effects: CharacterMutationFusionEffects): boolean {
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


  applyMetaUpgrades(effects: MetaUpgradeEffects): void {
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

  activateFrenzy(duration: number): void {
    this.frenzyTime = Math.max(this.frenzyTime, duration);
  }

  isFrenzyActive(): boolean {
    return this.frenzyTime > 0;
  }

  activateDamageImmunity(duration: number): void {
    if (duration <= 0) {
      return;
    }

    this.damageImmuneTime = Math.max(this.damageImmuneTime, duration);
    this.damageImmuneMaxTime = Math.max(this.damageImmuneMaxTime, this.damageImmuneTime);
  }

  isDamageImmune(): boolean {
    return this.damageImmuneTime > 0;
  }

  getDamageImmuneRatio(): number {
    if (this.damageImmuneMaxTime <= 0) {
      return 0;
    }
    return clamp(this.damageImmuneTime / this.damageImmuneMaxTime, 0, 1);
  }

  getDamageMultiplier(): number {
    const frenzyMul = this.isFrenzyActive() ? ConfigManager.getInstance().getBalance().frenzyDamageMul : 1;
    return this.passives.damageMultiplier * frenzyMul;
  }

  getCooldownMultiplier(): number {
    const frenzyMul = this.isFrenzyActive() ? ConfigManager.getInstance().getBalance().frenzyCooldownMul : 1;
    return this.passives.cooldownMultiplier * frenzyMul;
  }

  getMoveSpeed(): number {
    return this.baseSpeed * this.passives.moveSpeedMultiplier;
  }
}


