import { ConfigManager } from "./ConfigManager";
import { AnalyticsManager } from "./AnalyticsManager";
import {
  AntiAddictionAgeGroup,
  AntiAddictionGateResult,
  AntiAddictionStatusSnapshot
} from "../types";

type AntiAddictionProviderMode = "mock" | "backend" | "auto" | "disabled";

type AntiAddictionPaymentBlockReason =
  | "realname_required"
  | "face_verify_required"
  | "curfew"
  | "playtime_limit"
  | "payment_single_limit"
  | "payment_monthly_limit"
  | "payment_disabled"
  | "invalid_amount";

interface AntiAddictionPaymentGateResult {
  ok: boolean;
  reason?: AntiAddictionPaymentBlockReason;
  message: string;
  remainFen?: number;
}

interface AntiAddictionProfile {
  realnameVerified: boolean;
  faceVerified: boolean;
  needFaceVerify: boolean;
  isMinor: boolean;
  ageGroup: AntiAddictionAgeGroup;
  providerUid: string;
  updatedAt: number;
}

interface AntiAddictionDailyReport {
  dateKey: string;
  generatedAt: number;
  trigger: string;
  realnameVerified: boolean;
  faceVerified: boolean;
  needFaceVerify: boolean;
  isMinor: boolean;
  ageGroup: AntiAddictionAgeGroup;
  playSeconds: number;
  playLimitSeconds: number;
  playRemainSeconds: number;
  monthPaidFen: number;
  blocked: Record<string, number>;
}

interface AntiAddictionStorageData {
  version: number;
  profile: AntiAddictionProfile;
  playSecondsByDate: Record<string, number>;
  paymentFenByMonth: Record<string, number>;
  blockedByDate: Record<string, Record<string, number>>;
  pendingReports: AntiAddictionDailyReport[];
}

interface AntiAddictionRuntimeConfig {
  enabled: boolean;
  providerMode: AntiAddictionProviderMode;
  strictWithoutBackend: boolean;
  autoAuthOnBoot: boolean;
  authEndpoint: string;
  faceVerifyEndpoint: string;
  reportEndpoint: string;
  reportAuthToken: string;
  enforcePlaytime: boolean;
  enforceCurfew: boolean;
  enforcePayment: boolean;
  requireFaceVerify: boolean;
  minorDailySeconds: number;
  minorAllowedWeekdays: number[];
  minorAllowedWindows: Array<{ startMinutes: number; endMinutes: number }>;
  holidayDateList: string[];
  workdayDateList: string[];
  paymentLimitFen: {
    under8: { single: number; monthly: number };
    age8to15: { single: number; monthly: number };
    age16to17: { single: number; monthly: number };
  };
  mockProfile: Partial<AntiAddictionProfile>;
}

interface RealnameAuthResponse {
  ok: boolean;
  message?: string;
  realnameVerified?: boolean;
  faceVerified?: boolean;
  needFaceVerify?: boolean;
  isMinor?: boolean;
  ageGroup?: AntiAddictionAgeGroup | string;
  providerUid?: string;
}

const STORAGE_KEY = "evolution_survivor_anti_addiction_v1";
const STORAGE_VERSION = 1;
const PLAY_SECONDS_PERSIST_INTERVAL = 6;

const defaultProfile: AntiAddictionProfile = {
  realnameVerified: false,
  faceVerified: false,
  needFaceVerify: false,
  isMinor: false,
  ageGroup: "unknown",
  providerUid: "",
  updatedAt: 0
};

const defaultStorage: AntiAddictionStorageData = {
  version: STORAGE_VERSION,
  profile: { ...defaultProfile },
  playSecondsByDate: {},
  paymentFenByMonth: {},
  blockedByDate: {},
  pendingReports: []
};

const toDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const toMonthKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
};

const clampPositiveInt = (value: any, fallback: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
};

const parseClockToMinutes = (text: string, fallback: number): number => {
  if (typeof text !== "string") {
    return fallback;
  }
  const parts = text.trim().split(":");
  if (parts.length !== 2) {
    return fallback;
  }
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
    return fallback;
  }
  const h = Math.max(0, Math.min(23, Math.floor(hh)));
  const m = Math.max(0, Math.min(59, Math.floor(mm)));
  return h * 60 + m;
};

const normalizeAgeGroup = (raw: any): AntiAddictionAgeGroup => {
  if (raw === "under8" || raw === "age8to15" || raw === "age16to17" || raw === "adult" || raw === "unknown") {
    return raw;
  }
  if (raw === "8to15" || raw === "8-15") {
    return "age8to15";
  }
  if (raw === "16to17" || raw === "16-17") {
    return "age16to17";
  }
  return "unknown";
};

/**
 * Client-side anti-addiction manager.
 */
export class AntiAddictionManager {
  private static instance: AntiAddictionManager;

  private readonly cfg = ConfigManager.getInstance();
  private readonly analytics = AnalyticsManager.getInstance();
  private data: AntiAddictionStorageData = this.createDefaultData();
  private initialized = false;
  private runActive = false;
  private bufferedPlaySeconds = 0;
  private uploadingReports = false;

  static getInstance(): AntiAddictionManager {
    if (!AntiAddictionManager.instance) {
      AntiAddictionManager.instance = new AntiAddictionManager();
    }
    return AntiAddictionManager.instance;
  }

  init(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.load();

    const config = this.getRuntimeConfig();
    if (config.enabled && config.autoAuthOnBoot && !this.data.profile.realnameVerified) {
      this.requestRealNameAuth("auto");
    }

    this.queueDailyReport("boot");
    this.flushPendingReports();
  }

  onShow(): void {
    if (!this.initialized) {
      this.init();
    }
    this.flushPendingReports();
  }

  onHide(): void {
    this.persist(true);
    this.queueDailyReport("app_hide");
    this.flushPendingReports();
  }

  onRunStart(): void {
    if (!this.initialized) {
      this.init();
    }
    this.runActive = true;
    this.persist(false);
  }

  onRunEnd(): void {
    if (this.runActive) {
      this.runActive = false;
    }
    this.persist(true);
    this.queueDailyReport("run_end");
    this.flushPendingReports();
  }

  tickRun(dt: number): AntiAddictionGateResult {
    if (!this.initialized) {
      this.init();
    }

    if (this.runActive && Number.isFinite(dt) && dt > 0) {
      this.addTodayPlaySeconds(dt);
    }

    return this.getGameplayGate(new Date(), false);
  }

  getGameplayGate(now = new Date(), recordBlocked = false): AntiAddictionGateResult {
    const config = this.getRuntimeConfig();
    if (!config.enabled || config.providerMode === "disabled") {
      return {
        ok: true,
        message: ""
      };
    }

    if (!this.data.profile.realnameVerified) {
      if (recordBlocked) {
        this.recordBlockedReason("realname_required", now);
      }
      return {
        ok: false,
        reason: "realname_required",
        message: "请先完成实名认证"
      };
    }

    if (config.requireFaceVerify && (this.data.profile.needFaceVerify || !this.data.profile.faceVerified)) {
      if (recordBlocked) {
        this.recordBlockedReason("face_verify_required", now);
      }
      return {
        ok: false,
        reason: "face_verify_required",
        message: "请先完成人脸核验"
      };
    }

    if (!this.data.profile.isMinor) {
      return {
        ok: true,
        message: ""
      };
    }

    if (config.enforceCurfew && !this.isMinorPlayableNow(now, config)) {
      if (recordBlocked) {
        this.recordBlockedReason("curfew", now);
      }
      return {
        ok: false,
        reason: "curfew",
        message: "未成年当前时段不可游玩"
      };
    }

    if (config.enforcePlaytime && config.minorDailySeconds > 0) {
      const used = this.getTodayPlaySeconds(now);
      const remain = Math.max(0, config.minorDailySeconds - used);
      if (remain <= 0.01) {
        if (recordBlocked) {
          this.recordBlockedReason("playtime_limit", now);
        }
        return {
          ok: false,
          reason: "playtime_limit",
          message: "今日游戏时长已用尽",
          remainSeconds: 0
        };
      }
      return {
        ok: true,
        message: "",
        remainSeconds: remain
      };
    }

    return {
      ok: true,
      message: ""
    };
  }

  getStatusSnapshot(now = new Date()): AntiAddictionStatusSnapshot {
    const config = this.getRuntimeConfig();
    const gate = this.getGameplayGate(now, false);
    const used = this.getTodayPlaySeconds(now);
    const limit = this.data.profile.isMinor ? config.minorDailySeconds : 0;
    const remain = Math.max(0, limit - used);

    return {
      enabled: config.enabled && config.providerMode !== "disabled",
      realnameVerified: this.data.profile.realnameVerified,
      isMinor: this.data.profile.isMinor,
      needFaceVerify: config.requireFaceVerify && (this.data.profile.needFaceVerify || !this.data.profile.faceVerified),
      ageGroup: this.data.profile.ageGroup,
      authStatusText: this.getAuthStatusText(config),
      playtimeTodaySeconds: used,
      playtimeLimitSeconds: limit,
      playtimeRemainSeconds: remain,
      gate
    };
  }

  async requestRealNameAuth(trigger: "auto" | "manual" = "manual"): Promise<{ ok: boolean; message: string }> {
    if (!this.initialized) {
      this.init();
    }

    const config = this.getRuntimeConfig();
    const mode = this.resolveProviderMode(config);
    this.analytics.logEvent("anti_realname_auth_start", {
      trigger,
      mode
    });

    if (mode === "disabled") {
      return {
        ok: true,
        message: "防沉迷已关闭"
      };
    }

    if (mode === "mock") {
      this.applyMockProfile(config.mockProfile);
      this.analytics.logEvent("anti_realname_auth_success", {
        mode: "mock",
        trigger,
        isMinor: this.data.profile.isMinor,
        ageGroup: this.data.profile.ageGroup
      });
      return {
        ok: true,
        message: "实名认证成功（模拟）"
      };
    }

    if (!config.authEndpoint) {
      if (config.strictWithoutBackend) {
        this.analytics.logEvent("anti_realname_auth_fail", {
          trigger,
          reason: "auth_endpoint_missing"
        });
        return {
          ok: false,
          message: "未配置实名认证接口"
        };
      }

      this.applyMockProfile(config.mockProfile);
      return {
        ok: true,
        message: "未配置实名服务，已使用模拟认证"
      };
    }

    try {
      const code = await this.getWxLoginCode();
      const response = await this.requestJson<RealnameAuthResponse>(
        config.authEndpoint,
        {
          code,
          trigger,
          scene: "mini_game",
          clientTs: Date.now()
        },
        config.reportAuthToken
      );

      const normalized = this.normalizeAuthResponse(response);
      if (!normalized.ok) {
        this.analytics.logEvent("anti_realname_auth_fail", {
          trigger,
          reason: "backend_reject",
          message: normalized.message || ""
        });
        return {
          ok: false,
          message: normalized.message || "实名认证失败"
        };
      }

      this.applyAuthProfile(normalized);
      this.analytics.logEvent("anti_realname_auth_success", {
        mode: "backend",
        trigger,
        isMinor: this.data.profile.isMinor,
        ageGroup: this.data.profile.ageGroup
      });
      this.queueDailyReport("realname_auth");
      this.flushPendingReports();

      return {
        ok: true,
        message: normalized.message || "实名认证成功"
      };
    } catch (error) {
      this.analytics.logEvent("anti_realname_auth_fail", {
        trigger,
        reason: "request_error",
        message: this.stringifyError(error)
      });
      return {
        ok: false,
        message: "实名认证请求失败"
      };
    }
  }

  async requestFaceVerify(trigger: "manual" | "runtime" = "manual"): Promise<{ ok: boolean; message: string }> {
    if (!this.initialized) {
      this.init();
    }

    const config = this.getRuntimeConfig();
    const mode = this.resolveProviderMode(config);
    this.analytics.logEvent("anti_face_verify_start", {
      trigger,
      mode
    });

    if (mode === "disabled") {
      return {
        ok: true,
        message: "防沉迷已关闭"
      };
    }

    if (mode === "mock") {
      this.data.profile.faceVerified = true;
      this.data.profile.needFaceVerify = false;
      this.data.profile.updatedAt = Date.now();
      this.persist(true);
      this.analytics.logEvent("anti_face_verify_success", {
        mode: "mock",
        trigger
      });
      return {
        ok: true,
        message: "人脸核验成功（模拟）"
      };
    }

    if (!config.faceVerifyEndpoint) {
      if (config.strictWithoutBackend) {
        this.analytics.logEvent("anti_face_verify_fail", {
          trigger,
          reason: "face_endpoint_missing"
        });
        return {
          ok: false,
          message: "未配置人脸核验接口"
        };
      }

      this.data.profile.faceVerified = true;
      this.data.profile.needFaceVerify = false;
      this.data.profile.updatedAt = Date.now();
      this.persist(true);
      return {
        ok: true,
        message: "未配置人脸服务，已使用模拟核验"
      };
    }

    try {
      const code = await this.getWxLoginCode();
      const response = await this.requestJson<RealnameAuthResponse>(
        config.faceVerifyEndpoint,
        {
          code,
          trigger,
          scene: "mini_game",
          clientTs: Date.now()
        },
        config.reportAuthToken
      );

      const normalized = this.normalizeAuthResponse(response);
      if (!normalized.ok) {
        this.analytics.logEvent("anti_face_verify_fail", {
          trigger,
          reason: "backend_reject",
          message: normalized.message || ""
        });
        return {
          ok: false,
          message: normalized.message || "人脸核验失败"
        };
      }

      this.applyAuthProfile({
        ...normalized,
        needFaceVerify: false,
        faceVerified: true
      });
      this.analytics.logEvent("anti_face_verify_success", {
        mode: "backend",
        trigger
      });
      this.queueDailyReport("face_verify");
      this.flushPendingReports();
      return {
        ok: true,
        message: normalized.message || "人脸核验成功"
      };
    } catch (error) {
      this.analytics.logEvent("anti_face_verify_fail", {
        trigger,
        reason: "request_error",
        message: this.stringifyError(error)
      });
      return {
        ok: false,
        message: "人脸核验请求失败"
      };
    }
  }

  getPaymentGate(amountFen: number, now = new Date(), recordBlocked = false): AntiAddictionPaymentGateResult {
    const config = this.getRuntimeConfig();
    const gameplayGate = this.getGameplayGate(now, recordBlocked);
    if (!gameplayGate.ok && gameplayGate.reason) {
      return {
        ok: false,
        reason: gameplayGate.reason,
        message: gameplayGate.message
      };
    }

    if (!config.enabled || config.providerMode === "disabled" || !config.enforcePayment) {
      return {
        ok: true,
        message: ""
      };
    }

    const amount = clampPositiveInt(amountFen, 0);
    if (amount <= 0) {
      return {
        ok: false,
        reason: "invalid_amount",
        message: "支付金额无效"
      };
    }

    if (!this.data.profile.isMinor) {
      return {
        ok: true,
        message: ""
      };
    }

    const limit = this.getPaymentLimitForAge(this.data.profile.ageGroup, config);
    if (limit.single <= 0 || limit.monthly <= 0) {
      return {
        ok: false,
        reason: "payment_disabled",
        message: "当前年龄段不可充值"
      };
    }

    if (amount > limit.single) {
      return {
        ok: false,
        reason: "payment_single_limit",
        message: `超出单笔限额（${Math.floor(limit.single / 100)}元）`
      };
    }

    const monthKey = toMonthKey(now);
    const spent = clampPositiveInt(this.data.paymentFenByMonth[monthKey], 0);
    if (spent + amount > limit.monthly) {
      return {
        ok: false,
        reason: "payment_monthly_limit",
        message: `超出月累计限额（${Math.floor(limit.monthly / 100)}元）`,
        remainFen: Math.max(0, limit.monthly - spent)
      };
    }

    return {
      ok: true,
      message: ""
    };
  }

  recordPayment(amountFen: number, now = new Date(), payload?: Record<string, any>): void {
    const amount = clampPositiveInt(amountFen, 0);
    if (amount <= 0) {
      return;
    }
    const monthKey = toMonthKey(now);
    const current = clampPositiveInt(this.data.paymentFenByMonth[monthKey], 0);
    this.data.paymentFenByMonth[monthKey] = current + amount;
    this.trimPaymentRecords();
    this.persist(true);

    this.analytics.logEvent("anti_payment_record", {
      amountFen: amount,
      monthKey,
      monthPaidFen: this.data.paymentFenByMonth[monthKey],
      ...payload
    });

    this.queueDailyReport("payment");
    this.flushPendingReports();
  }

  private addTodayPlaySeconds(seconds: number): void {
    const date = new Date();
    const dateKey = toDateKey(date);
    const current = this.getTodayPlaySeconds(date);
    this.data.playSecondsByDate[dateKey] = current + Math.max(0, seconds);
    this.trimPlaytimeRecords();
    this.bufferedPlaySeconds += seconds;
    this.persist(this.bufferedPlaySeconds >= PLAY_SECONDS_PERSIST_INTERVAL);
  }

  private getTodayPlaySeconds(now = new Date()): number {
    const dateKey = toDateKey(now);
    return Math.max(0, Number(this.data.playSecondsByDate[dateKey] || 0));
  }

  private recordBlockedReason(reason: string, now = new Date()): void {
    const dateKey = toDateKey(now);
    const bucket = this.data.blockedByDate[dateKey] || {};
    bucket[reason] = clampPositiveInt(bucket[reason], 0) + 1;
    this.data.blockedByDate[dateKey] = bucket;
    this.trimBlockedRecords();
    this.persist(false);
    this.queueDailyReport(`blocked_${reason}`);
  }

  private getAuthStatusText(config: AntiAddictionRuntimeConfig): string {
    if (!config.enabled || config.providerMode === "disabled") {
      return "防沉迷：关闭";
    }

    if (!this.data.profile.realnameVerified) {
      return "实名状态：未实名";
    }

    const ageLabel = this.getAgeLabel(this.data.profile.ageGroup, this.data.profile.isMinor);
    const faceLabel = config.requireFaceVerify
      ? this.data.profile.needFaceVerify || !this.data.profile.faceVerified
        ? "，需人脸核验"
        : "，人脸已核验"
      : "";
    return `实名状态：已实名（${ageLabel}${faceLabel}）`;
  }

  private getAgeLabel(ageGroup: AntiAddictionAgeGroup, isMinor: boolean): string {
    if (!isMinor || ageGroup === "adult") {
      return "成年人";
    }
    if (ageGroup === "under8") {
      return "未成年<8";
    }
    if (ageGroup === "age8to15") {
      return "未成年8-15";
    }
    if (ageGroup === "age16to17") {
      return "未成年16-17";
    }
    return "未成年";
  }

  private isMinorPlayableNow(now: Date, config: AntiAddictionRuntimeConfig): boolean {
    if (!config.enforceCurfew) {
      return true;
    }

    const dateKey = toDateKey(now);
    const weekday = now.getDay();
    const minuteOfDay = now.getHours() * 60 + now.getMinutes();
    const holidaySet = new Set(config.holidayDateList);
    const workdaySet = new Set(config.workdayDateList);

    const isHoliday = holidaySet.has(dateKey);
    const forcedWorkday = workdaySet.has(dateKey);
    const weekdayAllowed = config.minorAllowedWeekdays.indexOf(weekday) >= 0;
    const dayAllowed = isHoliday || (weekdayAllowed && !forcedWorkday);
    if (!dayAllowed) {
      return false;
    }

    for (const window of config.minorAllowedWindows) {
      if (window.endMinutes > window.startMinutes) {
        if (minuteOfDay >= window.startMinutes && minuteOfDay < window.endMinutes) {
          return true;
        }
      } else if (minuteOfDay >= window.startMinutes || minuteOfDay < window.endMinutes) {
        return true;
      }
    }
    return false;
  }

  private queueDailyReport(trigger: string, now = new Date()): void {
    const config = this.getRuntimeConfig();
    if (!config.enabled || config.providerMode === "disabled") {
      return;
    }

    const dateKey = toDateKey(now);
    const monthKey = toMonthKey(now);
    const playSeconds = this.getTodayPlaySeconds(now);
    const playLimitSeconds = this.data.profile.isMinor ? config.minorDailySeconds : 0;
    const playRemainSeconds = Math.max(0, playLimitSeconds - playSeconds);
    const monthPaidFen = clampPositiveInt(this.data.paymentFenByMonth[monthKey], 0);
    const blocked = { ...(this.data.blockedByDate[dateKey] || {}) };

    const report: AntiAddictionDailyReport = {
      dateKey,
      generatedAt: Date.now(),
      trigger,
      realnameVerified: this.data.profile.realnameVerified,
      faceVerified: this.data.profile.faceVerified,
      needFaceVerify: this.data.profile.needFaceVerify,
      isMinor: this.data.profile.isMinor,
      ageGroup: this.data.profile.ageGroup,
      playSeconds,
      playLimitSeconds,
      playRemainSeconds,
      monthPaidFen,
      blocked
    };

    const existingIndex = this.data.pendingReports.findIndex((item) => item.dateKey === dateKey);
    if (existingIndex >= 0) {
      this.data.pendingReports[existingIndex] = report;
    } else {
      this.data.pendingReports.push(report);
      if (this.data.pendingReports.length > 30) {
        this.data.pendingReports.splice(0, this.data.pendingReports.length - 30);
      }
    }
    this.persist(true);
  }

  private async flushPendingReports(): Promise<void> {
    if (this.uploadingReports) {
      return;
    }
    const config = this.getRuntimeConfig();
    if (!config.enabled || config.providerMode === "disabled") {
      return;
    }
    if (!config.reportEndpoint || this.data.pendingReports.length <= 0) {
      return;
    }
    if (!wx || typeof wx.request !== "function") {
      return;
    }

    this.uploadingReports = true;

    try {
      while (this.data.pendingReports.length > 0) {
        const report = this.data.pendingReports[0];
        await this.requestJson(
          config.reportEndpoint,
          {
            reportDate: report.dateKey,
            generatedAt: report.generatedAt,
            trigger: report.trigger,
            realnameVerified: report.realnameVerified,
            faceVerified: report.faceVerified,
            needFaceVerify: report.needFaceVerify,
            isMinor: report.isMinor,
            ageGroup: report.ageGroup,
            playSeconds: Math.floor(report.playSeconds),
            playLimitSeconds: Math.floor(report.playLimitSeconds),
            playRemainSeconds: Math.floor(report.playRemainSeconds),
            monthPaidFen: Math.floor(report.monthPaidFen),
            blocked: report.blocked
          },
          config.reportAuthToken
        );

        this.data.pendingReports.shift();
        this.persist(true);
      }
    } catch (error) {
      this.analytics.logEvent("anti_report_upload_fail", {
        message: this.stringifyError(error),
        pending: this.data.pendingReports.length
      });
    } finally {
      this.uploadingReports = false;
    }
  }

  private load(): void {
    try {
      const raw = wx.getStorageSync(STORAGE_KEY);
      if (!raw) {
        this.data = this.createDefaultData();
        return;
      }
      const parsed = JSON.parse(raw);
      this.data = this.sanitizeStorage(parsed);
    } catch (error) {
      this.data = this.createDefaultData();
    }
  }

  private persist(force: boolean): void {
    if (!force && this.bufferedPlaySeconds < PLAY_SECONDS_PERSIST_INTERVAL) {
      return;
    }
    try {
      wx.setStorageSync(STORAGE_KEY, JSON.stringify(this.data));
      this.bufferedPlaySeconds = 0;
    } catch (error) {
      // Ignore storage errors in MVP.
    }
  }

  private sanitizeStorage(raw: any): AntiAddictionStorageData {
    if (!raw || typeof raw !== "object") {
      return this.createDefaultData();
    }

    const profileRaw = raw.profile || {};
    const profile: AntiAddictionProfile = {
      realnameVerified: !!profileRaw.realnameVerified,
      faceVerified: !!profileRaw.faceVerified,
      needFaceVerify: !!profileRaw.needFaceVerify,
      isMinor: !!profileRaw.isMinor,
      ageGroup: normalizeAgeGroup(profileRaw.ageGroup),
      providerUid: typeof profileRaw.providerUid === "string" ? profileRaw.providerUid : "",
      updatedAt: clampPositiveInt(profileRaw.updatedAt, 0)
    };
    if (profile.ageGroup === "adult") {
      profile.isMinor = false;
    }

    const playSecondsByDate: Record<string, number> = {};
    if (raw.playSecondsByDate && typeof raw.playSecondsByDate === "object") {
      Object.keys(raw.playSecondsByDate).forEach((key) => {
        playSecondsByDate[key] = Math.max(0, Number(raw.playSecondsByDate[key] || 0));
      });
    }

    const paymentFenByMonth: Record<string, number> = {};
    if (raw.paymentFenByMonth && typeof raw.paymentFenByMonth === "object") {
      Object.keys(raw.paymentFenByMonth).forEach((key) => {
        paymentFenByMonth[key] = clampPositiveInt(raw.paymentFenByMonth[key], 0);
      });
    }

    const blockedByDate: Record<string, Record<string, number>> = {};
    if (raw.blockedByDate && typeof raw.blockedByDate === "object") {
      Object.keys(raw.blockedByDate).forEach((dateKey) => {
        const bucket = raw.blockedByDate[dateKey];
        if (!bucket || typeof bucket !== "object") {
          return;
        }
        const out: Record<string, number> = {};
        Object.keys(bucket).forEach((reason) => {
          out[reason] = clampPositiveInt(bucket[reason], 0);
        });
        blockedByDate[dateKey] = out;
      });
    }

    const pendingReports: AntiAddictionDailyReport[] = [];
    if (Array.isArray(raw.pendingReports)) {
      for (const item of raw.pendingReports) {
        if (!item || typeof item !== "object") {
          continue;
        }
        pendingReports.push({
          dateKey: typeof item.dateKey === "string" ? item.dateKey : toDateKey(new Date()),
          generatedAt: clampPositiveInt(item.generatedAt, Date.now()),
          trigger: typeof item.trigger === "string" ? item.trigger : "unknown",
          realnameVerified: !!item.realnameVerified,
          faceVerified: !!item.faceVerified,
          needFaceVerify: !!item.needFaceVerify,
          isMinor: !!item.isMinor,
          ageGroup: normalizeAgeGroup(item.ageGroup),
          playSeconds: Math.max(0, Number(item.playSeconds || 0)),
          playLimitSeconds: Math.max(0, Number(item.playLimitSeconds || 0)),
          playRemainSeconds: Math.max(0, Number(item.playRemainSeconds || 0)),
          monthPaidFen: clampPositiveInt(item.monthPaidFen, 0),
          blocked: item.blocked && typeof item.blocked === "object" ? item.blocked : {}
        });
      }
    }

    const out: AntiAddictionStorageData = {
      version: STORAGE_VERSION,
      profile,
      playSecondsByDate,
      paymentFenByMonth,
      blockedByDate,
      pendingReports: pendingReports.slice(-30)
    };
    this.trimStorage(out);
    return out;
  }

  private trimStorage(target = this.data): void {
    this.trimPlaytimeRecords(target);
    this.trimPaymentRecords(target);
    this.trimBlockedRecords(target);
  }

  private trimPlaytimeRecords(target = this.data): void {
    const keys = Object.keys(target.playSecondsByDate).sort();
    if (keys.length <= 45) {
      return;
    }
    const removeCount = keys.length - 45;
    for (let i = 0; i < removeCount; i += 1) {
      delete target.playSecondsByDate[keys[i]];
    }
  }

  private trimPaymentRecords(target = this.data): void {
    const keys = Object.keys(target.paymentFenByMonth).sort();
    if (keys.length <= 12) {
      return;
    }
    const removeCount = keys.length - 12;
    for (let i = 0; i < removeCount; i += 1) {
      delete target.paymentFenByMonth[keys[i]];
    }
  }

  private trimBlockedRecords(target = this.data): void {
    const keys = Object.keys(target.blockedByDate).sort();
    if (keys.length <= 45) {
      return;
    }
    const removeCount = keys.length - 45;
    for (let i = 0; i < removeCount; i += 1) {
      delete target.blockedByDate[keys[i]];
    }
  }

  private applyMockProfile(mock: Partial<AntiAddictionProfile>): void {
    const merged: AntiAddictionProfile = {
      ...defaultProfile,
      ...mock,
      ageGroup: normalizeAgeGroup(mock.ageGroup),
      updatedAt: Date.now()
    };

    if (merged.ageGroup === "adult") {
      merged.isMinor = false;
    } else if (merged.ageGroup === "under8" || merged.ageGroup === "age8to15" || merged.ageGroup === "age16to17") {
      merged.isMinor = true;
    }
    if (!merged.realnameVerified) {
      merged.faceVerified = false;
      merged.needFaceVerify = false;
      merged.ageGroup = "unknown";
      merged.isMinor = false;
    }

    this.data.profile = merged;
    this.persist(true);
  }

  private applyAuthProfile(response: RealnameAuthResponse): void {
    const realnameVerified = !!response.realnameVerified;
    const ageGroup = normalizeAgeGroup(response.ageGroup);
    const isMinor = response.isMinor === undefined ? ageGroup !== "adult" && ageGroup !== "unknown" : !!response.isMinor;
    this.data.profile = {
      realnameVerified,
      faceVerified: !!response.faceVerified,
      needFaceVerify: !!response.needFaceVerify,
      isMinor,
      ageGroup: realnameVerified ? (ageGroup === "unknown" && !isMinor ? "adult" : ageGroup) : "unknown",
      providerUid: typeof response.providerUid === "string" ? response.providerUid : "",
      updatedAt: Date.now()
    };
    if (!realnameVerified) {
      this.data.profile.faceVerified = false;
      this.data.profile.needFaceVerify = false;
      this.data.profile.isMinor = false;
      this.data.profile.ageGroup = "unknown";
    }
    this.persist(true);
  }

  private normalizeAuthResponse(raw: any): RealnameAuthResponse {
    const data = raw && typeof raw === "object" && raw.data && typeof raw.data === "object" ? raw.data : raw;
    if (!data || typeof data !== "object") {
      return {
        ok: false,
        message: "invalid_response"
      };
    }

    const ok = data.ok !== false && data.success !== false;
    return {
      ok,
      message: typeof data.message === "string" ? data.message : "",
      realnameVerified: !!(data.realnameVerified ?? data.verified),
      faceVerified: !!(data.faceVerified ?? data.facePass),
      needFaceVerify: !!data.needFaceVerify,
      isMinor: typeof data.isMinor === "boolean" ? data.isMinor : undefined,
      ageGroup: data.ageGroup,
      providerUid: typeof data.providerUid === "string" ? data.providerUid : ""
    };
  }

  private getPaymentLimitForAge(
    ageGroup: AntiAddictionAgeGroup,
    config: AntiAddictionRuntimeConfig
  ): { single: number; monthly: number } {
    if (ageGroup === "under8") {
      return {
        single: config.paymentLimitFen.under8.single,
        monthly: config.paymentLimitFen.under8.monthly
      };
    }
    if (ageGroup === "age8to15") {
      return {
        single: config.paymentLimitFen.age8to15.single,
        monthly: config.paymentLimitFen.age8to15.monthly
      };
    }
    if (ageGroup === "age16to17") {
      return {
        single: config.paymentLimitFen.age16to17.single,
        monthly: config.paymentLimitFen.age16to17.monthly
      };
    }
    return {
      single: Number.MAX_SAFE_INTEGER,
      monthly: Number.MAX_SAFE_INTEGER
    };
  }

  private resolveProviderMode(config: AntiAddictionRuntimeConfig): AntiAddictionProviderMode {
    if (!config.enabled) {
      return "disabled";
    }
    if (config.providerMode === "disabled" || config.providerMode === "backend" || config.providerMode === "mock") {
      return config.providerMode;
    }
    if (config.authEndpoint || config.faceVerifyEndpoint || config.reportEndpoint) {
      return "backend";
    }
    return "mock";
  }

  private getRuntimeConfig(): AntiAddictionRuntimeConfig {
    const raw: any = (this.cfg.getBalance().antiAddiction || {}) as any;
    const providerMode: AntiAddictionProviderMode =
      raw.providerMode === "mock" || raw.providerMode === "backend" || raw.providerMode === "auto" || raw.providerMode === "disabled"
        ? raw.providerMode
        : "auto";

    const windowsRaw = Array.isArray(raw.minorAllowedWindows)
      ? raw.minorAllowedWindows
      : [{ start: "20:00", end: "21:00" }];
    const minorAllowedWindows = windowsRaw
      .map((item: any) => ({
        startMinutes: parseClockToMinutes(item?.start, 20 * 60),
        endMinutes: parseClockToMinutes(item?.end, 21 * 60)
      }))
      .filter((item: { startMinutes: number; endMinutes: number }) => item.startMinutes !== item.endMinutes);

    const reportEndpoint = typeof raw.reportEndpoint === "string" ? raw.reportEndpoint.trim() : "";
    const authEndpoint = typeof raw.authEndpoint === "string" ? raw.authEndpoint.trim() : "";
    const faceVerifyEndpoint = typeof raw.faceVerifyEndpoint === "string" ? raw.faceVerifyEndpoint.trim() : "";

    const defaultMockProfile: Partial<AntiAddictionProfile> = {
      realnameVerified: true,
      faceVerified: true,
      needFaceVerify: false,
      isMinor: false,
      ageGroup: "adult"
    };

    return {
      enabled: raw.enabled !== false,
      providerMode,
      strictWithoutBackend: raw.strictWithoutBackend === true,
      autoAuthOnBoot: raw.autoAuthOnBoot === true,
      authEndpoint,
      faceVerifyEndpoint,
      reportEndpoint,
      reportAuthToken: typeof raw.reportAuthToken === "string" ? raw.reportAuthToken : "",
      enforcePlaytime: raw.enforcePlaytime !== false,
      enforceCurfew: raw.enforceCurfew !== false,
      enforcePayment: raw.enforcePayment !== false,
      requireFaceVerify: raw.requireFaceVerify === true,
      minorDailySeconds: clampPositiveInt(raw.minorDailySeconds, 3600),
      minorAllowedWeekdays: Array.isArray(raw.minorAllowedWeekdays)
        ? raw.minorAllowedWeekdays
            .map((item: any) => clampPositiveInt(item, -1))
            .filter((item: number) => item >= 0 && item <= 6)
        : [5, 6, 0],
      minorAllowedWindows:
        minorAllowedWindows.length > 0 ? minorAllowedWindows : [{ startMinutes: 20 * 60, endMinutes: 21 * 60 }],
      holidayDateList: Array.isArray(raw.holidayDateList)
        ? raw.holidayDateList.filter((item: any) => typeof item === "string")
        : [],
      workdayDateList: Array.isArray(raw.workdayDateList)
        ? raw.workdayDateList.filter((item: any) => typeof item === "string")
        : [],
      paymentLimitFen: {
        under8: {
          single: clampPositiveInt(raw.paymentLimitFen?.under8?.single, 0),
          monthly: clampPositiveInt(raw.paymentLimitFen?.under8?.monthly, 0)
        },
        age8to15: {
          single: clampPositiveInt(raw.paymentLimitFen?.age8to15?.single, 5000),
          monthly: clampPositiveInt(raw.paymentLimitFen?.age8to15?.monthly, 20000)
        },
        age16to17: {
          single: clampPositiveInt(raw.paymentLimitFen?.age16to17?.single, 10000),
          monthly: clampPositiveInt(raw.paymentLimitFen?.age16to17?.monthly, 40000)
        }
      },
      mockProfile: {
        ...defaultMockProfile,
        ...(raw.mockProfile && typeof raw.mockProfile === "object" ? raw.mockProfile : {})
      }
    };
  }

  private async getWxLoginCode(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!wx || typeof wx.login !== "function") {
        reject(new Error("wx.login unavailable"));
        return;
      }
      wx.login({
        success: (res: any) => {
          const code = typeof res?.code === "string" ? res.code : "";
          if (!code) {
            reject(new Error("wx.login missing code"));
            return;
          }
          resolve(code);
        },
        fail: (error: any) => reject(error || new Error("wx.login fail"))
      });
    });
  }

  private async requestJson<T>(url: string, data: Record<string, any>, authToken = ""): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!wx || typeof wx.request !== "function") {
        reject(new Error("wx.request unavailable"));
        return;
      }

      const header: Record<string, string> = {
        "content-type": "application/json"
      };
      if (authToken) {
        header.Authorization = `Bearer ${authToken}`;
      }

      wx.request({
        url,
        method: "POST",
        data,
        header,
        success: (res: any) => {
          const statusCode = Number(res?.statusCode || 0);
          if (statusCode >= 200 && statusCode < 300) {
            resolve(res.data as T);
            return;
          }
          reject(new Error(`http_${statusCode}`));
        },
        fail: (error: any) => reject(error || new Error("request_fail"))
      });
    });
  }

  private createDefaultData(): AntiAddictionStorageData {
    return {
      ...defaultStorage,
      profile: { ...defaultProfile },
      playSecondsByDate: {},
      paymentFenByMonth: {},
      blockedByDate: {},
      pendingReports: []
    };
  }

  private stringifyError(error: any): string {
    if (!error) {
      return "unknown";
    }
    if (typeof error === "string") {
      return error;
    }
    if (typeof error.message === "string") {
      return error.message;
    }
    try {
      return JSON.stringify(error);
    } catch (jsonError) {
      return String(error);
    }
  }
}
