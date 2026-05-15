import { Composer, InlineKeyboard } from 'grammy';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { MyContext } from '../../../types';
import { checkInBot } from '../../../middlewares/checkInBot';
import { checkTeaching } from '../../../middlewares/checkTeaching';
import BotUserConfig from '../../../../models/botUserConfig';
import createDebug from 'debug';

const debug = createDebug('bot:teaching:updateLocation');
const updateLocationComposer = new Composer<MyContext>();

const TIMEOUT = 2 * 60 * 1000; // 2分钟超时

/**
 * 更新用户位置的对话
 * 位置统一存到 BotUserConfig.location，老师和普通用户都用这个
 */
async function updateLocationConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  {
    bot,
    botUser,
  }: {
    bot: any;
    botUser: any;
  },
) {
  await ctx.reply('📍 请发送您的位置（点击 📎 附件 → 位置）', {
    reply_markup: new InlineKeyboard().text('❌ 取消', 'close_update_location'),
  });

  const geoResult = await conversation.waitFor(
    ['message:location', 'callback_query:data'],
    { maxMilliseconds: TIMEOUT },
  );

  if (geoResult.callbackQuery?.data === 'close_update_location') {
    await ctx.answerCallbackQuery();
    await ctx.reply('❌ 已取消操作');
    return;
  }

  if (!geoResult.message?.location) {
    await ctx.reply('⏰ 超时或无效输入，已取消');
    return;
  }

  const { longitude, latitude } = geoResult.message.location;

  // 存到 BotUserConfig（upsert 保证记录存在）
  const config = await BotUserConfig.findOneAndUpdate(
    { bot: bot._id, botUser: botUser._id },
    {
      $set: {
        location: { type: 'Point', coordinates: [longitude, latitude] },
      },
    },
    { new: true },
  );

  if (!config) {
    await ctx.reply('❌ 未找到您的用户配置，请先与机器人互动一次');
    return;
  }

  debug(
    'updated location for botUser %s: %f, %f',
    botUser._id,
    longitude,
    latitude,
  );

  await ctx.reply(
    `✅ 位置已更新！\n📍 坐标：${longitude.toFixed(5)}, ${latitude.toFixed(
      5,
    )}\n\n现在可以在群里发送「附近」查找附近的老师了。`,
  );
}

updateLocationComposer.use(createConversation(updateLocationConversation));

// 触发命令
updateLocationComposer.hears(
  /更新位置/,
  checkInBot,
  checkTeaching,
  async (ctx) => {
    await ctx.conversation.exitAll();
    await ctx.conversation.enter('updateLocationConversation', {
      bot: ctx.currentBot,
      botUser: ctx.currentBotUser,
    });
  },
);

export default updateLocationComposer;
