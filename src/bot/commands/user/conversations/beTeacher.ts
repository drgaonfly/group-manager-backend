import { Composer, InlineKeyboard } from 'grammy';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { MyContext } from '../../../types';
import { checkInBot } from '../../../middlewares/checkInBot';
import { checkTeaching } from '../../../middlewares/checkTeaching';
import Teacher from '../../../../models/teacher';
import BotUserConfig from '../../../../models/botUserConfig';
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

  // 获取补习地点（文字）
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

  // 获取服务地点坐标（必填）
  await ctx.reply(
    '4️⃣ 请发送您的服务地点位置（点击 📎 附件 → 位置），方便用户搜索附近老师。',
    { reply_markup: cancelKeyboard },
  );
  let geoCoords: [number, number] | null = null;

  // 循环直到用户发送位置或取消
  while (!geoCoords) {
    const geoResult = await conversation.waitFor(
      ['message:location', 'callback_query:data'],
      { maxMilliseconds: TIMEOUT },
    );

    if (geoResult.callbackQuery?.data === 'close') {
      await ctx.deleteMessage();
      await ctx.reply('❌ 已取消操作');
      return;
    }

    if (geoResult.message?.location) {
      const { longitude, latitude } = geoResult.message.location;
      geoCoords = [longitude, latitude];
    } else {
      await ctx.reply('请发送位置（点击 📎 附件 → 位置），不能跳过哦～');
    }
  }

  // 获取描述
  await ctx.reply('5️⃣ 请输入您的个人描述（例如：身高、体重、籍贯等）：', {
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

  const brief = `1️⃣名字：${nickName}\n2️⃣价位：${price}\n3️⃣描述：${description}`;

  // 位置存到 BotUserConfig（统一位置存储）
  await BotUserConfig.findOneAndUpdate(
    { bot: bot._id, botUser: botUser._id },
    { $set: { location: { type: 'Point', coordinates: geoCoords } } },
  );

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
        address: location,
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
    `✅ 注册成功，你已成为认证老师\n联系方式：${contactLink}\n已上传：${images.length}张图片，${videos.length}个视频\n📍 服务地点已设置\n\n如需更新位置，可随时发送「更新位置」`,
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
    if (teacher.status === 'approved') {
      await ctx.reply(
        '您已经是认证老师了～\n\n如需更新位置，可发送「更新位置」',
      );
    } else if (teacher.status === 'pending') {
      await ctx.reply('您的老师认证正在审核中，请耐心等待');
    } else {
      await ctx.reply('您的老师认证被拒绝，请联系管理员');
    }
    return;
  }

  await ctx.conversation.enter('beTeacherConversation', {
    bot: ctx.currentBot,
    botUser: ctx.currentBotUser,
    proxyUser: ctx.currentProxyUser,
  });
});

export default beTeacherComposer;
