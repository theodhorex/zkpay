import { describe, expect, it } from "bun:test";
import { getBot } from "./bot";
import { GET } from "@/app/api/telegram/route";

describe("Telegram Bot Core & Command Handler (TASK-3.1)", () => {
  it("initializes bot instance with registered commands", () => {
    const bot = getBot("123456:mock_token_for_tests");
    expect(bot).toBeDefined();
    expect(typeof bot.command).toBe("function");
    expect(typeof bot.handleUpdate).toBe("function");
  });

  it("handles GET request on telegram webhook route", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("zkpay telegram webhook online");
  });

  it("dispatches /start and /help command updates without unhandled exceptions", async () => {
    const bot = getBot("123456:mock_token_for_tests");

    // Mock bot identity so handleUpdate does not make network calls to Telegram getMe
    bot.botInfo = {
      id: 123456,
      is_bot: true,
      first_name: "zkpay_bot",
      username: "zkpay_bot",
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    };

    let replyMessage = "";
    // Intercept outgoing API calls to avoid network requests to Telegram servers in test
    bot.api.config.use(async (prev, method, payload: any) => {
      if (method === "sendMessage") {
        replyMessage = payload.text;
        return { ok: true, result: { message_id: 1, date: 1, chat: payload.chat_id } } as any;
      }
      return prev(method, payload);
    });

    // Test /help command
    await bot.handleUpdate({
      update_id: 10001,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 99999, type: "private", first_name: "TestUser" },
        from: { id: 99999, is_bot: false, first_name: "TestUser" },
        text: "/help",
        entities: [{ offset: 0, length: 5, type: "bot_command" }],
      },
    });

    expect(replyMessage).toContain("How to Pay with Shielded Zcash");
    expect(replyMessage).toContain("Zashi");

    // Test /start command
    await bot.handleUpdate({
      update_id: 10002,
      message: {
        message_id: 2,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 99999, type: "private", first_name: "TestUser" },
        from: { id: 99999, is_bot: false, first_name: "TestUser" },
        text: "/start",
        entities: [{ offset: 0, length: 6, type: "bot_command" }],
      },
    });

    expect(replyMessage).toContain("zkpay (ZecSub)");
    expect(replyMessage).toContain("/gabung");
  });
});
