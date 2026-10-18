import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import protobuf from "protobufjs";
import { getBinaryPath } from "./derive";
import { CompactBlock, LightwalletdClient } from "./lightwalletd";

const execFileAsync = promisify(execFile);

let compactBlockType: protobuf.Type | null = null;

function getCompactBlockType(): protobuf.Type {
  if (!compactBlockType) {
    const root = protobuf.loadSync(path.resolve(process.cwd(), "proto/compact_formats.proto"));
    compactBlockType = root.lookupType("cash.z.wallet.sdk.rpc.CompactBlock");
  }
  return compactBlockType;
}

export interface DetectedPayment {
  txid: string;
  pool: "orchard" | "sapling";
  value_zatoshis: number;
  value_zec: number;
  diversifier: string;
  recipient_address?: string;
}

export interface ScanResult {
  success: boolean;
  block_height: number;
  block_hash: string;
  payments_found: DetectedPayment[];
  error?: string;
}

/**
 * Encodes a CompactBlock object into its raw protobuf binary bytes.
 */
export function encodeCompactBlock(block: CompactBlock): Uint8Array {
  const type = getCompactBlockType();
  const message = type.create(block);
  return type.encode(message).finish();
}

/**
 * Scans raw CompactBlock bytes using zkpay-core trial decryption.
 */
export async function scanCompactBlockBytes(
  ufvk: string,
  blockBytes: Uint8Array | Buffer
): Promise<ScanResult> {
  const binary = getBinaryPath();

  // If block is small (<= 64KB), pass hex string directly in CLI argument
  if (blockBytes.length <= 65536) {
    const hex = Buffer.from(blockBytes).toString("hex");
    try {
      const { stdout } = await execFileAsync(binary, [
        "scan-compact-block",
        "--ufvk",
        ufvk,
        "--block-hex",
        hex,
      ]);
      return JSON.parse(stdout) as ScanResult;
    } catch (err: unknown) {
      const errorOutput = (err as { stdout?: string; stderr?: string })?.stdout;
      if (errorOutput) {
        try {
          return JSON.parse(errorOutput) as ScanResult;
        } catch {}
      }
      return {
        success: false,
        block_height: 0,
        block_hash: "",
        payments_found: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Otherwise, write to a temporary file to avoid OS command line length limits
  const tmpFile = path.join(
    os.tmpdir(),
    `zkpay-block-${Date.now()}-${Math.random().toString(36).slice(2)}.pb`
  );
  try {
    await fs.writeFile(tmpFile, blockBytes);
    const { stdout } = await execFileAsync(binary, [
      "scan-compact-block",
      "--ufvk",
      ufvk,
      "--block-file",
      tmpFile,
    ]);
    return JSON.parse(stdout) as ScanResult;
  } catch (err: unknown) {
    const errorOutput = (err as { stdout?: string; stderr?: string })?.stdout;
    if (errorOutput) {
      try {
        return JSON.parse(errorOutput) as ScanResult;
      } catch {}
    }
    return {
      success: false,
      block_height: 0,
      block_hash: "",
      payments_found: [],
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    try {
      await fs.unlink(tmpFile);
    } catch {}
  }
}

/**
 * Scans a CompactBlock object directly.
 */
export async function scanCompactBlock(
  ufvk: string,
  block: CompactBlock
): Promise<ScanResult> {
  const bytes = encodeCompactBlock(block);
  return scanCompactBlockBytes(ufvk, bytes);
}

/**
 * Scans a range of blocks fetched from lightwalletd for incoming payments.
 */
export async function scanBlockRange(
  client: LightwalletdClient,
  ufvk: string,
  startHeight: number,
  endHeight: number
): Promise<{
  scanned_blocks: number;
  payments: DetectedPayment[];
}> {
  const blocks = await client.getBlockRange(startHeight, endHeight);
  const allPayments: DetectedPayment[] = [];

  for (const block of blocks) {
    const result = await scanCompactBlock(ufvk, block);
    if (result.success && result.payments_found.length > 0) {
      allPayments.push(...result.payments_found);
    }
  }

  return {
    scanned_blocks: blocks.length,
    payments: allPayments,
  };
}
