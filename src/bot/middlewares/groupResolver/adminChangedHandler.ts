import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import Group from '../../../models/group';
import BotUser from '../../../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:group:adminManagement');

/**
 * 管理员管理处理中间件
 * 职责：
 * 1. 检测用户被提升为管理员
 * 2. 检测用户被提升为群主（包括群主转移）
 * 3. 检测用户被撤销管理员
 * 4. 检测群主转移（creator -> administrator, member/administrator -> creator）
 * 5. 更新 Group.operators 和 Group.creator
 *
 * 注意：basicResolver 已处理类型检查，这里只需检查 ctx.currentGroup
 */
export const adminManagementHandler: Middleware<MyContext> = async (
  ctx,
  next,
) => {
  if (!ctx.currentGroup) {
    return await next();
  }

  // 频道不需要处理管理员变更
  if (ctx.currentGroup.type === 'channel') {
    return await next();
  }

  const chatMemberUpdate = ctx.chatMember;
  if (!chatMemberUpdate) {
    return await next();
  }

  const oldStatus = chatMemberUpdate.old_chat_member.status;
  const newStatus = chatMemberUpdate.new_chat_member.status;
  const memberUser = chatMemberUpdate.new_chat_member.user;
  const memberId = memberUser.id;

  const proxyUser = ctx.currentProxyUser;

  // ── 判断管理员提升/撤销 ───────────────────────────────────────────────
  // 注意：Telegram 普通 group（非 supergroup）中，提升管理员时
  // old/new status 都是 'member'，需要通过 can_manage_chat 权限字段来判断
  const oldCanManage =
    (chatMemberUpdate.old_chat_member as any).can_manage_chat === true;
  const newCanManage =
    (chatMemberUpdate.new_chat_member as any).can_manage_chat === true;

  // 用户被提升为管理员（不包括群主）
  // supergroup: member -> administrator (不包括 creator)
  // 普通 group: can_manage_chat false -> true
  const isPromotedToAdmin =
    (oldStatus === 'member' && newStatus === 'administrator') ||
    (!oldCanManage && newCanManage && newStatus === 'member');

  // 用户被提升为群主（包括从 member 或 administrator 提升）
  const isPromotedToCreator =
    (oldStatus === 'member' || oldStatus === 'administrator') &&
    newStatus === 'creator';

  // 用户被撤销管理员
  // supergroup: administrator -> member (creator 不会被撤销)
  // 普通 group: can_manage_chat true -> false
  const isDemotedFromAdmin =
    (oldStatus === 'administrator' && newStatus === 'member') ||
    (oldCanManage && !newCanManage && oldStatus === 'member');

  // 群主转移：旧群主被降级为管理员
  const isOwnerDemoted =
    oldStatus === 'creator' && newStatus === 'administrator';

  if (
    !isPromotedToAdmin &&
    !isPromotedToCreator &&
    !isDemotedFromAdmin &&
    !isOwnerDemoted
  ) {
    return await next();
  }

  try {
    // 使用原子操作查找或创建 BotUser，并添加到群组
    const botUser = await BotUser.findOneAndUpdate(
      {
        id: memberId.toString(),
        proxy: proxyUser._id,
      },
      {
        $setOnInsert: {
          userName: memberUser.username || '',
          firstName: memberUser.first_name,
          lastName: memberUser.last_name || '',
          bot: ctx.currentBot._id,
          proxy: proxyUser._id,
          groups: [], // 初始化空群组数组
        },
        $addToSet: { groups: ctx.currentGroup._id },
      },
      {
        upsert: true,
        new: true,
      },
    );
    debug(`✅ BotUser 已处理: ${memberId}`);

    if (isPromotedToAdmin) {
      // 只有管理员（不包括群主）才添加到 Group.operators
      await Group.updateOne(
        { _id: ctx.currentGroup._id },
        { $addToSet: { operators: botUser._id } },
      );
      debug(`✅ 用户 ${memberId} 被提升为管理员，已添加到 Group.operators`);
    } else if (isPromotedToCreator) {
      // 群主只更新 creator 字段，不加入 operators，并从 operators 中移除（如果之前是管理员）
      await Group.updateOne(
        { _id: ctx.currentGroup._id },
        {
          $set: { creator: botUser._id },
          $pull: { operators: botUser._id },
        },
      );
      debug(
        `👑 用户 ${memberId} 被提升为群主，已更新 Group.creator 并从 operators 移除`,
      );
    } else if (isDemotedFromAdmin) {
      // 从 Group.operators 移除
      await Group.updateOne(
        { _id: ctx.currentGroup._id },
        { $pull: { operators: botUser._id } },
      );
      debug(`✅ 用户 ${memberId} 被撤销管理员，已从 Group.operators 移除`);
    } else if (isOwnerDemoted) {
      // 群主转移：旧群主降级为管理员，添加到 operators
      await Group.updateOne(
        { _id: ctx.currentGroup._id },
        { $addToSet: { operators: botUser._id } },
      );
      debug(
        `📉 前任群主 ${memberId} (${memberUser.first_name}) 已降级为管理员，添加到 operators`,
      );
    }
  } catch (error) {
    debug('Error processing admin promotion/demotion:', error);
  }

  await next();
};
