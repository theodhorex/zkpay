import { describe, expect, it } from "bun:test";
import { validateUfvk, deriveDiversifiedAddress, generateTestAccount } from "./derive";

describe("Zcash UFVK and Address Derivation Service (TASK-1.1)", () => {
  it("rejects invalid UFVK string", async () => {
    const res = await validateUfvk("invalid_ufvk_string");
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("rejects invalid diversifier index", async () => {
    const res = await deriveDiversifiedAddress("uviewtest1...", -1);
    expect(res.success).toBe(false);
    expect(res.error).toContain("non-negative integer");
  });

  it("generates a valid testnet account with UFVK", async () => {
    const account = await generateTestAccount(42);
    expect(account.success).toBe(true);
    expect(account.network).toBe("testnet");
    expect(account.ufvk.startsWith("uviewtest1")).toBe(true);
    expect(account.default_address.startsWith("utest1")).toBe(true);

    // Validate the generated UFVK
    const validation = await validateUfvk(account.ufvk);
    expect(validation.success).toBe(true);
    expect(validation.network).toBe("testnet");
    expect(validation.has_orchard).toBe(true);

    // Derive diversified addresses for Invoice #1 and Invoice #2
    const invoice1 = await deriveDiversifiedAddress(account.ufvk, 1);
    expect(invoice1.success).toBe(true);
    expect(invoice1.network).toBe("testnet");
    expect(invoice1.diversifier_index).toBe(1);
    expect(invoice1.address?.startsWith("utest1")).toBe(true);

    const invoice2 = await deriveDiversifiedAddress(account.ufvk, 2);
    expect(invoice2.success).toBe(true);
    expect(invoice2.network).toBe("testnet");
    expect(invoice2.diversifier_index).toBe(2);
    expect(invoice2.address?.startsWith("utest1")).toBe(true);

    // Verify distinctness between invoices
    expect(invoice1.address).not.toBe(invoice2.address);

    // Verify determinism (re-deriving invoice #1 yields exact same address)
    const invoice1Repeat = await deriveDiversifiedAddress(account.ufvk, 1);
    expect(invoice1Repeat.address).toBe(invoice1.address);
  });
});
