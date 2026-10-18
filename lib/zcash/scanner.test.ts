import { describe, expect, it } from "bun:test";
import { generateTestAccount } from "./derive";
import { LightwalletdClient } from "./lightwalletd";
import {
  encodeCompactBlock,
  scanCompactBlock,
  scanCompactBlockBytes,
  scanBlockRange,
} from "./scanner";

describe("Zcash Compact Block Scanner & Trial Decryption", () => {
  it("encodes and scans a block with no matching payments gracefully", async () => {
    const testAccount = await generateTestAccount(42);
    expect(testAccount.success).toBe(true);

    const emptyBlock = {
      protoVersion: 1,
      height: 4500000,
      hash: Buffer.alloc(32, 0xaa),
      prevHash: Buffer.alloc(32, 0xbb),
      time: Math.floor(Date.now() / 1000),
      header: Buffer.alloc(0),
      vtx: [],
    };

    const encoded = encodeCompactBlock(emptyBlock);
    expect(encoded.length).toBeGreaterThan(0);

    const result = await scanCompactBlockBytes(testAccount.ufvk, encoded);
    expect(result.success).toBe(true);
    expect(result.block_height).toBe(4500000);
    expect(result.payments_found).toEqual([]);
    expect(result.error).toBeFalsy();
  });

  it("handles invalid ufvk gracefully", async () => {
    const emptyBlock = {
      protoVersion: 1,
      height: 100,
      hash: Buffer.alloc(32, 0x01),
      prevHash: Buffer.alloc(32, 0x00),
      time: 123456,
      header: Buffer.alloc(0),
      vtx: [],
    };

    const result = await scanCompactBlock("invalid_ufvk_key", emptyBlock);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("fetches and trial-decrypts real live compact blocks from testnet", async () => {
    const client = new LightwalletdClient();
    try {
      const testAccount = await generateTestAccount(7);
      const latestHeight = await client.getLatestBlockHeight();
      expect(latestHeight).toBeGreaterThan(4500000);

      // Scan the 3 most recent blocks from testnet
      const scanOutput = await scanBlockRange(
        client,
        testAccount.ufvk,
        latestHeight - 2,
        latestHeight
      );

      expect(scanOutput.scanned_blocks).toBe(3);
      expect(Array.isArray(scanOutput.payments)).toBe(true);
    } finally {
      client.close();
    }
  }, 15000);
});
