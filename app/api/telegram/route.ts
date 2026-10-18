import { webhookCallback } from "grammy";
import { getBot } from "@/lib/bot/bot";


export async function POST(req: Request) {
  try {
    const bot = getBot();
    const handleWebhook = webhookCallback(bot, "std/http");
    return await handleWebhook(req);
  } catch (err: unknown) {
    console.error("Telegram webhook error:", err);
    return new Response(JSON.stringify({ error: "Webhook handling failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET() {
  return new Response(JSON.stringify({ status: "zkpay telegram webhook online" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
