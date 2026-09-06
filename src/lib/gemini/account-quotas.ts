import "server-only";
import { getGeminiResetCountdown } from "./pool-report";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type QuotaModelItem = {
  id: string;
  name: string;
  used: number;
  total: number;
  remainingPercentage: number;
  resetAt: string | null;
  countdownText: string;
  status: "healthy" | "warning" | "exhausted";
  isPrimary?: boolean;
};

export type AccountQuotaItem = {
  id: string;
  name: string;
  email: string;
  priority: number;
  isActive: boolean;
  testStatus: "active" | "cooling" | "unavailable";
  lastUsedAt: string | null;
  dailyCapacity: number;
  usedToday: number;
  remainingToday: number;
  remainingPercentage: number;
  cuanPotentialIdr: number; // e.g. 1000 req * Rp 600 = Rp 600.000
  models: QuotaModelItem[];
};

export type FeatureProfitItem = {
  key: string;
  name: string;
  credits: number;
  userPriceIdr: number;
  aiCostIdr: 0;
  profitIdr: number;
  marginPercent: 100;
  dailyPotentialIdr: number; // 4000 req * profitIdr
};

export type QuotaTrackerPayload = {
  source: "9router_live" | "supabase_pool";
  sourceLabel: string;
  is9RouterConnected: boolean;
  totalAccounts: number;
  activeAccounts: number;
  totalCapacity: number;
  totalUsedToday: number;
  totalRemainingToday: number;
  totalRemainingPercentage: number;

  // Reset timing
  resetScheduleText: string;
  nextResetIso: string;
  countdownText: string;

  // Founder ATM Cuan Calculator
  realServerCostIdr: 0;
  realizedRevenueTodayIdr: number;
  realizedGenerationsToday: number;
  maxDailyRevenuePotentialIdr: number;
  maxMonthlyRevenuePotentialIdr: number;
  commercialSavingsTodayIdr: number;
  featureProfitMatrix: FeatureProfitItem[];

  // 4 Account details (Amati, Tiru, Modifikasi 9Router)
  accounts: AccountQuotaItem[];
};

// Known 4 Google Antigravity accounts from 9Router & environment pool
const KNOWN_ACCOUNTS = [
  {
    id: "4453a0ac-0637-44d8-affa-dab4ac04613c",
    email: "vadlyvldr@gmail.com",
    name: "vadlyvldr@gmail.com",
    priority: 1,
  },
  {
    id: "8e7642c5-39d9-484c-969f-54bfcfdca0a2",
    email: "vallendrino@gmail.com",
    name: "vallendrino@gmail.com",
    priority: 2,
  },
  {
    id: "796e055b-c59f-438f-b95e-1f1f9035a487",
    email: "dyrastore0707@gmail.com",
    name: "dyrastore0707@gmail.com",
    priority: 3,
  },
  {
    id: "f7bfabd5-b855-4f54-aaf9-c9a9aa4c786e",
    email: "vadlyvldr1@gmail.com",
    name: "vadlyvldr1@gmail.com",
    priority: 4,
  },
];

// Curated top models displayed in 9Router UI
const CURATED_MODELS = [
  { id: "gemini-3.6-flash-high", name: "Gemini 3.6 Flash (High)", isPrimary: true },
  { id: "gemini-3.5-flash-low", name: "Gemini 3.5 Flash", isPrimary: true },
  { id: "gemini-3.1-pro-low", name: "Gemini 3.1 Pro", isPrimary: false },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet", isPrimary: false },
  { id: "claude-opus-4-6-thinking", name: "Claude Opus", isPrimary: false },
  { id: "gpt-oss-120b-medium", name: "GPT-OSS 120B", isPrimary: false },
];

// Feature matrix for Malesan Creator tools
export const FEATURE_PROFIT_MATRIX: FeatureProfitItem[] = [
  {
    key: "script",
    name: "Bikin Script (Video Panjang / Reels)",
    credits: 4,
    userPriceIdr: 600,
    aiCostIdr: 0,
    profitIdr: 600,
    marginPercent: 100,
    dailyPotentialIdr: 2_400_000,
  },
  {
    key: "repurpose",
    name: "Ubah Format (5 Versi Multiplatform)",
    credits: 5,
    userPriceIdr: 750,
    aiCostIdr: 0,
    profitIdr: 750,
    marginPercent: 100,
    dailyPotentialIdr: 3_000_000,
  },
  {
    key: "clip",
    name: "Potong Momen / Auto Clip",
    credits: 4,
    userPriceIdr: 600,
    aiCostIdr: 0,
    profitIdr: 600,
    marginPercent: 100,
    dailyPotentialIdr: 2_400_000,
  },
  {
    key: "thread",
    name: "Bikin Thread X / Twitter",
    credits: 3,
    userPriceIdr: 450,
    aiCostIdr: 0,
    profitIdr: 450,
    marginPercent: 100,
    dailyPotentialIdr: 1_800_000,
  },
  {
    key: "affiliate",
    name: "Naskah Racun Affiliate",
    credits: 3,
    userPriceIdr: 450,
    aiCostIdr: 0,
    profitIdr: 450,
    marginPercent: 100,
    dailyPotentialIdr: 1_800_000,
  },
  {
    key: "hook",
    name: "Hook Lab (10 Pilihan Hook)",
    credits: 2,
    userPriceIdr: 300,
    aiCostIdr: 0,
    profitIdr: 300,
    marginPercent: 100,
    dailyPotentialIdr: 1_200_000,
  },
];

// In-memory cache to keep 9Router & Supabase fast (<5ms on repeated turns)
let cachedPayload: { timestamp: number; data: QuotaTrackerPayload } | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

function formatCountdown(resetAtIso: string | null, fallbackText: string): string {
  if (!resetAtIso) return fallbackText;
  try {
    const diff = new Date(resetAtIso).getTime() - Date.now();
    if (diff <= 0) return "in 0m";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days}d ${hours % 24}h`;
    }
    return `in ${hours}h ${mins}m`;
  } catch {
    return fallbackText;
  }
}

export async function fetchQuotaTrackerData(forceRefresh = false): Promise<QuotaTrackerPayload> {
  if (!forceRefresh && cachedPayload && Date.now() - cachedPayload.timestamp < CACHE_TTL_MS) {
    return cachedPayload.data;
  }

  const timing = getGeminiResetCountdown();
  const capPerKey = Number(process.env.GEMINI_DAILY_CAP_PER_KEY ?? 1000);

  // 1. Gather actual usage & revenue from Supabase
  let totalUsedToday = 0;
  let realizedRevenueTodayIdr = 0;
  let realizedGenerationsToday = 0;
  let commercialSavingsTodayIdr = 0;
  const keyUsageMap = new Map<number, { requests: number; tokens: number }>();

  try {
    const supabase = createServiceRoleClient();
    const todayStr = new Date().toISOString().slice(0, 10);

    const [usageRes, poolRes] = await Promise.all([
      supabase
        .from("ai_usage_log")
        .select("cost_idr, credits_charged, status, created_at")
        .gte("created_at", `${todayStr}T00:00:00.000Z`),
      supabase.rpc("gemini_pool_used_today"),
    ]);

    if (usageRes.data) {
      realizedGenerationsToday = usageRes.data.length;
      for (const row of usageRes.data) {
        const credits = Number(row.credits_charged ?? 0);
        // 1 kredit = Rp 150 (standar paket Malesan)
        realizedRevenueTodayIdr += credits * 150;
      }
    }

    if (poolRes.data) {
      for (const row of poolRes.data as { key_index: number; requests: number }[]) {
        const idx = Number(row.key_index);
        const reqs = Number(row.requests ?? 0);
        keyUsageMap.set(idx, { requests: reqs, tokens: 0 });
        totalUsedToday += reqs;
      }
    }

    // Try fetching real token counts from gemini_usage
    const { data: usageTokens } = await supabase
      .from("gemini_usage")
      .select("key_index, token_count")
      .eq("usage_date", todayStr);

    let totalTokens = 0;
    if (usageTokens) {
      for (const row of usageTokens) {
        const idx = Number(row.key_index);
        const toks = Number(row.token_count ?? 0);
        totalTokens += toks;
        const existing = keyUsageMap.get(idx);
        if (existing) {
          existing.tokens = toks;
        }
      }
    }

    // Commercial valuation saved ($0.15/$0.60 per 1M tokens)
    const estTokens = totalTokens > 0 ? totalTokens : totalUsedToday * 1200;
    const estUsd = (estTokens / 1_000_000) * 0.35;
    commercialSavingsTodayIdr = Math.round(estUsd * 16_500);
  } catch {
    // Non-critical fallback
  }

  // 2. Try probing 9Router Proxy (http://localhost:20128)
  let is9RouterConnected = false;
  let liveAccounts: AccountQuotaItem[] = [];

  try {
    const probeRes = await fetch(
      "http://localhost:20128/api/providers/client?page=1&pageSize=20&accountStatus=all&sort=priority",
      { signal: AbortSignal.timeout(1200) },
    );

    if (probeRes.ok) {
      const probeData = await probeRes.json();
      const antigravityConns = (probeData.connections || []).filter(
        (c: { provider: string }) => c.provider === "antigravity",
      );

      if (antigravityConns.length > 0) {
        is9RouterConnected = true;

        type UsageResponse = {
          quotas?: Record<
            string,
            {
              used?: number;
              total?: number;
              remainingPercentage?: number;
              resetAt?: string;
              displayName?: string;
            }
          >;
        };

        // Fetch usage sequentially to prevent 9Router timeout
        for (let i = 0; i < antigravityConns.length; i++) {
          const conn = antigravityConns[i];
          let usageData: UsageResponse | null = null;
          try {
            const uRes = await fetch(`http://localhost:20128/api/usage/${conn.id}`, {
              signal: AbortSignal.timeout(1500),
            });
            if (uRes.ok) {
              usageData = (await uRes.json()) as UsageResponse;
            }
          } catch {
            // Ignore single account timeout
          }

          const rawQuotas = usageData?.quotas || {};
          const models: QuotaModelItem[] = CURATED_MODELS.map((m) => {
            const raw = rawQuotas[m.id];
            const used = Number(raw?.used ?? 0);
            const total = Number(raw?.total ?? 1000);
            const remainingPercentage =
              typeof raw?.remainingPercentage === "number"
                ? raw.remainingPercentage
                : Math.max(0, Math.round(((total - used) / total) * 100));
            const resetAt = raw?.resetAt || timing.nextResetIso;
            const countdownText = formatCountdown(resetAt, timing.countdownText);

            return {
              id: m.id,
              name: raw?.displayName || m.name,
              used,
              total,
              remainingPercentage,
              resetAt,
              countdownText,
              status: remainingPercentage < 10 ? "exhausted" : remainingPercentage < 30 ? "warning" : "healthy",
              isPrimary: m.isPrimary,
            };
          });

          const primaryModel = models.find((m) => m.id === "gemini-3.6-flash-high") || models[0];
          const accUsed = primaryModel?.used ?? 0;
          const accTotal = primaryModel?.total ?? capPerKey;
          const remainingToday = Math.max(0, accTotal - accUsed);
          const remainingPct = accTotal > 0 ? Math.round((remainingToday / accTotal) * 100) : 100;

          liveAccounts.push({
            id: conn.id,
            name: conn.name || conn.email || `Akun ${i + 1}`,
            email: conn.email || conn.name || `account-${i + 1}@gmail.com`,
            priority: Number(conn.priority ?? i + 1),
            isActive: Boolean(conn.isActive ?? true),
            testStatus: (conn.testStatus as "active" | "cooling" | "unavailable") || "active",
            lastUsedAt: conn.lastUsedAt || null,
            dailyCapacity: accTotal,
            usedToday: accUsed,
            remainingToday,
            remainingPercentage: remainingPct,
            cuanPotentialIdr: accTotal * 600, // 1000 req * Rp 600 = Rp 600.000
            models,
          });
        }
      }
    }
  } catch {
    // 9Router is offline or unreachable (e.g. deployed on Vercel production)
    is9RouterConnected = false;
  }

  // 3. If 9Router not connected, generate graceful fallback mapped to the 4 known accounts
  if (!is9RouterConnected || liveAccounts.length === 0) {
    liveAccounts = KNOWN_ACCOUNTS.map((acc, idx) => {
      const keyIndex = idx + 1;
      const usage = keyUsageMap.get(keyIndex);
      const usedToday = usage?.requests ?? 0;
      const dailyCapacity = capPerKey;
      const remainingToday = Math.max(0, dailyCapacity - usedToday);
      const remainingPercentage = Math.max(0, Math.round((remainingToday / dailyCapacity) * 100));

      const models: QuotaModelItem[] = CURATED_MODELS.map((m) => {
        const modelUsed = m.isPrimary ? usedToday : 0;
        const modelRemainingPct = Math.max(0, Math.round(((dailyCapacity - modelUsed) / dailyCapacity) * 100));
        return {
          id: m.id,
          name: m.name,
          used: modelUsed,
          total: dailyCapacity,
          remainingPercentage: modelRemainingPct,
          resetAt: timing.nextResetIso,
          countdownText: `in ${timing.hoursUntilReset}h ${timing.minutesUntilReset}m`,
          status: modelRemainingPct < 10 ? "exhausted" : modelRemainingPct < 30 ? "warning" : "healthy",
          isPrimary: m.isPrimary,
        };
      });

      return {
        id: acc.id,
        name: acc.name,
        email: acc.email,
        priority: acc.priority,
        isActive: true,
        testStatus: "active",
        lastUsedAt: null,
        dailyCapacity,
        usedToday,
        remainingToday,
        remainingPercentage,
        cuanPotentialIdr: dailyCapacity * 600,
        models,
      };
    });
  }

  const totalCapacity = liveAccounts.reduce((s, a) => s + a.dailyCapacity, 0);
  const totalAccountUsed = liveAccounts.reduce((s, a) => s + a.usedToday, 0);
  const effectiveUsed = Math.max(totalUsedToday, totalAccountUsed);
  const totalRemainingToday = Math.max(0, totalCapacity - effectiveUsed);
  const totalRemainingPercentage = totalCapacity > 0 ? Math.round((totalRemainingToday / totalCapacity) * 100) : 100;

  // Potential revenue calculations
  // 4,000 req * Rp 600 (Script) = Rp 2.400.000 / hari
  const maxDailyRevenuePotentialIdr = totalCapacity * 600;
  const maxMonthlyRevenuePotentialIdr = maxDailyRevenuePotentialIdr * 30;

  const payload: QuotaTrackerPayload = {
    source: is9RouterConnected ? "9router_live" : "supabase_pool",
    sourceLabel: is9RouterConnected
      ? "9Router Proxy Live Sync (Port 20128)"
      : "Google Cloud Free Tier Pool (4 Akun)",
    is9RouterConnected,
    totalAccounts: liveAccounts.length,
    activeAccounts: liveAccounts.filter((a) => a.isActive).length,
    totalCapacity,
    totalUsedToday: effectiveUsed,
    totalRemainingToday,
    totalRemainingPercentage,
    resetScheduleText: `${timing.resetScheduleText}`,
    nextResetIso: timing.nextResetIso,
    countdownText: timing.countdownText,
    realServerCostIdr: 0,
    realizedRevenueTodayIdr,
    realizedGenerationsToday,
    maxDailyRevenuePotentialIdr,
    maxMonthlyRevenuePotentialIdr,
    commercialSavingsTodayIdr,
    featureProfitMatrix: FEATURE_PROFIT_MATRIX,
    accounts: liveAccounts,
  };

  cachedPayload = { timestamp: Date.now(), data: payload };
  return payload;
}
