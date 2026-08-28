import { NextFunction } from 'grammy';
import { MyContext } from '../types';
import AdRemoval from '../../models/adRemoval';
import AdWarning from '../../models/adWarning';
import { PermissionChecker } from '../utils/permissionChecker';
import { getCache } from '../../utils/cache';
import createDebug from 'debug';

const debug = createDebug('bot:adRemovalResolver');

/**
 * 警告计数存 MongoDB AdWarning，TTL 索引到期自动删除，无内存压力。
 */
async function getWarningCount(
  ruleId: string,
  chatId: number,
  userId: number,
): Promise<number> {
  const doc = await AdWarning.findOne({ ruleId, chatId, userId });
  return doc ? doc.count : 0;
}

async function recordWarning(
  ruleId: string,
  chatId: number,
  userId: number,
  windowSeconds: number,
): Promise<number> {
  const ttl = windowSeconds > 0 ? windowSeconds : 86400;
  const expiresAt = new Date(Date.now() + ttl * 1000);

  const doc = await AdWarning.findOneAndUpdate(
    { ruleId, chatId, userId },
    { $inc: { count: 1 }, $set: { expiresAt } },
    { upsert: true, new: true },
  );
  return doc.count;
}

async function resetWarningCount(
  ruleId: string,
  chatId: number,
  userId: number,
): Promise<void> {
  await AdWarning.deleteOne({ ruleId, chatId, userId });
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
 * keywords 结构：string[]
 *   - mode='any'：消息含任意一个词即命中（OR）
 *   - mode='all'：消息含全部词才命中（AND）
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
    // 获取当前机器人所有开启状态的拦截规则（带缓存，TTL 5 分钟）
    const cacheKey = `adRules:${ctx.currentBot?._id}`;
    const cache = getCache();
    let configs = await cache.get<any[]>(cacheKey);
    if (!configs) {
      configs = await AdRemoval.find({
        bot: ctx.currentBot?._id,
        isOnline: true,
      })
        .lean()
        .exec();
      await cache.set(cacheKey, configs ?? [], 300000);
    }

    if (!configs || configs.length === 0) {
      return await next();
    }

    const chatId = ctx.chat?.id;
    const messageId = ctx.message?.message_id;
    const userId = ctx.from?.id;
    if (!chatId || !messageId || !userId) return await next();

    // ctx.currentGroup 由 groupResolver 提前挂载，直接取其 MongoDB _id
    const currentGroupId = ctx.currentGroup?._id?.toString();

    // 判断当前用户是否是群主/管理员
    // basicResolver 已 populate creator 和 operators，直接用 IBotUser.id（Telegram user ID）比对
    const isAdmin = (() => {
      const { creator, operators } = ctx.currentGroup;
      const fromId = userId;
      if ((creator as any).id == fromId) return true;
      return (operators as any[]).some((op) => op?.id == fromId);
    })();

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

      // 检查管理员豁免（使用已 populate 的 operators/creator，无需 API 调用）
      if (ignoreAdmin && isAdmin) {
        debug(
          'Admin exempted by rule:',
          config.name,
          ctx.from?.username || userId,
        );
        continue;
      }

      if (!keywords || keywords.length === 0) continue;

      // 匹配逻辑：mode='any' 时含任意词命中（OR），mode='all' 时含全部词才命中（AND）
      const isHit =
        mode === 'all'
          ? keywords.every((word) => text.includes(word))
          : keywords.some((word) => text.includes(word));

      if (!isHit) continue;

      // 命中的第一个关键词（用于警告消息展示）
      const hitKeyword = keywords.find((w) => text.includes(w)) ?? '';

      debug('Ad detected by rule:', config.name);

      // ── 警告机制 ──────────────────────────────────────────────────────────
      const warnConfig = warning;
      const maxWarnings = warnConfig?.count ?? 0;

      if (maxWarnings > 0) {
        const ruleId = (config._id as any).toString();
        const windowSec = warnConfig?.windowSeconds ?? 0;
        const selfDestructSec = warnConfig?.selfDestructSeconds ?? 0;

        const currentCount = await getWarningCount(ruleId, chatId, userId);

        if (currentCount < maxWarnings) {
          const newCount = await recordWarning(
            ruleId,
            chatId,
            userId,
            windowSec,
          );

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

          try {
            const warningMsg = await ctx.api.sendMessage(chatId, warningText, {
              parse_mode: 'HTML',
            });

            // 自焚：延迟删除警告消息
            if (selfDestructSec > 0 && warningMsg?.message_id) {
              setTimeout(async () => {
                try {
                  await ctx.api.deleteMessage(chatId, warningMsg.message_id);
                } catch {
                  // 忽略删除失败
                  debug('Failed to send delete self');
                }
              }, selfDestructSec * 1000);
            }
          } catch (err: any) {
            debug('Failed to send warning message:', err.message);
          }

          return; // 警告完毕，不调用 next()
        }

        // 达到阈值 → 重置计数，继续走后续处罚逻辑
        await resetWarningCount(ruleId, chatId, userId);
      }

      // 1. 删除消息
      try {
        await ctx.api.deleteMessage(chatId, messageId);
      } catch (err: any) {
        debug('Failed to delete ad message:', err.message);
        if (
          err.description?.includes("can't delete") ||
          err.description?.includes('admin privileges')
        ) {
          try {
            await ctx.reply(
              `🛡️ **去除广告通知**\n检测到违规内容，但机器人目前**权限不足**，无法自动清理。\n请确保已授予机器人"**删除消息**"的管理员权限。`,
            );
          } catch (err: any) {
            debug('Failed to send permission warning:', err.message);
          }
        }
      }

      // 2. 执行处罚
      if (punishment?.type === 'kick') {
        debug('Punishment: kick user', userId);
        try {
          await ctx.api.banChatMember(chatId, userId);
          await ctx.api.unbanChatMember(chatId, userId);
        } catch (err: any) {
          debug('Failed to kick user:', err.message);
          if (err.description?.includes('admin privileges')) {
            try {
              await ctx.reply(
                `🛡️ 检测到违规内容，但机器人**权限不足**，无法踢出用户。`,
              );
            } catch (err: any) {
              debug('Failed to send kick warning:', err.message);
            }
          }
        }
      } else if (punishment?.type === 'mute') {
        const rawDuration = punishment.muteDuration ?? 60;
        const duration = Math.min(
          Math.max(rawDuration, MUTE_MIN_SECONDS),
          MUTE_MAX_SECONDS,
        );
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
              can_invite_users: true,
            },
            { until_date: untilDate },
          );
        } catch (err: any) {
          debug('Failed to mute user:', err.message);
          if (err.description?.includes('admin privileges')) {
            try {
              await ctx.reply(
                `🛡️ 检测到违规内容，但机器人**权限不足**，无法禁言用户。`,
              );
            } catch (err: any) {
              debug('Failed to send mute warning:', err.message);
            }
          }
        }
      }

      return; // 处罚完毕，不调用 next()
    }

    // 没有检测到广告，继续下一个中间件
    return await next();
  } catch (error) {
    debug('Ad removal resolver error:', error);
    return await next();
  }
};
