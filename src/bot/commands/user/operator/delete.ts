import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import BotUser from '../../../../models/botUser';
import { isGroupCreator } from '../../../middlewares/checkBotUser';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import { processTextUsernames } from './add';
import { checkPermission } from '../../../middlewares/checkPermission';

const deleteOperatorCommand = new Composer<MyContext>();

const debug = createDebug('bot:deleteOperator');

// 匹配 "删除操作人@机器人名 @用户" 格式的命令
deleteOperatorCommand.hears(
  /删除操作人/,
  checkGroup,
  checkPermission,
  isGroupCreator,
  async (ctx) => {
    debug('deleteOperator');
    const currentGroup = ctx.currentGroup;
    const messageText = ctx.message.text;

    // 分离两种提及类型
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

    debug('去重后的操作人列表:', operators);

    // 存储需要删除的操作人ID
    let removedOperatorIds = [];

    for (const user of operators) {
      // 查找对应用户数据库记录
      const botUser = await BotUser.findOne({ id: user.id.toString() });
      if (botUser) {
        removedOperatorIds.push(botUser._id);
      }
    }

    // 对 removedOperatorIds 进行去重
    removedOperatorIds = [...new Set(removedOperatorIds)];

    // 如果没有找到有效用户
    if (removedOperatorIds.length === 0) {
      await ctx.reply('⚠️ 未找到要删除的操作人');
      return;
    }

    // 从群组操作人列表中移除
    await currentGroup.updateOne({
      $pullAll: { operators: removedOperatorIds },
    });

    // 格式化在列表中的用户名
    const operatorNames = operators
      .map((user) =>
        user.username
          ? `@${user.username}`
          : `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      )
      .join('\n');

    // 发送移除成功消息
    if (operatorNames) {
      await ctx.reply(`✅ 已从操作人列表中移除：\n${operatorNames}`);
    }
  },
);

export default deleteOperatorCommand;
