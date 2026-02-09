import User from '../../models/user';
import GroupMessage, { IGroupMessage } from '../../models/groupMessage';
import { IGroup } from '../../models/group';
import GroupMessageHistory from '../../models/groupMessageHistory';
import GroupMessageRecord from '../../models/groupMessageRecord';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { isWithinTimeWindow, formatTimeWindow } from '../../utils/timeWindow';
import { setupBot } from '../../bot/botSetup';
import { InlineKeyboard } from 'grammy';
import { sendMediaMessage } from '../../utils/sendMultiMedia';

/**
 * 群发消息任务
 */
export async function sendGroupMessages() {
  try {
    console.log('[sendGroupMessages] 开始处理群发消息...');

    const currentTime = new Date();

    console.log(`[当前时间] ${formatBeijingDate(currentTime)}`);

    // 查询所有在线的群发消息，并关联 bot、user、groups
    const groupMessages = await GroupMessage.find({ isOnline: true })
      .populate({
        path: 'bot',
        populate: {
          path: 'user',
        },
      })
      .populate('groups')
      .sort({ weight: 1 }); // 按权重升序

    console.log(
      `[sendGroupMessages] 查询到 ${groupMessages.length} 条群发消息`,
    );

    // 按机器人分组，避免重复处理
    const botGroupMap = new Map<string, IGroupMessage[]>();
    for (const message of groupMessages) {
      const bot = message.bot as any;
      if (!bot) continue;

      const botId = bot._id.toString();
      if (!botGroupMap.has(botId)) {
        botGroupMap.set(botId, []);
      }
      botGroupMap.get(botId)!.push(message);
    }

    console.log(`[sendGroupMessages] 共 ${botGroupMap.size} 个机器人需要处理`);

    const stats = {
      processed: 0,
      sent: 0,
      skipped: 0,
      noPermission: 0,
      errors: 0,
    };

    // 按机器人处理，每个机器人只处理一次
    for (const [botId, botMessages] of botGroupMap.entries()) {
      try {
        const firstMessage = botMessages[0];
        const bot = firstMessage.bot as any;

        console.log(
          `[处理机器人] ${bot.botName} (${botId}), 共 ${botMessages.length} 条消息`,
        );

        // 检查机器人所属用户的群发权限
        const proxyUser = await User.findById(firstMessage.proxy);

        if (!proxyUser?.groupMessage) {
          console.warn(
            `[sendGroupMessages] 机器人 ${bot.botName} 关联的代理用户没有配置群发功能`,
          );
          stats.noPermission++;
          continue;
        }

        // 设置机器人
        const telegramBot = setupBot(bot.token);

        // 收集所有需要发送的群组（去重）
        const allGroups = new Set<string>();
        for (const msg of botMessages) {
          const groups = msg.groups as IGroup[];
          if (groups && groups.length > 0) {
            groups.forEach((g) => g && allGroups.add(g._id.toString()));
          }
        }

        if (allGroups.size === 0) {
          console.warn(
            `[sendGroupMessages] 机器人 ${bot.botName} 没有关联的群组，跳过`,
          );
          stats.skipped++;
          continue;
        }

        console.log(
          `[sendGroupMessages] 机器人 ${bot.botName} 需要发送到 ${allGroups.size} 个群组`,
        );

        let sentCount = 0;

        // 向每个群组发送消息
        for (const groupIdStr of allGroups) {
          try {
            // 找到包含这个群组的消息
            const messageForGroup = botMessages.find((msg) => {
              const groups = msg.groups as IGroup[];
              return groups?.some((g) => g._id.toString() === groupIdStr);
            });

            if (!messageForGroup) continue;

            const group = (messageForGroup.groups as IGroup[]).find(
              (g) => g._id.toString() === groupIdStr,
            );

            if (!group) {
              console.log(`[sendGroupMessage] 群组不存在: ${groupIdStr}`);
              continue;
            }

            // 检查是否在发送时间窗口内
            if (
              !isWithinTimeWindow(
                messageForGroup.startAt,
                messageForGroup.endAt,
              )
            ) {
              console.log(
                `[sendGroupMessages] 群 ${
                  group.id
                } 不在发送时间窗口内 (${formatTimeWindow(
                  messageForGroup.startAt,
                  messageForGroup.endAt,
                )})，跳过`,
              );
              stats.skipped++;
              continue;
            }

            const history = await GroupMessageHistory.findOne({
              group: group._id,
            });

            let nextMessage: IGroupMessage;
            let shouldSend = false;
            const intervalTimeInMs = messageForGroup.intervalTime * 60 * 1000;

            if (!history) {
              // 从没发过，发第一条
              console.log(
                `[首次发送] 群 ${group.id} 从未发送过消息，准备发送第一条`,
              );
              nextMessage = botMessages[0];
              shouldSend = true;
            } else {
              const lastSentIndex = botMessages.findIndex(
                (msg) =>
                  msg._id.toString() === history.lastSentMessage.toString(),
              );

              const now = Date.now();
              const timeSinceLastSent =
                now - new Date(history.sentAt).getTime();

              console.log(`[时间检查] 群 ${group.id}:`);
              console.log(
                `  上次发送时间: ${new Date(history.sentAt).toLocaleString(
                  'zh-CN',
                )}`,
              );
              console.log(
                `  当前时间: ${new Date(now).toLocaleString('zh-CN')}`,
              );
              console.log(`  经过时间(ms): ${timeSinceLastSent}`);
              console.log(`  需要间隔(ms): ${intervalTimeInMs}`);
              console.log(`  需要间隔(分钟): ${messageForGroup.intervalTime}`);

              if (timeSinceLastSent >= intervalTimeInMs) {
                // 下一个要发的消息（循环）
                const nextIndex = (lastSentIndex + 1) % botMessages.length;
                nextMessage = botMessages[nextIndex];
                shouldSend = true;
              } else {
                const timeSinceLastSentMinutes = (
                  timeSinceLastSent /
                  (60 * 1000)
                ).toFixed(2);
                console.log(
                  `[跳过] 群 ${group.id} 距离上次消息 ${timeSinceLastSentMinutes} 分钟，不足 ${messageForGroup.intervalTime} 分钟，跳过`,
                );
                stats.skipped++;
                continue;
              }
            }

            if (!shouldSend) continue;

            stats.processed++;

            // 构建菜单 InlineKeyboard
            let replyMarkup: InlineKeyboard | undefined = undefined;
            if (
              Array.isArray(nextMessage.menus) &&
              nextMessage.menus.length > 0
            ) {
              const perRow = nextMessage.menus_per_row || 1;
              replyMarkup = new InlineKeyboard();

              for (let i = 0; i < nextMessage.menus.length; i += perRow) {
                const rowMenus = nextMessage.menus.slice(i, i + perRow);
                const buttons = rowMenus
                  .filter((menu) => menu.name && menu.url)
                  .map((menu) => ({
                    text: menu.name,
                    url: menu.url,
                  }));

                if (buttons.length > 0) {
                  replyMarkup.add(...buttons).row();
                }
              }
            }

            // 发送消息
            let sentMessageId: number | undefined;
            try {
              if (
                Array.isArray(nextMessage.medias) &&
                nextMessage.medias.length > 0
              ) {
                const result = await sendMediaMessage(
                  telegramBot.api,
                  group.id,
                  nextMessage.medias,
                  {
                    caption: nextMessage.content,
                    reply_markup: replyMarkup,
                  },
                );
                sentMessageId =
                  result.message_id ||
                  result.media_group_messages?.[0]?.message_id;
              } else {
                const result = await telegramBot.api.sendMessage(
                  group.id,
                  nextMessage.content,
                  {
                    parse_mode: 'HTML',
                    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
                  },
                );
                sentMessageId = result.message_id;
              }

              // 记录成功发送
              await GroupMessageRecord.create({
                groupMessage: nextMessage._id,
                bot: bot._id,
                proxy: messageForGroup.proxy,
                group: group._id,
                groupId: group.id,
                messageId: sentMessageId,
                content: nextMessage.content,
                medias: nextMessage.medias || [],
                status: 'success',
                sentAt: new Date(),
              });

              sentCount++;

              await GroupMessageHistory.findOneAndUpdate(
                { group: group._id },
                {
                  lastSentMessage: nextMessage._id,
                  sentAt: new Date(),
                },
                { upsert: true },
              );

              console.log(
                `[sendGroupMessages] 群 ${group.id} 成功发送消息 ${nextMessage._id}`,
              );
            } catch (sendErr: any) {
              // 记录发送失败
              await GroupMessageRecord.create({
                groupMessage: nextMessage._id,
                bot: bot._id,
                proxy: messageForGroup.proxy,
                group: group._id,
                groupId: group.id,
                content: nextMessage.content,
                medias: nextMessage.medias || [],
                status: 'failed',
                errorMessage: sendErr?.message || String(sendErr),
                sentAt: new Date(),
              });
              console.error(
                `[sendGroupMessages] 向群组 ${group?.id} 发送消息失败:`,
                sendErr,
              );
              stats.errors++;
            }
          } catch (err) {
            console.error(`[sendGroupMessages] 处理群组时出错:`, err);
            stats.errors++;
            continue;
          }
        }

        if (sentCount > 0) {
          stats.sent++;
          console.log(
            `[sendGroupMessages] 机器人 ${bot.botName} 已成功发送到 ${sentCount} 个群组`,
          );
        }
      } catch (error) {
        console.error(
          `[sendGroupMessages] 处理机器人 ${botId} 时发生错误:`,
          error,
        );
        stats.errors++;
        continue;
      }
    }

    // 输出统计信息
    const endTime = new Date();
    const taskDuration = (endTime.getTime() - currentTime.getTime()) / 1000;

    console.log('\n========== 群发消息任务统计 ==========');
    console.log(`[统计信息] 处理的群组数: ${stats.processed}`);
    console.log(`[统计信息] 发送成功的机器人数: ${stats.sent}`);
    console.log(`[统计信息] 无权限跳过: ${stats.noPermission}`);
    console.log(`[统计信息] 其他跳过: ${stats.skipped}`);
    console.log(`[统计信息] 错误数: ${stats.errors}`);
    console.log(`[统计信息] 任务总耗时: ${taskDuration.toFixed(2)}秒`);
    console.log('========== 群发消息任务完成 ==========');
  } catch (error) {
    console.error('[sendGroupMessages] 处理群发消息时出错:', error);
  }
}
