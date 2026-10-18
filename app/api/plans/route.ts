import { NextResponse } from "next/server";
import { db, initDb, plans, creators } from "@/lib/db";
import { eq } from "drizzle-orm";


export async function GET() {
  await initDb();
  const allPlans = await db.select().from(plans);
  return NextResponse.json({ plans: allPlans });
}

export async function POST(req: Request) {
  await initDb();

  try {
    const body = (await req.json()) as {
      creatorId?: string;
      name: string;
      description?: string;
      priceUsd: number;
      intervalDays?: number;
    };

    if (!body.name || typeof body.priceUsd !== "number" || body.priceUsd <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid name and positive priceUsd are required" },
        { status: 400 }
      );
    }

    let creatorId = body.creatorId;
    if (!creatorId) {
      const [firstCreator] = await db.select().from(creators);
      if (!firstCreator) {
        return NextResponse.json(
          { success: false, error: "No creator found. Onboard creator first." },
          { status: 400 }
        );
      }
      creatorId = firstCreator.id;
    }

    const planId = crypto.randomUUID();
    await db.insert(plans).values({
      id: planId,
      creator_id: creatorId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      price_usd: body.priceUsd,
      interval_days: body.intervalDays || 30,
      is_active: true,
    });

    const [created] = await db.select().from(plans).where(eq(plans.id, planId));
    return NextResponse.json({ success: true, plan: created });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  await initDb();

  try {
    const body = (await req.json()) as {
      id: string;
      isActive?: boolean;
      name?: string;
      priceUsd?: number;
    };

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "Plan ID is required" },
        { status: 400 }
      );
    }

    const updates: Partial<{
      is_active: boolean;
      name: string;
      price_usd: number;
    }> = {};

    if (body.isActive !== undefined) updates.is_active = body.isActive;
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.priceUsd !== undefined) updates.price_usd = body.priceUsd;

    await db.update(plans).set(updates).where(eq(plans.id, body.id));

    const [updated] = await db.select().from(plans).where(eq(plans.id, body.id));
    return NextResponse.json({ success: true, plan: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
