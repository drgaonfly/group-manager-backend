import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { isBotOwner } from '../../../middlewares/checkBotOwner';
import { ITEMS_PER_PAGE } from '../../../../constants';
import Bot from '../../../../models/bot';
import createDebug from 'debug';

const deleteAuthorizeCommand = new Composer<MyContext>();
const debug = createDebug('bot:deleteAuthorize');

function buildDeleteMenu(authorizedUsers: any[], page: number, botId: string) {
  const total = authorizedUsers.length;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const start = (page - 1) * ITEMS_PER_PAGE;
  const pageUsers = authorizedUsers.slice(start, start + ITEMS_PER_PAGE);

  const messageLines = [
    '🗑️ <b>删除授权用户</b>',
    '',
    '请选择要删除的授权用户：',
    '',
  ];

  const keyboard = new InlineKeyboard();

  pageUsers.forEach((user: any, index: number) => {
    const userName = user.userName || user.firstName || '未知用户';
    const userId = user.id || 'N/A';
    // 使用全局索引，避免分页后索引错乱
    const globalIndex = start + index;
    messageLines.push(`${globalIndex + 1}. <b>${userName}</b> (ID: ${userId})`);
    keyboard.text(`❌ ${userName}`, `del_auth_${globalIndex}`).row();
  });

  messageLines.push('');
  messageLines.push('⚠️ <i>删除后该用户将无法访问机器人后台</i>');

  // 分页按钮
  if (totalPages > 1) {
    if (page > 1) {
      keyboard.text('⬅️ 上一页', `delete_authorizer_menu_${botId}_${page - 1}`);
    }
    if (page < totalPages) {
      keyboard.text('下一页 ➡️', `delete_authorizer_menu_${botId}_${page + 1}`);
    }
    keyboard.row();
  }

  keyboard.text('🔙 返回授权管理', `authorize_${botId}`);

  return { messageText: messageLines.join('\n'), keyboard };
}

/**
 * 删除授权用户菜单（入口 + 分页）
 */
deleteAuthorizeCommand.callbackQuery(
  /^delete_authorizer_menu_([^_]+)(?:_(\d+))?$/,
  isBotOwner,
  async (ctx) => {
    debug('delete_authorizer_menu callback triggered');

    const botId = ctx.match[1];
    const page = parseInt(ctx.match[2] || '1');
    const bot = ctx.currentBot;

    await bot.populate('authorized_users');
    const authorizedUsers = (bot.authorized_users || []) as any[];

    if (authorizedUsers.length === 0) {
      await ctx.answerCallbackQuery({
        text: '❌ 暂无授权用户可删除',
        show_alert: true,
      });
      return;
    }

    const { messageText, keyboard } = buildDeleteMenu(
      authorizedUsers,
      page,
      botId,
    );

    try {
      await ctx.editMessageText(messageText, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (error) {
      await ctx.reply(messageText, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    }

    await ctx.answerCallbackQuery();
  },
);

/**
 * 确认删除授权用户
 */
deleteAuthorizeCommand.callbackQuery(
  /^del_auth_(\d+)$/,
  isBotOwner,
  async (ctx) => {
    debug('del_auth callback triggered');

    const index = parseInt(ctx.match[1]);
    const bot = ctx.currentBot;

    try {
      await bot.populate('authorized_users');
      const authorizedUsers = (bot.authorized_users || []) as any[];

      if (index < 0 || index >= authorizedUsers.length) {
        await ctx.answerCallbackQuery({
          text: '❌ 用户不存在',
          show_alert: true,
        });
        return;
      }

      const targetUser = authorizedUsers[index];

      await Bot.findByIdAndUpdate(bot._id, {
        $pull: { authorized_users: targetUser._id },
      });

      debug(`已删除授权用户: ${targetUser._id}`);

      const userName =
        targetUser.userName || targetUser.firstName || '未知用户';

      await ctx.answerCallbackQuery({
        text: `✅ 已删除授权用户: ${userName}`,
        show_alert: true,
      });

      // 删除后刷新列表，回到第一页
      await bot.populate('authorized_users');
      const updatedUsers = (bot.authorized_users || []) as any[];
      const botId = bot._id.toString();

      if (updatedUsers.length === 0) {
        // 已无授权用户，返回授权管理菜单
        const keyboard = new InlineKeyboard()
          .text('➕ 添加授权人', `add_authorizer_${botId}`)
          .row()
          .text('👥 查看授权人列表', `show_authorizers_${botId}`)
          .row()
          .text('🔙 返回', 'back_to_start');

        const messageText = [
          '🔐 <b>授权管理</b>',
          '',
          `✅ 已成功删除授权用户: <b>${userName}</b>`,
          '',
          '当前暂无授权用户。',
        ].join('\n');

        try {
          await ctx.editMessageText(messageText, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
          });
        } catch (error) {
          await ctx.reply(messageText, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
          });
        }
      } else {
        // 刷新删除菜单，回到第一页
        const { messageText, keyboard } = buildDeleteMenu(
          updatedUsers,
          1,
          botId,
        );
        try {
          await ctx.editMessageText(messageText, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
          });
        } catch (error) {
          await ctx.reply(messageText, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
          });
        }
      }
    } catch (error) {
      debug('删除授权用户失败:', error);
      await ctx.answerCallbackQuery({
        text: '❌ 删除失败，请稍后再试',
        show_alert: true,
      });
    }
  },
);

export default deleteAuthorizeCommand;
