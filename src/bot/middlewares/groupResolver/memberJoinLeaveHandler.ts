import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import Group from '../../../models/group';
import BotUser from '../../../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:group:memberJoinLeave');

/**
 * 成员加入/离开处理中间件
 * 职责：
 * 1. 检测新成员加入群组（chat_member update）
 * 2. 检测成员离开群组
 * 3. 检测成员被踢出/限制
 * 4. 更新群组的 botUsers 列表
 * 5. 将新成员信息标记到 ctx，供后续中间件使用
 *
 * 注意：basicResolver 已处理类型检查，这里只需检查 ctx.currentGroup
 */
export const memberJoinLeaveHandler: Middleware<MyContext> = async (
  ctx,
  next,
) => {
  // basicResolver 已处理类型检查，只需检查 currentGroup 是否存在
  if (!ctx.currentGroup) {
    return await next();
  }

  // 频道不需要处理成员加入/离开（使用 channelSubscriptionHandler）
  if (ctx.currentGroup.type === 'channel') {
    return await next();
  }

  const chatMemberUpdate = ctx.chatMember;
  const proxyUser = ctx.currentProxyUser;

  // ── 处理成员离开 ──────────────────────────────────────────────────────
  const isMemberLeft =
    (chatMemberUpdate &&
      ['member', 'administrator', 'creator'].includes(
        chatMemberUpdate.old_chat_member.status,
      ) &&
      chatMemberUpdate.new_chat_member.status === 'left') ||
    ctx.message?.left_chat_member;

  if (isMemberLeft) {
    const leftMemberId =
      chatMemberUpdate?.new_chat_member.user.id ||
      ctx.message?.left_chat_member?.id;

    if (leftMemberId) {
      debug(`Processing left member: ${leftMemberId}`);

      try {
        const botUser = await BotUser.findOne({
          id: leftMemberId.toString(),
          proxy: proxyUser._id,
        });

        if (botUser) {
          // 新逻辑：从 BotUser.groups 移除
          await BotUser.updateOne(
            { _id: botUser._id },
            { $pull: { groups: ctx.currentGroup._id } },
          );
          debug(`Removed member ${leftMemberId} from group`);
        }
      } catch (error) {
        debug('Error processing left member:', error);
      }
    }
  }

  // ── 处理成员被踢出/限制 ─────────────────────────────────────────────
  if (chatMemberUpdate && !isMemberLeft) {
    const oldStatus = chatMemberUpdate.old_chat_member.status;
    const newStatus = chatMemberUpdate.new_chat_member.status;
    const memberId = chatMemberUpdate.new_chat_member.user.id;

    const shouldRemoveMember =
      ['member', 'administrator', 'creator'].includes(oldStatus) &&
      ['kicked', 'restricted'].includes(newStatus);

    if (shouldRemoveMember) {
      try {
        const botUser = await BotUser.findOne({
          id: memberId.toString(),
          proxy: proxyUser._id,
        });

        if (botUser) {
          // 新逻辑：从 BotUser.groups 移除，但保留 operators 操作（管理员状态独立维护）
          await Promise.all([
            BotUser.updateOne(
              { _id: botUser._id },
              { $pull: { groups: ctx.currentGroup._id } },
            ),
            // 管理员状态单独处理
            Group.updateOne(
              { _id: ctx.currentGroup._id },
              { $pull: { operators: botUser._id } },
            ),
          ]);
          debug(`Removed kicked/restricted member ${memberId} from group`);
        }
      } catch (error) {
        debug('Error processing member update:', error);
      }
    }
  }

  // ── 处理新成员加入 ──────────────────────────────────────────────────
  // 不再依赖 chat_member 更新（已从 allowed_updates 移除）
  // 改用 message.new_chat_members，上粉时压力小得多
  const newMembers = ctx.message?.new_chat_members;

  if (newMembers && newMembers.length > 0) {
    for (const member of newMembers) {
      if (member.is_bot && member.id === ctx.me.id) continue;

      debug(`Processing new member: ${member.id} (${member.first_name})`);

      ctx.newMember = {
        id: member.id,
        is_bot: member.is_bot,
        first_name: member.first_name,
        last_name: member.last_name,
        username: member.username,
      };
    }
  }

  await next();
};
