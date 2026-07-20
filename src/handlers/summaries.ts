import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getConfigStore } from "../services/storage.js";

registerMainMenuItem({ label: "📊 Summaries", data: "summaries:show", order: 60 });

const composer = new Composer<Ctx>();

const backMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

function summaryKeyboard(enabled: boolean) {
  return inlineKeyboard([
    [
      inlineButton(
        enabled ? "✅ Daily summaries ON" : "Daily summaries OFF",
        "summaries:toggle",
      ),
    ],
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);
}

composer.command("summaries", async (ctx) => {
  const store = await getConfigStore();
  const enabled = await store.getSummaryEnabled(String(ctx.from?.id ?? 0));
  const status = enabled ? "Daily summaries are ON." : "Daily summaries are OFF.";
  await ctx.reply(status, { reply_markup: summaryKeyboard(enabled) });
});

composer.callbackQuery("summaries:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = await getConfigStore();
  const enabled = await store.getSummaryEnabled(String(ctx.from?.id ?? 0));
  const status = enabled ? "Daily summaries are ON." : "Daily summaries are OFF.";
  await ctx.editMessageText(status, { reply_markup: summaryKeyboard(enabled) });
});

composer.callbackQuery("summaries:toggle", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = await getConfigStore();
  const userId = String(ctx.from?.id ?? 0);
  const current = await store.getSummaryEnabled(userId);
  await store.setSummaryEnabled(userId, !current);
  const newEnabled = !current;
  const status = newEnabled ? "Daily summaries are now ON." : "Daily summaries are now OFF.";
  await ctx.editMessageText(status, { reply_markup: summaryKeyboard(newEnabled) });
});

export default composer;
