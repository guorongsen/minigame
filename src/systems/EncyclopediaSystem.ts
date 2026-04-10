import { ConfigManager } from "../managers/ConfigManager";
import { SaveManager } from "../managers/SaveManager";

/**
 * Read-only helper for evolution collection UI.
 */
export class EncyclopediaSystem {
  private readonly config = ConfigManager.getInstance();
  private readonly save = SaveManager.getInstance();

  getEntries(): Array<{
    id: string;
    name: string;
    description: string;
    unlocked: boolean;
    color: string;
  }> {
    return this.config.getAllEvolutionRules().map((rule) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      unlocked: this.save.isEvolutionUnlocked(rule.id),
      color: rule.color
    }));
  }

  unlockAllDebug(): void {
    const allIds = this.config.getAllEvolutionRules().map((rule) => rule.id);
    this.save.unlockAllEvolutionDebug(allIds);
  }
}
