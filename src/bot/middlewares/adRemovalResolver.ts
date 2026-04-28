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
        try {
          await ctx.api.deleteMessage(chatId, messageId);
        } catch (err: any) {
          debug('Failed to delete ad message:', err.message);
          // 如果是因为权限不足（403: Forbidden 或 400: Bad Request 且提示权限相关）
          if (
            err.description?.includes("can't delete") ||
            err.description?.includes('admin privileges')
          ) {
            await ctx
              .reply(
                `🛡️ **去除广告通知**\n检测到违规广告，但机器人目前**权限不足**，无法自动清理。\n请确保已授予机器人“**删除消息**”的管理员权限。`,
              )
              .catch(() => {});
          }
        }
        return; // 命中即中止后续
      }
    }

    return await next();
  } catch (error) {
    debug('Ad removal resolver error:', error);
    return await next();
  }
};
