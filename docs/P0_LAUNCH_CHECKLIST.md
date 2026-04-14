# P0 上线清单（执行版）

## 1. 广告接入（已实现代码能力）
- [ ] 在 `src/Data/upgradeConfig.ts` 设置 `adRuntimeMode`：
  - `mock`：仅模拟广告
  - `auto`：优先真实广告，失败回退 mock
  - `real`：仅真实广告（可关闭回退）
  - `disabled`：全关广告
- [ ] 填写 `adUnitIdByPlacement` 五个广告位 ID。
- [ ] 若未满足流量主条件，保持 `adRuntimeMode: "mock"`。
- [ ] 真机验证每个广告位：成功、失败、中断、冷却、最短时长门槛。

## 2. 真机性能验收
- [ ] 按 [device-acceptance.md](./performance/device-acceptance.md) 跑完整测试矩阵。
- [ ] 高压场景（怪物高峰 + 粒子高峰 + Boss 技能）稳定无连续卡死。
- [ ] 开启/关闭性能模式分别验证表现和可玩性。

## 3. 稳定性兜底
- [x] 主循环 update/render 已加异常保护与自动恢复。
- [x] 已接入 `wx.onError` / `wx.onUnhandledRejection` / `wx.onMemoryWarning` 埋点。
- [ ] 真机触发弱网、切后台、来电、低内存场景确认不黑屏/不死循环。
- [ ] 存档异常场景（写入失败/读取损坏）回归。

## 4. 合规材料
- [ ] 隐私政策：参考 [privacy-policy-template.md](./compliance/privacy-policy-template.md)
- [ ] 用户协议：参考 [user-agreement-template.md](./compliance/user-agreement-template.md)
- [ ] 小游戏后台填写隐私与数据使用说明（与文档一致）
- [ ] 若投放未成年人用户，补齐相关说明与限制策略

## 5. 发布前回归
- [ ] 按 [regression-test-cases.md](./testing/regression-test-cases.md) 全量回归。
- [ ] 回归必须覆盖：章节解锁、星级结算、首通奖励、每日系统、广告奖励。

## 6. 发布素材与配置
- [ ] 按 [materials-checklist.md](./release/materials-checklist.md) 准备素材。
- [ ] 校验小游戏后台配置：类目、简介、图标、截图、体验说明。
- [ ] 提审版本号与 changelog 同步。
