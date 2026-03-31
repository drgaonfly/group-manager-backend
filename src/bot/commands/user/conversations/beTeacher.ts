import { Composer, InlineKeyboard } from 'grammy';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { MyContext } from '../../../types';
import { checkInBot } from '../../../middlewares/checkInBot';
import Teacher from '../../../../models/teacher';
import createDebug from 'debug';

const debug = createDebug('bot:teaching:beTeacher');
const beTeacherComposer = new Composer<MyContext>();

const TIMEOUT = 5 * 60 * 1000;
const cancelKeyboard = new InlineKeyboard().text('❌ 取消', 'close');

function normalizeContactLink(input: string) {
  const text = input.trim();
  if (/^https:\/\/t\.me\/[A-Za-z0-9_]{3,}$/.test(text)) return text;
  if (/^@[A-Za-z0-9_]{3,}$/.test(text)) return `https://t.me/${text.slice(1)}`;
  if (/^[A-Za-z0-9_]{3,}$/.test(text)) return `https://t.me/${text}`;
  return null;
}

async function beTeacherConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  {
    bot,
    botUser,
    proxyUser,
  }: {
    bot: any;
    botUser: any;
    proxyUser?: any;
  },
) {
  await ctx.reply('请输入你的联系方式（例如 https://t.me/xxx 或 @xxx）', {
    reply_markup: cancelKeyboard,
  });

  const result = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    {
      maxMilliseconds: TIMEOUT,
    },
  );

  if (result.callbackQuery?.data === 'close') {
    await ctx.deleteMessage();
    await ctx.reply('❌ 已取消操作');
    return;
  }

  const contactLinkRaw = result.message?.text;
  const contactLink = contactLinkRaw
    ? normalizeContactLink(contactLinkRaw)
    : null;

  if (!contactLink) {
    await ctx.reply('请输入正确格式的联系方式（https://t.me/xxx 或 @xxx）');
    return beTeacherConversation(conversation, ctx, {
      bot,
      botUser,
      proxyUser,
    });
  }

  const doc = await Teacher.findOneAndUpdate(
    {
      bot: bot._id,
      botUser: botUser._id,
    },
    {
      $set: {
        proxy: proxyUser?._id,
        contactLink,
        isAvailable: true,
      },
      $setOnInsert: {
        bot: bot._id,
        botUser: botUser._id,
      },
    },
    { new: true, upsert: true },
  );

  debug('registered teacher', doc._id);
  await ctx.reply(`✅ 注册成功，你已成为认证老师\n联系方式：${contactLink}`);
}

beTeacherComposer.use(createConversation(beTeacherConversation));

beTeacherComposer.hears(/注册老师/, checkInBot, async (ctx) => {
  await ctx.conversation.exitAll();
  await ctx.conversation.enter('beTeacherConversation', {
    bot: ctx.currentBot,
    botUser: ctx.currentBotUser,
    proxyUser: ctx.currentProxyUser,
  });
});

export default beTeacherComposer;
