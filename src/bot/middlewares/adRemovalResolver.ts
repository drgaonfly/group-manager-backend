import { NextFunction } from 'grammy';
import { MyContext } from '../types';
import AdRemoval from '../../models/adRemoval';
import { PermissionChecker } from '../utils/permissionChecker';
import createDebug from 'debug';

const debug = createDebug('bot:adRemovalResolver');

/**
 * 去除广告核心处理中间件
 */
export const adRemovalResolver = async (ctx: MyContext, next: NextFunction) => {
  // 仅处理文本消息或带说明的媒体消息
  const text = ctx.message?.text || ctx.message?.caption;
  if (!text) {
    return await next();
  }

  // 检查是否启用了广告移除功能
  if (
    !PermissionChecker.canUseAdRemoval(ctx.currentProxyUser, ctx.currentBot)
  ) {
    debug('未启用广告移除功能');
    return await next();
  }

  try {
    // 获取当前机器人所有开启状态的拦截规则
    const configs = await AdRemoval.find({
      bot: ctx.currentBot?._id,
      isOnline: true,
    }).exec();

    if (!configs || configs.length === 0) {
      return await next();
    }

    const chatId = ctx.chat?.id;
    const messageId = ctx.message?.message_id;
    if (!chatId || !messageId) return await next();

    for (const config of configs) {
      const { keywords, mode } = config;
      if (!keywords || keywords.length === 0) continue;

      let isHit = false;
      if (mode === 'all') {
        isHit = keywords.every((kw) => {
          if (kw.isFuzzy) return text.includes(kw.content);
          return text === kw.content;
        });
      } else {
        isHit = keywords.some((kw) => {
          if (kw.isFuzzy) return text.includes(kw.content);
          return text === kw.content;
        });
      }

      if (isHit) {
        debug('Ad detected by rule:', config.name, 'Action: block');
        await ctx.api.deleteMessage(chatId, messageId).catch((err) => {
          debug('Failed to delete ad message:', err.message);
        });
        return; // 命中即删除并中止
      }
    }

    return await next();
  } catch (error) {
    debug('Ad removal resolver error:', error);
    return await next();
  }
};
