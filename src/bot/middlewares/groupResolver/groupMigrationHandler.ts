import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import Group from '../../../models/group';
import createDebug from 'debug';

const debug = createDebug('bot:group:migration');

/**
 * 群组升级事件处理中间件
 *
 * Telegram group → supergroup 迁移时 bot 收到三条 update：
 *   1. message（旧 chatId）含 migrate_to_chat_id   → 旧群发出，basicResolver 能找到旧记录
 *   2. message（新 chatId）含 migrate_from_chat_id → 新群发出，basicResolver 找不到记录
 *   3. my_chat_member（新 chatId）                 → bot 状态变更，basicResolver 找不到记录
 *
 * 本中间件统一处理上面三种情况，确保在 botJoinLeaveHandler 之前把
 * ctx.currentGroup 设置好，避免 botJoinLeaveHandler 误判为新加入而创建重复记录。
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

  // ── 情况 1：message 含 migrate_from_chat_id（新 chatId 发来的迁移消息）──
  const oldChatId = ctx.message?.migrate_from_chat_id;
  const newChatId = ctx.message?.chat?.id;

  if (oldChatId && newChatId) {
    debug(`🔄 [migrate_from] 检测到群组升级: ${oldChatId} -> ${newChatId}`);

    const updatedGroup = await Group.findOneAndUpdate(
      { id: oldChatId, proxy: proxyUser._id },
      {
        $set: {
          id: newChatId,
          type: ctx.message?.chat?.type || 'supergroup',
          username: (ctx.message?.chat as any)?.username ?? '',
        },
      },
      { new: true },
    ).populate(['bot', 'creator', 'operators']);

    if (updatedGroup) {
      debug(`✅ 已更新群组 ID: ${oldChatId} -> ${newChatId}`);
      ctx.currentGroup = updatedGroup;
    }

    return await next();
  }

  // ── 情况 2：ctx.currentGroup 为 null 且当前是 supergroup ──────────────
  // 覆盖两种场景：
  //   a. message 含 migrate_to_chat_id（旧 chatId 发来，basicResolver 已找到旧记录，跳过）
  //   b. my_chat_member（新 chatId，basicResolver 找不到记录，需要 title 匹配）
  if (!ctx.currentGroup && chatType === 'supergroup' && chatTitle) {
    const migratedGroup = await Group.findOne({
      title: chatTitle,
      bot: ctx.currentBot._id,
      proxy: proxyUser._id,
      type: 'group', // 迁移前是普通 group
    }).populate(['bot', 'creator', 'operators']);

    if (migratedGroup) {
      debug(
        `🔄 [title匹配] 检测到群组已升级: ${migratedGroup.id} -> ${chatId}`,
      );

      migratedGroup.id = chatId;
      migratedGroup.type = 'supergroup';
      migratedGroup.username = (chat as any)?.username ?? '';
      await migratedGroup.save();

      ctx.currentGroup = migratedGroup;
      debug(`✅ 已通过 title 匹配更新群组 ID 和类型`);
    }
  }

  await next();
};
