import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import Group from '../../../models/group';
import BotUser from '../../../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:group:memberJoinLeave');

/**
 * 成员加入/离开处理中间件
 *
 * 不依赖 chat_member 事件（已从 allowed_updates 移除，避免上粉打满事件循环）
 * 全部改用 message 里的 service message：
 *   - 加入：message.new_chat_members
 *   - 离开：message.left_chat_member
 *
 * 被踢/限制无 message 替代，忽略（数据库脏数据可接受，不影响实际权限）
 */
export const memberJoinLeaveHandler: Middleware<MyContext> = async (
  ctx,
  next,
) => {
  if (!ctx.currentGroup) {
    return await next();
  }

  if (ctx.currentGroup.type === 'channel') {
    return await next();
  }

  const proxyUser = ctx.currentProxyUser;

  // ── 处理成员离开 ──────────────────────────────────────────────────────
  const leftMember = ctx.message?.left_chat_member;

  if (leftMember) {
    debug(`Processing left member: ${leftMember.id}`);
    try {
      const botUser = await BotUser.findOne({
        id: leftMember.id.toString(),
        proxy: proxyUser._id,
      });
      if (botUser) {
        await Promise.all([
          // 从群组成员列表移除
          BotUser.updateOne(
            { _id: botUser._id },
            { $pull: { groups: ctx.currentGroup._id } },
          ),
          // 如果是群管，同步从 operators 移除
          Group.updateOne(
            { _id: ctx.currentGroup._id },
            { $pull: { operators: botUser._id } },
          ),
        ]);
        debug(`Removed member ${leftMember.id} from group and operators`);
      }
    } catch (error) {
      debug('Error processing left member:', error);
    }
  }

  // ── 处理新成员加入 ──────────────────────────────────────────────────
  // 用户直接加入 / 管理员手动添加 → message.new_chat_members
  // 邀请链接批量加入（上粉）→ chat_member（已不订阅，不处理，欢迎/验证不触发）
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
