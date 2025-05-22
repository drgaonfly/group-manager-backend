import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import BotUser from '../../../../models/botUser';
import { isGroupCreator } from '../../../middlewares/checkBotUser';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import { createTelegramClient } from '../../../services/gramClient';
import { Api } from 'telegram';
import { checkPermission } from '../../../middlewares/checkPermission';

const addOperatorCommand = new Composer<MyContext>();
const debug = createDebug('bot:addOperator');

// 通过 username 获取用户信息
export async function getUserByUsername(session: any, username: string) {
  debug('username', username);
  const gramClient = createTelegramClient(session);
  try {
    await gramClient.connect();
    const user = await gramClient.invoke(
      new Api.contacts.ResolveUsername({ username }),
    );
    const { id, username: uname, firstName, lastName } = user.users[0] as any;
    debug('用户信息:', { id, username: uname, firstName, lastName });
    debug('id', id.value);
    debug('处理 @username 提及:', uname);

    return {
      id,
      username: uname,
      first_name: firstName,
      last_name: lastName,
    };
  } catch (error) {
    debug('获取用户信息失败:', error);
  }
}

// 处理两种提及类型
addOperatorCommand.hears(
  /(设置操作人|设置为操作人|添加操作人|设置操作员|添加操作员|设置为操作员)/,
  checkGroup,
  checkPermission,
  isGroupCreator,
  async (ctx) => {
    const currentGroup = ctx.currentGroup;

    // 获取消息文本中的用户提及
    const messageText = ctx.message.text;
    const textMentions =
      ctx.message.entities?.filter((e) => e.type === 'text_mention') || [];
    const mentions =
      ctx.message.entities?.filter((e) => e.type === 'mention') || [];

    debug('textMentions:', textMentions);
    debug('mentions:', mentions);

    // 从消息文本中提取 @ 后的用户名
    const textUsernames = messageText.match(/@(\w+)/g) || [];
    const usernamesFromText = textUsernames.map((u) => u.substring(1));

    debug('从文本提取的用户名:', usernamesFromText);

    // 合并处理结果
    let operators = [
      ...textMentions.map((e: any) => e.user), // 直接获取 text_mention 用户
      // ...(await processUsernameMentions(ctx, mentions)), // 处理 @username 提及
      ...(await processTextUsernames(ctx, usernamesFromText)), // 处理文本中的 @用户名
    ].filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i); // 去重

    debug('最终操作人列表:', operators);

    // 对 operators 数组进行去重，根据用户 ID 去重
    operators = operators.reduce((acc, current) => {
      const exists = acc.find(
        (item) => item.id.toString() === current.id.toString(),
      );
      if (!exists) {
        acc.push(current);
      }
      return acc;
    }, []);

    if (operators.length === 0) {
      await ctx.reply('未找到有效的操作人，请使用"设置操作人 @用户名"的格式');
      return;
    }

    // 数据库操作保持不变
    const newOperators = [];
    for (const user of operators) {
      const botUser = await BotUser.findOneAndUpdate(
        { id: user.id.toString() },
        {
          $set: {
            userName: user.username,
            firstName: user.first_name,
            lastName: user.last_name,
          },
        },
        { new: true, upsert: true },
      );
      newOperators.push(botUser._id);
    }

    await currentGroup.updateOne({
      $addToSet: { operators: { $each: newOperators } },
    });

    const operatorNames = operators
      .map((user) =>
        user.username
          ? `@${user.username}`
          : `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      )
      .join(' ');

    await ctx.reply(
      `已设置操作人：${operatorNames}，共添加 ${operators.length} 位`,
    );
  },
);

// 处理 @username 类型提及
export async function processUsernameMentions(ctx: MyContext, mentions: any[]) {
  const resolvedUsers = [];

  if (!ctx.currentBotSession) {
    await ctx.reply('session 不存在，请先使用 /start 命令初始化 session');
    return [];
  }

  for (const entity of mentions) {
    const mentionText = ctx.message.text.substring(
      entity.offset,
      entity.offset + entity.length,
    );
    const mentionUsername = mentionText.replace('@', '').trim();

    try {
      const user = await getUserByUsername(
        ctx.currentBotSession,
        mentionUsername,
      );
      if (user) {
        resolvedUsers.push(user);
      }
    } catch (error) {
      // 获取用户信息失败时跳过该用户
      debug('获取用户信息失败，跳过:', mentionUsername, error);
      continue;
    }
  }

  return resolvedUsers;
}

// 处理文本中的用户名
export async function processTextUsernames(
  ctx: MyContext,
  usernames: string[],
) {
  const resolvedUsers = [];

  if (!ctx.currentBotSession) {
    await ctx.reply('session 不存在，请先使用 /start 命令初始化 session');
    return [];
  }

  for (const username of usernames) {
    try {
      const user = await getUserByUsername(ctx.currentBotSession, username);
      if (user) {
        resolvedUsers.push(user);
      }
    } catch (error) {
      // 获取用户信息失败时跳过该用户
      debug('获取用户信息失败，跳过:', username, error);
      continue;
    }
  }

  return resolvedUsers;
}

export default addOperatorCommand;
