import { describe, expect, it } from "bun:test";
import { NearIntentsClient, SUPPORTED_SOURCE_ASSETS } from "./index";

describe("NEAR Intents 1Click Cross-Chain Settlement Engine (TASK-7.1)", () => {
  it("provides supported cross-chain assets across Solana, Base, Arbitrum, NEAR, and Ethereum", () => {
    const client = new NearIntentsClient();
    const assets = client.getSupportedAssets();

    expect(assets.length).toBeGreaterThanOrEqual(4);
    const symbols = assets.map((a) => a.symbol);
    expect(symbols).toContain("USDC");
    expect(symbols).toContain("NEAR");

    const chains = assets.map((a) => a.chain);
    expect(chains).toContain("solana");
    expect(chains).toContain("base");
    expect(chains).toContain("arbitrum");
  });

  it("generates a cross-chain quote to swap USDC on Base into Shielded ZEC", async () => {
    const client = new NearIntentsClient();
    const recipientZcashAddress = "utest1en0nk65p5azckzylfy86la39nrddhfrauvd02atvue9x2s7c...";

    const quote = await client.createCrossChainQuote(
      {
        sourceAssetId: "base:usdc",
        amountZec: 0.05,
        amountZatoshis: 5_000_000,
        recipientZcashAddress,
      },
      1000.0 // $1000/ZEC rate -> 0.05 ZEC = $50 USD
    );

    expect(quote).toBeDefined();
    expect(quote.quoteId).toMatch(/^ni_quote_/);
    expect(quote.sourceAsset.symbol).toBe("USDC");
    expect(quote.sourceAsset.chain).toBe("base");
    expect(quote.amountInFormatted).toBeGreaterThan(49); // ~$50.25 USD including solver fee
    expect(quote.amountOutZec).toBe(0.05);
    expect(quote.amountOutZatoshis).toBe(5_000_000);
    expect(quote.recipientZcashAddress).toBe(recipientZcashAddress);
    expect(quote.depositAddress).toMatch(/^0x[a-f0-9]{40}$/);
    expect(quote.status).toBe("PENDING_DEPOSIT");
    expect(quote.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("generates a Solana deposit address when swapping from USDC on Solana", async () => {
    const client = new NearIntentsClient();
    const quote = await client.createCrossChainQuote({
      sourceAssetId: "solana:usdc",
      amountZec: 0.02,
      amountZatoshis: 2_000_000,
      recipientZcashAddress: "utest1solanadeposit...",
    });

    expect(quote.sourceAsset.chain).toBe("solana");
    expect(quote.depositAddress).toMatch(/^SolNear/);
  });

  it("tracks intent execution status gracefully", async () => {
    const client = new NearIntentsClient();
    const status = await client.trackIntentStatus("ni_quote_mock_123");
    expect(status.quoteId).toBe("ni_quote_mock_123");
    expect(status.status).toBe("PENDING_DEPOSIT");
  });
});
