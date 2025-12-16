import { MyContext } from '../bot/types';
import { InlineKeyboard } from 'grammy';
import { sendGroupWelcomeMessage } from './sendGroupWelcomeMessage';
import { findBotProxy } from '../bot/services/findBotProxy';
import { PermissionChecker } from '../bot/utils/permissionChecker';
import Group from '../models/group';
import createDebug from 'debug';

const debug = createDebug('bot:group-verify');

interface GroupVerifyConfig {
  question: string;
  asks: {
    name: string;
    isCorrect: boolean;
  }[];
}

/**
 * 检查用户是否正在验证中或被禁言
 */
export async function isUserPendingVerification(
  chatId: number,
  userId: number,
): Promise<boolean> {
  const group = await Group.findOne({ id: chatId });
  if (!group) return false;
  return (
    group.pendingVerifyUsers?.includes(userId) ||
    group.mutedUsers?.includes(userId)
  );
}

/**
 * 添加用户到验证队列
 */
async function addPendingVerification(
  chatId: number,
  userId: number,
): Promise<void> {
  await Group.updateOne(
    { id: chatId },
    { $addToSet: { pendingVerifyUsers: userId } },
  );
}

/**
 * 从验证队列移除用户
 */
async function removePendingVerification(
  chatId: number,
  userId: number,
): Promise<void> {
  await Group.updateOne(
    { id: chatId },
    { $pull: { pendingVerifyUsers: userId } },
  );
}

/**
 * 添加用户到禁言列表
 */
async function addMutedUser(chatId: number, userId: number): Promise<void> {
  await Group.updateOne(
    { id: chatId },
    {
      $addToSet: { mutedUsers: userId },
      $pull: { pendingVerifyUsers: userId },
    },
  );
}

/**
 * 从禁言列表移除用户
 */
async function removeMutedUser(chatId: number, userId: number): Promise<void> {
  await Group.updateOne({ id: chatId }, { $pull: { mutedUsers: userId } });
}

/**
 * 发送群组验证消息
 * @param ctx 上下文
 * @param username 用户名
 * @param memberName 成员名称
 * @param groupVerifyConfig 群组验证配置
 * @param memberId 新成员的 Telegram ID（用于验证回调）
 */
export async function sendGroupVerifyMessage(
  ctx: MyContext,
  username: string,
  groupVerifyConfig: GroupVerifyConfig,
  memberId?: number,
): Promise<void> {
  if (
    !groupVerifyConfig ||
    !groupVerifyConfig.question ||
    !groupVerifyConfig.asks?.length
  ) {
    debug('群组验证配置不完整，跳过验证');
    return;
  }

  // 使用传入的 memberId，如果没有则使用 ctx.from?.id
  const targetUserId = memberId || ctx.from?.id;

  if (!targetUserId) {
    debug('无法获取用户 ID，跳过验证');
    return;
  }

  try {
    // 将用户添加到验证队列
    await addPendingVerification(ctx.chat!.id, targetUserId);

    const message = [
      '🔐 群组验证 ',
      '',
      `欢迎 ${username}！`,
      '',
      '为了确保群组安全，请回答以下问题：',
      '',
      `❓ ${groupVerifyConfig.question}`,
      '',
      '请选择正确答案：',
    ].join('\n');

    // 创建内联键盘
    const keyboard = new InlineKeyboard();

    // 为每个答案选项创建按钮，使用新成员的 ID
    groupVerifyConfig.asks.forEach((ask, index) => {
      keyboard.text(
        ask.name,
        `verify_${targetUserId}_${index}_${
          ask.isCorrect ? 'correct' : 'wrong'
        }`,
      );
      if ((index + 1) % 2 === 0) {
        keyboard.row(); // 每两个按钮换行
      }
    });

    // 如果最后一行只有一个按钮，也要换行
    if (groupVerifyConfig.asks.length % 2 !== 0) {
      keyboard.row();
    }

    keyboard.row();
    keyboard.text('✅ 通过(管理员)', `verify_admin_pass_${targetUserId}`);
    keyboard.text('❌ 拒绝(管理员)', `verify_admin_reject_${targetUserId}`);

    // 发送验证消息
    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });

    debug(`群组验证消息已发送给用户: ${username} (ID: ${targetUserId})`);
  } catch (error) {
    debug('发送群组验证消息失败:', error);
    throw error;
  }
}

/**
 * 处理验证回调
 * @param ctx 上下文
 * @param callbackData 回调数据
 */
export async function handleVerifyCallback(
  ctx: MyContext,
  callbackData: string,
): Promise<void> {
  try {
    const parts = callbackData.split('_');
    if (parts.length < 4 || parts[0] !== 'verify') {
      return;
    }

    // 检查是否是管理员操作
    if (parts[1] === 'admin') {
      await handleAdminVerifyAction(ctx, parts);
      return;
    }

    const [, userId, , result] = parts;
    const isCorrect = result === 'correct';

    // 检查是否是当前用户的验证
    if (ctx.from?.id.toString() !== userId) {
      await ctx.answerCallbackQuery('这不是您的验证问题');
      return;
    }

    // 从验证队列移除用户
    await removePendingVerification(ctx.chat!.id, ctx.from!.id);

    if (isCorrect) {
      // 验证成功
      await ctx.editMessageText('✅ 验证成功！欢迎加入群组！');
      await ctx.answerCallbackQuery('验证成功！');
      debug(`用户 ${ctx.from?.id} 验证成功`);

      // 发送欢迎消息
      try {
        const { proxyUser } = await findBotProxy(ctx.currentBot);
        if (PermissionChecker.canUseGroupWelcome(proxyUser, ctx.currentBot)) {
          const memberName =
            ctx.from?.first_name +
            (ctx.from?.last_name ? ` ${ctx.from.last_name}` : '');
          const username = ctx.from?.username
            ? `@${ctx.from.username}`
            : memberName;
          await sendGroupWelcomeMessage(
            ctx,
            username,
            memberName,
            ctx.currentBot.groupWelcome,
          );
          debug(`欢迎消息已发送给用户: ${username}`);
        }
      } catch (welcomeError) {
        debug('发送欢迎消息失败:', welcomeError);
      }
    } else {
      // 验证失败，禁言用户
      const userName =
        ctx.from?.first_name +
        (ctx.from?.last_name ? ` ${ctx.from.last_name}` : '');
      const displayName = ctx.from?.username
        ? `@${ctx.from.username}`
        : userName;

      // 检查是否是超级群组
      const isSupergroup = ctx.chat?.type === 'supergroup';

      if (isSupergroup) {
        // 超级群组：使用禁言
        try {
          await ctx.api.restrictChatMember(ctx.chat!.id, ctx.from!.id, {
            can_send_messages: false,
            can_send_audios: false,
            can_send_documents: false,
            can_send_photos: false,
            can_send_videos: false,
            can_send_video_notes: false,
            can_send_voice_notes: false,
            can_send_polls: false,
            can_send_other_messages: false,
            can_add_web_page_previews: false,
          });
          // 添加到禁言列表
          await addMutedUser(ctx.chat!.id, ctx.from!.id);
          await ctx.editMessageText(`❌ 验证失败！${displayName} 已被禁言。`);
          await ctx.answerCallbackQuery('验证失败');
          debug(`用户 ${ctx.from?.id} 验证失败，已被禁言`);
        } catch (muteError) {
          debug('禁言用户失败:', muteError);
          // 禁言失败，添加到禁言列表（用于删除消息）
          await addMutedUser(ctx.chat!.id, ctx.from!.id);
          await ctx.editMessageText(`❌ ${displayName} 验证失败！`);
          await ctx.answerCallbackQuery('验证失败');
        }
      } else {
        // 普通群组：只能删除消息，添加到禁言列表
        await addMutedUser(ctx.chat!.id, ctx.from!.id);
        await ctx.editMessageText(`❌ ${displayName} 验证失败！`);
        await ctx.answerCallbackQuery('验证失败');
        debug(`用户 ${ctx.from?.id} 验证失败，消息将被删除`);
      }
    }
  } catch (error) {
    debug('处理验证回调失败:', error);
    await ctx.answerCallbackQuery('处理验证时发生错误');
  }
}

/**
 * 处理管理员验证操作
 */
async function handleAdminVerifyAction(
  ctx: MyContext,
  parts: string[],
): Promise<void> {
  const [, , action, targetUserId] = parts;

  // 检查是否是管理员（群组创建者）
  const creator = ctx.currentGroup?.creator as { id?: string } | undefined;
  const isAdmin = creator?.id === ctx.currentBotUser?.id;

  if (!isAdmin) {
    await ctx.answerCallbackQuery('只有管理员才能执行此操作');
    return;
  }

  const targetId = parseInt(targetUserId, 10);

  // 从验证队列移除用户
  await removePendingVerification(ctx.chat!.id, targetId);

  // 尝试获取被验证用户的信息
  let targetUserName = `用户(${targetId})`;
  try {
    const chatMember = await ctx.api.getChatMember(ctx.chat!.id, targetId);
    const user = chatMember.user;
    const memberName =
      user.first_name + (user.last_name ? ` ${user.last_name}` : '');
    targetUserName = user.username ? `@${user.username}` : memberName;
  } catch (getUserError) {
    debug('获取用户信息失败:', getUserError);
  }

  if (action === 'pass') {
    // 管理员通过验证
    await ctx.editMessageText(
      `✅ 管理员已批准 ${targetUserName} 的验证，欢迎加入群组！`,
    );
    await ctx.answerCallbackQuery('已批准验证');
    debug(`管理员 ${ctx.from?.id} 批准了用户 ${targetId} 的验证`);

    // 发送欢迎消息
    try {
      const { proxyUser } = await findBotProxy(ctx.currentBot);
      if (PermissionChecker.canUseGroupWelcome(proxyUser, ctx.currentBot)) {
        const chatMember = await ctx.api.getChatMember(ctx.chat!.id, targetId);
        const user = chatMember.user;
        const memberName =
          user.first_name + (user.last_name ? ` ${user.last_name}` : '');
        const username = user.username ? `@${user.username}` : memberName;
        await sendGroupWelcomeMessage(
          ctx,
          username,
          memberName,
          ctx.currentBot.groupWelcome,
        );
        debug(`欢迎消息已发送给用户: ${username}`);
      }
    } catch (welcomeError) {
      debug('发送欢迎消息失败:', welcomeError);
    }
  } else if (action === 'reject') {
    // 管理员拒绝验证，禁言用户
    // 检查是否是超级群组
    const isSupergroup = ctx.chat?.type === 'supergroup';

    if (isSupergroup) {
      // 超级群组：使用禁言
      try {
        await ctx.api.restrictChatMember(ctx.chat!.id, targetId, {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_video_notes: false,
          can_send_voice_notes: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
        });
        // 添加到禁言列表
        await addMutedUser(ctx.chat!.id, targetId);
        await ctx.editMessageText(
          `❌ 管理员已拒绝 ${targetUserName} 的验证，已被禁言。`,
        );
        await ctx.answerCallbackQuery('已拒绝验证');
        debug(`管理员 ${ctx.from?.id} 拒绝了用户 ${targetId} 的验证，已禁言`);
      } catch (muteError) {
        debug('禁言用户失败:', muteError);
        // 禁言失败，添加到禁言列表（用于删除消息）
        await addMutedUser(ctx.chat!.id, targetId);
        await ctx.editMessageText(`❌ 管理员已拒绝 ${targetUserName} 的验证`);
        await ctx.answerCallbackQuery('拒绝成功，但禁言失败');
      }
    } else {
      // 普通群组：只能删除消息，添加到禁言列表
      await addMutedUser(ctx.chat!.id, targetId);
      await ctx.editMessageText(`❌ 管理员已拒绝 ${targetUserName} 的验证`);
      await ctx.answerCallbackQuery('已拒绝验证');
      debug(
        `管理员 ${ctx.from?.id} 拒绝了用户 ${targetId} 的验证，消息将被删除`,
      );
    }
  }
}
