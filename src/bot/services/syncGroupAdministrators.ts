import { MyContext } from '../types';
import Group from '../../models/group';
import BotUser, { IBotUser } from '../../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:service:syncAdmins');

/**
 * 同步群组管理员信息服务
 * 主动调用 Telegram API 获取群组的所有管理员，并更新到数据库
 */
export async function syncGroupAdministrators(
  ctx: MyContext,
  group: any,
  proxyUser: any,
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    // 调用 Telegram API 获取群组管理员列表
    const administrators = await ctx.api.getChatAdministrators(group.id);

    debug(`📋 获取到 ${administrators.length} 个管理员，群组: ${group.title}`);

    const operatorIds: IBotUser[] = [];
    let groupCreator: IBotUser | undefined;
    const adminList: string[] = [];

    for (const admin of administrators) {
      const user = admin.user;

      // 跳过机器人
      if (user.is_bot) {
        debug(`⏭️ 跳过机器人管理员: ${user.first_name} (${user.id})`);
        continue;
      }

      // 查找或创建 BotUser
      let botUser = await BotUser.findOne({
        id: user.id.toString(),
        proxy: proxyUser._id,
      });

      if (!botUser) {
        botUser = new BotUser({
          id: user.id.toString(),
          userName: user.username || '',
          firstName: user.first_name,
          lastName: user.last_name || '',
          bot: ctx.currentBot._id,
          proxy: proxyUser._id,
        });
        await botUser.save();
        debug(`✅ 创建新 BotUser (管理员): ${user.id}`);
      }

      const displayName = user.username
        ? `@${user.username}`
        : `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`;

      // 如果是群主（creator），记录为 creator，但不加入 operators
      if (admin.status === 'creator') {
        groupCreator = botUser;
        adminList.push(`👑 群主: ${displayName}`);
        debug(`👑 找到群主: ${user.first_name} (${user.id})`);
      }
      // 只有管理员（不包括群主）才添加到 operators
      else if (admin.status === 'administrator') {
        operatorIds.push(botUser);
        adminList.push(`👤 管理员: ${displayName}`);
        debug(
          `👤 添加管理员: ${user.first_name} (${user.id}) - ${admin.status}`,
        );
      }
    }

    // 更新群组的 creator 和 operators
    const updateData: any = {
      operators: operatorIds.map((op) => op._id),
    };

    // 如果找到了真实的群主，更新 creator
    if (groupCreator) {
      updateData.creator = groupCreator._id;
    }

    await Group.updateOne({ _id: group._id }, { $set: updateData });

    debug(
      `✅ 已更新群组管理员信息: creator=${!!groupCreator}, operators=${
        operatorIds.length
      }`,
    );

    return {
      success: true,
      message: '同步成功',
      data: {
        adminCount: operatorIds.length,
        hasCreator: !!groupCreator,
        adminList,
      },
    };
  } catch (error: any) {
    debug(`❌ 同步群组管理员失败: ${error.message}`);
    return {
      success: false,
      message: `同步失败: ${error.message}`,
    };
  }
}
