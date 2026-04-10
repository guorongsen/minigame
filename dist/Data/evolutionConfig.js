"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evolutionByFromWeapon = exports.evolutionConfigList = void 0;
exports.evolutionConfigList = [
    {
        id: "evo_rule_knife_poison",
        name: "毒刃风暴",
        fromWeaponId: "knife",
        toWeaponId: "evo_poison_blade_storm",
        requiredElement: "poison",
        description: "飞刀 + 毒 => 环绕毒刃持续切割。",
        color: "#5df08f"
    },
    {
        id: "evo_rule_knife_lightning",
        name: "电弧飞刃",
        fromWeaponId: "knife",
        toWeaponId: "evo_thunder_arc_knives",
        requiredElement: "lightning",
        description: "飞刀 + 电 => 高速穿透电刃。",
        color: "#6ec2ff"
    },
    {
        id: "evo_rule_fireball_lightning",
        name: "雷火爆弹",
        fromWeaponId: "fireball",
        toWeaponId: "evo_thunderfire_bomb",
        requiredElement: "lightning",
        description: "火球 + 电 => 雷火连爆。",
        color: "#ffb347"
    },
    {
        id: "evo_rule_fireball_ice",
        name: "霜火法球",
        fromWeaponId: "fireball",
        toWeaponId: "evo_frostfire_orb",
        requiredElement: "ice",
        description: "火球 + 冰 => 霜火混合巨球。",
        color: "#ffa6f0"
    },
    {
        id: "evo_rule_shockwave_ice",
        name: "冰爆震荡",
        fromWeaponId: "shockwave",
        toWeaponId: "evo_ice_quake",
        requiredElement: "ice",
        description: "冲击波 + 冰 => 大范围冰震。",
        color: "#9af2ff"
    },
    {
        id: "evo_rule_shockwave_poison",
        name: "剧毒震波",
        fromWeaponId: "shockwave",
        toWeaponId: "evo_toxic_wave",
        requiredElement: "poison",
        description: "冲击波 + 毒 => 持续毒环扩散。",
        color: "#82ff9b"
    },
    {
        id: "evo_rule_laser_poison",
        name: "腐蚀射线",
        fromWeaponId: "laser",
        toWeaponId: "evo_corrosion_ray",
        requiredElement: "poison",
        description: "激光 + 毒 => 腐蚀光束。",
        color: "#9fff9b"
    },
    {
        id: "evo_rule_laser_fire",
        name: "烈阳光矛",
        fromWeaponId: "laser",
        toWeaponId: "evo_solar_lance",
        requiredElement: "fire",
        description: "激光 + 火 => 烈阳光矛。",
        color: "#ffd86f"
    },
    {
        id: "evo_rule_punch_fire",
        name: "烈焰拳浪",
        fromWeaponId: "punch",
        toWeaponId: "evo_blaze_punch",
        requiredElement: "fire",
        description: "拳风 + 火 => 烈焰拳浪。",
        color: "#ff9c5a"
    },
    {
        id: "evo_rule_punch_lightning",
        name: "雷霆拳浪",
        fromWeaponId: "punch",
        toWeaponId: "evo_storm_punch",
        requiredElement: "lightning",
        description: "拳风 + 电 => 雷霆连拳。",
        color: "#86f3ff"
    },
    {
        id: "evo_rule_laser_level5",
        name: "棱镜激光",
        fromWeaponId: "laser",
        toWeaponId: "evo_prism_laser",
        requiredWeaponLevel: 5,
        description: "激光 5级 => 棱镜分裂激光。",
        color: "#fff8d8"
    },
    {
        id: "evo_rule_knife_level5",
        name: "影袭飞刃",
        fromWeaponId: "knife",
        toWeaponId: "evo_shadow_daggers",
        requiredWeaponLevel: 5,
        description: "飞刀 5级 => 影袭飞刃爆发。",
        color: "#bca8ff"
    }
];
exports.evolutionByFromWeapon = exports.evolutionConfigList.reduce((map, item) => {
    if (!map[item.fromWeaponId]) {
        map[item.fromWeaponId] = [];
    }
    map[item.fromWeaponId].push(item);
    return map;
}, {});
