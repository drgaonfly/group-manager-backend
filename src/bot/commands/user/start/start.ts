import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { startClientAndGetSession } from '../../../services/gramClient';
// import createMainKeyboard from '../../../menus/keyboards/mainKeyboard';
import { checkStartAllowedChats } from '../../../middlewares/checkInBot';
import { handleJoinLottery } from './handleLottery';
import { handlePromotion } from './handlePromotion';
import { handleMySuccess } from './handleMySuccess';
import { findBotProxy } from '../../../services/findBotProxy';
import { PermissionChecker } from '../../../utils/permissionChecker';
import { generateSignedUrl } from '../../../../utils/generateSignedUrl';
import createDebug from 'debug';

const startCommand = new Composer<MyContext>();

const debug = createDebug('bot:start');

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

  // 自由键盘等（权限判断在 createMainKeyboard 内部）
  // const replyOptions: any = {
  //   reply_markup: await createMainKeyboard(ctx),
  // };

  const message = [
    `嗨！ ${ctx.currentBot.botName} 能幫助你方便地安全管理你的群組，是 TG 上最完善的機器人！`,
    ``,
    `將我添加到超級群組並授予管理員權限，這樣我才能進行操作！`,
    ``,
    `點擊 /help 查看所有指令及使用方法。`,
  ].join('\n');

  const inlineKeyboard = new InlineKeyboard()
    .text(
      '把我加到群组',
      `https://t.me/${ctx.currentBot.userName}?startgroup=start`,
    )
    .text('克隆机器人', 'clone_start');

  await ctx.reply(message, {
    reply_markup: inlineKeyboard,
  });
});

export default startCommand;
