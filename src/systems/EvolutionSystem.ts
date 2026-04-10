import { EvolutionConfig } from "../types";
import { ConfigManager } from "../managers/ConfigManager";
import { SaveManager } from "../managers/SaveManager";
import { Player } from "../entities/Player";

export interface EvolutionResult {
  rule: EvolutionConfig;
  fromWeaponId: string;
  toWeaponId: string;
}

/**
 * Checks evolution rules and performs weapon replacement.
 */
export class EvolutionSystem {
  private readonly rules: EvolutionConfig[];
  private readonly saveManager: SaveManager;

  constructor() {
    this.rules = ConfigManager.getInstance().getAllEvolutionRules();
    this.saveManager = SaveManager.getInstance();
  }

  tryEvolve(player: Player): EvolutionResult | null {
    for (const baseId of player.ownedBaseWeaponIds) {
      const currentWeaponId = player.currentWeaponByBase[baseId];
      if (currentWeaponId !== baseId) {
        continue;
      }

      const matched = this.rules.find((rule) => {
        if (rule.fromWeaponId !== baseId) {
          return false;
        }
        if (rule.requiredElement && !player.hasElement(rule.requiredElement)) {
          return false;
        }
        if (rule.requiredWeaponLevel && player.getWeaponLevel(baseId) < rule.requiredWeaponLevel) {
          return false;
        }
        return true;
      });

      if (matched) {
        player.evolveWeapon(baseId, matched.toWeaponId);
        this.saveManager.unlockEvolution(matched.id);
        return {
          rule: matched,
          fromWeaponId: baseId,
          toWeaponId: matched.toWeaponId
        };
      }
    }

    return null;
  }

  getRules(): EvolutionConfig[] {
    return this.rules;
  }
}
