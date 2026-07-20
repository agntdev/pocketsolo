import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getSharedClient } from "../services/pocket-option.js";

registerMainMenuItem({ label: "💰 Balance", data: "balance:show", order: 10 });

const composer = new Composer<Ctx>();

const backMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

function noConnection(): string {
  return "Couldn't connect to Pocket Option. Check your credentials in environment variables and try again.";
}

composer.command("balance", async (ctx) => {
  const client = getSharedClient();
  if (!client) {
    await ctx.reply(noConnection(), { reply_markup: backMenu });
    return;
  }
  try {
    const acct = await client.getBalance();
    const text =
      `💰 Account balance\n\n` +
      `Balance: ${acct.balance.toFixed(2)} ${acct.currency}\n` +
      `Equity: ${acct.equity.toFixed(2)} ${acct.currency}`;
    await ctx.reply(text, { reply_markup: backMenu });
  } catch {
    await ctx.reply("Couldn't fetch your balance. Check your connection and try again.", {
      reply_markup: backMenu,
    });
  }
});

composer.callbackQuery("balance:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const client = getSharedClient();
  if (!client) {
    await ctx.editMessageText(noConnection(), { reply_markup: backMenu });
    return;
  }
  try {
    const acct = await client.getBalance();
    const text =
      `💰 Account balance\n\n` +
      `Balance: ${acct.balance.toFixed(2)} ${acct.currency}\n` +
      `Equity: ${acct.equity.toFixed(2)} ${acct.currency}`;
    await ctx.editMessageText(text, { reply_markup: backMenu });
  } catch {
    await ctx.editMessageText("Couldn't fetch your balance. Check your connection and try again.", {
      reply_markup: backMenu,
    });
  }
});

export default composer;
