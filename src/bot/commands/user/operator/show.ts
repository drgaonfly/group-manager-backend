import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import { isGroupCreator } from '../../../middlewares/isGroupCreator';

const showOperatorCommand = new Composer<MyContext>();

const debug = createDebug('bot:showOperator');

// 匹配 "设置操作人@机器人名 @用户" 格式的命令
showOperatorCommand.hears(/^显示操作人/, isGroupCreator, async (ctx) => {
  debug('showOperator');
  const currentGroup = ctx.currentGroup;

  // 从当前群组中获取操作人列表
  const operators = currentGroup?.operators || [];

  debug('operators', operators);

  if (!operators.length) {
    await ctx.reply('当前群组没有设置操作人');
    return;
  }

  // 格式化操作人名单
  const operatorNames = operators
    .map((op: any) =>
      op.userName
        ? `@${op.userName}`
        : `${op.firstName || ''} ${op.lastName || ''}`.trim(),
    )
    .join(', ');

  // 发送确认消息
  await ctx.reply(`当前群组的操作人: ${operatorNames}`);
});

export default showOperatorCommand;
