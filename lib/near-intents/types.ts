/**
 * NEAR Intents 1Click Cross-Chain Settlement Engine Types
 * Specs: https://docs.near-intents.org/
 */

export interface SupportedAsset {
  id: string;
  symbol: string;
  name: string;
  chain: "solana" | "base" | "arbitrum" | "ethereum" | "near";
  decimals: number;
  iconUrl?: string;
  defuseAssetId: string;
}

export interface CrossChainQuoteRequest {
  sourceAssetId: string;
  amountZec: number;
  amountZatoshis: number;
  recipientZcashAddress: string;
  slippageTolerancePercent?: number;
}

export interface CrossChainQuote {
  quoteId: string;
  sourceAsset: SupportedAsset;
  amountIn: string;
  amountInFormatted: number;
  amountOutZec: number;
  amountOutZatoshis: number;
  recipientZcashAddress: string;
  depositAddress: string;
  memoOrTag?: string;
  estimatedSettlementSeconds: number;
  expiresAt: Date;
  status: "PENDING_DEPOSIT" | "SOLVER_PROCESSING" | "SETTLED" | "EXPIRED";
}

export interface IntentStatusResponse {
  quoteId: string;
  status: "PENDING_DEPOSIT" | "SOLVER_PROCESSING" | "SETTLED" | "EXPIRED";
  txHashIn?: string;
  txHashOutZec?: string;
  settledAt?: Date;
}
