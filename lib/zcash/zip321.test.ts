import { describe, expect, it } from "bun:test";
import {
  buildZip321Uri,
  parseZip321Uri,
  generatePaymentQrBuffer,
  generatePaymentQrDataUrl,
  generatePaymentQrSvg,
} from "./zip321";

describe("ZIP-321 Payment URI & QR Code Generator (TASK-3.2)", () => {
  it("builds a standard ZIP-321 URI with amount and message", () => {
    const uri = buildZip321Uri({
      address: "utest1testpaymentaddress99999",
      amountZec: 0.5,
      message: "Monthly VIP",
    });

    expect(uri).toBe("zcash:utest1testpaymentaddress99999?amount=0.5&message=Monthly%20VIP");
  });

  it("handles base64url memo encoding and precision", () => {
    const uri = buildZip321Uri({
      address: "utest1testpaymentaddress99999",
      amountZec: 1.12345678,
      memo: "Invoice 12345",
    });

    expect(uri).toContain("amount=1.12345678");
    expect(uri).toContain("memo=");

    const parsed = parseZip321Uri(uri);
    expect(parsed.address).toBe("utest1testpaymentaddress99999");
    expect(parsed.amountZec).toBe(1.12345678);
    expect(parsed.memo).toBe("Invoice 12345");
  });

  it("parses full ZIP-321 URI correctly", () => {
    const rawUri = "zcash:utest1dest?amount=2.5&message=Alpha%20Pass";
    const parsed = parseZip321Uri(rawUri);

    expect(parsed.address).toBe("utest1dest");
    expect(parsed.amountZec).toBe(2.5);
    expect(parsed.message).toBe("Alpha Pass");
  });

  it("throws validation errors for invalid arguments", () => {
    expect(() => buildZip321Uri({ address: "", amountZec: 1 })).toThrow();
    expect(() => buildZip321Uri({ address: "utest1", amountZec: -5 })).toThrow();
    expect(() => parseZip321Uri("bitcoin:123")).toThrow();
  });

  it("generates a valid PNG QR code buffer with PNG magic header", async () => {
    const uri = "zcash:utest1sample?amount=0.25";
    const buffer = await generatePaymentQrBuffer(uri);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);
    // Verify PNG magic header: 0x89 50 4E 47 0D 0A 1A 0A
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50); // 'P'
    expect(buffer[2]).toBe(0x4e); // 'N'
    expect(buffer[3]).toBe(0x47); // 'G'
  });

  it("generates valid data URL and SVG representations", async () => {
    const uri = "zcash:utest1sample?amount=0.25";

    const dataUrl = await generatePaymentQrDataUrl(uri);
    expect(dataUrl).toStartWith("data:image/png;base64,");

    const svg = await generatePaymentQrSvg(uri);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});
