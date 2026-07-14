import { Composer } from 'grammy';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { isBotOwner } from '../../../middlewares/checkBotOwner';
import { MyContext } from '../../../types';
import { cancelKeyboard } from '../../../menus/inline/cacel';
import Bot, { IBot } from '../../../../models/bot';
import BotUser, { IBotUser } from '../../../../models/botUser';
import { getUserByUsername } from '../../../../utils/getBotUserByUsername';
import createDebug from 'debug';

const debug = createDebug('bot:authorizeConversation');
const authorizeConversationComposer = new Composer<MyContext>();
const TIMEOUT = 5 * 60 * 1000;

/**
 * 添加授权人的对话流程
 */
async function addAuthorizerConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  { bot, botUser }: { bot: IBot; botUser: IBotUser },
) {
  debug('等待用户输入授权人的用户名或 ID');

  const result = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    { maxMilliseconds: TIMEOUT },
  );

  // 处理取消
  if (result.callbackQuery && result.callbackQuery.data === 'close') {
    await ctx.reply('已取消添加授权人操作。');
    return;
  }

  // 获取用户输入
  const input = result.message?.text?.trim();
  if (!input) {
    await ctx.reply(
      [
        '❗ <b>请输入有效的用户名或用户 ID</b>',
        '',
        '格式示例：',
        '• 用户名：<code>@username</code> 或 <code>username</code>',
        '',
        '如需取消，请点击下方按钮。',
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: cancelKeyboard },
    );
    return await addAuthorizerConversation(conversation, ctx, { bot, botUser });
  }

  debug('收到用户输入:', input);
  await ctx.reply('✅ 正在查找用户，请稍候...');

  try {
    // 去掉 @ 符号
    const userName = input.replace(/^@/, '');

    let targetUser: any;
    try {
      targetUser = await getUserByUsername(bot.token, userName);
      debug('从 Telegram API 获取到用户:', targetUser);
    } catch (error) {
      debug('从 Telegram API 获取用户失败:', error);
      await ctx.reply(
        [
          '❌ <b>未找到该用户</b>',
          '',
          '请确保：',
          '• 用户名输入正确',
          '• 用户存在且可被搜索',
        ].join('\n'),
        { parse_mode: 'HTML' },
      );
      return;
    }

    // 在数据库中创建或更新 BotUser
    const targetBotUser = await BotUser.findOneAndUpdate(
      { id: targetUser.id },
      {
        $set: {
          userName: targetUser.username,
          firstName: targetUser.first_name,
          lastName: targetUser.last_name,
        },
      },
      { new: true, upsert: true },
    );
    debug('已创建/更新 BotUser:', targetBotUser);

    // 验证不能授权给自己
    const currentBotUserId = botUser._id?.toString();
    if (targetBotUser._id.toString() === currentBotUserId) {
      await ctx.reply('❌ 不能将自己添加为授权用户！');
      return;
    }

    // 检查是否已经授权
    const authorizedUsers = bot.authorized_users || [];
    const isAlreadyAuthorized = authorizedUsers.some(
      (userId: any) => userId.toString() === targetBotUser._id.toString(),
    );

    if (isAlreadyAuthorized) {
      await ctx.reply(
        `❌ 用户 <b>${
          targetBotUser.userName || targetBotUser.firstName
        }</b> 已经是授权用户了！`,
        { parse_mode: 'HTML' },
      );
      return;
    }

    // 添加授权
    await Bot.findByIdAndUpdate(bot._id, {
      $addToSet: { authorized_users: targetBotUser._id },
    });

    debug(`已添加授权用户: ${targetBotUser._id}`);

    await ctx.reply(
      [
        '✅ <b>授权成功！</b>',
        '',
        `用户 <b>${
          targetBotUser.userName || targetBotUser.firstName
        }</b> (ID: <code>${targetBotUser.id}</code>) 已被授权管理此机器人。`,
        '',
        '💡 该用户现在可以访问机器人管理后台。',
      ].join('\n'),
      { parse_mode: 'HTML' },
    );
  } catch (error) {
    debug('添加授权失败:', error);
    await ctx.reply('❌ 添加授权失败，请稍后再试。');
  }
}

// 注册对话
authorizeConversationComposer.use(
  createConversation(addAuthorizerConversation),
);

/**
 * 入口按钮：添加授权人
 */
authorizeConversationComposer.callbackQuery(
  /^add_authorizer_(.+)$/,
  isBotOwner,
  async (ctx) => {
    debug('add_authorizer clicked');

    const botId = ctx.match[1];

    // 退出所有对话
    await ctx.conversation.exitAll();

    await ctx.reply(
      [
        '➕ <b>添加授权人</b>',
        '',
        '请发送要授权的用户的 <b>用户名</b>：',
        '',
        '格式示例：',
        '• 用户名：<code>@username</code> 或 <code>username</code>',
        '',
        '💡 <b>注意</b>：',
        '• 授权后该用户可以访问机器人管理后台',
        '',
        '⏳ 此操作将在 5 分钟后过期。',
        '',
        '如需取消，请点击下方按钮。',
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: cancelKeyboard },
    );

    await ctx.conversation.enter('addAuthorizerConversation', {
      bot: ctx.currentBot,
      botUser: ctx.currentBotUser,
    });
    await ctx.answerCallbackQuery();
  },
);

export default authorizeConversationComposer;
