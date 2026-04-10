import { ElementConfig, ElementType } from "../types";

export const elementConfigList: ElementConfig[] = [
  {
    id: "fire",
    name: "火",
    color: "#ff7a45",
    description: "强化爆发与灼烧风格。"
  },
  {
    id: "ice",
    name: "冰",
    color: "#7fd9ff",
    description: "强化控场与减速压制。"
  },
  {
    id: "lightning",
    name: "电",
    color: "#ffe65e",
    description: "强调高速打击与连锁效果。"
  },
  {
    id: "poison",
    name: "毒",
    color: "#7eff9a",
    description: "持续压制并附带腐蚀风格。"
  }
];

export const elementConfigMap: Record<ElementType, ElementConfig> = elementConfigList.reduce((map, item) => {
  map[item.id] = item;
  return map;
}, {} as Record<ElementType, ElementConfig>);

