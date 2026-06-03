import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { startClientAndGetSession } from '../../../services/gramClient';
import createMainKeyboard from '../../../menus/keyboards/mainKeyboard';
import { checkStartAllowedChats } from '../../../middlewares/checkInBot';
import { handleJoinLottery } from './handleLottery';
import { handlePromotion } from './handlePromotion';
import {
  handleEvaluation,
  handleEvaluationList,
  getEvaluationDetail,
} from './handleEvaluation';
import { handleMySuccess } from './handleMySuccess';
import { findBotProxy } from '../../../services/findBotProxy';
import { PermissionChecker } from '../../../utils/permissionChecker';
import Evaluation from '../../../../models/evaluation';
import Teacher from '../../../../models/teacher';
import { generateSignedUrl } from '../../../../utils/generateSignedUrl';
import createDebug from 'debug';

const startCommand = new Composer<MyContext>();

const debug = createDebug('bot:start');

export async function handleStart(ctx: MyContext) {
  const bot = ctx.currentBot;
  debug('imageurl', bot.multi_image);

  // 如果 multi_image 和 multi_content 都有，才发送图片和内容，否则什么都不做
  if (bot.multi_image && bot.multi_content) {
    const imageUrl = await generateSignedUrl(bot.multi_image);
    await ctx.replyWithPhoto(imageUrl, {
      caption: bot.multi_content,
      parse_mode: 'HTML',
    });
  }
  // 如果没有 multi_image 或 multi_content，什么都不做
}

// 开始命令处理（私聊与群/超级群均可，群内可拉取自由键盘）
startCommand.command('start', checkStartAllowedChats, async (ctx) => {
  debug('start');
  // const chatId = ctx.chat.id; // 获取群组 ID
  const bot = ctx.currentBot;
  const isGroupChat =
    ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

  // 获取代理用户权限（提前获取，后续可以复用）
  // const { proxyUser } = await findBotProxy(ctx.currentBot);

  // 处理推广链接关联
  // 获取 start 命令的参数（例如：/start JXCAZEAX）
  const startParam = ctx.match as string;

  // 处理抽奖参与
  if (startParam?.startsWith('join-')) {
    const code = startParam.replace('join-', '');
    if (code) {
      await handleJoinLottery(ctx, code);
      return;
    }
  }

  // 处理红包深链接：私聊中弹出 Mini App
  if (startParam?.startsWith('rp_')) {
    const groupId = startParam.replace('rp_', '');
    const { proxyUser } = await findBotProxy(ctx.currentBot);
    if (PermissionChecker.canUseRedPacket(proxyUser, ctx.currentBot)) {
      const webAppUrl = process.env.FRONTEND_URL || 'https://your-domain.com';
      const botId = ctx.currentBot._id;
      const botUserId = ctx.currentBotUser?._id;
      const url = `${webAppUrl}/redpacket/create?botId=${botId}&botUserId=${botUserId}&groupId=${groupId}`;

      const keyboard = new InlineKeyboard().webApp('🧧 发红包', url);
      await ctx.reply('💰 点击下方按钮填写并发送红包', {
        reply_markup: keyboard,
      });
      return;
    }
  }

  // 处理积分继承深链接
  if (startParam === 'mycode' || startParam === 'inherit') {
    const { proxyUser } = await findBotProxy(ctx.currentBot);
    if (PermissionChecker.canUseSuccess(proxyUser, ctx.currentBot)) {
      if (startParam === 'mycode') {
        await handleMySuccess(ctx);
        return;
      }
      if (startParam === 'inherit') {
        const keyboard = new InlineKeyboard().text('💸 开始继承', 'inherit');
        await ctx.reply(
          '💸 *立即继承*\n\n点击下方按钮，输入继承码将积分转移到本账号。',
          { parse_mode: 'Markdown', reply_markup: keyboard },
        );
        return;
      }
    }
  }

  // 处理评价链接
  if (startParam) {
    if (startParam.startsWith('eval_list_')) {
      const teacherId = startParam.replace('eval_list_', '');
      await handleEvaluationList(ctx, teacherId);
      return;
    }
    if (startParam.startsWith('eval_')) {
      const evalId = startParam.replace('eval_', '');
      await handleEvaluation(ctx, evalId);
      return;
    }
    await handlePromotion(ctx, startParam);
  }

  const botSession = bot.session;

  debug('------------------session------------------');
  if (!botSession) {
    const session = await startClientAndGetSession(bot.token);
    debug('session', session);
    bot.session = session as any;
    await bot.save();
  }

  debug(ctx.chat);

  // 判断是否在群组中
  // if (ctx.chat.type !== 'private') {
  //   await ctx.reply('感谢您把我添加到贵群!\n下一步设置费率，请发：设置费率x%');
  //   debug(`感谢添加！本群 ID 为：${chatId}`);

  //   // 检查机器人是否可以读取所有群组消息
  //   if (!ctx.me.can_read_all_group_messages) {
  //     await ctx.reply(
  //       '请关闭机器人隐私模式，否则无法正常工作。\n设置方法：联系 @BotFather，发送 /setprivacy，选择机器人，选择 Disable',
  //     );
  //     debug('需要关闭机器人隐私模式');
  //   }

  //   return;
  // }

  // 群内不发送 multi 推广图，避免刷屏；私聊保持原样
  if (!isGroupChat) {
    await handleStart(ctx);
  }

  // 自由键盘等（权限判断在 createMainKeyboard 内部）
  const replyOptions: any = {
    reply_markup: await createMainKeyboard(ctx),
  };

  const welcomeText = bot.message || '欢迎使用机器人';

  await ctx.reply(welcomeText, replyOptions);
});

// 处理评价列表回调
startCommand.callbackQuery(/^eval_list_(.+?)(?:_(\d+))?$/, async (ctx) => {
  const teacherId = ctx.match[1];
  const page = ctx.match[2] ? parseInt(ctx.match[2]) : 1;
  await handleEvaluationList(ctx, teacherId, true, page);
  await ctx.answerCallbackQuery();
});

// 处理具体评价详情回调
startCommand.callbackQuery(/^show_eval_([a-f\d]{24})$/i, async (ctx) => {
  const evalId = ctx.match[1];
  try {
    const evaluation = await Evaluation.findById(evalId)
      .populate('reviewer', 'userName firstName lastName')
      .populate({
        path: 'teacher',
        populate: { path: 'botUser' },
      });

    if (!evaluation) {
      await ctx.answerCallbackQuery('❌ 评价不存在');
      return;
    }

    const teacherId = (evaluation.teacher as any)?._id ?? evaluation.teacher;
    const teacher = await Teacher.findById(teacherId);

    const msg = getEvaluationDetail(evaluation);
    const keyboard = new InlineKeyboard();

    const hasMedia =
      teacher &&
      ((teacher.images && teacher.images.length > 0) ||
        (teacher.videos && teacher.videos.length > 0));

    if (hasMedia) {
      keyboard.text('🖼 查看照片', `show_teacher_media_${teacher._id}`).row();
    }

    keyboard.text('⬅️ 返回列表', `eval_list_${teacherId}`);

    await ctx.editMessageText(msg, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    await ctx.answerCallbackQuery();
  } catch (err) {
    console.error('Show evaluation detail failed:', err);
    await ctx.answerCallbackQuery('❌ 加载失败');
  }
});

// 处理查看评价照片回调
startCommand.callbackQuery(
  /^show_teacher_media_([a-f\d]{24})$/i,
  async (ctx) => {
    const teacherId = ctx.match[1];
    try {
      const teacher = await Teacher.findById(teacherId);

      if (!teacher) {
        await ctx.answerCallbackQuery('❌ 老师信息不存在');
        return;
      }

      const teacher_media = [
        ...(teacher.images || []),
        ...(teacher.videos || []),
      ];

      if (teacher_media.length === 0) {
        await ctx.answerCallbackQuery('❌ 暂无照片');
        return;
      }

      // 生成签名 URL（与项目其他地方保持一致）
      const mediaUrls = await Promise.all(
        teacher_media.map((file) => generateSignedUrl(file)),
      );

      await ctx.answerCallbackQuery();

      if (mediaUrls.length === 1) {
        const url = mediaUrls[0];
        const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(url);
        if (isVideo) {
          await ctx.replyWithVideo(url);
        } else {
          await ctx.replyWithPhoto(url);
        }
        return;
      }

      // 分批发送，每组最多 10 个，replyWithMediaGroup 要求至少 2 个
      for (let i = 0; i < mediaUrls.length; i += 10) {
        const chunk = mediaUrls.slice(i, i + 10);
        if (chunk.length === 1) {
          const url = chunk[0];
          const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(url);
          if (isVideo) {
            await ctx.replyWithVideo(url);
          } else {
            await ctx.replyWithPhoto(url);
          }
        } else {
          const mediaGroup = chunk.map((url) => {
            const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(url);
            return {
              type: isVideo ? ('video' as const) : ('photo' as const),
              media: url,
            };
          });
          await ctx.replyWithMediaGroup(mediaGroup);
        }
      }
    } catch (err) {
      console.error('Show evaluation media failed:', err);
      await ctx.answerCallbackQuery('❌ 加载失败');
    }
  },
);

export default startCommand;
