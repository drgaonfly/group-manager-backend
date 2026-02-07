import { MyContext } from '../../../types';
import PromotionLink from '../../../../models/promotionLink';
import BotUser from '../../../../models/botUser';
import { setupBot } from '../../../botSetup';
import { findBotProxy } from '../../../services/findBotProxy';
import { PermissionChecker } from '../../../utils/permissionChecker';
import createDebug from 'debug';

const debug = createDebug('bot:promotion');

/**
 * 处理推广链接关联
 * @param ctx Telegram Bot 上下文
 * @param startParam start 命令的参数（例如：JXCAZEAX）
 */
export async function handlePromotion(ctx: MyContext, startParam: string) {
  if (!startParam || !ctx.currentBotUserConfig) {
    return;
  }

  const bot = ctx.currentBot;
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

      // 获取代理用户权限
      const { proxyUser } = await findBotProxy(ctx.currentBot);

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
              (promotionLink.link ? `\n推广链接:\n${promotionLink.link}` : '');

            // 给所有拥有者发送通知
            for (const owner of owners) {
              if (owner?.id) {
                try {
                  await botInstance.api.sendMessage(
                    owner.id,
                    notificationMessage,
                    {
                      parse_mode: 'HTML',
                    },
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
