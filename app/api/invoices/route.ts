import { NextResponse } from "next/server";
import { db, initDb, invoices, plans, creators } from "@/lib/db";
import { eq, desc } from "drizzle-orm";


export async function GET(req: Request) {
  await initDb();

  const { searchParams } = new URL(req.url);
  const invoiceId = searchParams.get("id");

  if (invoiceId) {
    const [row] = await db
      .select({
        id: invoices.id,
        creatorId: invoices.creator_id,
        planId: invoices.plan_id,
        telegramUserId: invoices.telegram_user_id,
        diversifierIndex: invoices.diversifier_index,
        paymentAddress: invoices.payment_address,
        amountUsd: invoices.amount_usd,
        amountZatoshis: invoices.amount_zatoshis,
        amountZec: invoices.amount_zec,
        rateZecUsd: invoices.rate_zec_usd,
        rateExpiresAt: invoices.rate_expires_at,
        status: invoices.status,
        txid: invoices.txid,
        pool: invoices.pool,
        detectedAt: invoices.detected_at,
        confirmedAt: invoices.confirmed_at,
        createdAt: invoices.created_at,
        planName: plans.name,
        planIntervalDays: plans.interval_days,
        channelTitle: creators.channel_title,
        channelId: creators.channel_id,
      })
      .from(invoices)
      .innerJoin(plans, eq(invoices.plan_id, plans.id))
      .innerJoin(creators, eq(invoices.creator_id, creators.id))
      .where(eq(invoices.id, invoiceId));

    if (!row) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, invoice: row });
  }

  const allInvoices = await db
    .select({
      id: invoices.id,
      creatorId: invoices.creator_id,
      planId: invoices.plan_id,
      telegramUserId: invoices.telegram_user_id,
      diversifierIndex: invoices.diversifier_index,
      paymentAddress: invoices.payment_address,
      amountUsd: invoices.amount_usd,
      amountZatoshis: invoices.amount_zatoshis,
      amountZec: invoices.amount_zec,
      rateZecUsd: invoices.rate_zec_usd,
      rateExpiresAt: invoices.rate_expires_at,
      status: invoices.status,
      txid: invoices.txid,
      pool: invoices.pool,
      detectedAt: invoices.detected_at,
      confirmedAt: invoices.confirmed_at,
      createdAt: invoices.created_at,
      planName: plans.name,
    })
    .from(invoices)
    .innerJoin(plans, eq(invoices.plan_id, plans.id))
    .orderBy(desc(invoices.created_at))
    .limit(50);

  const confirmedInvoices = allInvoices.filter((i) => i.status === "confirmed" || i.status === "overpaid");

  const revenue = {
    totalZec: confirmedInvoices.reduce((acc, curr) => acc + curr.amountZec, 0),
    totalUsd: confirmedInvoices.reduce((acc, curr) => acc + curr.amountUsd, 0),
    confirmedCount: confirmedInvoices.length,
    underpaidCount: allInvoices.filter((i) => i.status === "underpaid").length,
    pendingCount: allInvoices.filter((i) => i.status === "pending").length,
    totalCount: allInvoices.length,
  };

  return NextResponse.json({ revenue, invoices: allInvoices });
}
