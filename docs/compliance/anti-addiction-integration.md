# 防沉迷接入说明（客户端）

## 1. 已实现能力

- 客户端实名门禁：未实名不可开局。
- 人脸门禁：`requireFaceVerify=true` 时，需人脸核验通过才可开局。
- 未成年时长限制：按日累计时长，超限后强制结束当前对局。
- 未成年宵禁限制：按配置时段放行，非放行时段不可开局。
- 未成年付费限制：提供单笔/单月限额校验与记账接口（用于真实支付前拦截）。
- 每日上报：防沉迷日报本地排队并自动重试上报。

## 2. 配置入口

文件：`src/Data/upgradeConfig.ts` -> `gameBalanceConfig.antiAddiction`

关键字段：

- `enabled`: 开关
- `providerMode`: `auto | backend | mock | disabled`
- `strictWithoutBackend`: 未配置后端时是否强制拦截
- `authEndpoint`: 实名认证接口
- `faceVerifyEndpoint`: 人脸核验接口
- `reportEndpoint`: 每日上报接口
- `enforcePlaytime / enforceCurfew / enforcePayment`: 三类限制开关
- `minorDailySeconds`: 每日时长上限
- `minorAllowedWeekdays + minorAllowedWindows`: 未成年可玩时段
- `holidayDateList / workdayDateList`: 节假日与调休覆盖
- `paymentLimitFen`: 未成年人付费限额（分）

## 3. 后端接口约定（建议）

### 3.1 实名认证 `authEndpoint`

请求：

```json
{
  "code": "wx.login code",
  "trigger": "auto|manual",
  "scene": "mini_game",
  "clientTs": 1710000000000
}
```

响应：

```json
{
  "ok": true,
  "message": "ok",
  "realnameVerified": true,
  "isMinor": false,
  "ageGroup": "adult",
  "needFaceVerify": false,
  "faceVerified": true,
  "providerUid": "uid_xxx"
}
```

### 3.2 人脸核验 `faceVerifyEndpoint`

请求同上；响应字段同实名认证。

### 3.3 每日上报 `reportEndpoint`

请求：

```json
{
  "reportDate": "2026-04-13",
  "generatedAt": 1710000000000,
  "trigger": "run_end",
  "realnameVerified": true,
  "faceVerified": true,
  "needFaceVerify": false,
  "isMinor": false,
  "ageGroup": "adult",
  "playSeconds": 1800,
  "playLimitSeconds": 3600,
  "playRemainSeconds": 1800,
  "monthPaidFen": 0,
  "blocked": {}
}
```

## 4. 验收清单（提审前）

- 真机验证未实名拦截。
- 真机验证需人脸拦截与核验后放行。
- 真机验证未成年宵禁拦截。
- 真机验证未成年时长到点强制结束。
- 真机验证未成年付费超单笔/超月限拦截。
- 真机验证每日上报成功、失败重试成功。
- 输出一份真机录屏与接口日志，作为提审附件。
