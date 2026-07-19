import { Middleware } from 'grammy';
import { MyContext } from '../types';
import GroupMessage from '../../models/groupMessage';
import GroupWelcome from '../../models/groupWelcome';
import ReplyRule from '../../models/replyRule';
import ChannelPost from '../../models/channelPost';
import createDebug from 'debug';

const debug = createDebug('bot:inlineMenuCallback');

/**
 * 处理内联菜单按钮的 callback_query
 * 根据 menu._id 查找对应的弹窗文字并显示
 */
export const inlineMenuCallbackHandler: Middleware<MyContext> = async (
  ctx,
  next,
) => {
  // 只处理 callback_query 且有 data 的情况
  if (!ctx.callbackQuery?.data) {
    return next();
  }

  const data = ctx.callbackQuery.data;

  try {
    let callbackText: string | undefined;

    // 1. 查询 GroupMessage 中的菜单
    const gm = await GroupMessage.findOne(
      { 'menus._id': data },
      { 'menus.$': 1 },
    );
    callbackText = gm?.menus?.[0]?.callback;

    // 2. 如果没找到，查询 GroupWelcome 中的菜单
    if (!callbackText) {
      const gw = await GroupWelcome.findOne(
        { 'menus._id': data },
        { 'menus.$': 1 },
      );
      callbackText = (gw?.menus?.[0] as any)?.callback;
    }

    // 3. 如果还没找到，查询 ReplyRule 中的菜单
    if (!callbackText) {
      const rr = await ReplyRule.findOne(
        { 'menus._id': data },
        { 'menus.$': 1 },
      );
      callbackText = rr?.menus?.[0]?.callback;
    }

    // 4. 最后查询 ChannelPost 中的菜单
    if (!callbackText) {
      const cp = await ChannelPost.findOne(
        { 'menus._id': data },
        { 'menus.$': 1 },
      );
      callbackText = (cp?.menus?.[0] as any)?.callback;
    }

    // 如果找到了 callback 文字，显示弹窗并返回
    if (callbackText) {
      debug('找到菜单回调文字，菜单 ID: %s', data);
      await ctx.answerCallbackQuery({ text: callbackText, show_alert: true });
      return;
    }
  } catch (error) {
    debug('查询菜单回调文字失败:', error);
    // 查询失败时继续走后续 handler
  }

  // 如果没找到对应的菜单，继续执行后续中间件
  return next();
};
