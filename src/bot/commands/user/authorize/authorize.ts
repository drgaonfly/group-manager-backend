import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { isBotOwner } from '../../../middlewares/checkBotOwner';
import createDebug from 'debug';

const authorizeCommand = new Composer<MyContext>();
const debug = createDebug('bot:addAuthorize');

/**
 * 响应 start 的 authorize_bot._id
 * 显示 inline menu: 添加授权人、展示授权人、删除授权人
 */
authorizeCommand.callbackQuery(/^authorize_(.+)$/, isBotOwner, async (ctx) => {
  debug('authorize callback triggered');

  const botId = ctx.match[1];

  // 构建授权管理菜单
  const keyboard = new InlineKeyboard()
    .text('➕ 添加授权人', `add_authorizer_${botId}`)
    .row()
    .text('👥 查看授权人列表', `show_authorizers_${botId}`)
    .row()
    .text('🗑️ 删除授权人', `delete_authorizer_menu_${botId}`)
    .row()
    .text('❌ 取消', 'close');

  const messageText = [
    '🔐 <b>授权管理</b>',
    '',
    '通过授权功能，您可以允许其他用户管理此机器人。',
    '',
    '• <b>添加授权人</b>：授予其他用户管理权限',
    '• <b>查看授权人</b>：查看所有已授权的用户',
    '• <b>删除授权人</b>：撤销用户的管理权限',
    '',
    '💡 <i>授权用户可以访问机器人后台，但无法修改授权设置</i>',
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

  await ctx.answerCallbackQuery();
});

export default authorizeCommand;
