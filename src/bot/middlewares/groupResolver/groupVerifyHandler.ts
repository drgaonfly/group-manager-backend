import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import { findBotProxy } from '../../services/findBotProxy';
import { PermissionChecker } from '../../utils/permissionChecker';
import { sendGroupVerifyMessage } from '../../../services/sendGroupVerifyMessage';
import GroupVerify from '../../../models/groupVerify';
import createDebug from 'debug';

const debug = createDebug('bot:group:verify');

/**
 * 群组验证处理中间件
 * 职责：
 * 1. 检测新成员加入（由 memberJoinLeaveHandler 标记）
 * 2. 检查是否启用验证功能
 * 3. 发送验证消息
 *
 * 注意：依赖 memberJoinLeaveHandler 设置 ctx.newMember
 */
export const groupVerifyHandler: Middleware<MyContext> = async (ctx, next) => {
  // 只处理新成员加入事件（由 memberJoinLeaveHandler 标记）
  if (!ctx.newMember || !ctx.currentGroup) {
    return await next();
  }

  const { proxyUser } = await findBotProxy(ctx.currentBot);

  // 检查是否启用验证功能
  if (!PermissionChecker.canUseGroupVerify(proxyUser, ctx.currentBot)) {
    debug('⚠️ 未启用群组验证功能');
    return await next();
  }

  const member = ctx.newMember;
  const memberName =
    member.first_name + (member.last_name ? ` ${member.last_name}` : '');
  const username = member.username ? `@${member.username}` : memberName;

  debug(`Attempting to send verification message for: ${username}`);

  try {
    // 查询该群组的验证配置
    const groupVerifyConfig = await GroupVerify.findOne({
      bot: ctx.currentBot._id,
      group: ctx.currentGroup._id,
      isActive: true,
    });

    if (
      groupVerifyConfig &&
      groupVerifyConfig.question &&
      groupVerifyConfig.asks &&
      groupVerifyConfig.asks.length > 0
    ) {
      // 发送验证消息
      await sendGroupVerifyMessage(ctx, username, groupVerifyConfig, member.id);
      debug(`✅ Verification message sent for new member: ${username}`);

      // 验证消息已发送，标记已处理，阻止欢迎消息
      ctx.newMemberHandled = true;
    } else {
      debug('⚠️ No valid group verify config found');
    }
  } catch (error) {
    debug('❌ Failed to send verification message:', error);
  }

  await next();
};
