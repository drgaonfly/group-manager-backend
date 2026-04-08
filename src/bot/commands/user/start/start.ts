import fs from 'fs/promises';
import path from 'path';
import { Composer, InlineKeyboard, InputFile } from 'grammy';
import { MyContext } from '../../../types';
import { startClientAndGetSession } from '../../../services/gramClient';
import createMainKeyboard from '../../../menus/keyboards/mainKeyboard';
import { checkInBot } from '../../../middlewares/checkInBot';
// import { findBotProxy } from '../../../services/findBotProxy';
// import { PermissionChecker } from '../../../utils/permissionChecker';
// import { setupBot } from '../../../botSetup';
import { handleJoinLottery } from './handleLottery';
import { handlePromotion } from './handlePromotion';
import { handleEvaluation, handleEvaluationList } from './handleEvaluation';
import createDebug from 'debug';

const startCommand = new Composer<MyContext>();

const debug = createDebug('bot:start');

export async function handleStart(ctx: MyContext) {
  const bot = ctx.currentBot;
  debug('imageurl', bot.multi_image);

  // 如果 multi_image 和 multi_content 都有，才发送图片和内容，否则什么都不做
  if (bot.multi_image && bot.multi_content) {
    const imagePath = path.join(process.cwd(), 'tmp', bot.multi_image);

    // 检查图片文件是否存在
    try {
      await fs.access(imagePath);
    } catch (err) {
      // 图片不存在，不发送也不提示
      return;
    }

    await ctx.replyWithPhoto(new InputFile(imagePath, 'multi.jpg'), {
      caption: [bot.multi_content].join('\n'),
      parse_mode: 'HTML',
    });
  }
  // 如果没有 multi_image 或 multi_content，什么都不做
}

// 开始命令处理
startCommand.command('start', checkInBot, async (ctx) => {
  debug('start');
  // const chatId = ctx.chat.id; // 获取群组 ID
  const bot = ctx.currentBot;

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

  await handleStart(ctx);

  // 合并原有菜单和添加到群组按钮
  const combinedKeyboard = new InlineKeyboard();

  // 添加群组按钮
  combinedKeyboard
    .url('➕ 添加到群聊', `https://t.me/${ctx.me.username}?startgroup=true`)
    .row();

  // 添加原有菜单项
  bot.menus.forEach((item) => {
    combinedKeyboard.url(item.name, item.url).row();
  });

  // 总是显示自定义键盘（权限判断在 createMainKeyboard 内部）
  const replyOptions: any = {
    reply_markup: await createMainKeyboard(ctx),
  };

  // 发送消息和键盘
  await ctx.reply(bot.message || '欢迎使用机器人', replyOptions);
});

// 处理评价列表回调
startCommand.callbackQuery(/^eval_list_(.+?)(?:_(\d+))?$/, async (ctx) => {
  const teacherId = ctx.match[1];
  const page = ctx.match[2] ? parseInt(ctx.match[2]) : 1;
  await handleEvaluationList(ctx, teacherId, true, page);
  await ctx.answerCallbackQuery();
});

// 处理具体评价详情回调
startCommand.callbackQuery(/^show_eval_(.+)$/, async (ctx) => {
  const evalId = ctx.match[1];
  try {
    const Evaluation = (await import('../../../../models/evaluation')).default;
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

    const { getEvaluationDetail } = await import('./handleEvaluation');
    const msg = getEvaluationDetail(evaluation);
    const keyboard = new InlineKeyboard().text(
      '⬅️ 返回列表',
      `eval_list_${(evaluation.teacher as any)?._id}`,
    );

    await ctx.editMessageText(msg, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCallbackQuery();
  } catch (err) {
    console.error('Show evaluation detail failed:', err);
    await ctx.answerCallbackQuery('❌ 加载失败');
  }
});

export default startCommand;
