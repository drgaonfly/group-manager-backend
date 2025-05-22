import BotUserConfig, { UserStatus } from '../../models/botUserConfig';
import { IBot } from '../../models/bot';
import { setupBot } from '../../bot/botSetup';
import { IBotUser } from '../../models/botUser';

export async function trialExpired() {
  try {
    console.log('[trialExpired] 开始检查试用过期用户...');
    // 查找所有试用期已过期的用户
    const expiredUsers = await BotUserConfig.find({
      status: UserStatus.TRIAL,
      trialEndDate: { $lte: new Date() },
    })
      .populate('bot')
      .populate('botUser');

    console.log(`[trialExpired] 找到 ${expiredUsers.length} 个试用过期用户`);

    // 更新这些用户的状态为试用过期并发送通知
    const updatePromises = expiredUsers.map(async (user) => {
      const botUser = user.botUser as IBotUser;
      const username =
        botUser.userName ||
        `${botUser.firstName || ''} ${botUser.lastName || ''}`.trim();
      console.log(
        `[trialExpired] 正在处理用户 ${username} (ID: ${botUser.id}), 原试用结束时间: ${user.trialEndDate}`,
      );

      const updatedUser = await BotUserConfig.findByIdAndUpdate(
        user._id,
        { status: UserStatus.TRIAL_EXPIRED },
        { new: true },
      );

      if (updatedUser) {
        console.log(
          `[trialExpired] 用户 ${username} (ID: ${botUser.id}) 状态已更新为 TRIAL_EXPIRED`,
        );
      } else {
        console.warn(
          `[trialExpired] 用户 ${username} (ID: ${botUser.id}) 状态更新失败`,
        );
      }

      const bot = setupBot((user.bot as IBot).token);

      // 发送试用过期通知
      try {
        console.log(
          `[trialExpired] 向用户 ${username} (ID: ${botUser.id}) 发送过期通知`,
        );
        await bot.api.sendMessage(
          (user.botUser as IBotUser).id,
          '您的试用期已到期，请续费以继续使用服务。',
        );
        console.log(
          `[trialExpired] 已成功通知用户 ${username} (ID: ${botUser.id}) 试用过期`,
        );
      } catch (error) {
        console.error(
          `[trialExpired] 向用户 ${user._id} (${username}) 发送过期通知失败:`,
          error,
        );
      }

      return updatedUser;
    });

    const updatedUsers = await Promise.all(updatePromises);
    console.log(
      `[trialExpired] 成功更新 ${updatedUsers.length} 个用户状态为试用过期`,
    );
  } catch (error) {
    console.error('[trialExpired] 处理试用过期用户时出错:', error);
  }
}
