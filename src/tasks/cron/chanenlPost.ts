import User from '../../models/user';
import ChannelPost from '../../models/channelPost';
import ChannelPostHistory from '../../models/channelPostHistory';
import { IGroup } from '../../models/group';
import { isWithinTimeWindow, formatTimeWindow } from '../../utils/timeWindow';
import { setupBot } from '../../bot/botSetup';
import { sendMediaMessage } from '../../utils/sendMultiMedia';
import { buildInlineKeyboard } from '../../utils/buildInlineKeyboard';

/**
 * 定时发送频道消息任务
 */
export async function channelPost() {
  try {
    console.log('[channelPost] 开始处理频道推广...');

    const currentTime = new Date();

    // 查询所有在线的频道推广（仅定时发送），关联 bot、channel
    const channelPosts = await ChannelPost.find({
      isOnline: true,
      sendType: 'scheduled',
    })
      .populate({
        path: 'bot',
        populate: { path: 'user groups' },
      })
      .populate('channel')
      .sort({ weight: 1 });

    console.log(`[channelPost] 查询到 ${channelPosts.length} 条频道推广`);

    const stats = {
      processed: 0,
      sent: 0,
      skipped: 0,
      noPermission: 0,
      errors: 0,
    };

    for (const post of channelPosts) {
      try {
        const bot = post.bot as any;
        const channel = post.channel as IGroup | undefined;

        if (!bot || !channel) {
          console.warn(
            `[channelPost] 推广 ${post._id} 缺少 bot 或 channel，跳过`,
          );
          stats.skipped++;
          continue;
        }

        // 检查代理用户权限
        const proxyUser = await User.findById(post.proxy);
        if (!proxyUser?.channelPost) {
          console.warn(
            `[channelPost] 机器人 ${bot.botName} 代理用户无频道推广权限，跳过`,
          );
          stats.noPermission++;
          continue;
        }

        // 检查时间窗口
        if (!isWithinTimeWindow(post.startAt, post.endAt)) {
          console.log(
            `[channelPost] 推广 ${
              post._id
            } 不在发送时间窗口内 (${formatTimeWindow(
              post.startAt,
              post.endAt,
            )})，跳过`,
          );
          stats.skipped++;
          continue;
        }

        // 检查间隔时间
        const history = await ChannelPostHistory.findOne({
          channel: channel._id,
        });
        const intervalTimeInMs = post.interval * 60 * 1000;

        if (history) {
          const timeSinceLastSent =
            Date.now() - new Date(history.sentAt).getTime();
          if (timeSinceLastSent < intervalTimeInMs) {
            console.log(
              `[channelPost] 频道 ${channel.id} 距上次发送 ${(
                timeSinceLastSent / 60000
              ).toFixed(2)} 分钟，不足 ${post.interval} 分钟，跳过`,
            );
            stats.skipped++;
            continue;
          }
        }

        stats.processed++;

        // 从 bot.groups 中查找 channel 对应的 Telegram ID
        const botGroups = bot.groups as any[];
        const channelGroup = botGroups.find(
          (g: any) => g._id.toString() === channel._id.toString(),
        );
        const channelTarget = channelGroup?.id;

        if (!channelTarget) {
          console.warn(
            `[channelPost] 频道 ${channel._id} 未在 bot.groups 中找到对应的 Telegram ID，跳过`,
          );
          stats.skipped++;
          continue;
        }

        const telegramBot = setupBot(bot.token);

        const replyMarkup = buildInlineKeyboard(post.menus);

        let sentMessageId: number | undefined;
        try {
          // 自动删除上一条
          if (post.isClearLastPost && history?.messageId) {
            try {
              await telegramBot.api.deleteMessage(
                channelTarget,
                history.messageId,
              );
              console.log(
                `[autoDelete] 频道 ${channelTarget} 已删除上一条消息 ${history.messageId}`,
              );
            } catch (delErr: any) {
              console.warn(
                `[autoDelete] 删除消息失败（忽略）:`,
                delErr?.message,
              );
            }
          }

          const messageContent =
            post.content || bot.purchasing_introduction || '📺 频道推荐';

          if (Array.isArray(post.medias) && post.medias.length > 0) {
            const result = await sendMediaMessage(
              telegramBot.api,
              channelTarget,
              post.medias,
              {
                caption: messageContent,
                reply_markup: replyMarkup,
              },
            );
            sentMessageId =
              (result as any).message_id ||
              (result as any).media_group_messages?.[0]?.message_id;
          } else {
            const result = await telegramBot.api.sendMessage(
              channelTarget,
              messageContent,
              {
                parse_mode: 'HTML',
                ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
              },
            );
            sentMessageId = result.message_id;
          }

          await ChannelPostHistory.create({
            channelPost: post._id,
            bot: bot._id,
            proxy: post.proxy,
            channel: channel._id,
            channelId: channelTarget,
            messageId: sentMessageId,
            content: post.content,
            medias: post.medias || [],
            status: 'success',
            sentAt: new Date(),
          });

          await ChannelPost.findByIdAndUpdate(post._id, {
            lastPostTime: new Date(),
          });

          stats.sent++;
          console.log(
            `[channelPost] 频道 ${channelTarget} 推广 ${post._id} 发送成功`,
          );
        } catch (sendErr: any) {
          await ChannelPostHistory.create({
            channelPost: post._id,
            bot: bot._id,
            proxy: post.proxy,
            channel: channel._id,
            channelId: channelTarget,
            content: post.content,
            medias: post.medias || [],
            status: 'failed',
            errorMessage: sendErr?.message || String(sendErr),
            sentAt: new Date(),
          });
          console.error(
            `[channelPost] 向频道 ${channelTarget} 发送消息失败:`,
            sendErr,
          );
          stats.errors++;
        }
      } catch (err) {
        console.error(`[channelPost] 处理推广时出错:`, err);
        stats.errors++;
      }
    }

    const taskDuration = (new Date().getTime() - currentTime.getTime()) / 1000;
    console.log('\n========== 频道推广任务统计 ==========');
    console.log(`[统计信息] 处理条数: ${stats.processed}`);
    console.log(`[统计信息] 发送成功: ${stats.sent}`);
    console.log(`[统计信息] 无权限跳过: ${stats.noPermission}`);
    console.log(`[统计信息] 其他跳过: ${stats.skipped}`);
    console.log(`[统计信息] 错误数: ${stats.errors}`);
    console.log(`[统计信息] 总耗时: ${taskDuration.toFixed(2)}秒`);
    console.log('========== 频道推广任务完成 ==========');
  } catch (error) {
    console.error('[channelPost] 处理频道推广时出错:', error);
  }
}
