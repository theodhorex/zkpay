import { describe, expect, it } from "bun:test";
import {
  generateWebAccessPass,
  verifyWebAccessPass,
  parseZip302Memo,
} from "./bearer";

describe("ZIP-302 Encrypted Memo & Zero-Knowledge Bearer Web Access Pass (TASK-7.3)", () => {
  it("generates and verifies a valid cryptographic web access pass", () => {
    const payload = {
      invoiceId: "inv_12345",
      subscriberId: "sub_67890",
      creatorId: "creator_abc",
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    const token = generateWebAccessPass(payload);
    expect(token).toStartWith("zkp_");

    const result = verifyWebAccessPass(token);
    expect(result.valid).toBe(true);
    expect(result.payload?.invoiceId).toBe("inv_12345");
    expect(result.payload?.creatorId).toBe("creator_abc");
  });

  it("rejects tampered or malformed tokens", () => {
    const payload = {
      invoiceId: "inv_real",
      subscriberId: "sub_real",
      creatorId: "creator_real",
      expiresAt: Date.now() + 10000,
    };

    const token = generateWebAccessPass(payload);
    const tampered = token.slice(0, -4) + "XXXX";

    const result = verifyWebAccessPass(tampered);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("signature");
  });

  it("rejects expired tokens", () => {
    const payload = {
      invoiceId: "inv_old",
      subscriberId: "sub_old",
      creatorId: "creator_old",
      expiresAt: Date.now() - 5000, // expired 5 seconds ago
    };

    const token = generateWebAccessPass(payload);
    const result = verifyWebAccessPass(token);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("expired");
  });

  it("parses ZIP-302 memo with null padding and structured claims", () => {
    // 512-byte buffer with text and trailing zeros
    const raw = Buffer.alloc(512);
    raw.write("zkpay:pass:super_secret_alpha_access", 0, "utf-8");

    const parsed = parseZip302Memo(raw);
    expect(parsed.type).toBe("auth_phrase");
    expect(parsed.content).toBe("super_secret_alpha_access");

    const empty = parseZip302Memo(Buffer.alloc(512));
    expect(empty.type).toBe("empty");
  });
});
