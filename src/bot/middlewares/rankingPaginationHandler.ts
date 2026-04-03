import { Middleware } from 'grammy';
import { MyContext } from '../types';
import { getGroupUserRankingList } from '../../services/rankingService';
// import BotUserConfig from '../../models/botUserConfig';
import createDebug from 'debug';

const debug = createDebug('bot:rankingPagination');

export const rankingPaginationHandler: Middleware<MyContext> = async (
  ctx,
  next,
) => {
  if (!ctx.callbackQuery?.data?.startsWith('rank_page_')) {
    return next();
  }

  const page = parseInt(ctx.callbackQuery.data.replace('rank_page_', ''));
  if (isNaN(page) || page < 1) {
    return ctx.answerCallbackQuery('无效的页码');
  }

  const botId = ctx.currentBot?._id;
  if (!botId) return;

  try {
    const rankingListData = await getGroupUserRankingList(
      botId,
      ctx.currentGroup?.botUsers as any,
      page,
    );

    const inlineButtons: any[] = [];
    const buttons = [];
    if (page > 1) {
      buttons.push({
        text: '⬅️ 上一页',
        callback_data: `rank_page_${page - 1}`,
      });
    }
    if (rankingListData.hasNext) {
      buttons.push({
        text: '下一页 ➡️',
        callback_data: `rank_page_${page + 1}`,
      });
    }
    if (buttons.length > 0) {
      inlineButtons.push(buttons);
    }

    // 获取原始消息的键盘，保留非分页按钮
    const originalKeyboard =
      ctx.callbackQuery.message?.reply_markup?.inline_keyboard || [];
    const otherButtons = originalKeyboard.filter(
      (row) =>
        !row.some(
          (btn) => (btn as any).callback_data?.startsWith('rank_page_'),
        ),
    );

    inlineButtons.push(...otherButtons);

    await ctx.editMessageText(rankingListData.text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineButtons },
    });

    await ctx.answerCallbackQuery();
  } catch (error) {
    debug('Error handling ranking pagination:', error);
    await ctx.answerCallbackQuery('加载失败，请稍后重试');
  }
};
