import { NextResponse } from "next/server";
import { validateUfvk } from "@/lib/zcash";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { ufvk?: string };
    if (!body.ufvk || typeof body.ufvk !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid 'ufvk' parameter" },
        { status: 400 }
      );
    }

    const result = await validateUfvk(body.ufvk.trim());
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
