# HI Design 素材清单（首版）

> 目标：用于“进化幸存者”高保真 UI 与战斗表现升级。

## 0) 第一批（人物与怪物贴图必需）

> 用于“先完成人物和怪物贴图接入”的最小闭环。优先收齐以下 10 张。

| 素材名 | 作用 | 建议规格 |
|---|---|---|
| `char_player_main_v1.png` | 玩家主贴图，替换当前战斗中的玩家圆形绘制。 | 512x512，PNG 透明 |
| `enemy_slime_main_v1.png` | 普通怪类型 `slime` 主贴图。 | 512x512，PNG 透明 |
| `enemy_hound_main_v1.png` | 普通怪类型 `hound` 主贴图。 | 512x512，PNG 透明 |
| `enemy_spitter_main_v1.png` | 远程怪类型 `spitter` 主贴图。 | 512x512，PNG 透明 |
| `enemy_brute_main_v1.png` | 高血量怪类型 `brute` 主贴图。 | 512x512，PNG 透明 |
| `enemy_shield_guard_main_v1.png` | 护盾怪类型 `shield_guard` 主贴图。 | 512x512，PNG 透明 |
| `enemy_swift_stalker_main_v1.png` | 迅捷怪类型 `swift_stalker` 主贴图。 | 512x512，PNG 透明 |
| `boss_main_v1.png` | 首领主贴图，替换 Boss 圆形绘制。 | 768x768，PNG 透明 |
| `enemy_elite_overlay_v1.png` | 精英怪叠加标记（覆盖到任意怪物上，区分精英）。 | 256x256，PNG 透明 |
| `shadow_soft_round_v1.png` | 通用脚下阴影（玩家/普通怪/Boss 共用），增强贴地感。 | 256x256，PNG 透明 |

### 第一批统一规范

1. 透明背景：`PNG + RGBA`，不要底色。
2. 视角统一：俯视/半俯视，与当前玩法一致。
3. 主体居中：四周留 8%~12% 安全边距，避免裁切。
4. 轮廓清晰：移动端小尺寸下仍能辨认角色类型。
5. 禁止内容：文字、Logo、水印、复杂背景。

## 1) 首页与菜单视觉

1. `bg_lobby_cinematic_v1.jpg`
   - 用途：开始页主背景（全屏）
   - 建议规格：1080x1920，JPG，< 450KB

2. `bg_lobby_overlay_noise_v1.png`
   - 用途：开始页叠加质感（轻颗粒）
   - 建议规格：1080x1920，PNG 透明，< 300KB

3. `logo_evolution_survivor_cn_v1.png`
   - 用途：游戏标题 Logo（中文）
   - 建议规格：1200x500，PNG 透明，< 250KB

## 2) HUD 与图标

1. `icon_dna_currency_v1.png`
   - 用途：DNA 货币图标
   - 建议规格：128x128，PNG 透明

2. `icon_hp_hex_v1.png`
   - 用途：HP 区域装饰图标
   - 建议规格：96x96，PNG 透明

3. `icon_exp_orb_v1.png`
   - 用途：EXP 区域装饰图标
   - 建议规格：96x96，PNG 透明

4. `icon_pause_glass_v1.png`
   - 用途：暂停按钮图标
   - 建议规格：96x96，PNG 透明

5. `icon_mode_story_v1.png`
   - 用途：模式页-标准模式图标
   - 建议规格：128x128，PNG 透明

6. `icon_mode_endless_v1.png`
   - 用途：模式页-无尽模式图标
   - 建议规格：128x128，PNG 透明

7. `icon_mode_daily_v1.png`
   - 用途：模式页-每日挑战图标
   - 建议规格：128x128，PNG 透明

## 3) 按钮与面板皮肤

1. `panel_glass_primary_9slice_v1.png`
   - 用途：主面板九宫格皮肤
   - 建议规格：512x512，PNG 透明

2. `panel_glass_secondary_9slice_v1.png`
   - 用途：次级面板九宫格皮肤
   - 建议规格：512x512，PNG 透明

3. `btn_primary_cyan_9slice_v1.png`
   - 用途：主按钮（开始战斗、确认）
   - 建议规格：256x96，PNG 透明

4. `btn_warn_amber_9slice_v1.png`
   - 用途：广告按钮/提示操作
   - 建议规格：256x96，PNG 透明

5. `btn_danger_red_9slice_v1.png`
   - 用途：危险操作（重置、退出）
   - 建议规格：256x96，PNG 透明

## 4) 战斗场景素材

1. `bg_battle_floor_tile_v1.png`
   - 用途：战斗地板平铺纹理
   - 建议规格：512x512，PNG

2. `fx_ring_spawn_v1.png`
   - 用途：精英/首领登场环形特效
   - 建议规格：512x512，PNG 透明

3. `fx_hit_flash_v1.png`
   - 用途：受击闪光贴图
   - 建议规格：256x256，PNG 透明

4. `fx_evolution_burst_v1.png`
   - 用途：进化触发爆发特效
   - 建议规格：1024x1024，PNG 透明

5. `fx_warning_sector_v1.png`
   - 用途：Boss 危险区预警贴图
   - 建议规格：1024x1024，PNG 透明

## 5) 模态弹窗素材

1. `panel_upgrade_header_v1.png`
   - 用途：升级弹窗顶部装饰
   - 建议规格：1024x180，PNG 透明

2. `panel_chest_header_v1.png`
   - 用途：宝箱弹窗顶部装饰
   - 建议规格：1024x180，PNG 透明

3. `panel_settlement_header_v1.png`
   - 用途：结算弹窗顶部装饰
   - 建议规格：1024x180，PNG 透明

4. `badge_star_gold_v1.png`
   - 用途：章节星级展示
   - 建议规格：128x128，PNG 透明

## 6) 字体与品牌（可选但强建议）

1. `font_display_cn_bold.otf`
   - 用途：标题、大按钮文本
   - 要求：可商用中文字体

2. `font_ui_cn_regular.otf`
   - 用途：UI 正文、说明文本
   - 要求：可商用中文字体

## 命名规范

- 格式：`[category]_[usage]_[style]_v1.[ext]`
- 示例：`icon_dna_currency_v1.png`
- 后续版本递增：`v2`, `v3`。

## 交付建议

1. 首批优先给：`bg_lobby_cinematic_v1.jpg`、`logo_evolution_survivor_cn_v1.png`、`icon_dna_currency_v1.png`、`btn_primary_cyan_9slice_v1.png`。
2. 若素材暂时不齐，可先用当前代码中的程序化渐变占位，我可以逐批替换为正式素材。
