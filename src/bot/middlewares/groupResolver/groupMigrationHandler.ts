import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import Group from '../../../models/group';
import createDebug from 'debug';

const debug = createDebug('bot:group:migration');

/**
 * 群组升级事件处理中间件
 * 职责：
 * 1. 检测群组从 group 升级到 supergroup
 * 2. 更新数据库中的群组 ID 和类型
 * 3. 通过 title 匹配处理升级后的群组
 *
 * 注意：basicResolver 已处理基础类型检查
 */
export const groupMigrationHandler: Middleware<MyContext> = async (
  ctx,
  next,
) => {
  const chat = ctx.chat || ctx.myChatMember?.chat || ctx.chatMember?.chat;
  const chatId = chat?.id;
  const chatTitle = (chat as any)?.title;
  const chatType = chat?.type;

  const proxyUser = ctx.currentProxyUser;

  // ── 方式 1: 通过 migrate_from_chat_id 事件直接更新 ──────────────────
  const oldChatId = ctx.message?.migrate_from_chat_id;
  const newChatId = ctx.message?.chat.id;

  if (oldChatId && newChatId) {
    debug(`🔄 检测到群组升级事件: ${oldChatId} -> ${newChatId}`);

    const updatePayload = {
      id: newChatId,
      type: ctx.message?.chat.type || 'supergroup',
      username: ctx.message?.chat.username ?? '',
    };

    const updatedGroup = await Group.findOneAndUpdate(
      { id: oldChatId, proxy: proxyUser._id },
      { $set: updatePayload },
      { new: true },
    ).populate(['bot', 'creator', 'operators']);

    if (updatedGroup) {
      debug(`✅ 已更新群组 ID: ${oldChatId} -> ${newChatId}`);
      ctx.currentGroup = updatedGroup;
    }

    return await next();
  }

  // ── 方式 2: 通过 title 匹配处理已升级的群组 ──────────────────────
  // 如果当前是 supergroup 但没有找到记录，尝试用 title 匹配
  if (!ctx.currentGroup && chatType === 'supergroup') {
    const groupByTitle = await Group.findOne({
      title: chatTitle,
      bot: ctx.currentBot._id,
      type: 'group', // 找升级前的普通群组
      proxy: proxyUser._id,
    }).populate(['bot', 'creator', 'operators']);

    if (groupByTitle) {
      debug(
        `🔄 检测到群组已升级（通过 title 匹配）: ${groupByTitle.id} -> ${chatId}`,
      );

      // 更新群组 ID、类型和用户名
      groupByTitle.id = chatId;
      groupByTitle.type = 'supergroup';
      groupByTitle.username = (chat as any).username ?? '';
      await groupByTitle.save();

      ctx.currentGroup = groupByTitle;
      debug(`✅ 已更新群组 ID 和类型`);
    }
  }

  await next();
};
