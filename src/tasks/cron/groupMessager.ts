import User from '../../models/user';
import GroupMessage from '../../models/groupMessage';
import { IGroup } from '../../models/group';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { isWithinTimeWindow, formatTimeWindow } from '../../utils/timeWindow';
import { setupBot } from '../../bot/botSetup';
import { sendMediaMessage } from '../../utils/sendMultiMedia';
import { buildInlineKeyboard } from '../../utils/buildInlineKeyboard';
import { replaceMessageVariables } from '../../utils/telegramHtmlConvert';

/**
 * 群发消息任务（每条消息对应单个群组）
 */
export async function sendGroupMessages() {
  try {
    console.log('[sendGroupMessages] 开始处理群发消息...');

    const currentTime = new Date();
    console.log(`[当前时间] ${formatBeijingDate(currentTime)}`);

    // 查询所有在线且状态正常的群发消息，关联 bot、group
    const groupMessages = await GroupMessage.find({
      isOnline: true,
      sendType: { $ne: 'immediate' },
      status: { $ne: 'abnormal' },
    })
      .populate({
        path: 'bot',
        populate: { path: 'user' },
      })
      .populate('group')
      .sort({ weight: 1 });

    console.log(
      `[sendGroupMessages] 查询到 ${groupMessages.length} 条群发消息`,
    );

    const stats = {
      processed: 0,
      sent: 0,
      skipped: 0,
      noPermission: 0,
      errors: 0,
      markedAbnormal: 0,
    };

    for (const msg of groupMessages) {
      try {
        const bot = msg.bot as any;
        const group = msg.group as IGroup | undefined;

        if (!bot || !group) {
          console.warn(
            `[sendGroupMessages] 消息 ${msg._id} 缺少 bot 或 group，跳过`,
          );
          stats.skipped++;
          continue;
        }

        // 检查代理用户群发权限
        const proxyUser = await User.findById(msg.proxy);
        if (!proxyUser?.groupMessage) {
          console.warn(
            `[sendGroupMessages] 机器人 ${bot.botName} 代理用户无群发权限，跳过`,
          );
          stats.noPermission++;
          continue;
        }

        // 检查时间窗口
        if (!isWithinTimeWindow(msg.startAt, msg.endAt)) {
          console.log(
            `[sendGroupMessages] 消息 ${
              msg._id
            } 不在发送时间窗口内 (${formatTimeWindow(
              msg.startAt,
              msg.endAt,
            )})，跳过`,
          );
          stats.skipped++;
          continue;
        }

        // 检查间隔时间（使用 GroupMessage 自身的 lastSentTime）
        if (msg.lastSentTime) {
          const timeSinceLastSent =
            Date.now() - new Date(msg.lastSentTime).getTime();
          const intervalTimeInMs = msg.intervalTime * 60 * 1000;

          if (timeSinceLastSent < intervalTimeInMs) {
            console.log(
              `[sendGroupMessages] 群 ${group.id} 距上次发送 ${(
                timeSinceLastSent / 60000
              ).toFixed(2)} 分钟，不足 ${msg.intervalTime} 分钟，跳过`,
            );
            stats.skipped++;
            continue;
          }
        }

        stats.processed++;

        // 先记录发送时间（用触发时刻而非完成时刻），避免累积漂移
        await GroupMessage.findByIdAndUpdate(msg._id, {
          lastSentTime: currentTime,
        });

        const telegramBot = setupBot(bot.token);

        const replyMarkup = buildInlineKeyboard(msg.menus);

        let sentMessageId: number | undefined;
        try {
          // 自动删除上一条
          if (msg.autoDeletePrevious && msg.lastSentMessageId) {
            try {
              // 如果上一条消息设置了置顶，先取消置顶
              if (msg.isPinned) {
                try {
                  await telegramBot.api.unpinChatMessage(
                    group.id,
                    msg.lastSentMessageId,
                  );
                  console.log(
                    `[autoDelete] 群 ${group.id} 已取消置顶消息 ${msg.lastSentMessageId}`,
                  );
                } catch (unpinErr: any) {
                  console.warn(
                    `[autoDelete] 取消置顶失败（忽略）:`,
                    unpinErr?.message,
                  );
                }
              }

              // 删除消息
              await telegramBot.api.deleteMessage(
                group.id,
                msg.lastSentMessageId,
              );
              console.log(
                `[autoDelete] 群 ${group.id} 已删除上一条消息 ${msg.lastSentMessageId}`,
              );
            } catch (delErr: any) {
              console.warn(
                `[autoDelete] 删除消息失败（忽略）:`,
                delErr?.message,
              );
            }
          }

          const variables = {
            groupTitle: String(group.title || group.id),
            currentTime: formatBeijingDate(new Date()),
            currentBot: `@${bot.userName}`,
          };
          const processedContent = replaceMessageVariables(
            msg.content,
            variables,
          );

          if (Array.isArray(msg.medias) && msg.medias.length > 0) {
            const result = await sendMediaMessage(
              telegramBot.api,
              group.id,
              msg.medias,
              {
                caption: processedContent,
                reply_markup: replyMarkup,
              },
            );
            sentMessageId =
              (result as any).message_id ||
              (result as any).media_group_messages?.[0]?.message_id;
          } else {
            const result = await telegramBot.api.sendMessage(
              group.id,
              processedContent,
              {
                parse_mode: 'HTML',
                ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
              },
            );
            sentMessageId = result.message_id;
          }

          // 如果设置了置顶，则置顶消息
          if (msg.isPinned && sentMessageId) {
            try {
              await telegramBot.api.pinChatMessage(group.id, sentMessageId, {
                disable_notification: true,
              });
              console.log(
                `[pinMessage] 群 ${group.id} 消息 ${sentMessageId} 已置顶`,
              );
            } catch (pinErr: any) {
              console.warn(
                `[pinMessage] 置顶消息失败（忽略）:`,
                pinErr?.message,
              );
            }
          }

          // 更新 GroupMessage 的消息ID（lastSentTime 已在发送前记录）
          await GroupMessage.findByIdAndUpdate(msg._id, {
            lastSentMessageId: sentMessageId,
          });

          stats.sent++;
          console.log(
            `[sendGroupMessages] 群 ${group.id} 消息 ${msg._id} 发送成功`,
          );
        } catch (sendErr: any) {
          console.error(
            `[sendGroupMessages] 向群 ${group?.id} 发送消息失败:`,
            sendErr,
          );

          // 判断是否为不可恢复的错误，标记为 abnormal 避免持续重试
          const description: string = sendErr?.description ?? '';
          const isIrrecoverable =
            description.includes('chat not found') ||
            description.includes('CHAT_RESTRICTED') ||
            description.includes('not enough rights');

          if (isIrrecoverable) {
            await GroupMessage.findByIdAndUpdate(msg._id, {
              status: 'abnormal',
              statusReason: description,
            });
            console.warn(
              `[sendGroupMessages] 消息 ${msg._id} 标记为 abnormal: ${description}`,
            );
            stats.markedAbnormal++;
          }

          stats.errors++;
        }
      } catch (err) {
        console.error(`[sendGroupMessages] 处理消息时出错:`, err);
        stats.errors++;
      }
    }

    const taskDuration = (new Date().getTime() - currentTime.getTime()) / 1000;
    console.log('\n========== 群发消息任务统计 ==========');
    console.log(`[统计信息] 处理条数: ${stats.processed}`);
    console.log(`[统计信息] 发送成功: ${stats.sent}`);
    console.log(`[统计信息] 无权限跳过: ${stats.noPermission}`);
    console.log(`[统计信息] 其他跳过: ${stats.skipped}`);
    console.log(`[统计信息] 标记异常: ${stats.markedAbnormal}`);
    console.log(`[统计信息] 错误数: ${stats.errors}`);
    console.log(`[统计信息] 总耗时: ${taskDuration.toFixed(2)}秒`);
    console.log('========== 群发消息任务完成 ==========');
  } catch (error) {
    console.error('[sendGroupMessages] 处理群发消息时出错:', error);
  }
}
