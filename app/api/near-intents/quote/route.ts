import { NextResponse } from "next/server";
import { nearIntentsClient, SUPPORTED_SOURCE_ASSETS } from "@/lib/near-intents";
import { getZecUsdRate } from "@/lib/rates/oracle";

export async function GET() {
  return NextResponse.json({
    success: true,
    supportedAssets: SUPPORTED_SOURCE_ASSETS,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      sourceAssetId?: string;
      amountZec?: number;
      amountZatoshis?: number;
      recipientZcashAddress?: string;
    };

    if (!body.sourceAssetId || !body.recipientZcashAddress || !body.amountZec) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: sourceAssetId, amountZec, recipientZcashAddress" },
        { status: 400 }
      );
    }

    const { rate } = await getZecUsdRate();

    const quote = await nearIntentsClient.createCrossChainQuote(
      {
        sourceAssetId: body.sourceAssetId,
        amountZec: body.amountZec,
        amountZatoshis: body.amountZatoshis || Math.round(body.amountZec * 100_000_000),
        recipientZcashAddress: body.recipientZcashAddress,
      },
      rate
    );

    return NextResponse.json({
      success: true,
      quote,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
