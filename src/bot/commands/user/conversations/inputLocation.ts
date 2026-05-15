import { Composer, InlineKeyboard } from 'grammy';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { MyContext } from '../../../types';
import BotUserConfig from '../../../../models/botUserConfig';
import createDebug from 'debug';

const debug = createDebug('bot:teaching:inputLocation');
const inputLocationComposer = new Composer<MyContext>();

const TIMEOUT = 3 * 60 * 1000;
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

async function geocode(query: string): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    'accept-language': 'zh-CN',
    countrycodes: 'cn',
  });

  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': 'TelegramBot/1.0 (location-picker)' },
  });

  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  return res.json() as Promise<NominatimResult[]>;
}

function shortName(displayName: string): string {
  return displayName.split(',').slice(0, 2).join(',').trim();
}

async function inputLocationConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  { bot, botUser }: { bot: any; botUser: any },
) {
  // ── 第一步：输入地址 ────────────────────────────────────────────────────────
  await ctx.reply(
    '⌨️ 请输入您的地址（支持省/市/区/街道，越详细越准确）\n\n示例：\n• 甘肃省兰州市城关区\n• 北京市朝阳区三里屯\n• 上海徐汇区',
    {
      reply_markup: new InlineKeyboard().text(
        '❌ 取消',
        'cancel_input_location',
      ),
    },
  );

  const inputResult = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    { maxMilliseconds: TIMEOUT },
  );

  if (inputResult.callbackQuery?.data === 'cancel_input_location') {
    await ctx.answerCallbackQuery();
    await ctx.reply('❌ 已取消');
    return;
  }

  const query = inputResult.message?.text?.trim();
  if (!query) {
    await ctx.reply('⏰ 超时或无效输入，已取消');
    return;
  }

  // ── 第二步：Nominatim 查询 ──────────────────────────────────────────────────
  const searchingMsg = await ctx.reply('🔍 正在查询，请稍候...');

  let results: NominatimResult[] = [];
  try {
    results = await geocode(query);
  } catch (err) {
    debug('Nominatim error: %o', err);
    await ctx.api
      .deleteMessage(ctx.chat!.id, searchingMsg.message_id)
      .catch(() => {});
    await ctx.reply('❌ 地址查询失败，请稍后重试');
    return;
  }

  await ctx.api
    .deleteMessage(ctx.chat!.id, searchingMsg.message_id)
    .catch(() => {});

  if (results.length === 0) {
    await ctx.reply(
      '❌ 未找到该地址，请尝试更换关键词\n\n建议：\n• 去掉"省""市"等后缀\n• 只输入区名或街道名',
    );
    return;
  }

  // ── 第三步：展示候选结果 ────────────────────────────────────────────────────
  const keyboard = new InlineKeyboard();
  results.forEach((r, i) => {
    keyboard
      .text(`${i + 1}. ${shortName(r.display_name)}`, `loc_pick:${i}`)
      .row();
  });
  keyboard.text('❌ 取消', 'cancel_input_location');

  const listText = results
    .map((r, i) => `${i + 1}. ${r.display_name}`)
    .join('\n\n');

  await ctx.reply(`找到以下地点，请选择：\n\n${listText}`, {
    reply_markup: keyboard,
  });

  // ── 第四步：等待用户选择 ────────────────────────────────────────────────────
  const pickResult = await conversation.waitFor(['callback_query:data'], {
    maxMilliseconds: TIMEOUT,
  });

  const data = pickResult.callbackQuery?.data;
  await ctx.answerCallbackQuery().catch(() => {});

  if (!data || data === 'cancel_input_location') {
    await ctx.reply('❌ 已取消');
    return;
  }

  const match = data.match(/^loc_pick:(\d+)$/);
  if (!match) {
    await ctx.reply('❌ 无效选择');
    return;
  }

  const picked = results[parseInt(match[1])];
  if (!picked) {
    await ctx.reply('❌ 无效选择');
    return;
  }

  const lng = parseFloat(picked.lon);
  const lat = parseFloat(picked.lat);

  // ── 第五步：存入 BotUserConfig ──────────────────────────────────────────────
  const updated = await BotUserConfig.findOneAndUpdate(
    { bot: bot._id, botUser: botUser._id },
    { $set: { location: { type: 'Point', coordinates: [lng, lat] } } },
    { new: true },
  );

  if (!updated) {
    await ctx.reply('❌ 未找到您的用户配置，请先与机器人互动一次');
    return;
  }

  debug('inputLocation: botUser=%s lng=%f lat=%f', botUser._id, lng, lat);

  await ctx.reply(
    `✅ 位置已更新！\n📍 ${shortName(
      picked.display_name,
    )}\n\n现在可以在群里发送「附近」查找附近的老师了。`,
  );
}

inputLocationComposer.use(createConversation(inputLocationConversation));

inputLocationComposer.callbackQuery('loc_method:input', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.conversation.exitAll();
  await ctx.conversation.enter('inputLocationConversation', {
    bot: ctx.currentBot,
    botUser: ctx.currentBotUser,
  });
});

export default inputLocationComposer;
