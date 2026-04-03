import { Composer, InlineKeyboard } from 'grammy';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { MyContext } from '../../../types';
import { checkInBot } from '../../../middlewares/checkInBot';
import { checkTeaching } from '../../../middlewares/checkTeaching';
import Teacher from '../../../../models/teacher';
import { downloadTelegramFile } from '../../../services/dowlnloader';
import createDebug from 'debug';

const debug = createDebug('bot:teaching:beTeacher');
const beTeacherComposer = new Composer<MyContext>();

const TIMEOUT = 5 * 60 * 1000;
const cancelKeyboard = new InlineKeyboard().text('❌ 取消', 'close');
const finishKeyboard = new InlineKeyboard()
  .text('✅ 完成上传', 'finish_media')
  .row()
  .text('❌ 取消', 'close');

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

  // 获取花名
  await ctx.reply('1️⃣ 请输入您的花名：', { reply_markup: cancelKeyboard });
  const nameResult = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    { maxMilliseconds: TIMEOUT },
  );
  if (nameResult.callbackQuery?.data === 'close') {
    await ctx.deleteMessage();
    await ctx.reply('❌ 已取消操作');
    return;
  }
  const nickName = nameResult.message?.text || '未知';

  // 获取费用/价位
  await ctx.reply('2️⃣ 请输入您的价位（例如：P6 PP11）：', {
    reply_markup: cancelKeyboard,
  });
  const priceResult = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    { maxMilliseconds: TIMEOUT },
  );
  if (priceResult.callbackQuery?.data === 'close') {
    await ctx.deleteMessage();
    await ctx.reply('❌ 已取消操作');
    return;
  }
  const price = priceResult.message?.text || '未填';

  // 获取补习地点
  await ctx.reply('3️⃣ 请输入您的补习地点（例如：七里河）：', {
    reply_markup: cancelKeyboard,
  });
  const locationResult = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    { maxMilliseconds: TIMEOUT },
  );
  if (locationResult.callbackQuery?.data === 'close') {
    await ctx.deleteMessage();
    await ctx.reply('❌ 已取消操作');
    return;
  }
  const location = locationResult.message?.text || '未填';

  // 获取描述
  await ctx.reply('4️⃣ 请输入您的个人描述（例如：身高、体重、籍贯等）：', {
    reply_markup: cancelKeyboard,
  });
  const descResult = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    { maxMilliseconds: TIMEOUT },
  );
  if (descResult.callbackQuery?.data === 'close') {
    await ctx.deleteMessage();
    await ctx.reply('❌ 已取消操作');
    return;
  }
  const description = descResult.message?.text || '无';

  const brief = `1️⃣名字：${nickName}\n2️⃣价位：${price}\n3️⃣联系方式：${contactLink}\n4️⃣描述：${description}\n5️⃣补习位置：${location}`;

  const doc = await Teacher.findOneAndUpdate(
    {
      bot: bot._id,
      botUser: botUser._id,
    },
    {
      $set: {
        display_name: nickName,
        proxy: proxyUser?._id,
        contactLink,
        brief,
        isAvailable: true,
      },
      $setOnInsert: {
        bot: bot._id,
        botUser: botUser._id,
        images: [],
        videos: [],
      },
    },
    { new: true, upsert: true },
  );

  await ctx.reply(
    '请上传您的个人照片或展示视频（支持多张图片和视频，上传完成后点击“完成上传”按钮）',
    {
      reply_markup: finishKeyboard,
    },
  );

  const images: string[] = [];
  const videos: string[] = [];

  let isUploading = true;
  while (isUploading) {
    const mediaResult = await conversation.waitFor(
      ['message:photo', 'message:video', 'callback_query:data'],
      {
        maxMilliseconds: TIMEOUT,
      },
    );

    if (mediaResult.callbackQuery?.data === 'close') {
      await ctx.deleteMessage();
      await ctx.reply('❌ 已取消操作');
      return;
    }

    if (mediaResult.callbackQuery?.data === 'finish_media') {
      if (images.length === 0 && videos.length === 0) {
        await ctx.reply('请至少上传一张图片或一段视频');
        continue;
      }
      isUploading = false;
      continue;
    }

    const botToken = ctx.api.token;

    if (mediaResult.message?.photo) {
      const photo = mediaResult.message.photo.pop();
      if (photo) {
        const fileName = await downloadTelegramFile(botToken, photo.file_id);
        if (fileName) {
          images.push(fileName);
          await ctx.reply(`已收到图片 (${images.length})`, {
            reply_markup: finishKeyboard,
          });
        }
      }
    } else if (mediaResult.message?.video) {
      const video = mediaResult.message.video;
      const fileName = await downloadTelegramFile(botToken, video.file_id);
      if (fileName) {
        videos.push(fileName);
        await ctx.reply(`已收到视频 (${videos.length})`, {
          reply_markup: finishKeyboard,
        });
      }
    }
  }

  await Teacher.findByIdAndUpdate(doc._id, {
    $set: { images, videos },
  });

  debug('registered teacher', doc._id);
  await ctx.reply(
    `✅ 注册成功，你已成为认证老师\n联系方式：${contactLink}\n已上传：${images.length}张图片，${videos.length}个视频`,
  );
}

beTeacherComposer.use(createConversation(beTeacherConversation));

beTeacherComposer.hears(/注册老师/, checkInBot, checkTeaching, async (ctx) => {
  await ctx.conversation.exitAll();

  const teacher = await Teacher.findOne({
    bot: ctx.currentBot._id,
    botUser: ctx.currentBotUser._id,
  });

  if (teacher) {
    debug('用户已经是老师');
    await ctx.reply('你已经是老师了，无需重复注册');
    return;
  }

  await ctx.conversation.enter('beTeacherConversation', {
    bot: ctx.currentBot,
    botUser: ctx.currentBotUser,
    proxyUser: ctx.currentProxyUser,
  });
});

export default beTeacherComposer;
