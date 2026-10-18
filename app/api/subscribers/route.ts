import { NextResponse } from "next/server";
import { db, initDb, subscribers, plans, creators } from "@/lib/db";
import { eq, desc } from "drizzle-orm";


export async function GET(req: Request) {
  await initDb();

  const url = new URL(req.url);
  const format = url.searchParams.get("format");

  const roster = await db
    .select({
      id: subscribers.id,
      telegramUserId: subscribers.telegram_user_id,
      telegramUsername: subscribers.telegram_username,
      status: subscribers.status,
      currentPeriodStart: subscribers.current_period_start,
      currentPeriodEnd: subscribers.current_period_end,
      gracePeriodEnd: subscribers.grace_period_end,
      joinRequestApproved: subscribers.join_request_approved,
      createdAt: subscribers.created_at,
      planName: plans.name,
      planPriceUsd: plans.price_usd,
      channelTitle: creators.channel_title,
    })
    .from(subscribers)
    .innerJoin(plans, eq(subscribers.plan_id, plans.id))
    .innerJoin(creators, eq(subscribers.creator_id, creators.id))
    .orderBy(desc(subscribers.created_at));

  // If CSV export is requested
  if (format === "csv") {
    const headers = [
      "Subscriber ID",
      "Telegram User ID",
      "Username",
      "Plan",
      "Price (USD)",
      "Status",
      "Period Start",
      "Period End",
      "Grace Period End",
      "Join Approved",
      "Created At",
    ];

    const rows = roster.map((s) => [
      s.id,
      s.telegramUserId,
      s.telegramUsername || "",
      s.planName,
      s.planPriceUsd,
      s.status,
      s.currentPeriodStart ? new Date(s.currentPeriodStart).toISOString() : "",
      s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toISOString() : "",
      s.gracePeriodEnd ? new Date(s.gracePeriodEnd).toISOString() : "",
      s.joinRequestApproved ? "YES" : "NO",
      new Date(s.createdAt).toISOString(),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="zkpay-subscribers-${Date.now()}.csv"`,
      },
    });
  }

  // Summary counts
  const stats = {
    total: roster.length,
    active: roster.filter((s) => s.status === "active").length,
    gracePeriod: roster.filter((s) => s.status === "grace_period").length,
    evicted: roster.filter((s) => s.status === "evicted").length,
    pending: roster.filter((s) => s.status === "pending").length,
  };

  return NextResponse.json({ stats, subscribers: roster });
}
