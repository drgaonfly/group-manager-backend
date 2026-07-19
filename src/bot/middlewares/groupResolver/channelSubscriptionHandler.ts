import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import Group from '../../../models/group';
import BotUser from '../../../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:group:channelSubscription');

/**
 * 频道订阅处理中间件
 * 职责：
 * 1. 检测用户订阅频道
 * 2. 检测用户取消订阅频道
 * 3. 更新频道的 botUsers 列表
 *
 * 注意：basicResolver 已处理类型检查，这里只检查是否为频道
 */
export const channelSubscriptionHandler: Middleware<MyContext> = async (
  ctx,
  next,
) => {
  if (!ctx.currentGroup) {
    return await next();
  }

  // 只处理频道
  if (ctx.currentGroup.type !== 'channel') {
    return await next();
  }

  const chatMemberUpdate = ctx.chatMember;
  if (!chatMemberUpdate) {
    return await next();
  }

  const oldStatus = chatMemberUpdate.old_chat_member.status;
  const newStatus = chatMemberUpdate.new_chat_member.status;
  const user = chatMemberUpdate.new_chat_member.user;

  const proxyUser = ctx.currentProxyUser;

  // 用户订阅频道
  const isChannelSubscribed =
    ['left', 'kicked'].includes(oldStatus) &&
    ['member', 'administrator', 'creator'].includes(newStatus);

  // 用户取消订阅频道
  const isChannelUnsubscribed =
    ['member', 'administrator', 'creator'].includes(oldStatus) &&
    ['left', 'kicked'].includes(newStatus);

  if (isChannelSubscribed) {
    debug(`📢 用户订阅频道: ${user.id} (${user.first_name})`);

    try {
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
        debug(`✅ 创建新 BotUser: ${user.id}`);
      }

      // 将用户添加到频道的 botUsers 列表
      await Group.updateOne(
        { _id: ctx.currentGroup._id },
        { $addToSet: { botUsers: botUser._id } },
      );
      debug(`✅ 用户 ${user.id} 已添加到频道订阅者列表`);
    } catch (error) {
      debug('处理频道订阅事件失败:', error);
    }

    return; // 订阅事件处理完毕，不继续传递
  }

  if (isChannelUnsubscribed) {
    debug(`📢 用户取消订阅频道: ${user.id} (${user.first_name})`);

    try {
      const botUser = await BotUser.findOne({
        id: user.id.toString(),
        proxy: proxyUser._id,
      });

      if (botUser) {
        await Group.updateOne(
          { _id: ctx.currentGroup._id },
          { $pull: { botUsers: botUser._id } },
        );
        debug(`✅ 用户 ${user.id} 已从频道订阅者列表移除`);
      }
    } catch (error) {
      debug('处理频道取消订阅事件失败:', error);
    }

    return; // 取消订阅事件处理完毕，不继续传递
  }

  await next();
};
