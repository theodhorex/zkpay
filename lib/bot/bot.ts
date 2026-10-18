import { Bot } from "grammy";
import { registerCommands } from "./handlers";
import { registerGatekeeper } from "./gatekeeper";

let botInstance: Bot | null = null;

export function getBot(token?: string): Bot {
  if (botInstance && !token) {
    return botInstance;
  }

  const botToken = token || process.env.TELEGRAM_BOT_TOKEN || "mock_token_for_dev_and_tests";
  const bot = new Bot(botToken);
  registerCommands(bot);
  registerGatekeeper(bot);

  if (!token) {
    botInstance = bot;
  }

  return bot;
}
