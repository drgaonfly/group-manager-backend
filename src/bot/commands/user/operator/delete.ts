import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import BotUser from '../../../../models/botUser';
import { isGroupCreator } from '../../../middlewares/isGroupCreator';

const deleteOperatorCommand = new Composer<MyContext>();

const debug = createDebug('bot:deleteOperator');

// 匹配 "删除操作人@机器人名 @用户" 格式的命令
deleteOperatorCommand.hears(/^删除操作人/, isGroupCreator, async (ctx) => {
  debug('deleteOperator');
  const currentGroup = ctx.currentGroup;

  // 提取消息中@的用户实体
  const operators = ctx.message.entities.filter(
    (entity: any) => entity.user !== undefined,
  );

  // 存储需要删除的操作人ID
  const removedOperatorIds = [];

  for (const operator of operators) {
    const {
      user: { id },
    } = operator as any;

    // 查找对应用户数据库记录
    const botUser = await BotUser.findOne({ id: id.toString() });
    if (botUser) {
      removedOperatorIds.push(botUser._id);
    }
  }

  // 如果没有找到有效用户
  if (removedOperatorIds.length === 0) {
    await ctx.reply('⚠️ 未找到要删除的操作人');
    return;
  }

  // 从群组操作人列表中移除
  await currentGroup.updateOne({
    $pullAll: { operators: removedOperatorIds },
  });

  // 格式化用户名
  const operatorNames = operators
    .map((op: any) =>
      op.user.username
        ? `@${op.user.username}`
        : `${op.user.first_name || ''} ${op.user.last_name || ''}`.trim(),
    )
    .join(' ');

  await ctx.reply(`✅ 已从操作人列表中移除：${operatorNames}`);
});

export default deleteOperatorCommand;
