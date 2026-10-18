import { db, ratesCache } from "@/lib/db";
import { eq } from "drizzle-orm";

export interface RateQuote {
  rateZecUsd: number;
  amountUsd: number;
  amountZec: number;
  amountZatoshis: number;
  source: string;
  lockedAt: Date;
  expiresAt: Date;
}

const DEFAULT_FALLBACK_PRICE = 30.0;
const CACHE_KEY = "ZEC_USD";
const CACHE_TTL_MS = 60 * 1000; // 1 minute in memory / db cache
export const RATE_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface PriceFetcher {
  name: string;
  fetch: () => Promise<number>;
}

const PRICE_SOURCES: PriceFetcher[] = [
  {
    name: "coingecko",
    fetch: async () => {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd",
        {
          headers: { "User-Agent": "zkpay-oracle/1.0" },
          signal: AbortSignal.timeout(2000),
        }
      );
      if (!res.ok) throw new Error(`CoinGecko HTTP error: ${res.status}`);
      const data = (await res.json()) as { zcash?: { usd?: number } };
      const price = data.zcash?.usd;
      if (!price || price <= 0) throw new Error("Invalid CoinGecko price");
      return price;
    },
  },
  {
    name: "binance",
    fetch: async () => {
      const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=ZECUSDT", {
        headers: { "User-Agent": "zkpay-oracle/1.0" },
        signal: AbortSignal.timeout(1500),
      });
      if (!res.ok) throw new Error(`Binance HTTP error: ${res.status}`);
      const data = (await res.json()) as { price: string };
      const parsed = parseFloat(data.price);
      if (isNaN(parsed) || parsed <= 0) throw new Error("Invalid Binance price");
      return parsed;
    },
  },
  {
    name: "kraken",
    fetch: async () => {
      const res = await fetch("https://api.kraken.com/0/public/Ticker?pair=ZECUSD", {
        headers: { "User-Agent": "zkpay-oracle/1.0" },
        signal: AbortSignal.timeout(1500),
      });
      if (!res.ok) throw new Error(`Kraken HTTP error: ${res.status}`);
      const data = (await res.json()) as {
        result?: {
          XZECZUSD?: { c?: [string, string] };
          ZECUSD?: { c?: [string, string] };
        };
      };
      const pair = data.result?.XZECZUSD || data.result?.ZECUSD;
      const priceStr = pair?.c?.[0];
      if (!priceStr) throw new Error("Kraken pair not found in response");
      const parsed = parseFloat(priceStr);
      if (isNaN(parsed) || parsed <= 0) throw new Error("Invalid Kraken price");
      return parsed;
    },
  },
];

/**
 * Fetches the latest live ZEC/USD price across redundant exchanges.
 */
export async function fetchLiveZecPrice(): Promise<{ price: number; source: string }> {
  for (const source of PRICE_SOURCES) {
    try {
      const price = await source.fetch();
      return { price, source: source.name };
    } catch {
      // Try next provider
      continue;
    }
  }

  return { price: DEFAULT_FALLBACK_PRICE, source: "fallback_static" };
}

/**
 * Gets cached exchange rate or fetches and updates database cache.
 */
export async function getZecUsdRate(
  database = db
): Promise<{ rate: number; source: string; cached: boolean }> {
  try {
    const [cached] = await database
      .select()
      .from(ratesCache)
      .where(eq(ratesCache.id, CACHE_KEY));

    const now = Date.now();
    if (cached && now - cached.updated_at.getTime() < CACHE_TTL_MS) {
      return { rate: cached.rate, source: cached.source, cached: true };
    }

    const { price, source } = await fetchLiveZecPrice();

    await database
      .insert(ratesCache)
      .values({
        id: CACHE_KEY,
        rate: price,
        source,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: ratesCache.id,
        set: {
          rate: price,
          source,
          updated_at: new Date(),
        },
      });

    return { rate: price, source, cached: false };
  } catch {
    // If DB is offline or querying fails, still fetch live or return fallback
    const { price, source } = await fetchLiveZecPrice();
    return { rate: price, source, cached: false };
  }
}

/**
 * Converts a USD amount to ZEC and Zatoshis based on a given rate.
 */
export function calculateZecAmount(
  amountUsd: number,
  rateZecUsd: number
): { amountZec: number; amountZatoshis: number } {
  if (amountUsd <= 0 || rateZecUsd <= 0) {
    throw new Error("USD amount and ZEC rate must be positive numbers");
  }

  // 1 ZEC = 100,000,000 Zatoshis (8 decimal places)
  const zecPrecise = amountUsd / rateZecUsd;
  const amountZatoshis = Math.round(zecPrecise * 100_000_000);
  const amountZec = amountZatoshis / 100_000_000;

  return {
    amountZec,
    amountZatoshis,
  };
}

/**
 * Generates a 15-minute locked rate quote for an invoice.
 */
export async function createLockedRateQuote(
  amountUsd: number,
  options?: { customRate?: number; database?: any }
): Promise<RateQuote> {
  const lockedAt = new Date();
  const expiresAt = new Date(lockedAt.getTime() + RATE_LOCK_DURATION_MS);

  let rate: number;
  let source: string;

  if (options?.customRate && options.customRate > 0) {
    rate = options.customRate;
    source = "custom";
  } else {
    const rateInfo = await getZecUsdRate(options?.database);
    rate = rateInfo.rate;
    source = rateInfo.source;
  }

  const { amountZec, amountZatoshis } = calculateZecAmount(amountUsd, rate);

  return {
    rateZecUsd: rate,
    amountUsd,
    amountZec,
    amountZatoshis,
    source,
    lockedAt,
    expiresAt,
  };
}

/**
 * Checks whether a given rate quote or invoice expiration has elapsed.
 */
export function isRateExpired(expiresAt: Date | number): boolean {
  const expiryTime = typeof expiresAt === "number" ? expiresAt : expiresAt.getTime();
  return Date.now() > expiryTime;
}
