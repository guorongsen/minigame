import { Player } from "../entities/Player";
import { ConfigManager } from "../managers/ConfigManager";
import { CharacterMutationFusionConfig } from "../types";

/**
 * Character mutation fusion system: checks gene combinations and applies fused effects.
 */
export class CharacterMutationSystem {
  private readonly cfg = ConfigManager.getInstance();

  tryFuse(player: Player): CharacterMutationFusionConfig | null {
    for (const rule of this.cfg.getCharacterMutationFusions()) {
      if (player.hasCharacterFusion(rule.id)) {
        continue;
      }

      const ready = rule.requiresGeneIds.every((geneId) => player.hasMutationGene(geneId));
      if (!ready) {
        continue;
      }

      player.applyCharacterFusion(rule.id, rule.effects);
      return rule;
    }

    return null;
  }
}
