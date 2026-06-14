import { NextFunction } from 'grammy';
import { MyContext } from '../types';
import AdRemoval from '../../models/adRemoval';
import { PermissionChecker } from '../utils/permissionChecker';
import createDebug from 'debug';

const debug = createDebug('bot:adRemovalResolver');

/**
 * 内存中维护各用户的警告记录。
 * key: `${ruleId}:${chatId}:${userId}`
 * value: 警告时间戳数组
 *
 * 注意：Bot 重启后记录会丢失，如需持久化可改为 Redis/MongoDB。
 */
const warningRecords = new Map<string, number[]>();

/**
 * 获取（并清理过期记录）某规则下某用户的当前有效警告次数。
 */
function getWarningCount(
  ruleId: string,
  chatId: number,
  userId: number,
  windowSeconds: number,
): number {
  const key = `${ruleId}:${chatId}:${userId}`;
  const now = Date.now();
  const records = warningRecords.get(key) ?? [];

  if (windowSeconds <= 0) {
    // 不限时间窗口：返回全部历史次数
    return records.length;
  }

  const windowMs = windowSeconds * 1000;
  const valid = records.filter((ts) => now - ts < windowMs);
  warningRecords.set(key, valid);
  return valid.length;
}

/**
 * 记录一次警告。
 */
function recordWarning(
  ruleId: string,
  chatId: number,
  userId: number,
  windowSeconds: number,
): number {
  const key = `${ruleId}:${chatId}:${userId}`;
  const now = Date.now();
  const records = warningRecords.get(key) ?? [];

  let valid =
    windowSeconds > 0
      ? records.filter((ts) => now - ts < windowSeconds * 1000)
      : records;

  valid = [...valid, now];
  warningRecords.set(key, valid);
  return valid.length;
}

/**
 * 重置某规则下某用户的警告计数（处罚后清零）。
 */
function resetWarningCount(
  ruleId: string,
  chatId: number,
  userId: number,
): void {
  const key = `${ruleId}:${chatId}:${userId}`;
  warningRecords.delete(key);
}

/**
 * Telegram restrictChatMember 的 until_date 约束：
 * - 必须在调用时刻的 30 秒到 366 天之间
 * - 小于 30 秒会被视为永久禁言（Telegram 的坑）
 * - 大于 366 天同理会被视为永久禁言
 * 这里将时长下限 clamp 到 30 秒，保证时效性正确。
 */
const MUTE_MIN_SECONDS = 30;
const MUTE_MAX_SECONDS = 366 * 24 * 3600;

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
      const { keywords, mode, ignoreAdmin, punishment, warning } = config;

      // 群组范围过滤：group 有值时只在指定群生效，null/undefined 则全部群生效
      if (config.group) {
        if (!currentGroupId) {
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

      // 命中的第一个关键词（用于警告消息展示）
      const hitKeyword =
        keywords
          .find((line) => {
            if (mode === 'all') return line.every((w) => text.includes(w));
            return line.some((w) => text.includes(w));
          })
          ?.find((w) => text.includes(w)) ?? '';

      debug('Ad detected by rule:', config.name);

      // ── 警告机制 ──────────────────────────────────────────────────────────
      const warnConfig = warning;
      const maxWarnings = warnConfig?.count ?? 0;

      if (maxWarnings > 0) {
        const ruleId = (config._id as any).toString();
        const windowSec = warnConfig?.windowSeconds ?? 0;
        const selfDestructSec = warnConfig?.selfDestructSeconds ?? 0;

        const currentCount = getWarningCount(ruleId, chatId, userId, windowSec);

        if (currentCount < maxWarnings) {
          // 还没达到处罚阈值 → 先删消息，发警告通知
          const newCount = recordWarning(ruleId, chatId, userId, windowSec);

          // 删违规消息
          try {
            await ctx.api.deleteMessage(chatId, messageId);
          } catch (err: any) {
            debug('Failed to delete message (warning stage):', err.message);
          }

          // 构造警告文本
          const userName =
            ctx.from?.first_name ||
            (ctx.from?.username ? `@${ctx.from.username}` : `用户 ${userId}`);

          const punishLabel = (() => {
            if (!punishment?.type || punishment.type === ('none' as any))
              return '消息删除';
            if (punishment.type === 'kick') return '踢出群组';
            if (punishment.type === 'mute') {
              const sec = punishment.muteDuration ?? 60;
              if (sec >= 86400) return `禁言 ${Math.floor(sec / 86400)} 天`;
              if (sec >= 3600) return `禁言 ${Math.floor(sec / 3600)} 小时`;
              if (sec >= 60) return `禁言 ${Math.floor(sec / 60)} 分钟`;
              return `禁言 ${sec} 秒`;
            }
            return '处罚';
          })();

          const selfDestructNote =
            selfDestructSec > 0
              ? `\n⏱ 此消息将在 ${selfDestructSec} 秒后自动删除`
              : '';

          const warningText =
            `⚠️ ${userName}，禁止使用违禁词"${hitKeyword}"，` +
            `已警告 ${newCount} 次，达到 ${maxWarnings} 次将触发「${punishLabel}」。${selfDestructNote}`;

          let warningMsg: any = null;
          try {
            warningMsg = await ctx.api.sendMessage(chatId, warningText, {
              parse_mode: undefined,
            });
          } catch (err: any) {
            debug('Failed to send warning message:', err.message);
          }

          // 自焚：延迟删除警告消息
          if (selfDestructSec > 0 && warningMsg?.message_id) {
            const warnMsgId = warningMsg.message_id;
            setTimeout(async () => {
              try {
                await ctx.api.deleteMessage(chatId, warnMsgId);
              } catch {
                // 消息可能已被手动删除，忽略
              }
            }, selfDestructSec * 1000);
          }

          return; // 本次只警告，不处罚
        }

        // 达到阈值 → 重置计数，继续走后续处罚逻辑
        resetWarningCount(ruleId, chatId, userId);
      }
      // ── 警告机制结束 ──────────────────────────────────────────────────────

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
        // Telegram 规定 until_date 必须在 30 秒 ~ 366 天范围内
        // 低于 30 秒会被视为永久禁言，因此做 clamp 处理
        const rawDuration = punishment.muteDuration ?? 60;
        const duration = Math.min(
          Math.max(rawDuration, MUTE_MIN_SECONDS),
          MUTE_MAX_SECONDS,
        );
        const untilDate = Math.floor(Date.now() / 1000) + duration;

        debug(
          'Punishment: mute user',
          userId,
          'for',
          duration,
          'seconds (requested:',
          rawDuration,
          ')',
        );

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
