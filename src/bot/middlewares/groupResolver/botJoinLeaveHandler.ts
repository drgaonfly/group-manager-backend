import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import { findBotProxy } from '../../services/findBotProxy';
import { syncGroupAdministrators } from '../../services/syncGroupAdministrators';
import Group from '../../../models/group';
import createDebug from 'debug';

const debug = createDebug('bot:group:botJoinLeave');

/**
 * Bot 加入/退出群组处理中间件
 * 职责：
 * 1. 检测 Bot 被添加到群组/频道
 * 2. 检测 Bot 被移除出群组/频道
 * 3. 创建新群组记录
 * 4. 权限检查（专属机器人）
 *
 * 注意：basicResolver 已处理基础类型检查
 */
export const botJoinLeaveHandler: Middleware<MyContext> = async (ctx, next) => {
  const myChatMemberUpdate = ctx.myChatMember;

  // 只处理 Bot 自己的 chat_member 事件
  if (!myChatMemberUpdate) {
    return await next();
  }

  const chat = ctx.chat || myChatMemberUpdate.chat;
  const chatId = chat.id;
  const chatTitle = (chat as any).title;
  const chatType = chat.type;

  // 检查是否是机器人被添加到群组/频道
  const isBotAddedToChat =
    myChatMemberUpdate &&
    ['left', 'kicked'].includes(myChatMemberUpdate.old_chat_member.status) &&
    ['member', 'administrator', 'creator'].includes(
      myChatMemberUpdate.new_chat_member.status,
    );

  // 检查是否是机器人被移除
  const isBotRemovedFromChat =
    myChatMemberUpdate &&
    ['member', 'administrator', 'creator'].includes(
      myChatMemberUpdate.old_chat_member.status,
    ) &&
    ['left', 'kicked'].includes(myChatMemberUpdate.new_chat_member.status);

  const { proxyUser } = await findBotProxy(ctx.currentBot);

  // 处理 Bot 被移除
  if (isBotRemovedFromChat) {
    debug('Bot removed from chat:', chatId);

    const group = await Group.findOne({
      id: chatId,
      proxy: proxyUser._id,
    });

    if (group) {
      await ctx.currentBot.updateOne({
        $pull: { groups: group._id },
      });
      debug('Bot removed from group/channel:', group.id);
    }

    ctx.currentGroup = null;
    return await next();
  }

  // 处理 Bot 被添加（新群组或重新添加）
  if (isBotAddedToChat) {
    // 检查是否已有群组记录
    if (ctx.currentGroup) {
      // 重新添加到已存在的群组，同步管理员信息
      if (chatType !== 'channel') {
        debug('🔄 Bot 被重新添加到群组，同步管理员信息');
        const syncResult = await syncGroupAdministrators(
          ctx,
          ctx.currentGroup,
          proxyUser,
        );

        if (syncResult.success) {
          debug(`✅ 重新同步管理员信息成功: ${chatTitle}`);
        } else {
          debug(`⚠️ 重新同步管理员信息失败: ${syncResult.message}`);
        }
      }
      return await next();
    }

    // 专属机器人权限检查
    if (ctx.currentBot.type === 'private') {
      const botOwnerId = ctx.currentBot.owner?.toString();
      const currentBotUserId = ctx.currentBotUser?._id?.toString();

      if (botOwnerId !== currentBotUserId) {
        await ctx.reply(
          '⚠️ 此机器人为专属机器人，只有机器人拥有者才能将其添加到群组。\n\n机器人将自动退出此群组。',
        );

        try {
          await ctx.api.leaveChat(chatId);
          debug(`🚫 非 Owner 添加专属机器人到群组，已自动退出: ${chatTitle}`);
        } catch (err) {
          debug(`❌ 退出群组失败: ${err}`);
        }

        ctx.currentGroup = null;
        return await next();
      }
    }

    // 创建新群组记录
    const newGroup = new Group({
      id: chatId,
      title: chatTitle,
      username: (chat as any).username ?? '',
      type: chatType,
      bot: ctx.currentBot._id,
      creator: ctx.currentBotUser?._id,
      exchange_rate: 1,
      fee_rate: 0,
      proxy: proxyUser._id,
    });

    await newGroup.save();
    ctx.currentGroup = newGroup;

    debug(
      `✅ 已创建${chatType === 'channel' ? '频道' : '群组'}记录: ${chatTitle}`,
    );

    // 同步管理员信息（同步执行，确保初始化完整）
    if (chatType !== 'channel') {
      const syncResult = await syncGroupAdministrators(
        ctx,
        newGroup,
        proxyUser,
      );

      if (syncResult.success) {
        debug(
          `✅ 已同步群组管理员信息: ${chatTitle} (${
            syncResult.data?.adminCount || 0
          } 个管理员)`,
        );
      } else {
        debug(`⚠️ 同步群组管理员信息失败: ${syncResult.message}`);
      }

      // 发送提示消息
      await ctx.reply('请把我添加为管理员才能正常使用!');
    }
  }

  await next();
};
