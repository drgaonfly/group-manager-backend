import { MyContext } from '../../../types';
import PromotionLink from '../../../../models/promotionLink';
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
