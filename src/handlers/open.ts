import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getSharedClient } from "../services/pocket-option.js";

registerMainMenuItem({ label: "📋 Open", data: "open:show", order: 30 });

const composer = new Composer<Ctx>();

const backMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

function noConnection(): string {
  return "Couldn't connect to Pocket Option. Check your credentials and try again.";
}

function formatPositions(positions: Awaited<ReturnType<NonNullable<ReturnType<typeof getSharedClient>>["getOpenPositions"]>>): string {
  if (positions.length === 0) {
    return "No open positions.";
  }
  const lines = positions.map((p) => {
    const dir = p.direction === "call" ? "📈" : "📉";
    return `${dir} ${p.symbol} — $${p.amount} (${p.direction})`;
  });
  return `📋 Open positions\n\n${lines.join("\n")}`;
}

composer.command("open", async (ctx) => {
  const client = getSharedClient();
  if (!client) {
    await ctx.reply(noConnection(), { reply_markup: backMenu });
    return;
  }
  try {
    const positions = await client.getOpenPositions();
    await ctx.reply(formatPositions(positions), { reply_markup: backMenu });
  } catch {
    await ctx.reply("Couldn't fetch open positions. Check your connection and try again.", {
      reply_markup: backMenu,
    });
  }
});

composer.callbackQuery("open:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const client = getSharedClient();
  if (!client) {
    await ctx.editMessageText(noConnection(), { reply_markup: backMenu });
    return;
  }
  try {
    const positions = await client.getOpenPositions();
    await ctx.editMessageText(formatPositions(positions), { reply_markup: backMenu });
  } catch {
    await ctx.editMessageText("Couldn't fetch open positions. Check your connection and try again.", {
      reply_markup: backMenu,
    });
  }
});

export default composer;
