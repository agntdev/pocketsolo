import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getSharedClient } from "../services/pocket-option.js";
import { getTradeStore } from "../services/storage.js";

registerMainMenuItem({ label: "🚫 Cancel", data: "cancel:show", order: 50 });

const composer = new Composer<Ctx>();

const backMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

function noConnection(): string {
  return "Couldn't connect to Pocket Option. Check your credentials and try again.";
}

composer.command("cancel", async (ctx) => {
  const store = await getTradeStore();
  const trades = await store.listTrades(String(ctx.from?.id ?? 0), 5);
  const openTrades = trades.filter((t) => t.status === "open" || t.status === "pending");
  if (openTrades.length === 0) {
    await ctx.reply("No active trades to cancel.", { reply_markup: backMenu });
    return;
  }
  const buttons = openTrades.map((t) => [
    inlineButton(`${t.symbol} $${t.amount} — ${t.id}`, `cancel:exec:${t.id}`),
  ]);
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  await ctx.reply("Pick a trade to cancel:", { reply_markup: inlineKeyboard(buttons) });
});

composer.callbackQuery("cancel:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = await getTradeStore();
  const trades = await store.listTrades(String(ctx.from?.id ?? 0), 5);
  const openTrades = trades.filter((t) => t.status === "open" || t.status === "pending");
  if (openTrades.length === 0) {
    await ctx.editMessageText("No active trades to cancel.", { reply_markup: backMenu });
    return;
  }
  const buttons = openTrades.map((t) => [
    inlineButton(`${t.symbol} $${t.amount} — ${t.id}`, `cancel:exec:${t.id}`),
  ]);
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  await ctx.editMessageText("Pick a trade to cancel:", { reply_markup: inlineKeyboard(buttons) });
});

composer.callbackQuery(/^cancel:exec:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const tradeId = ctx.match[1];
  const client = getSharedClient();
  if (!client) {
    await ctx.editMessageText(noConnection(), { reply_markup: backMenu });
    return;
  }
  try {
    const result = await client.cancelTrade(tradeId);
    if (result.success) {
      const store = await getTradeStore();
      const trade = await store.getTrade(tradeId);
      if (trade) {
        trade.status = "closed";
        await store.saveTrade(trade);
      }
      await ctx.editMessageText(`Trade ${tradeId} cancelled.`, { reply_markup: backMenu });
    } else {
      await ctx.editMessageText(
        `Couldn't cancel trade: ${result.message}\n\nIt may have already settled.`,
        { reply_markup: backMenu },
      );
    }
  } catch {
    await ctx.editMessageText(
      "Something went wrong cancelling that trade. Try again.",
      { reply_markup: backMenu },
    );
  }
});

export default composer;
