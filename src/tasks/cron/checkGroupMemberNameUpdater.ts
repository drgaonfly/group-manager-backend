import Bot from '../../models/bot';
import Group from '../../models/group';
import BotUser from '../../models/botUser';
import { setupBot } from '../../bot/botSetup';
import { findBotProxy } from '../../bot/services/findBotProxy';
import { PermissionChecker } from '../../bot/utils/permissionChecker';
import { checkMemberNameUpdated } from '../../utils/checkMemberNameUpdated';
import { getGramClient } from '../../bot/services/gramClient';

// 单个操作的超时时间（毫秒）
const OPERATION_TIMEOUT = 30000;

/**
 * 带超时的 Promise 包装器
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operation: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} 超时 (${ms}ms)`)), ms),
    ),
  ]);
}

/**
 * 定时检测群成员名称变更
 * 通过 MTProto client.getParticipants 获取群成员最新信息，与数据库对比，发现变更则通知群组
 * 使用数据库保存的 session 进行连接，避免频繁 start() 导致 FloodWait
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

      let gramClient: Awaited<ReturnType<typeof getGramClient>> | null = null;
      try {
        gramClient = await withTimeout(
          getGramClient(bot.token),
          OPERATION_TIMEOUT,
          'gramClient 连接',
        );
      } catch (err: any) {
        console.error(
          `[checkGroupMemberNameUpdater] Bot ${bot.botName} gramClient 连接失败:`,
          err.message || err,
        );
        continue;
      }

      try {
        const groups = await Group.find({ bot: bot._id }).populate('botUsers');
        console.log(
          `[checkGroupMemberNameUpdater] Bot ${bot.botName} 有 ${groups.length} 个群组`,
        );

        for (const group of groups) {
          console.log(
            `[checkGroupMemberNameUpdater] 检查群组 ${group.title}, 用户数: ${
              group.botUsers?.length || 0
            }`,
          );
          try {
            // 先获取群成员列表，填充实体缓存，添加超时控制
            const participants = await withTimeout(
              gramClient.getParticipants(group.id, {}),
              OPERATION_TIMEOUT,
              `获取群组 ${group.title} 成员列表`,
            );

            // 建立 userId -> user 的映射
            const userMap = new Map<string, any>();
            for (const p of participants) {
              if (p.id) userMap.set(p.id.toString(), p);
            }

            for (const botUser of group.botUsers as any[]) {
              if (!botUser?.id) continue;

              try {
                // 直接从缓存的 participants 中获取
                const user = userMap.get(botUser.id.toString());
                if (!user || !('firstName' in user)) continue;

                console.log(
                  `[checkGroupMemberNameUpdater] 用户 ${botUser.id}: DB(${botUser.userName}/${botUser.firstName}/${botUser.lastName}) -> API(${user.username}/${user.firstName}/${user.lastName})`,
                );

                const message = checkMemberNameUpdated(botUser, {
                  id: Number(user.id),
                  username: user.username,
                  first_name: user.firstName,
                  last_name: user.lastName,
                });

                if (message) {
                  await BotUser.findByIdAndUpdate(botUser._id, {
                    $set: {
                      userName: user.username,
                      firstName: user.firstName,
                      lastName: user.lastName,
                    },
                  });
                  await botInstance.api.sendMessage(group.id, message);
                  console.log(
                    `[checkGroupMemberNameUpdater] ${group.title} 用户 ${user.id} 信息变更已通知`,
                  );
                }
              } catch (err: any) {
                console.log(
                  `[checkGroupMemberNameUpdater] 获取用户 ${botUser.id} 失败:`,
                  err.message,
                );
              }
            }
          } catch (err: any) {
            console.error(
              `[checkGroupMemberNameUpdater] 处理群组 ${group.title} 失败:`,
              err.message || err,
            );
          }
        }
      } finally {
        // 确保断开连接，即使出错也要断开
        try {
          await gramClient.disconnect();
        } catch (disconnectErr: any) {
          console.log(
            `[checkGroupMemberNameUpdater] 断开连接时出错:`,
            disconnectErr.message,
          );
        }
      }
    }

    console.log('[checkGroupMemberNameUpdater] 检测完成');
  } catch (error) {
    console.error('[checkGroupMemberNameUpdater] 执行出错:', error);
  }
};
