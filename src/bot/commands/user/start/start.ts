import fs from 'fs/promises';
import path from 'path';
import { Composer, InlineKeyboard, InputFile } from 'grammy';
import { MyContext } from '../../../types';
import { startClientAndGetSession } from '../../../services/gramClient';
import createMainKeyboard from '../../../menus/keyboards/mainKeyboard';
import { checkInBot } from '../../../middlewares/checkInBot';
import { findBotProxy } from '../../../services/findBotProxy';
import { PermissionChecker } from '../../../utils/permissionChecker';
import createDebug from 'debug';
import PromotionLink from '../../../../models/promotionLink';
import BotUser from '../../../../models/botUser';
import { setupBot } from '../../../botSetup';

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
  const { proxyUser } = await findBotProxy(ctx.currentBot);

  // 处理推广链接关联
  // 获取 start 命令的参数（例如：/start JXCAZEAX）
  const startParam = ctx.match as string;

  if (startParam && ctx.currentBotUserConfig) {
    const code = startParam.trim();
    debug('start command code:', code);

    try {
      // 查找对应的推广链接
      const promotionLink = await PromotionLink.findOne({ code, bot: bot._id });

      if (promotionLink && !ctx.currentBotUserConfig.promotionLink) {
        // 关联推广链接到 BotUserConfig（只有在没有关联时才更新）
        ctx.currentBotUserConfig.promotionLink = promotionLink._id;
        await ctx.currentBotUserConfig.save();

        debug('Promotion link associated:', promotionLink.title);

        // 如果双向功能可用，通知拥有者
        if (PermissionChecker.canUseBidirectional(proxyUser, bot)) {
          try {
            // 获取所有拥有者
            const owners = await BotUser.find({
              _id: { $in: bot.owners || [] },
            });

            if (owners.length > 0) {
              const botInstance = setupBot(bot.token);

              // 构建通知消息
              const customerName =
                ctx.currentBotUser.firstName && ctx.currentBotUser.lastName
                  ? `${ctx.currentBotUser.firstName} ${ctx.currentBotUser.lastName}`.trim()
                  : ctx.currentBotUser.userName
                    ? `@${ctx.currentBotUser.userName}`
                    : `ID: ${ctx.currentBotUser.id}`;

              const notificationMessage =
                `🔗 新用户通过推广链接启动\n\n` +
                `用户: ${customerName}\n` +
                `推广链接标题: <b>${promotionLink.title}</b>\n` +
                (promotionLink.link
                  ? `\n推广链接:\n${promotionLink.link}`
                  : '');

              // 给所有拥有者发送通知
              for (const owner of owners) {
                if (owner?.id) {
                  try {
                    await botInstance.api.sendMessage(
                      owner.id,
                      notificationMessage,
                      { parse_mode: 'HTML' },
                    );
                    debug(`✅ 已发送推广链接通知给拥有者: ${owner.id}`);
                  } catch (sendErr: any) {
                    console.error(
                      `发送推广链接通知给拥有者 ${owner.id} 失败:`,
                      sendErr.message || sendErr.description,
                    );
                  }
                }
              }
            }
          } catch (notifyErr) {
            console.error('发送推广链接通知失败:', notifyErr);
            // 不影响主流程继续执行
          }
        }
      } else if (promotionLink && ctx.currentBotUserConfig.promotionLink) {
        debug(
          'BotUserConfig already has promotion link:',
          ctx.currentBotUserConfig.promotionLink,
        );
      } else {
        debug('No promotion link found for code:', code);
      }
    } catch (error) {
      debug('Error associating promotion link:', error);
      // 不阻止后续流程继续执行
    }
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
    combinedKeyboard.url(item.menuName, item.url).row();
  });

  // 根据权限和机器人配置决定是否使用自定义键盘
  const replyOptions: any = {};
  if (
    PermissionChecker.canUseFreeKeyboard(proxyUser, bot) &&
    bot.keyboards &&
    bot.keyboards.length > 0
  ) {
    // 自由键盘功能可用且配置了键盘，使用自定义键盘
    replyOptions.reply_markup = await createMainKeyboard(ctx);
  }

  // 发送消息和键盘
  await ctx.reply(bot.message || '欢迎使用机器人', replyOptions);
});

export default startCommand;
