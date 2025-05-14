import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import BotUser from '../../../../models/botUser';
import { isGroupCreator } from '../../../middlewares/checkBotUser';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import { createTelegramClient } from '../../../services/gramClient';
import { Api } from 'telegram';
const deleteOperatorCommand = new Composer<MyContext>();

const debug = createDebug('bot:deleteOperator');

// 匹配 "删除操作人@机器人名 @用户" 格式的命令
deleteOperatorCommand.hears(
  /删除操作人/,
  checkGroup,
  isGroupCreator,
  async (ctx) => {
    debug('deleteOperator');
    const currentGroup = ctx.currentGroup;

    // 分离两种提及类型
    const textMentions =
      ctx.message.entities?.filter((e) => e.type === 'text_mention') || [];
    const mentions =
      ctx.message.entities?.filter((e) => e.type === 'mention') || [];
    debug('textMentions:', textMentions);
    debug('mentions:', mentions);

    // 合并处理结果
    const operators = [
      ...textMentions.map((e: any) => e.user), // 直接获取 text_mention 用户
      ...(await processUsernameMentions(ctx, mentions)), // 处理 @username 提及
    ].filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i); // 去重

    debug('最终操作人列表:', operators);

    // 存储需要删除的操作人ID
    const removedOperatorIds = [];

    for (const user of operators) {
      // 查找对应用户数据库记录
      const botUser = await BotUser.findOne({ id: user.id.toString() });
      if (botUser) {
        removedOperatorIds.push(botUser._id);
      }
    }

    // 如果没有找到有效用户
    if (removedOperatorIds.length === 0) {
      await ctx.reply('⚠️ 未找到要删除的操作人');
      return;
    }

    // 找出不在操作人列表中的用户
    const notOperators = operators.filter(
      (user) =>
        !removedOperatorIds.some((id) => id.toString() === user.id.toString()),
    );

    // 找出在操作人列表中的用户
    const validOperators = operators.filter((user) =>
      removedOperatorIds.some((id) => id.toString() === user.id.toString()),
    );

    // 从群组操作人列表中移除
    await currentGroup.updateOne({
      $pullAll: { operators: removedOperatorIds },
    });

    // 格式化在列表中的用户名
    const operatorNames = validOperators
      .map((user) =>
        user.username
          ? `@${user.username}`
          : `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      )
      .join('\n');

    // 格式化不在列表中的用户名
    const notOperatorNames = notOperators
      .map((user) =>
        user.username
          ? `@${user.username}`
          : `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      )
      .join('\n');

    // 分别发送两种状态的消息
    if (operatorNames) {
      await ctx.reply(`✅ 已从操作人列表中移除：\n${operatorNames}`);
    }

    if (notOperatorNames) {
      await ctx.reply(`⚠️ 以下用户不在操作人列表中：\n${notOperatorNames}`);
    }
  },
);

// 处理 @username 类型提及
async function processUsernameMentions(ctx: MyContext, mentions: any[]) {
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

    const gramClient = createTelegramClient(ctx.currentBotSession);
    await gramClient.connect();
    const user = await gramClient.invoke(
      new Api.contacts.ResolveUsername({ username: mentionUsername }),
    );
    const { id, username, firstName, lastName } = user.users[0] as any;
    debug('用户信息:', { id, username, firstName, lastName });
    debug('id', id.value);

    debug('处理 @username 提及:', username);

    resolvedUsers.push({
      id,
      username,
      first_name: firstName,
      last_name: lastName,
    });
  }

  return resolvedUsers;
}

export default deleteOperatorCommand;
