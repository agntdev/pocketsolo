import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getSharedClient } from "../services/pocket-option.js";

registerMainMenuItem({ label: "📜 History", data: "history:show", order: 40 });

const composer = new Composer<Ctx>();

const backMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

function noConnection(): string {
  return "Couldn't connect to Pocket Option. Check your credentials and try again.";
}

function formatHistory(trades: Awaited<ReturnType<NonNullable<ReturnType<typeof getSharedClient>>["getTradeHistory"]>>): string {
  if (trades.length === 0) {
    return "No trade history yet.";
  }
  const lines = trades.slice(0, 10).map((t) => {
    const dir = t.direction === "call" ? "📈" : "📉";
    const outcome = t.outcome === "win" ? "✅" : t.outcome === "loss" ? "❌" : "⏳";
    const pnl = t.pnl != null ? (t.pnl >= 0 ? `+$${t.pnl.toFixed(2)}` : `-$${Math.abs(t.pnl).toFixed(2)}`) : "";
    return `${outcome} ${dir} ${t.symbol} — $${t.amount} (${t.direction}) ${pnl}`;
  });
  return `📜 Trade history\n\n${lines.join("\n")}`;
}

composer.command("history", async (ctx) => {
  const client = getSharedClient();
  if (!client) {
    await ctx.reply(noConnection(), { reply_markup: backMenu });
    return;
  }
  try {
    const trades = await client.getTradeHistory(10);
    await ctx.reply(formatHistory(trades), { reply_markup: backMenu });
  } catch {
    await ctx.reply("Couldn't fetch trade history. Check your connection and try again.", {
      reply_markup: backMenu,
    });
  }
});

composer.callbackQuery("history:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const client = getSharedClient();
  if (!client) {
    await ctx.editMessageText(noConnection(), { reply_markup: backMenu });
    return;
  }
  try {
    const trades = await client.getTradeHistory(10);
    await ctx.editMessageText(formatHistory(trades), { reply_markup: backMenu });
  } catch {
    await ctx.editMessageText("Couldn't fetch trade history. Check your connection and try again.", {
      reply_markup: backMenu,
    });
  }
});

export default composer;
