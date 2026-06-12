import { NextFunction } from 'grammy';
import { MyContext } from '../types';
import AdRemoval from '../../models/adRemoval';
import { PermissionChecker } from '../utils/permissionChecker';
import createDebug from 'debug';

const debug = createDebug('bot:adRemovalResolver');

/**
 * 去除广告核心处理中间件
 *
 * keywords 结构：string[][]
 *   - 外层每个元素是 textarea 的一行，行间是 OR 关系（命中任意一行即触发）
 *   - 行内多个词用空格分隔，mode='any' 时行内 OR，mode='all' 时行内 AND
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
    const userId = ctx.from?.id;
    if (!chatId || !messageId || !userId) return await next();

    // ctx.currentGroup 由 groupResolver 提前挂载，直接取其 MongoDB _id
    const currentGroupId = ctx.currentGroup?._id?.toString();

    for (const config of configs) {
      const { keywords, mode, ignoreAdmin, punishment } = config;

      // 群组范围过滤：group 有值时只在指定群生效，null/undefined 则全部群生效
      if (config.group) {
        if (!currentGroupId) {
          // 无法确定当前群组，跳过有范围限制的规则
          continue;
        }
        if (config.group.toString() !== currentGroupId) {
          debug('Rule skipped (group not in scope):', config.name);
          continue;
        }
      }

      // 检查管理员豁免
      if (ignoreAdmin) {
        try {
          const member = await ctx.getChatMember(userId);
          if (
            member.status === 'administrator' ||
            member.status === 'creator'
          ) {
            debug(
              'Admin exempted by rule:',
              config.name,
              ctx.from?.username || userId,
            );
            continue;
          }
        } catch (error) {
          debug('Failed to get chat member status for exemption:', error);
        }
      }

      if (!keywords || keywords.length === 0) continue;

      // 匹配逻辑：行间 OR，行内由 mode 控制（any=OR / all=AND）
      const isHit = keywords.some((lineWords) => {
        if (!lineWords || lineWords.length === 0) return false;
        if (mode === 'all') {
          return lineWords.every((word) => text.includes(word));
        }
        return lineWords.some((word) => text.includes(word));
      });

      if (!isHit) continue;

      debug('Ad detected by rule:', config.name);

      // 1. 删除消息
      try {
        await ctx.api.deleteMessage(chatId, messageId);
      } catch (err: any) {
        debug('Failed to delete ad message:', err.message);
        if (
          err.description?.includes("can't delete") ||
          err.description?.includes('admin privileges')
        ) {
          await ctx
            .reply(
              `🛡️ **去除广告通知**\n检测到违规内容，但机器人目前**权限不足**，无法自动清理。\n请确保已授予机器人"**删除消息**"的管理员权限。`,
            )
            .catch(() => {});
        }
      }

      // 2. 执行处罚
      if (punishment?.type === 'kick') {
        debug('Punishment: kick user', userId);
        try {
          await ctx.api.banChatMember(chatId, userId);
          // 立即解封，相当于踢出（不永久封禁）
          await ctx.api.unbanChatMember(chatId, userId);
        } catch (err: any) {
          debug('Failed to kick user:', err.message);
          if (err.description?.includes('admin privileges')) {
            await ctx
              .reply(`🛡️ 检测到违规内容，但机器人**权限不足**，无法踢出用户。`)
              .catch(() => {});
          }
        }
      } else if (punishment?.type === 'mute') {
        const duration = punishment.muteDuration ?? 60; // 默认禁言 60 秒
        const untilDate = Math.floor(Date.now() / 1000) + duration;
        debug('Punishment: mute user', userId, 'for', duration, 'seconds');
        try {
          await ctx.api.restrictChatMember(
            chatId,
            userId,
            {
              can_send_messages: false,
              can_send_audios: false,
              can_send_documents: false,
              can_send_photos: false,
              can_send_videos: false,
              can_send_video_notes: false,
              can_send_voice_notes: false,
              can_send_polls: false,
              can_send_other_messages: false,
              can_add_web_page_previews: false,
            },
            { until_date: untilDate },
          );
        } catch (err: any) {
          debug('Failed to mute user:', err.message);
          if (err.description?.includes('admin privileges')) {
            await ctx
              .reply(`🛡️ 检测到违规内容，但机器人**权限不足**，无法禁言用户。`)
              .catch(() => {});
          }
        }
      }

      return; // 命中即中止后续中间件
    }

    return await next();
  } catch (error) {
    debug('Ad removal resolver error:', error);
    return await next();
  }
};
