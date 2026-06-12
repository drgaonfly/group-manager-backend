import { MyContext } from '../bot/types';
import { InlineKeyboard } from 'grammy';
import { sendGroupWelcomeMessage } from './sendGroupWelcomeMessage';
import { findBotProxy } from '../bot/services/findBotProxy';
import { PermissionChecker } from '../bot/utils/permissionChecker';
import GroupWelcome from '../models/groupWelcome';
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
 * 发送群组验证消息
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

  const targetUserId = memberId || ctx.from?.id;

  if (!targetUserId) {
    debug('无法获取用户 ID，跳过验证');
    return;
  }

  try {
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

    const keyboard = new InlineKeyboard();

    groupVerifyConfig.asks.forEach((ask, index) => {
      keyboard.text(
        ask.name,
        `verify_${targetUserId}_${index}_${
          ask.isCorrect ? 'correct' : 'wrong'
        }`,
      );
      if ((index + 1) % 2 === 0) {
        keyboard.row();
      }
    });

    if (groupVerifyConfig.asks.length % 2 !== 0) {
      keyboard.row();
    }

    keyboard.row();
    keyboard.text('✅ 通过(管理员)', `verify_admin_pass_${targetUserId}`);
    keyboard.text('❌ 拒绝(管理员)', `verify_admin_reject_${targetUserId}`);

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

    if (parts[1] === 'admin') {
      await handleAdminVerifyAction(ctx, parts);
      return;
    }

    const [, userId, , result] = parts;
    const isCorrect = result === 'correct';

    if (ctx.from?.id.toString() !== userId) {
      await ctx.answerCallbackQuery('这不是您的验证问题');
      return;
    }

    if (isCorrect) {
      await ctx.editMessageText('✅ 验证成功！欢迎加入群组！');
      await ctx.answerCallbackQuery('验证成功！');
      debug(`用户 ${ctx.from?.id} 验证成功`);

      try {
        const { proxyUser } = await findBotProxy(ctx.currentBot);
        if (PermissionChecker.canUseGroupWelcome(proxyUser, ctx.currentBot)) {
          const memberName =
            ctx.from?.first_name +
            (ctx.from?.last_name ? ` ${ctx.from.last_name}` : '');
          const username = ctx.from?.username
            ? `@${ctx.from.username}`
            : memberName;
          const groupWelcomeConfig = await GroupWelcome.findOne({
            bot: ctx.currentBot._id,
            group: ctx.currentGroup?._id,
          });
          await sendGroupWelcomeMessage(
            ctx,
            username,
            memberName,
            groupWelcomeConfig ?? undefined,
          );
          debug(`欢迎消息已发送给用户: ${username}`);
        }
      } catch (welcomeError) {
        debug('发送欢迎消息失败:', welcomeError);
      }
    } else {
      const userName =
        ctx.from?.first_name +
        (ctx.from?.last_name ? ` ${ctx.from.last_name}` : '');
      const displayName = ctx.from?.username
        ? `@${ctx.from.username}`
        : userName;

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
        await ctx.editMessageText(`❌ 验证失败！${displayName} 已被禁言。`);
        await ctx.answerCallbackQuery('验证失败');
        debug(`用户 ${ctx.from?.id} 验证失败，已被禁言`);
      } catch (muteError) {
        debug('禁言用户失败:', muteError);
        await ctx.editMessageText(`❌ ${displayName} 验证失败！`);
        await ctx.answerCallbackQuery('验证失败');
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

  const creator = ctx.currentGroup?.creator as { id?: string } | undefined;
  const isAdmin = creator?.id === ctx.currentBotUser?.id;

  if (!isAdmin) {
    await ctx.answerCallbackQuery('只有管理员才能执行此操作');
    return;
  }

  const targetId = parseInt(targetUserId, 10);

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
    await ctx.editMessageText(
      `✅ 管理员已批准 ${targetUserName} 的验证，欢迎加入群组！`,
    );
    await ctx.answerCallbackQuery('已批准验证');
    debug(`管理员 ${ctx.from?.id} 批准了用户 ${targetId} 的验证`);

    try {
      const { proxyUser } = await findBotProxy(ctx.currentBot);
      if (PermissionChecker.canUseGroupWelcome(proxyUser, ctx.currentBot)) {
        const chatMember = await ctx.api.getChatMember(ctx.chat!.id, targetId);
        const user = chatMember.user;
        const memberName =
          user.first_name + (user.last_name ? ` ${user.last_name}` : '');
        const username = user.username ? `@${user.username}` : memberName;
        const groupWelcomeConfig = await GroupWelcome.findOne({
          bot: ctx.currentBot._id,
          group: ctx.currentGroup?._id,
        });
        await sendGroupWelcomeMessage(
          ctx,
          username,
          memberName,
          groupWelcomeConfig ?? undefined,
        );
        debug(`欢迎消息已发送给用户: ${username}`);
      }
    } catch (welcomeError) {
      debug('发送欢迎消息失败:', welcomeError);
    }
  } else if (action === 'reject') {
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
      await ctx.editMessageText(
        `❌ 管理员已拒绝 ${targetUserName} 的验证，已被禁言。`,
      );
      await ctx.answerCallbackQuery('已拒绝验证');
      debug(`管理员 ${ctx.from?.id} 拒绝了用户 ${targetId} 的验证，已禁言`);
    } catch (muteError) {
      debug('禁言用户失败:', muteError);
      await ctx.editMessageText(`❌ 管理员已拒绝 ${targetUserName} 的验证`);
      await ctx.answerCallbackQuery('拒绝成功，但禁言失败');
    }
  }
}
