import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  registerMainMenuItem,
  inlineButton,
  inlineKeyboard,
  confirmKeyboard,
} from "../toolkit/index.js";
import { getSharedClient } from "../services/pocket-option.js";
import { getTradeStore } from "../services/storage.js";
import type { TradeRecord } from "../services/pocket-option.js";

registerMainMenuItem({ label: "📈 Trade", data: "trade:start", order: 20 });

const composer = new Composer<Ctx>();

const SYMBOLS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "BTC/USD"];

function mainMenu() {
  return inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);
}

function symbolKeyboard() {
  return inlineKeyboard(
    SYMBOLS.map((s) => [inlineButton(s, `trade:sym:${s}`)]),
  );
}

function directionKeyboard() {
  return inlineKeyboard([
    [inlineButton("📈 Call", "trade:dir:call"), inlineButton("📉 Put", "trade:dir:put")],
  ]);
}

function durationKeyboard() {
  return inlineKeyboard([
    [inlineButton("30s", "trade:dur:30"), inlineButton("1m", "trade:dur:60")],
    [inlineButton("5m", "trade:dur:300"), inlineButton("15m", "trade:dur:900")],
  ]);
}

function noConnection(): string {
  return "Couldn't connect to Pocket Option. Check your credentials and try again.";
}

composer.command("trade", async (ctx) => {
  ctx.session.tradeStep = "symbol";
  ctx.session.tradeSymbol = undefined;
  ctx.session.tradeDirection = undefined;
  ctx.session.tradeAmount = undefined;
  ctx.session.tradeDuration = undefined;
  await ctx.reply("Pick an asset to trade:", { reply_markup: symbolKeyboard() });
});

composer.callbackQuery("trade:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.tradeStep = "symbol";
  ctx.session.tradeSymbol = undefined;
  ctx.session.tradeDirection = undefined;
  ctx.session.tradeAmount = undefined;
  ctx.session.tradeDuration = undefined;
  await ctx.editMessageText("Pick an asset to trade:", { reply_markup: symbolKeyboard() });
});

composer.callbackQuery(/^trade:sym:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const symbol = ctx.match[1];
  ctx.session.tradeSymbol = symbol;
  ctx.session.tradeStep = "direction";
  await ctx.editMessageText(
    `${symbol} — pick direction:`,
    { reply_markup: directionKeyboard() },
  );
});

composer.callbackQuery(/^trade:dir:(call|put)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const dir = ctx.match[1] as "call" | "put";
  ctx.session.tradeDirection = dir;
  ctx.session.tradeStep = "amount";
  await ctx.editMessageText(
    `How much to risk? Enter a dollar amount:`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("$5", "trade:amt:5"), inlineButton("$10", "trade:amt:10")],
        [inlineButton("$25", "trade:amt:25"), inlineButton("$50", "trade:amt:50")],
        [inlineButton("⬅️ Cancel", "trade:cancel")],
      ]),
    },
  );
});

composer.callbackQuery(/^trade:amt:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const amount = Number(ctx.match[1]);
  ctx.session.tradeAmount = amount;
  ctx.session.tradeStep = "duration";
  await ctx.editMessageText(
    `Pick duration:`,
    { reply_markup: durationKeyboard() },
  );
});

composer.callbackQuery(/^trade:dur:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const duration = Number(ctx.match[1]);
  ctx.session.tradeDuration = duration;
  ctx.session.tradeStep = "confirm";

  const sym = ctx.session.tradeSymbol ?? "—";
  const dir = ctx.session.tradeDirection ?? "—";
  const amt = ctx.session.tradeAmount ?? 0;
  const dur = formatDuration(duration);
  const text =
    `Confirm trade:\n\n` +
    `Asset: ${sym}\n` +
    `Direction: ${dir === "call" ? "📈 Call" : "📉 Put"}\n` +
    `Amount: $${amt}\n` +
    `Duration: ${dur}`;
  await ctx.editMessageText(text, {
    reply_markup: confirmKeyboard("trade:confirm", { yes: "✅ Place trade", no: "❌ Cancel" }),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.tradeStep !== "amount") return next();
  const text = ctx.message.text.trim();
  const amount = Number(text.replace(/[$,]/g, ""));
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply("Enter a valid dollar amount (e.g. 10):", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Cancel", "trade:cancel")],
      ]),
    });
    return;
  }
  ctx.session.tradeAmount = amount;
  ctx.session.tradeStep = "duration";
  await ctx.reply("Pick duration:", { reply_markup: durationKeyboard() });
});

composer.callbackQuery("trade:confirm:yes", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.tradeStep = undefined;

  const client = getSharedClient();
  if (!client) {
    await ctx.editMessageText(noConnection(), { reply_markup: mainMenu() });
    return;
  }

  const symbol = ctx.session.tradeSymbol ?? "—";
  const direction = ctx.session.tradeDirection ?? "call";
  const amount = ctx.session.tradeAmount ?? 0;
  const duration = ctx.session.tradeDuration ?? 60;

  try {
    const result = await client.placeTrade({ symbol, direction, amount, duration });
    if (result.success) {
      const tradeRecord: TradeRecord = {
        id: result.platformTradeId ?? `trade_${Date.now()}`,
        symbol,
        direction,
        amount,
        duration,
        status: "open",
        openTime: new Date().toISOString(),
        platformTradeId: result.platformTradeId,
      };
      const store = await getTradeStore();
      await store.saveTrade(tradeRecord);

      const dur = formatDuration(duration);
      const text =
        `✅ Trade placed\n\n` +
        `Asset: ${symbol}\n` +
        `Direction: ${direction === "call" ? "📈 Call" : "📉 Put"}\n` +
        `Amount: $${amount}\n` +
        `Duration: ${dur}\n` +
        `ID: ${tradeRecord.id}`;
      await ctx.editMessageText(text, { reply_markup: mainMenu() });
    } else {
      await ctx.editMessageText(
        `Trade failed: ${result.message}\n\nTry again or check your balance.`,
        { reply_markup: mainMenu() },
      );
    }
  } catch {
    await ctx.editMessageText(
      "Something went wrong placing your trade. Check your connection and try again.",
      { reply_markup: mainMenu() },
    );
  }
});

composer.callbackQuery("trade:confirm:no", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.tradeStep = undefined;
  ctx.session.tradeSymbol = undefined;
  ctx.session.tradeDirection = undefined;
  ctx.session.tradeAmount = undefined;
  ctx.session.tradeDuration = undefined;
  await ctx.editMessageText("Trade cancelled.", { reply_markup: mainMenu() });
});

composer.callbackQuery("trade:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.tradeStep = undefined;
  ctx.session.tradeSymbol = undefined;
  ctx.session.tradeDirection = undefined;
  ctx.session.tradeAmount = undefined;
  ctx.session.tradeDuration = undefined;
  await ctx.editMessageText("Trade cancelled.", { reply_markup: mainMenu() });
});

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

export default composer;
