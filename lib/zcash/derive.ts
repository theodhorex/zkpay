import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";

const execFileAsync = promisify(execFile);

export interface ValidateUfvkResult {
  success: boolean;
  network?: "mainnet" | "testnet";
  has_orchard?: boolean;
  has_sapling?: boolean;
  error?: string;
}

export interface DeriveAddressResult {
  success: boolean;
  network?: "mainnet" | "testnet";
  address?: string;
  diversifier_index?: number;
  has_orchard?: boolean;
  has_sapling?: boolean;
  error?: string;
}

export interface GenerateTestAccountResult {
  success: boolean;
  network: "mainnet" | "testnet";
  ufvk: string;
  default_address: string;
  error?: string;
}


function getBinaryPath(): string {
  // Check release binary first, fallback to debug
  const releasePath = path.resolve(process.cwd(), "crates/zkpay-core/target/release/zkpay-core");
  if (fs.existsSync(releasePath)) {
    return releasePath;
  }
  const debugPath = path.resolve(process.cwd(), "crates/zkpay-core/target/debug/zkpay-core");
  if (fs.existsSync(debugPath)) {
    return debugPath;
  }
  throw new Error(`zkpay-core binary not found. Run 'cargo build --manifest-path crates/zkpay-core/Cargo.toml' first.`);
}

/**
 * Validates a Zcash Unified Full Viewing Key (UFVK) string.
 */
export async function validateUfvk(ufvk: string): Promise<ValidateUfvkResult> {
  const binary = getBinaryPath();
  try {
    const { stdout } = await execFileAsync(binary, ["validate-ufvk", "--ufvk", ufvk]);
    return JSON.parse(stdout) as ValidateUfvkResult;
  } catch (err: unknown) {
    const errorOutput = (err as { stdout?: string; stderr?: string })?.stdout;
    if (errorOutput) {
      try {
        return JSON.parse(errorOutput) as ValidateUfvkResult;
      } catch {
        // ignore parse error
      }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Derives a diversified unified address from a UFVK for a specific invoice index.
 */
export async function deriveDiversifiedAddress(
  ufvk: string,
  index: number
): Promise<DeriveAddressResult> {
  if (index < 0 || !Number.isInteger(index)) {
    return {
      success: false,
      error: "Diversifier index must be a non-negative integer",
    };
  }

  const binary = getBinaryPath();
  try {
    const { stdout } = await execFileAsync(binary, [
      "derive-address",
      "--ufvk",
      ufvk,
      "--index",
      index.toString(),
    ]);
    return JSON.parse(stdout) as DeriveAddressResult;
  } catch (err: unknown) {
    const errorOutput = (err as { stdout?: string; stderr?: string })?.stdout;
    if (errorOutput) {
      try {
        return JSON.parse(errorOutput) as DeriveAddressResult;
      } catch {
        // ignore parse error
      }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Generates a fresh testnet keypair and UFVK for testing/development.
 */
export async function generateTestAccount(seedNonce = 0): Promise<GenerateTestAccountResult> {
  const binary = getBinaryPath();
  const { stdout } = await execFileAsync(binary, [
    "generate-test-account",
    "--seed-nonce",
    seedNonce.toString(),
  ]);
  return JSON.parse(stdout) as GenerateTestAccountResult;
}

