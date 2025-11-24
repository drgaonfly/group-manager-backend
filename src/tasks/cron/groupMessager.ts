import User from '../../models/user';
import GroupMessage, { IGroupMessage } from '../../models/groupMessage';
import { IGroup } from '../../models/group';
import GroupMessageHistory from '../../models/groupMessageHistory';
import { formatBeijingDate } from '../../utils/formatBeijingDate';
import { setupBot } from '../../bot/botSetup';
import { InlineKeyboard, InputFile } from 'grammy';

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

    const stats = {
      processed: 0,
      sent: 0,
      skipped: 0,
      noPermission: 0,
      errors: 0,
    };

    for (const message of groupMessages) {
      try {
        stats.processed++;

        console.log('message', message);

        const bot = message.bot as any;
        if (!bot) {
          console.warn(
            `[sendGroupMessages] 消息 ${message._id} 没有关联的机器人，跳过`,
          );
          stats.skipped++;
          continue;
        }

        // 检查机器人所属用户的群发权限
        const proxyUer = await User.findById(message.proxy);

        if (!proxyUer.groupMessage) {
          console.warn(
            `[sendGroupMessages] 消息 ${message._id} 关联的代理用户没有配置群发功能`,
          );
          stats.skipped++;
          continue;
        }

        // 设置机器人
        const telegramBot = setupBot(bot.token);

        // 获取关联的群组
        const groups = message.groups as IGroup[];

        if (!groups || groups.length === 0) {
          console.warn(
            `[sendGroupMessages] 消息 ${message._id} 没有关联的群组，跳过`,
          );
          stats.skipped++;
          continue;
        }

        // 获取该机器人的所有群发消息（用于轮播逻辑）
        const botGroupMessages = await GroupMessage.find({
          bot: bot._id,
          isOnline: true,
        }).sort({ weight: 1 });

        let sentCount = 0;

        // 向每个群组发送消息
        for (const group of groups) {
          try {
            if (!group) {
              console.log(`[sendGroupMessage] 群组不存在: ${group}`);
              continue;
            }

            const history = await GroupMessageHistory.findOne({
              group: group._id,
            });

            let nextMessage: IGroupMessage;
            let shouldSend = false;
            const intervalTimeInMs = message.intervalTime * 60 * 60 * 1000;

            if (!history) {
              // 从没发过，发第一条
              console.log(
                `[首次发送] 群 ${group.id} 从未发送过消息，准备发送第一条`,
              );
              nextMessage = botGroupMessages[0];
              shouldSend = true;
            } else {
              const lastSentIndex = botGroupMessages.findIndex(
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
              console.log(`  需要间隔(小时): ${message.intervalTime}`);

              if (timeSinceLastSent >= intervalTimeInMs) {
                // 下一个要发的消息（循环）
                const nextIndex = (lastSentIndex + 1) % botGroupMessages.length;
                nextMessage = botGroupMessages[nextIndex];
                shouldSend = true;
              } else {
                const timeSinceLastSentHours = (
                  timeSinceLastSent /
                  (60 * 60 * 1000)
                ).toFixed(2);
                console.log(
                  `[跳过] 群 ${group.id} 距离上次消息 ${timeSinceLastSentHours} 小时，不足 ${message.intervalTime} 小时，跳过`,
                );
                stats.skipped++;
                continue;
              }
            }

            if (!shouldSend) continue;

            // ✅ 满足条件，可以发送该条消息

            // 构建菜单 InlineKeyboard, 支持每行多个菜单按钮
            let replyMarkup: InlineKeyboard | undefined = undefined;
            if (
              Array.isArray(nextMessage.menus) &&
              nextMessage.menus.length > 0
            ) {
              const perRow = nextMessage.menus_per_row || 1; // 默认每行1个按钮
              replyMarkup = new InlineKeyboard();

              for (let i = 0; i < nextMessage.menus.length; i += perRow) {
                const rowMenus = nextMessage.menus.slice(i, i + perRow);
                const buttons = rowMenus
                  .filter((menu) => menu.menuName && menu.url)
                  .map((menu) => ({
                    text: menu.menuName,
                    url: menu.url,
                  }));

                // 添加这一行按钮
                if (buttons.length > 0) {
                  replyMarkup.add(...buttons).row();
                }
              }
            }

            // 如果成功，才发送消息
            if (
              Array.isArray(nextMessage.images) &&
              nextMessage.images.length > 0
            ) {
              if (nextMessage.images.length === 1) {
                // 单张图片，直接 sendPhoto
                await telegramBot.api.sendPhoto(
                  group.id,
                  new InputFile(`tmp/${nextMessage.images[0]}`),
                  {
                    caption: nextMessage.content,
                    parse_mode: 'HTML',
                    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
                  },
                );
              } else {
                // 多张图片，使用 sendMediaGroup
                const media = nextMessage.images.map(
                  (img: string, idx: number) => {
                    return {
                      type: 'photo' as const,
                      media: new InputFile(`tmp/${img}`),
                      ...(idx === 0 ? { parse_mode: 'HTML' } : {}),
                    };
                  },
                );

                // sendMediaGroup 不支持 reply_markup（内联菜单），Telegram API 限制
                await telegramBot.api.sendMediaGroup(group.id, media as any);

                await telegramBot.api.sendMessage(
                  group.id,
                  nextMessage.content,
                  {
                    parse_mode: 'HTML',
                    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
                  },
                );
              }
            } else {
              // 发送纯文本消息
              await telegramBot.api.sendMessage(group.id, nextMessage.content, {
                parse_mode: 'HTML',
                ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
              });
            }
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
            console.log(`[sendGroupMessages] 已向群组 ${group.id} 发送消息`);
          } catch (err) {
            console.error(
              `[sendGroupMessages] 向群组 ${group?.id} 发送消息失败:`,
              err,
            );
            continue;
          }
        }

        // 只有当消息至少发送到一个群组时才更新发送时间
        if (sentCount > 0) {
          await GroupMessage.findByIdAndUpdate(message, {
            updatedAt: currentTime,
          });
          stats.sent++;
          console.log(
            `[sendGroupMessages] 消息 ${message._id} 已成功发送到 ${sentCount}/${groups.length} 个群组`,
          );
        } else {
          console.log(
            `[sendGroupMessages] 消息 ${message._id} 没有成功发送到任何群组`,
          );
        }
      } catch (error) {
        console.error(
          `[sendGroupMessages] 处理消息 ${message._id} 时发生错误:`,
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
    console.log(`[统计信息] 总消息数: ${stats.processed}`);
    console.log(`[统计信息] 发送消息数: ${stats.sent}`);
    console.log(`[统计信息] 无权限跳过: ${stats.noPermission}`);
    console.log(`[统计信息] 其他跳过: ${stats.skipped}`);
    console.log(`[统计信息] 错误消息数: ${stats.errors}`);
    console.log(`[统计信息] 任务总耗时: ${taskDuration.toFixed(2)}秒`);
    console.log('========== 群发消息任务完成 ==========');
  } catch (error) {
    console.error('[sendGroupMessages] 处理群发消息时出错:', error);
  }
}
