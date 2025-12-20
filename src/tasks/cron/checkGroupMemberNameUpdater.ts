import Bot from '../../models/bot';
import Group from '../../models/group';
import BotUser from '../../models/botUser';
import { setupBot } from '../../bot/botSetup';
import { findBotProxy } from '../../bot/services/findBotProxy';
import { PermissionChecker } from '../../bot/utils/permissionChecker';
import { checkMemberNameUpdated } from '../../utils/checkMemberNameUpdated';

/**
 * 定时检测群成员名称变更
 * 通过 Telegram API 获取群成员信息，与数据库对比，发现变更则通知群组
 * 注意：getChatMember API 可能有缓存延迟，实时检测主要依赖 botUserResolver
 */
export const checkGroupMemberNameUpdater = async () => {
  try {
    console.log('[checkGroupMemberNameUpdater] 开始检测群成员名称变更...');

    const bots = await Bot.find({
      canReportMemberNameUpdated: true,
      isOnline: true,
    });

    for (const bot of bots) {
      const { proxyUser } = await findBotProxy(bot);
      if (!PermissionChecker.canReportMemberNameUpdated(proxyUser, bot)) {
        continue;
      }

      const botInstance = setupBot(bot.token);
      const groups = await Group.find({ bot: bot._id }).populate('botUsers');

      for (const group of groups) {
        try {
          for (const botUser of group.botUsers as any[]) {
            if (!botUser?.id) continue;

            try {
              const chatMember = await botInstance.api.getChatMember(
                group.id,
                parseInt(botUser.id),
              );
              const user = chatMember.user;

              const message = checkMemberNameUpdated(botUser, {
                id: user.id,
                username: user.username,
                first_name: user.first_name,
                last_name: user.last_name,
              });

              if (message) {
                await BotUser.findByIdAndUpdate(botUser._id, {
                  $set: {
                    userName: user.username,
                    firstName: user.first_name,
                    lastName: user.last_name,
                  },
                });
                await botInstance.api.sendMessage(group.id, message);
                console.log(
                  `[checkGroupMemberNameUpdater] ${group.title} 用户 ${user.id} 信息变更已通知`,
                );
              }
            } catch {
              // 用户可能已离开群组
            }
          }
        } catch (err) {
          console.error(
            `[checkGroupMemberNameUpdater] 处理群组 ${group.title} 失败:`,
            err,
          );
        }
      }
    }

    console.log('[checkGroupMemberNameUpdater] 检测完成');
  } catch (error) {
    console.error('[checkGroupMemberNameUpdater] 执行出错:', error);
  }
};
