import { NextResponse } from "next/server";
import { db, initDb, creators, type Creator } from "@/lib/db";
import { validateUfvk, generateTestAccount } from "@/lib/zcash";
import { eq } from "drizzle-orm";


export async function GET() {
  await initDb();

  const [creator] = await db.select().from(creators);
  if (!creator) {
    // Generate a default demo creator on testnet for instant out-of-the-box evaluation
    const testAccount = await generateTestAccount(1);
    const newId = crypto.randomUUID();
    await db.insert(creators).values({
      id: newId,
      telegram_user_id: "demo_admin",
      username: "zkpay_creator",
      ufvk: testAccount.ufvk,
      channel_id: "-100123456789",
      channel_title: "Zcash Shielded Alpha VIP",
    });

    const [created] = await db.select().from(creators).where(eq(creators.id, newId));
    return NextResponse.json({ creator: created });
  }

  return NextResponse.json({ creator });
}

export async function POST(req: Request) {
  await initDb();

  try {
    const body = (await req.json()) as {
      id?: string;
      ufvk?: string;
      channelId?: string;
      channelTitle?: string;
      username?: string;
    };

    if (body.ufvk) {
      const validation = await validateUfvk(body.ufvk.trim());
      if (!validation.success) {
        return NextResponse.json(
          { success: false, error: `Invalid UFVK: ${validation.error}` },
          { status: 400 }
        );
      }
    }

    const [existing] = await db.select().from(creators);
    const creatorId = body.id || existing?.id || crypto.randomUUID();

    if (existing) {
      await db
        .update(creators)
        .set({
          ufvk: body.ufvk ? body.ufvk.trim() : existing.ufvk,
          channel_id: body.channelId !== undefined ? body.channelId : existing.channel_id,
          channel_title: body.channelTitle !== undefined ? body.channelTitle : existing.channel_title,
          username: body.username !== undefined ? body.username : existing.username,
        })
        .where(eq(creators.id, existing.id));
    } else {
      await db.insert(creators).values({
        id: creatorId,
        telegram_user_id: "admin",
        username: body.username || "creator",
        ufvk: body.ufvk ? body.ufvk.trim() : "",
        channel_id: body.channelId || null,
        channel_title: body.channelTitle || null,
      });
    }

    const [updated] = await db.select().from(creators).where(eq(creators.id, creatorId));
    return NextResponse.json({ success: true, creator: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
