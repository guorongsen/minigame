"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.characterMutationFusions = exports.characterMutationGenes = void 0;
exports.characterMutationGenes = [
    {
        id: "gene_fury",
        name: "狂怒基因",
        color: "#ff8a7a",
        description: "提升爆发伤害潜力。"
    },
    {
        id: "gene_guard",
        name: "铁壁基因",
        color: "#7ad6ff",
        description: "强化生命与生存能力。"
    },
    {
        id: "gene_sprint",
        name: "猎行基因",
        color: "#9eff9a",
        description: "增强机动与拉扯能力。"
    },
    {
        id: "gene_focus",
        name: "聚能基因",
        color: "#ffd67b",
        description: "压缩攻击间隔，提高输出频率。"
    }
];
exports.characterMutationFusions = [
    {
        id: "fusion_overload_core",
        name: "过载心核",
        requiresGeneIds: ["gene_fury", "gene_focus"],
        color: "#ffb57a",
        description: "狂怒 + 聚能：伤害与攻速同时爆发。",
        effects: {
            damageAdd: 0.2,
            cooldownMul: 0.9
        }
    },
    {
        id: "fusion_titan_stride",
        name: "泰坦步态",
        requiresGeneIds: ["gene_guard", "gene_sprint"],
        color: "#8fd5ff",
        description: "铁壁 + 猎行：更肉更快，持续作战更稳。",
        effects: {
            maxHpAdd: 34,
            moveSpeedAdd: 0.14
        }
    },
    {
        id: "fusion_berserk_hide",
        name: "狂战外壳",
        requiresGeneIds: ["gene_fury", "gene_guard"],
        color: "#ff9eb1",
        description: "狂怒 + 铁壁：兼顾硬度和进攻。",
        effects: {
            damageAdd: 0.15,
            maxHpAdd: 26
        }
    },
    {
        id: "fusion_neural_accel",
        name: "神经加速",
        requiresGeneIds: ["gene_focus", "gene_sprint"],
        color: "#b4ffe4",
        description: "聚能 + 猎行：攻速与位移双线强化。",
        effects: {
            cooldownMul: 0.88,
            moveSpeedAdd: 0.1
        }
    },
    {
        id: "fusion_predator_form",
        name: "掀食形态",
        requiresGeneIds: ["gene_fury", "gene_sprint"],
        color: "#ffc37d",
        description: "狂怒 + 猎行：滚雪球更快，清场效率更高。",
        effects: {
            damageAdd: 0.12,
            pickupAdd: 22
        }
    },
    {
        id: "fusion_living_fortress",
        name: "生体要塞",
        requiresGeneIds: ["gene_guard", "gene_focus"],
        color: "#d2d9ff",
        description: "铁壁 + 聚能：稳态输出并获得战场续航。",
        effects: {
            maxHpAdd: 30,
            cooldownMul: 0.92,
            heal: 18
        }
    }
];
