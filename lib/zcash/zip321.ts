import QRCode from "qrcode";

export interface Zip321Params {
  address: string;
  amountZec?: number;
  message?: string;
  memo?: string;
}

/**
 * Builds a ZIP-321 standard Zcash payment URI.
 * Specification: https://zips.z.cash/zip-0321
 */
export function buildZip321Uri(params: Zip321Params): string {
  const { address, amountZec, message, memo } = params;

  if (!address || !address.trim()) {
    throw new Error("Address is required for ZIP-321 URI");
  }

  const queryParts: string[] = [];

  if (amountZec !== undefined) {
    if (amountZec <= 0) {
      throw new Error("Amount must be positive in ZIP-321 URI");
    }
    // Format up to 8 decimal places, removing unnecessary trailing zeroes
    const formattedAmount = Number(amountZec.toFixed(8)).toString();
    queryParts.push(`amount=${encodeURIComponent(formattedAmount)}`);
  }

  if (message) {
    queryParts.push(`message=${encodeURIComponent(message)}`);
  }

  if (memo) {
    // ZIP-321 memo is base64url encoded without padding
    const base64urlMemo = Buffer.from(memo, "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    queryParts.push(`memo=${base64urlMemo}`);
  }

  const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
  return `zcash:${address.trim()}${queryString}`;
}

/**
 * Parses a ZIP-321 URI into structured parameters.
 */
export function parseZip321Uri(uri: string): Zip321Params {
  if (!uri.startsWith("zcash:")) {
    throw new Error("Invalid ZIP-321 URI: must start with 'zcash:'");
  }

  const withoutScheme = uri.slice(6);
  const [addressPart, queryPart] = withoutScheme.split("?");

  const result: Zip321Params = {
    address: decodeURIComponent(addressPart),
  };

  if (queryPart) {
    const params = new URLSearchParams(queryPart);
    const amountStr = params.get("amount");
    if (amountStr) {
      const parsedAmount = parseFloat(amountStr);
      if (!isNaN(parsedAmount)) {
        result.amountZec = parsedAmount;
      }
    }

    const message = params.get("message");
    if (message) {
      result.message = message;
    }

    const memo = params.get("memo");
    if (memo) {
      try {
        // Decode base64url
        const base64 = memo.replace(/-/g, "+").replace(/_/g, "/");
        result.memo = Buffer.from(base64, "base64").toString("utf-8");
      } catch {
        // If memo decoding fails, keep raw
        result.memo = memo;
      }
    }
  }

  return result;
}

/**
 * Generates a PNG QR code buffer for a ZIP-321 payment URI.
 */
export async function generatePaymentQrBuffer(uri: string): Promise<Buffer> {
  return QRCode.toBuffer(uri, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 400,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

/**
 * Generates a Data URL (base64 PNG) for rendering directly in HTML / web UI.
 */
export async function generatePaymentQrDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 400,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

/**
 * Generates an SVG string of the QR code.
 */
export async function generatePaymentQrSvg(uri: string): Promise<string> {
  return QRCode.toString(uri, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
  });
}
