import { describe, expect, it } from "bun:test";
import {
  calculateZecAmount,
  createLockedRateQuote,
  isRateExpired,
  getZecUsdRate,
  fetchLiveZecPrice,
  RATE_LOCK_DURATION_MS,
} from "./oracle";
import { createInMemoryDb } from "@/lib/db";

describe("Exchange Rate Oracle & 15-Minute Lock (TASK-2.2)", () => {
  it("calculates ZEC and zatoshis accurately from USD amount and rate", () => {
    // Exact 1 ZEC
    const calc1 = calculateZecAmount(30.0, 30.0);
    expect(calc1.amountZec).toBe(1.0);
    expect(calc1.amountZatoshis).toBe(100_000_000);

    // 0.5 ZEC
    const calc2 = calculateZecAmount(15.0, 30.0);
    expect(calc2.amountZec).toBe(0.5);
    expect(calc2.amountZatoshis).toBe(50_000_000);

    // Arbitrary precision with fractional zatoshis
    const calc3 = calculateZecAmount(10.0, 33.33333333);
    expect(calc3.amountZatoshis).toBeGreaterThan(0);
    expect(Number.isInteger(calc3.amountZatoshis)).toBe(true);

    // Error on negative or zero
    expect(() => calculateZecAmount(0, 30.0)).toThrow();
    expect(() => calculateZecAmount(-10, 30.0)).toThrow();
    expect(() => calculateZecAmount(10, 0)).toThrow();
  });

  it("generates a locked rate quote with exact 15-minute TTL", async () => {
    const quote = await createLockedRateQuote(25.0, { customRate: 35.0 });

    expect(quote.amountUsd).toBe(25.0);
    expect(quote.rateZecUsd).toBe(35.0);
    expect(quote.source).toBe("custom");
    expect(quote.amountZec).toBeCloseTo(25.0 / 35.0, 6);
    expect(quote.amountZatoshis).toBe(Math.round((25.0 / 35.0) * 100_000_000));

    // Verify 15-minute lock duration
    const diffMs = quote.expiresAt.getTime() - quote.lockedAt.getTime();
    expect(diffMs).toBe(RATE_LOCK_DURATION_MS);
    expect(diffMs).toBe(15 * 60 * 1000);
  });

  it("correctly identifies expired quotes", () => {
    const now = Date.now();
    const future = new Date(now + 60 * 1000);
    const past = new Date(now - 1000);

    expect(isRateExpired(future)).toBe(false);
    expect(isRateExpired(past)).toBe(true);
  });

  it("caches exchange rates in database and honors TTL", async () => {
    const { db } = await createInMemoryDb();

    // First call writes to DB
    const res1 = await getZecUsdRate(db);
    expect(res1.rate).toBeGreaterThan(0);
    expect(res1.source).toBeDefined();

    // Immediate second call uses cached rate
    const res2 = await getZecUsdRate(db);
    expect(res2.cached).toBe(true);
    expect(res2.rate).toBe(res1.rate);
  }, 10000);

  it("fetches live price or falls back safely without unhandled exceptions", async () => {
    const result = await fetchLiveZecPrice();
    expect(result.price).toBeGreaterThan(0);
    expect(typeof result.source).toBe("string");
  }, 10000);
});
