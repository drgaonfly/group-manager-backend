import { Composer, InlineKeyboard } from 'grammy';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { MyContext } from '../../../types';
import BotUserConfig from '../../../../models/botUserConfig';
import createDebug from 'debug';

const debug = createDebug('bot:teaching:uploadLocation');
const uploadLocationComposer = new Composer<MyContext>();

const TIMEOUT = 2 * 60 * 1000;

async function uploadLocationConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  { bot, botUser }: { bot: any; botUser: any },
) {
  await ctx.reply('📍 请发送您的位置（点击 📎 附件 → 位置）', {
    reply_markup: new InlineKeyboard().text(
      '❌ 取消',
      'cancel_upload_location',
    ),
  });

  const result = await conversation.waitFor(
    ['message:location', 'callback_query:data'],
    { maxMilliseconds: TIMEOUT },
  );

  if (result.callbackQuery?.data === 'cancel_upload_location') {
    await ctx.answerCallbackQuery();
    await ctx.reply('❌ 已取消');
    return;
  }

  if (!result.message?.location) {
    await ctx.reply('⏰ 超时或无效输入，已取消');
    return;
  }

  const { longitude, latitude } = result.message.location;

  const updated = await BotUserConfig.findOneAndUpdate(
    { bot: bot._id, botUser: botUser._id },
    {
      $set: { location: { type: 'Point', coordinates: [longitude, latitude] } },
    },
    { new: true },
  );

  if (!updated) {
    await ctx.reply('❌ 未找到您的用户配置，请先与机器人互动一次');
    return;
  }

  debug(
    'uploadLocation: botUser=%s lng=%f lat=%f',
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

uploadLocationComposer.use(createConversation(uploadLocationConversation));

// 用户选择方式后，进入对应的 conversation
uploadLocationComposer.callbackQuery('loc_method:upload', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.conversation.exitAll();
  await ctx.conversation.enter('uploadLocationConversation', {
    bot: ctx.currentBot,
    botUser: ctx.currentBotUser,
  });
});

export default uploadLocationComposer;
