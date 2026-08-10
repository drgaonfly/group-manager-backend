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
          await Group.updateOne(
            { _id: ctx.currentGroup._id },
            {
              $pull: {
                botUsers: botUser._id,
                operators: botUser._id,
              },
            },
          );
          debug(`Removed member ${leftMemberId} from group botUsers`);
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
          await Group.updateOne(
            { _id: ctx.currentGroup._id },
            {
              $pull: {
                botUsers: botUser._id,
                operators: botUser._id,
              },
            },
          );
          debug(`Removed kicked/restricted member ${memberId} from group`);
        }
      } catch (error) {
        debug('Error processing member update:', error);
      }
    }
  }

  // ── 处理新成员加入 ──────────────────────────────────────────────────
  // 在 supergroup 中，新成员事件通过 chat_member update 传递
  const isNewMemberFromChatMember =
    chatMemberUpdate &&
    chatMemberUpdate.old_chat_member.status === 'left' &&
    ['member', 'administrator', 'creator'].includes(
      chatMemberUpdate.new_chat_member.status,
    );

  if (isNewMemberFromChatMember) {
    const member = chatMemberUpdate.new_chat_member.user;

    // 跳过机器人自己
    if (member.is_bot && member.id === ctx.me.id) {
      debug('Skipping bot itself');
      return await next();
    }

    debug(`Processing new member: ${member.id} (${member.first_name})`);

    // 查找或创建 BotUser - 使用 findOneAndUpdate + upsert 合并查找+创建操作
    try {
      const botUser = await BotUser.findOneAndUpdate(
        {
          id: member.id.toString(),
          proxy: proxyUser._id,
        },
        {
          $setOnInsert: {
            userName: member.username || '',
            firstName: member.first_name,
            lastName: member.last_name || '',
            bot: ctx.currentBot._id,
            proxy: proxyUser._id,
          },
        },
        {
          upsert: true,
          new: true,
        },
      );

      await Group.updateOne(
        { _id: ctx.currentGroup._id },
        { $addToSet: { botUsers: botUser._id } },
      );
      debug(`✅ 新成员 ${member.id} 已写入群组 botUsers`);

      // 标记新成员信息到 ctx，供欢迎/验证中间件使用
      ctx.newMember = {
        id: member.id,
        is_bot: member.is_bot,
        first_name: member.first_name,
        last_name: member.last_name,
        username: member.username,
      };
    } catch (error) {
      debug('写入 botUsers 失败:', error);
    }
  }

  await next();
};
