import { NextResponse } from "next/server";
import { runScannerCycle } from "@/lib/zcash";

export async function GET() {
  try {
    const result = await runScannerCycle();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
