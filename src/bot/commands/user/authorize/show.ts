import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { isBotOwner } from '../../../middlewares/checkBotOwner';
import { ITEMS_PER_PAGE } from '../../../../constants';
import createDebug from 'debug';

const showAuthorizeCommand = new Composer<MyContext>();
const debug = createDebug('bot:showAuthorize');

function buildShowMessage(authorizedUsers: any[], page: number, botId: string) {
  const total = authorizedUsers.length;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const start = (page - 1) * ITEMS_PER_PAGE;
  const pageUsers = authorizedUsers.slice(start, start + ITEMS_PER_PAGE);

  let messageText = '';

  if (total === 0) {
    messageText = [
      '👥 <b>授权用户列表</b>',
      '',
      '暂无授权用户',
      '',
      '💡 <i>点击下方"添加授权人"按钮添加授权用户</i>',
    ].join('\n');
  } else {
    const userList = pageUsers
      .map((user: any, index: number) => {
        const userName = user.userName || user.firstName || '未知用户';
        const userId = user.id || 'N/A';
        return `${
          start + index + 1
        }. <b>${userName}</b> (ID: <code>${userId}</code>)`;
      })
      .join('\n');

    messageText = [
      '👥 <b>授权用户列表</b>',
      '',
      `共 ${total} 位授权用户（第 ${page}/${totalPages} 页）：`,
      '',
      userList,
      '',
      '💡 <i>这些用户可以访问机器人管理后台</i>',
    ].join('\n');
  }

  const keyboard = new InlineKeyboard();

  // 分页按钮
  if (totalPages > 1) {
    if (page > 1) {
      keyboard.text('⬅️ 上一页', `show_authorizers_${botId}_${page - 1}`);
    }
    if (page < totalPages) {
      keyboard.text('下一页 ➡️', `show_authorizers_${botId}_${page + 1}`);
    }
    keyboard.row();
  }

  keyboard
    .text('➕ 添加授权人', `add_authorizer_${botId}`)
    .row()
    .text('🗑️ 删除授权人', `delete_authorizer_menu_${botId}`)
    .row()
    .text('🔙 返回授权管理', `authorize_${botId}`);

  return { messageText, keyboard };
}

/**
 * 显示授权用户列表（入口 + 分页）
 */
showAuthorizeCommand.callbackQuery(
  /^show_authorizers_([^_]+)(?:_(\d+))?$/,
  isBotOwner,
  async (ctx) => {
    debug('show_authorizers callback triggered');

    const botId = ctx.match[1];
    const page = parseInt(ctx.match[2] || '1');
    const bot = ctx.currentBot;

    await bot.populate('authorized_users');
    const authorizedUsers = (bot.authorized_users || []) as any[];

    const { messageText, keyboard } = buildShowMessage(
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

export default showAuthorizeCommand;
