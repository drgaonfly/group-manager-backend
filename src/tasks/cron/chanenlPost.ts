import Bot from '../../models/bot';
import ChannelPost from '../../models/channelPost';
import { findBotProxy } from '../../bot/services/findBotProxy';
import { PermissionChecker } from '../../bot/utils/permissionChecker';
import { setupBot } from '../../bot/botSetup';
import { InlineKeyboard, InputFile } from 'grammy';

/**
 * 定时发送频道消息到指定群组
 */
export async function channelPost() {
  try {
    // 查询所有开启频道发送且在线的机器人
    const bots = await Bot.find({
      isOnline: true,
      canOpenChannelPost: true,
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

        // 查询该机器人的所有启用的频道推广
        const allChannels = await ChannelPost.find({
          bot: bot._id,
          isOnline: true,
        }).sort({ weight: 1, createdAt: -1 });

        if (!allChannels || allChannels.length === 0) {
          console.log(`机器人 ${bot.botName} 未配置启用的频道，跳过`);
          continue;
        }

        // 筛选出需要发送的频道（检查间隔时间）
        const channelsToPost = allChannels.filter((channel) =>
          checkChannelSendInterval(channel),
        );

        if (channelsToPost.length === 0) {
          console.log(`机器人 ${bot.botName} 没有到达发送间隔的频道，跳过`);
          continue;
        }

        console.log(
          `机器人 ${bot.botName} 找到 ${channelsToPost.length} 个需要发送的频道`,
        );

        // 设置机器人实例
        const telegramBot = setupBot(bot.token);

        // 向每个需要发送的频道发送消息
        for (const channel of channelsToPost) {
          try {
            // 从频道URL中提取频道ID或用户名
            const channelTarget = extractChannelTarget(channel.url);

            if (!channelTarget) {
              console.log(
                `频道 ${channel.title} 的URL格式不正确，跳过: ${channel.url}`,
              );
              continue;
            }

            // 如果频道设置了清除上一条消息且有上一条消息ID，先删除上一条消息
            if (channel.isClearLastPost === true && channel.lastPostMessageId) {
              try {
                await telegramBot.api.deleteMessage(
                  channelTarget,
                  channel.lastPostMessageId,
                );
                console.log(
                  `成功删除频道 ${channel.title} 中的上一条消息 (ID: ${channel.lastPostMessageId})`,
                );
              } catch (deleteError) {
                console.log(
                  `删除频道 ${channel.title} 中的上一条消息失败 (ID: ${channel.lastPostMessageId}):`,
                  deleteError,
                );
                // 删除失败不影响发送新消息，继续执行
              }
            }

            // 为单个频道构建消息内容和键盘
            const {
              messageContent: singleChannelMessage,
              keyboard: singleChannelKeyboard,
            } = buildSingleChannelMessage(bot, channel);

            // 发送新消息到频道
            let sentMessage;

            // 判断媒体类型的辅助函数
            const getMediaType = (filename: string): 'photo' | 'video' => {
              const ext = filename.toLowerCase().split('.').pop();
              const videoExtensions = [
                'mp4',
                'avi',
                'mov',
                'mkv',
                'webm',
                'flv',
                'wmv',
              ];
              return videoExtensions.includes(ext || '') ? 'video' : 'photo';
            };

            // 检查是否有媒体文件
            if (
              channel.medias &&
              Array.isArray(channel.medias) &&
              channel.medias.length > 0
            ) {
              if (channel.medias.length === 1) {
                const mediaType = getMediaType(channel.medias[0]);
                if (mediaType === 'video') {
                  sentMessage = await telegramBot.api.sendVideo(
                    channelTarget,
                    new InputFile(`tmp/${channel.medias[0]}`),
                    {
                      caption: singleChannelMessage,
                      parse_mode: 'HTML',
                      reply_markup: singleChannelKeyboard,
                    },
                  );
                } else {
                  sentMessage = await telegramBot.api.sendPhoto(
                    channelTarget,
                    new InputFile(`tmp/${channel.medias[0]}`),
                    {
                      caption: singleChannelMessage,
                      parse_mode: 'HTML',
                      reply_markup: singleChannelKeyboard,
                    },
                  );
                }
              } else {
                // 多个媒体文件，使用 sendMediaGroup（不带 caption）
                const media = channel.medias.map((file: string) => {
                  const type = getMediaType(file);
                  return {
                    type: type as 'photo' | 'video',
                    media: new InputFile(`tmp/${file}`),
                  };
                });

                await telegramBot.api.sendMediaGroup(
                  channelTarget,
                  media as any,
                );

                // 发送完媒体组后，单独发送 caption 和内联菜单
                sentMessage = await telegramBot.api.sendMessage(
                  channelTarget,
                  singleChannelMessage,
                  {
                    parse_mode: 'HTML',
                    reply_markup: singleChannelKeyboard,
                  },
                );
              }
            } else {
              // 发送纯文本消息
              sentMessage = await telegramBot.api.sendMessage(
                channelTarget,
                singleChannelMessage,
                {
                  parse_mode: 'HTML',
                  reply_markup: singleChannelKeyboard,
                },
              );
            }

            console.log(
              `成功发送消息到频道 ${channel.title} (${channelTarget}) 使用机器人 ${bot.botName}, 新消息ID: ${sentMessage.message_id}`,
            );

            // 更新频道推广的最后发送时间和消息ID
            await ChannelPost.findByIdAndUpdate(channel._id, {
              lastPostTime: new Date(),
              lastPostMessageId: sentMessage.message_id,
            });
          } catch (channelError) {
            console.error(
              `[channelPost] 向频道 ${channel.title} 发送消息时出错:`,
              channelError,
            );
            // 继续处理下一个频道，不中断整个流程
            continue;
          }
        }
      } catch (botError) {
        console.error(
          `[channelPost] 处理机器人 ${bot.botName} 时出错:`,
          botError,
        );
        // 继续处理下一个机器人，不中断整个流程
        continue;
      }
    }

    console.log('[channelPost] 频道消息发送任务完成');
  } catch (error) {
    console.error('[channelPost] 发送消息到频道失败:', error);
  }
}

/**
 * 从频道URL中提取Telegram频道ID或用户名
 */
function extractChannelTarget(url: string): string | null {
  if (!url) return null;

  // 处理 t.me/channelname 格式
  const telegramMatch = url.match(/t\.me\/([a-zA-Z0-9_]+)/);
  if (telegramMatch) {
    return `@${telegramMatch[1]}`;
  }

  // 处理直接的频道ID格式 (如 -1001234567890)
  const channelIdMatch = url.match(/^-?\d+$/);
  if (channelIdMatch) {
    return url;
  }

  // 处理 @channelname 格式
  const usernameMatch = url.match(/^@([a-zA-Z0-9_]+)$/);
  if (usernameMatch) {
    return url;
  }

  return null;
}

/**
 * 为单个频道构建消息内容和键盘
 */
function buildSingleChannelMessage(
  bot: any,
  channel: any,
): { messageContent: string; keyboard: InlineKeyboard } {
  // 构建消息内容
  let messageContent = `<b>${channel.title}</b>`;

  // 如果有自定义内容，使用自定义内容，否则使用默认格式
  if (channel.content) {
    messageContent += `\n\n${channel.content}`;
  } else {
    messageContent += `\n\n${bot.purchasing_introduction || '📺 频道推荐'}`;
  }

  // 构建内联键盘
  const keyboard = new InlineKeyboard();

  // 如果有自定义菜单，使用自定义菜单
  if (channel.menus && channel.menus.length > 0) {
    // 添加自定义菜单按钮，两列布局
    for (let i = 0; i < channel.menus.length; ) {
      const menu1 = channel.menus[i];
      const menu2 = i + 1 < channel.menus.length ? channel.menus[i + 1] : null;

      if (menu1 && menu2) {
        // 一行两个按钮
        keyboard.url(menu1.name, menu1.url).url(menu2.name, menu2.url).row();
        i += 2;
      } else if (menu1) {
        // 只有一个按钮
        keyboard.url(menu1.name, menu1.url).row();
        i += 1;
      } else {
        break;
      }
    }
  } else {
    // 使用默认按钮布局
    // 添加频道链接按钮
    keyboard.url(`📺 ${channel.title}`, channel.url).row();
  }

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
 * 检查频道是否到了发送间隔时间
 */
function checkChannelSendInterval(channel: any): boolean {
  const now = new Date();
  const intervalMinutes = channel.interval || 0; // 确保有默认值

  // 如果间隔设置为0，表示禁用发送
  if (intervalMinutes === 0) {
    console.log(`频道 ${channel.title} 间隔设置为0，禁用发送`);
    return false;
  }

  // 如果没有上次发送时间，说明是第一次发送，允许发送
  if (!channel.lastPostTime) {
    console.log(`频道 ${channel.title} 首次发送，允许发送`);
    return true;
  }

  // 计算时间差（毫秒）
  const timeDiff = now.getTime() - new Date(channel.lastPostTime).getTime();
  const timeDiffMinutes = timeDiff / (1000 * 60); // 转换为分钟

  console.log(
    `频道 ${channel.title} 上次发送时间: ${
      channel.lastPostTime
    }, 间隔设置: ${intervalMinutes}分钟, 实际间隔: ${timeDiffMinutes.toFixed(
      2,
    )}分钟`,
  );

  // 如果时间差大于等于设置的间隔时间，允许发送
  return timeDiffMinutes >= intervalMinutes;
}
