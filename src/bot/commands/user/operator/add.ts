import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import BotUser from '../../../../models/botUser';
import { isGroupCreator } from '../../../middlewares/isGroupCreator';
const addOperatorCommand = new Composer<MyContext>();

const debug = createDebug('bot:addOperator');

// 匹配 "设置操作人@机器人名 @用户" 格式的命令
addOperatorCommand.hears(/^设置操作人/, isGroupCreator, async (ctx) => {
  const currentGroup = ctx.currentGroup;

  debug(ctx.message.entities);
  const operators = ctx.message.entities.filter(
    (entity: any) => entity.user !== undefined,
  );

  debug('operators');
  debug(operators);

  // 存储新的操作人信息
  const newOperators = [];

  for (const operator of operators) {
    const {
      user: { id, username, first_name, last_name },
    } = operator as any;

    const botUser = await BotUser.findOneAndUpdate(
      { id: id.toString() },
      {
        $set: {
          userName: username,
          firstName: first_name,
          lastName: last_name,
        },
      },
      { new: true, upsert: true },
    );

    newOperators.push(botUser._id);
  }

  // 将新的操作人添加到当前群组的操作人列表中
  await currentGroup.updateOne({
    $addToSet: {
      operators: {
        $each: newOperators,
      },
    },
  });

  // 格式化操作人名单
  const operatorNames = operators
    .map((op: any) =>
      op.user.username
        ? `@${op.user.username}`
        : `${op.user.first_name || ''} ${op.user.last_name || ''}`.trim(),
    )
    .join(' ');

  // 发送确认消息
  await ctx.reply(`已将 ${operatorNames} 设置为操作人`);
});

export default addOperatorCommand;
