import { ConfigManager } from "../managers/ConfigManager";
import { Player } from "../entities/Player";
import { ChestMutationRollResult, UpgradeDefinition, UpgradeOption } from "../types";
import { pickWeighted } from "../utils/MathUtil";

export interface UpgradeApplyHooks {
  onWeaponAdded: (baseWeaponId: string) => void;
  onFeedback: (text: string, color?: string) => void;
}

export interface UpgradeGenerateContext {
  forceEvolutionAssist?: boolean;
}

export interface UpgradeGenerateResult {
  options: UpgradeOption[];
  forcedEvolutionAssist: boolean;
}

interface Candidate {
  key: string;
  weight: number;
  option: UpgradeOption;
  supportsEvolution: boolean;
  evolutionScore: number;
}

/**
 * Weighted choice generator for level-up and chest mutation rewards.
 */
export class UpgradeSystem {
  private readonly cfg = ConfigManager.getInstance();

  generateLevelUpOptions(
    player: Player,
    hooks: UpgradeApplyHooks,
    count = 3,
    context?: UpgradeGenerateContext
  ): UpgradeGenerateResult {
    const candidates = this.buildCandidates(player, hooks);
    return this.pickUnique(candidates, count, context);
  }

  /**
   * Compatibility method: legacy chest API now maps to mutation chest pool.
   */
  generateChestOptions(
    player: Player,
    hooks: UpgradeApplyHooks,
    boosted = false,
    context?: UpgradeGenerateContext
  ): UpgradeGenerateResult {
    const roll = this.generateChestMutationOptions(player, hooks, boosted, context);
    return {
      options: [...roll.weaponOptions, ...roll.characterOptions],
      forcedEvolutionAssist: roll.forcedWeaponEvolutionAssist
    };
  }

  generateChestMutationOptions(
    player: Player,
    hooks: UpgradeApplyHooks,
    boosted = false,
    context?: UpgradeGenerateContext
  ): ChestMutationRollResult {
    const allCandidates = this.buildCandidates(player, hooks);
    const weaponCandidates = allCandidates.filter((candidate) => {
      const c = candidate.option.category;
      return c === "new_weapon" || c === "weapon_level" || c === "element";
    });

    const weaponCount = boosted ? 2 : 1;
    const weaponRoll = this.pickUnique(weaponCandidates, weaponCount, {
      forceEvolutionAssist: !!context?.forceEvolutionAssist
    });

    const characterCandidates = this.buildCharacterMutationCandidates(player, hooks);
    const characterCount = boosted ? 2 : 1;
    const characterRoll = this.pickUnique(characterCandidates, characterCount);

    return {
      weaponOptions: weaponRoll.options,
      characterOptions: characterRoll.options,
      forcedWeaponEvolutionAssist: weaponRoll.forcedEvolutionAssist
    };
  }

  generateExtraAdOption(player: Player, hooks: UpgradeApplyHooks, existingIds: string[]): UpgradeOption | null {
    const candidates = this.buildCandidates(player, hooks).filter((candidate) => {
      return existingIds.indexOf(candidate.option.id) < 0;
    });
    const picks = this.pickUnique(candidates, 1);
    return picks.options.length > 0 ? picks.options[0] : null;
  }

  private buildCandidates(player: Player, hooks: UpgradeApplyHooks): Candidate[] {
    const categoryWeight = this.cfg.getCategoryBaseWeight();
    const candidates: Candidate[] = [];

    const baseWeaponIds = this.cfg.getBaseWeaponIds();
    for (const baseId of baseWeaponIds) {
      const weapon = this.cfg.getWeapon(baseId);
      const owned = player.ownedBaseWeaponIds.indexOf(baseId) >= 0;

      if (!owned && player.ownedBaseWeaponIds.length < this.cfg.getMaxWeaponsInRun()) {
        candidates.push({
          key: `new_weapon_${baseId}`,
          weight: categoryWeight.new_weapon * (player.ownedBaseWeaponIds.length < 2 ? 1.35 : 1),
          supportsEvolution: false,
          evolutionScore: 0,
          option: {
            id: `new_weapon_${baseId}`,
            title: `新武器：${weapon.name}`,
            description: weapon.description,
            category: "new_weapon",
            color: weapon.color,
            apply: () => {
              if (player.addWeapon(baseId)) {
                hooks.onWeaponAdded(baseId);
                hooks.onFeedback(`已解锁 ${weapon.name}`, weapon.color);
              }
            }
          }
        });
      }

      if (owned) {
        const level = player.getWeaponLevel(baseId);
        const currentWeaponId = player.currentWeaponByBase[baseId];
        const maxLevel = this.cfg.getWeapon(currentWeaponId).maxLevel;
        if (level < maxLevel) {
          const support = this.getWeaponLevelEvolutionSupport(player, baseId, level + 1);
          candidates.push({
            key: `weapon_level_${baseId}`,
            weight: categoryWeight.weapon_level * (1 + (6 - level) * 0.08),
            supportsEvolution: support.supports,
            evolutionScore: support.score,
            option: {
              id: `weapon_level_${baseId}`,
              title: `${this.cfg.getWeapon(currentWeaponId).name} +1\u7ea7`,
              description: `当前等级 ${level} -> ${level + 1}`,
              category: "weapon_level",
              color: this.cfg.getWeapon(currentWeaponId).color,
              apply: () => {
                if (player.levelWeapon(baseId)) {
                  hooks.onFeedback(
                    `${this.cfg.getWeapon(currentWeaponId).name} \u5347\u81f3${level + 1}\u7ea7`,
                    this.cfg.getWeapon(currentWeaponId).color
                  );
                }
              }
            }
          });
        }
      }
    }

    for (const element of this.cfg.getAllElements()) {
      if (player.hasElement(element.id)) {
        continue;
      }

      const support = this.getElementEvolutionSupport(player, element.id);
      let synergyBonus = 1;
      if (support.supports) {
        synergyBonus += Math.min(0.65, support.score / 200);
      }

      candidates.push({
        key: `element_${element.id}`,
        weight: categoryWeight.element * synergyBonus,
        supportsEvolution: support.supports,
        evolutionScore: support.score,
        option: {
          id: `element_${element.id}`,
          title: `元素附加：${element.name}`,
          description: element.description,
          category: "element",
          color: element.color,
          apply: () => {
            if (player.addElement(element.id)) {
              hooks.onFeedback(`已附加元素：${element.name}`, element.color);
            }
          }
        }
      });
    }

    for (const def of this.cfg.getUpgradeDefinitions()) {
      const weight = def.weight * this.getDefinitionWeightMultiplier(player, def);
      if (weight <= 0) {
        continue;
      }

      candidates.push({
        key: def.id,
        weight: categoryWeight[def.category] * weight,
        supportsEvolution: false,
        evolutionScore: 0,
        option: {
          id: def.id,
          title: def.title,
          description: def.description,
          category: def.category,
          color: def.color,
          apply: () => {
            this.applyDefinition(def, player, hooks);
          }
        }
      });
    }

    return candidates;
  }

  private buildCharacterMutationCandidates(player: Player, hooks: UpgradeApplyHooks): Candidate[] {
    const candidates: Candidate[] = [];

    for (const gene of this.cfg.getCharacterMutationGenes()) {
      if (player.hasMutationGene(gene.id)) {
        continue;
      }

      const supportScore = this.getCharacterFusionSupportScore(player, gene.id);
      const weight = 2.1 + Math.min(1.2, supportScore * 0.28);

      candidates.push({
        key: `mutation_gene_${gene.id}`,
        weight,
        supportsEvolution: false,
        evolutionScore: 0,
        option: {
          id: `mutation_gene_${gene.id}`,
          title: `人物变异：${gene.name}`,
          description: gene.description,
          category: "passive",
          color: gene.color,
          apply: () => {
            if (player.addMutationGene(gene.id)) {
              hooks.onFeedback(`人物变异获得：${gene.name}`, gene.color);
            }
          }
        }
      });
    }

    // If all genes are obtained, fallback to short-term mutation buff candidates.
    if (candidates.length === 0) {
      candidates.push({
        key: "mutation_buff_frenzy",
        weight: 1,
        supportsEvolution: false,
        evolutionScore: 0,
        option: {
          id: "mutation_buff_frenzy",
          title: "人物变异：狂热注入",
          description: "立即进入狂热 12 秒。",
          category: "temp_buff",
          color: "#ffd37a",
          apply: () => {
            player.activateFrenzy(this.cfg.getBalance().frenzyDuration);
            hooks.onFeedback("人物变异触发：狂热注入", "#ffd37a");
          }
        }
      });
    }

    return candidates;
  }

  private getCharacterFusionSupportScore(player: Player, geneId: string): number {
    let score = 0;

    for (const rule of this.cfg.getCharacterMutationFusions()) {
      if (player.hasCharacterFusion(rule.id)) {
        continue;
      }
      if (rule.requiresGeneIds.indexOf(geneId) < 0) {
        continue;
      }

      const ownedCount = rule.requiresGeneIds.filter((id) => player.hasMutationGene(id)).length;
      if (ownedCount >= rule.requiresGeneIds.length - 1) {
        score = Math.max(score, 4);
      } else if (ownedCount > 0) {
        score = Math.max(score, 2);
      } else {
        score = Math.max(score, 1);
      }
    }

    return score;
  }

  private getElementEvolutionSupport(
    player: Player,
    elementId: string
  ): {
    supports: boolean;
    score: number;
  } {
    let score = 0;

    for (const rule of this.cfg.getAllEvolutionRules()) {
      if (rule.requiredElement !== elementId) {
        continue;
      }
      if (player.ownedBaseWeaponIds.indexOf(rule.fromWeaponId) < 0) {
        continue;
      }
      if (player.currentWeaponByBase[rule.fromWeaponId] !== rule.fromWeaponId) {
        continue;
      }

      const level = player.getWeaponLevel(rule.fromWeaponId);
      const requiredLevel = rule.requiredWeaponLevel || 1;

      if (level >= requiredLevel) {
        score = Math.max(score, 125);
      } else {
        const gap = requiredLevel - level;
        score = Math.max(score, 85 - gap * 11);
      }
    }

    return {
      supports: score > 0,
      score
    };
  }

  private getWeaponLevelEvolutionSupport(
    player: Player,
    baseWeaponId: string,
    nextLevel: number
  ): {
    supports: boolean;
    score: number;
  } {
    if (player.currentWeaponByBase[baseWeaponId] !== baseWeaponId) {
      return { supports: false, score: 0 };
    }

    let score = 0;
    for (const rule of this.cfg.getAllEvolutionRules()) {
      if (rule.fromWeaponId !== baseWeaponId || !rule.requiredWeaponLevel) {
        continue;
      }

      const requiredLevel = rule.requiredWeaponLevel;
      if (nextLevel <= player.getWeaponLevel(baseWeaponId)) {
        continue;
      }

      if (nextLevel >= requiredLevel) {
        const elementReady = !rule.requiredElement || player.hasElement(rule.requiredElement);
        score = Math.max(score, elementReady ? 120 : 88);
      } else {
        const gap = requiredLevel - nextLevel;
        let baseScore = 62 - gap * 10;
        if (rule.requiredElement && player.hasElement(rule.requiredElement)) {
          baseScore += 12;
        }
        score = Math.max(score, baseScore);
      }
    }

    return {
      supports: score > 0,
      score
    };
  }

  private getDefinitionWeightMultiplier(player: Player, def: UpgradeDefinition): number {
    if (def.id === "recovery_heal_30") {
      const hpRatio = player.hp / player.maxHp;
      return hpRatio < 0.55 ? 1.5 : 0.6;
    }
    return 1;
  }

  private applyDefinition(def: UpgradeDefinition, player: Player, hooks: UpgradeApplyHooks): void {
    if (def.category === "passive") {
      if (player.applyPassive(def.id)) {
        hooks.onFeedback(def.title, def.color);
      }
      return;
    }

    if (def.id === "recovery_heal_30") {
      player.heal(30);
      hooks.onFeedback("恢复 30 点生命", "#7affbe");
      return;
    }

    if (def.id === "temp_buff_frenzy") {
      player.activateFrenzy(this.cfg.getBalance().frenzyDuration);
      hooks.onFeedback("狂热状态已激活", "#ffd37a");
    }
  }

  private pickUnique(candidates: Candidate[], count: number, context?: UpgradeGenerateContext): UpgradeGenerateResult {
    const pool = [...candidates];
    const selected: Candidate[] = [];

    while (selected.length < count && pool.length > 0) {
      const picked = pickWeighted(pool, (item) => item.weight);
      if (!picked) {
        break;
      }
      selected.push(picked);

      const index = pool.indexOf(picked);
      if (index >= 0) {
        pool.splice(index, 1);
      }
    }

    let forcedEvolutionAssist = false;
    if (context?.forceEvolutionAssist && selected.length > 0 && !selected.some((item) => item.supportsEvolution)) {
      const supportCandidates = candidates
        .filter((item) => {
          return item.supportsEvolution && selected.every((selectedItem) => selectedItem.option.id !== item.option.id);
        })
        .sort((a, b) => {
          if (b.evolutionScore !== a.evolutionScore) {
            return b.evolutionScore - a.evolutionScore;
          }
          return b.weight - a.weight;
        });

      if (supportCandidates.length > 0) {
        selected[selected.length - 1] = supportCandidates[0];
        forcedEvolutionAssist = true;
      }
    }

    return {
      options: selected.map((item) => item.option),
      forcedEvolutionAssist
    };
  }
}
