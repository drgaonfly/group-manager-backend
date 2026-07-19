import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import { findBotProxy } from '../../services/findBotProxy';
import { PermissionChecker } from '../../utils/permissionChecker';
import { sendGroupWelcomeMessage } from '../../../services/sendGroupWelcomeMessage';
import GroupWelcome from '../../../models/groupWelcome';
import createDebug from 'debug';

const debug = createDebug('bot:group:welcome');

/**
 * 群组欢迎处理中间件
 * 职责：
 * 1. 检测新成员加入（由 memberJoinLeaveHandler 标记）
 * 2. 检查是否已被验证中间件处理
 * 3. 检查是否启用欢迎功能
 * 4. 发送欢迎消息
 *
 * 注意：依赖 memberJoinLeaveHandler 设置 ctx.newMember
 */
export const groupWelcomeHandler: Middleware<MyContext> = async (ctx, next) => {
  // 只处理新成员加入事件（由 memberJoinLeaveHandler 标记）
  if (!ctx.newMember || !ctx.currentGroup) {
    return await next();
  }

  // 如果已被验证中间件处理，跳过欢迎消息
  if (ctx.newMemberHandled) {
    debug('⚠️ New member already handled by verification');
    return await next();
  }

  const { proxyUser } = await findBotProxy(ctx.currentBot);

  // 检查是否启用欢迎功能
  if (!PermissionChecker.canUseGroupWelcome(proxyUser, ctx.currentBot)) {
    debug('⚠️ 未启用群组欢迎功能');
    return await next();
  }

  const member = ctx.newMember;
  const memberName =
    member.first_name + (member.last_name ? ` ${member.last_name}` : '');
  const username = member.username ? `@${member.username}` : memberName;

  debug(`Attempting to send welcome message for: ${username}`);

  try {
    // 查询该群组的欢迎配置
    const groupWelcomeConfig = await GroupWelcome.findOne({
      bot: ctx.currentBot._id,
      group: ctx.currentGroup._id,
    });

    await sendGroupWelcomeMessage(
      ctx,
      username,
      memberName,
      groupWelcomeConfig ?? undefined,
    );
    debug(`✅ Welcome message sent for new member: ${username}`);
  } catch (error) {
    debug('❌ Failed to send welcome message:', error);
  }

  await next();
};
