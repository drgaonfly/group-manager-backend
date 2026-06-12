import User from '../../models/user';
import GroupMessage from '../../models/groupMessage';
import { IGroup } from '../../models/group';
import GroupMessageHistory from '../../models/groupMessageHistory';
import GroupMessageRecord from '../../models/groupMessageRecord';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { isWithinTimeWindow, formatTimeWindow } from '../../utils/timeWindow';
import { setupBot } from '../../bot/botSetup';
import { InlineKeyboard } from 'grammy';
import { sendMediaMessage } from '../../utils/sendMultiMedia';
import { replaceMessageVariables } from '../../utils/telegramHtmlConvert';

/**
 * 群发消息任务（每条消息对应单个群组）
 */
export async function sendGroupMessages() {
  try {
    console.log('[sendGroupMessages] 开始处理群发消息...');

    const currentTime = new Date();
    console.log(`[当前时间] ${formatBeijingDate(currentTime)}`);

    // 查询所有在线的群发消息，关联 bot、group
    const groupMessages = await GroupMessage.find({ isOnline: true })
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

        // 检查间隔时间
        const history = await GroupMessageHistory.findOne({ group: group._id });
        const intervalTimeInMs = msg.intervalTime * 60 * 1000;

        if (history) {
          const timeSinceLastSent =
            Date.now() - new Date(history.sentAt).getTime();
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

        const telegramBot = setupBot(bot.token);

        // 构建内联键盘
        let replyMarkup: InlineKeyboard | undefined;
        if (Array.isArray(msg.menus) && msg.menus.length > 0) {
          const perRow = msg.menus_per_row || 1;
          replyMarkup = new InlineKeyboard();
          for (let i = 0; i < msg.menus.length; i += perRow) {
            const buttons = msg.menus
              .slice(i, i + perRow)
              .filter((m) => m.name && m.url)
              .map((m) => ({ text: m.name, url: m.url }));
            if (buttons.length > 0) replyMarkup.add(...buttons).row();
          }
        }

        let sentMessageId: number | undefined;
        try {
          // 自动删除上一条
          if (msg.autoDeletePrevious && history?.lastSentMessageId) {
            try {
              await telegramBot.api.deleteMessage(
                group.id,
                history.lastSentMessageId,
              );
              console.log(
                `[autoDelete] 群 ${group.id} 已删除上一条消息 ${history.lastSentMessageId}`,
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

          await GroupMessageRecord.create({
            groupMessage: msg._id,
            bot: bot._id,
            proxy: msg.proxy,
            group: group._id,
            groupId: group.id,
            messageId: sentMessageId,
            content: msg.content,
            medias: msg.medias || [],
            status: 'success',
            sentAt: new Date(),
          });

          await GroupMessageHistory.findOneAndUpdate(
            { group: group._id },
            {
              lastSentMessage: msg._id,
              lastSentMessageId: sentMessageId,
              sentAt: new Date(),
            },
            { upsert: true },
          );

          stats.sent++;
          console.log(
            `[sendGroupMessages] 群 ${group.id} 消息 ${msg._id} 发送成功`,
          );
        } catch (sendErr: any) {
          await GroupMessageRecord.create({
            groupMessage: msg._id,
            bot: bot._id,
            proxy: msg.proxy,
            group: group._id,
            groupId: group.id,
            content: msg.content,
            medias: msg.medias || [],
            status: 'failed',
            errorMessage: sendErr?.message || String(sendErr),
            sentAt: new Date(),
          });
          console.error(
            `[sendGroupMessages] 向群 ${group?.id} 发送消息失败:`,
            sendErr,
          );
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
    console.log(`[统计信息] 错误数: ${stats.errors}`);
    console.log(`[统计信息] 总耗时: ${taskDuration.toFixed(2)}秒`);
    console.log('========== 群发消息任务完成 ==========');
  } catch (error) {
    console.error('[sendGroupMessages] 处理群发消息时出错:', error);
  }
}
