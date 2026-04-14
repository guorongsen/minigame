import { bossConfig, enemyConfigList } from "../Data/enemyConfig";
import { elementConfigList, elementConfigMap } from "../Data/elementConfig";
import { evolutionConfigList } from "../Data/evolutionConfig";
import { stageConfigList } from "../Data/stageConfig";
import { storyChapterConfigList } from "../Data/storyChapterConfig";
import { dailyChallengeTemplates } from "../Data/dailyChallengeConfig";
import { characterMutationFusions, characterMutationGenes } from "../Data/characterMutationConfig";
import {
  categoryBaseWeight,
  gameBalanceConfig,
  levelExpTable,
  maxWeaponsInRun,
  upgradeDefinitions
} from "../Data/upgradeConfig";
import { baseWeaponIds, weaponConfigList, weaponConfigMap } from "../Data/weaponConfig";
import {
  CharacterMutationFusionConfig,
  CharacterMutationGeneConfig,
  DailyChallengeTemplate,
  ElementType,
  EnemyConfig,
  EvolutionConfig,
  StageConfig,
  StoryChapterConfig,
  UpgradeDefinition,
  WeaponConfig
} from "../types";

/**
 * Centralized read-only game data registry.
 */
export class ConfigManager {
  private static instance: ConfigManager;

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  getWeapon(id: string): WeaponConfig {
    return weaponConfigMap[id];
  }

  getAllWeapons(): WeaponConfig[] {
    return weaponConfigList;
  }

  getBaseWeaponIds(): string[] {
    return baseWeaponIds;
  }

  getElement(id: ElementType) {
    return elementConfigMap[id];
  }

  getAllElements() {
    return elementConfigList;
  }

  getAllEvolutionRules(): EvolutionConfig[] {
    return evolutionConfigList;
  }

  getDailyChallengeTemplates(): DailyChallengeTemplate[] {
    return dailyChallengeTemplates;
  }

  getCharacterMutationGenes(): CharacterMutationGeneConfig[] {
    return characterMutationGenes;
  }

  getCharacterMutationFusions(): CharacterMutationFusionConfig[] {
    return characterMutationFusions;
  }

  getEnemyPool(): EnemyConfig[] {
    return enemyConfigList;
  }

  getBossConfig(): EnemyConfig {
    return bossConfig;
  }

  getStageConfigs(): StageConfig[] {
    return stageConfigList;
  }

  getStoryChapters(): StoryChapterConfig[] {
    return storyChapterConfigList;
  }

  getUpgradeDefinitions(): UpgradeDefinition[] {
    return upgradeDefinitions;
  }

  getCategoryBaseWeight() {
    return categoryBaseWeight;
  }

  getMaxWeaponsInRun(): number {
    return maxWeaponsInRun;
  }

  getLevelExp(level: number): number {
    if (level < levelExpTable.length) {
      return levelExpTable[level];
    }
    const extra = level - (levelExpTable.length - 1);
    return levelExpTable[levelExpTable.length - 1] + extra * 80;
  }

  getBalance() {
    return gameBalanceConfig;
  }
}
