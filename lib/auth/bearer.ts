/**
 * Zero-Knowledge Bearer Web Access Pass (ZIP-302 Memo & Bearer Token)
 * 
 * Generates and validates self-contained cryptographic access passes
 * allowing subscribers to unlock gated creator portals without email,
 * password, or centralized identity verification.
 */

import crypto from "node:crypto";

const JWT_SECRET = process.env.BEARER_ACCESS_SECRET || "zkpay_zk_access_secret_key_2026";

export interface AccessPassPayload {
  invoiceId: string;
  subscriberId: string;
  creatorId: string;
  telegramUserId?: string;
  expiresAt: number; // Unix timestamp ms
  memoSecret?: string;
}

export interface VerificationResult {
  valid: boolean;
  payload?: AccessPassPayload;
  error?: string;
}

/**
 * Creates a signed Zero-Knowledge Web Access Pass.
 */
export function generateWebAccessPass(payload: AccessPassPayload): string {
  const jsonStr = JSON.stringify(payload);
  const base64Data = Buffer.from(jsonStr, "utf-8").toString("base64url");

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(base64Data)
    .digest("base64url");

  return `zkp_${base64Data}.${signature}`;
}

/**
 * Verifies and decodes a Zero-Knowledge Web Access Pass.
 */
export function verifyWebAccessPass(token: string): VerificationResult {
  if (!token.startsWith("zkp_")) {
    return { valid: false, error: "Invalid token prefix: must start with 'zkp_'" };
  }

  const parts = token.slice(4).split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Malformed token structure" };
  }

  const [base64Data, signature] = parts;

  const expectedSig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(base64Data)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return { valid: false, error: "Invalid cryptographic signature" };
  }

  try {
    const rawJson = Buffer.from(base64Data, "base64url").toString("utf-8");
    const payload = JSON.parse(rawJson) as AccessPassPayload;

    if (Date.now() > payload.expiresAt) {
      return { valid: false, error: "Access pass has expired" };
    }

    return { valid: true, payload };
  } catch (err: unknown) {
    return { valid: false, error: `JSON decode error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Parses a ZIP-302 standard 512-byte shielded memo.
 * Formats:
 * - Text memo (UTF-8, <= 512 bytes)
 * - Structured prefix: `zkpay:pass:<phrase>` or `zkpay:uid:<telegramId>`
 */
export function parseZip302Memo(memoBytes: Uint8Array | Buffer | string): {
  type: "text" | "auth_phrase" | "telegram_claim" | "empty";
  content: string;
} {
  let str = "";
  if (typeof memoBytes === "string") {
    str = memoBytes;
  } else {
    // Strip trailing null bytes standard in 512-byte Zcash memos
    let end = memoBytes.length;
    while (end > 0 && memoBytes[end - 1] === 0x00) {
      end--;
    }
    str = Buffer.from(memoBytes.slice(0, end)).toString("utf-8").trim();
  }

  if (!str) {
    return { type: "empty", content: "" };
  }

  if (str.startsWith("zkpay:pass:")) {
    return { type: "auth_phrase", content: str.slice("zkpay:pass:".length) };
  }

  if (str.startsWith("zkpay:uid:")) {
    return { type: "telegram_claim", content: str.slice("zkpay:uid:".length) };
  }

  return { type: "text", content: str };
}
