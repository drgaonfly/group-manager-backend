import Bot from '../../models/bot';
import ChannelPost from '../../models/channelPost';
import ChannelPostHistory from '../../models/channelPostHistory';
import { findBotProxy } from '../../bot/services/findBotProxy';
import { PermissionChecker } from '../../bot/utils/permissionChecker';
import { setupBot } from '../../bot/botSetup';
import { InlineKeyboard } from 'grammy';
import { buildInlineKeyboard } from '../../utils/buildInlineKeyboard';
import { isWithinTimeWindow, formatTimeWindow } from '../../utils/timeWindow';
import { sendMediaMessage } from '../../utils/sendMultiMedia';

/**
 * 定时发送频道消息到指定频道
 */
export async function channelPost() {
  try {
    // 查询所有开启频道发送且在线的机器人
    const bots = await Bot.find({
      isOnline: true,
    }).populate('groups');

    console.log(`查询到 ${bots.length} 个开启频道发送的在线机器人`);

    for (const bot of bots) {
      try {
        console.log(`处理机器人: ${bot.botName}`);

        const { proxyUser } = await findBotProxy(bot);

        if (!PermissionChecker.canUseChannelPost(proxyUser, bot)) {
          console.log(`机器人 ${bot.botName} 无权限发送频道消息，跳过`);
          continue;
        }

        // 查询该机器人的所有启用的频道推广，并 populate channel
        const allChannelPosts = await ChannelPost.find({
          bot: bot._id,
          isOnline: true,
        })
          .populate('channel')
          .sort({ weight: 1, createdAt: -1 });

        if (!allChannelPosts || allChannelPosts.length === 0) {
          console.log(`机器人 ${bot.botName} 未配置启用的频道推广，跳过`);
          continue;
        }

        // 筛选出需要发送的频道推广（检查间隔时间和时间窗口）
        const postsToSend = allChannelPosts.filter((post) => {
          // 先检查时间窗口
          if (!isWithinTimeWindow(post.startAt, post.endAt)) {
            console.log(
              `频道推广 ${post._id} 不在发送时间窗口内 (${formatTimeWindow(
                post.startAt,
                post.endAt,
              )})，跳过`,
            );
            return false;
          }
          // 再检查发送间隔
          return checkChannelSendInterval(post);
        });

        if (postsToSend.length === 0) {
          console.log(`机器人 ${bot.botName} 没有到达发送间隔的频道推广，跳过`);
          continue;
        }

        console.log(
          `机器人 ${bot.botName} 找到 ${postsToSend.length} 个需要发送的频道推广`,
        );

        // 设置机器人实例
        const telegramBot = setupBot(bot.token);

        // 处理每个频道推广
        for (const post of postsToSend) {
          try {
            // 获取所有目标频道
            const channelTargets = getChannelTargets(post);

            if (channelTargets.length === 0) {
              console.log(`频道推广 ${post._id} 未配置有效的频道目标，跳过`);
              continue;
            }

            // 为每个目标频道发送消息
            for (const channelTarget of channelTargets) {
              try {
                // 构建消息内容和键盘
                const { messageContent, keyboard } = buildChannelMessage(
                  bot,
                  post,
                );

                // 发送消息到频道
                let sentMessage;

                // 检查是否有媒体文件
                if (
                  post.medias &&
                  Array.isArray(post.medias) &&
                  post.medias.length > 0
                ) {
                  const result = await sendMediaMessage(
                    telegramBot.api,
                    channelTarget,
                    post.medias,
                    {
                      caption: messageContent,
                      reply_markup: keyboard,
                    },
                  );
                  sentMessage = result.message_id
                    ? { message_id: result.message_id }
                    : result.media_group_messages?.[0];
                } else {
                  // 发送纯文本消息
                  sentMessage = await telegramBot.api.sendMessage(
                    channelTarget,
                    messageContent,
                    {
                      parse_mode: 'HTML',
                      reply_markup: keyboard,
                    },
                  );
                }

                console.log(
                  `成功发送消息到频道 (${channelTarget}) 使用机器人 ${bot.botName}, 消息ID: ${sentMessage.message_id}`,
                );

                // 记录发送成功历史
                const channelGroup = findChannelGroup(post, channelTarget);
                await ChannelPostHistory.create({
                  channelPost: post._id,
                  bot: bot._id,
                  proxy: proxyUser._id,
                  channel: channelGroup?._id,
                  channelId: channelTarget,
                  messageId: sentMessage.message_id,
                  content: messageContent,
                  medias: post.medias || [],
                  status: 'success',
                  sentAt: new Date(),
                });
              } catch (sendError: any) {
                console.error(
                  `[channelPost] 向频道 ${channelTarget} 发送消息时出错:`,
                  sendError,
                );

                // 记录发送失败历史
                const channelGroup = findChannelGroup(post, channelTarget);
                await ChannelPostHistory.create({
                  channelPost: post._id,
                  bot: bot._id,
                  proxy: proxyUser._id,
                  channel: channelGroup?._id,
                  channelId: channelTarget,
                  content: post.content || '',
                  medias: post.medias || [],
                  status: 'failed',
                  errorMessage: sendError?.message || String(sendError),
                  sentAt: new Date(),
                });

                // 继续处理下一个频道
              }
            }

            // 更新频道推广的最后发送时间
            await ChannelPost.findByIdAndUpdate(post._id, {
              lastPostTime: new Date(),
            });
          } catch (postError) {
            console.error(
              `[channelPost] 处理频道推广 ${post._id} 时出错:`,
              postError,
            );
            continue;
          }
        }
      } catch (botError) {
        console.error(
          `[channelPost] 处理机器人 ${bot.botName} 时出错:`,
          botError,
        );
        continue;
      }
    }

    console.log('[channelPost] 频道消息发送任务完成');
  } catch (error) {
    console.error('[channelPost] 发送消息到频道失败:', error);
  }
}

/**
 * 获取频道目标（channel.id）
 */
function getChannelTargets(post: any): (string | number)[] {
  if (post.channel?.id) {
    return [post.channel.id];
  }
  return [];
}

/**
 * 为频道推广构建消息内容和键盘
 */
function buildChannelMessage(
  bot: any,
  post: any,
): { messageContent: string; keyboard: InlineKeyboard } {
  // 构建消息内容
  const messageContent =
    post.content || bot.purchasing_introduction || '📺 频道推荐';

  const keyboard = buildInlineKeyboard(post.menus) || new InlineKeyboard();

  // 添加机器人的客服和机器人链接（如果有的话）
  if (bot.customer_service_link) {
    keyboard.url('📱 联系客服', bot.customer_service_link).row();
  }
  if (bot.url) {
    keyboard.url('🤖 访问机器人', bot.url).row();
  }

  return { messageContent, keyboard };
}

/**
 * 检查频道推广是否到了发送间隔时间
 */
function checkChannelSendInterval(post: any): boolean {
  const now = new Date();
  const intervalMinutes = post.interval || 0;

  // 如果间隔设置为0，表示禁用发送
  if (intervalMinutes === 0) {
    console.log(`频道推广 ${post._id} 间隔设置为0，禁用发送`);
    return false;
  }

  // 如果没有上次发送时间，说明是第一次发送，允许发送
  if (!post.lastPostTime) {
    console.log(`频道推广 ${post._id} 首次发送，允许发送`);
    return true;
  }

  // 计算时间差（毫秒）
  const timeDiff = now.getTime() - new Date(post.lastPostTime).getTime();
  const timeDiffMinutes = timeDiff / (1000 * 60);

  console.log(
    `频道推广 ${post._id} 上次发送时间: ${
      post.lastPostTime
    }, 间隔设置: ${intervalMinutes}分钟, 实际间隔: ${timeDiffMinutes.toFixed(
      2,
    )}分钟`,
  );

  return timeDiffMinutes >= intervalMinutes;
}

/**
 * 根据频道目标查找对应的 Group 对象
 */
function findChannelGroup(post: any, channelTarget: string | number): any {
  if (post.channel?.id === channelTarget) {
    return post.channel;
  }
  return null;
}
