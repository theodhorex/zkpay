import { NextResponse } from "next/server";
import { runLifecycleCycle } from "@/lib/lifecycle/workers";
import { expireOverdueInvoices } from "@/lib/invoices/engine";


export async function GET(req: Request) {
  // Optional cron secret authorization
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expiredInvoices = await expireOverdueInvoices();
    const lifecycleResult = await runLifecycleCycle();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      expiredInvoices,
      ...lifecycleResult,
    });
  } catch (err: unknown) {
    console.error("Cron lifecycle error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
