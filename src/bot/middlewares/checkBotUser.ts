import { IBotUser } from '../../models/botUser';
import { MyContext } from '../types';
import createDebug from 'debug';

const debug = createDebug('bot:checkBotUser');

export const isGroupCreator = async (
  ctx: MyContext,
  next: () => Promise<void>,
) => {
  const currentGroup = ctx.currentGroup;
  const creator = currentGroup.creator as IBotUser;

  debug('当前用户ID:', ctx.currentBotUser._id);
  debug('创建者ID:', creator._id);

  if (ctx.currentBotUser._id.toString() !== creator._id.toString()) {
    await ctx.reply(
      `您不是当前权限人哦！此群机器人由 ${
        creator.userName ||
        `${creator.firstName || ''} ${creator.lastName || ''}`.trim()
      } 首次设置.`,
    );
    return;
  } else {
    debug('⚠️ 仅群组创建者可使用此命令');
    await next();
  }
};

export const isOperatorOrCreator = async (
  ctx: MyContext,
  next: () => Promise<void>,
) => {
  const currentGroup = ctx.currentGroup;
  const creator = currentGroup.creator as IBotUser;
  const operators = currentGroup.operators || [];
  const currentBotUser = ctx.currentBotUser;

  debug('当前用户ID:', currentBotUser._id);
  debug('创建者ID:', creator._id);
  debug(
    '操作员列表:',
    operators.map((op: IBotUser) => op._id),
  );

  // 检查是否为创建者或操作员
  const isCreator = currentBotUser._id.toString() === creator._id.toString();
  const isOperator = operators.some(
    (op: IBotUser) => op._id.toString() === currentBotUser._id.toString(),
  );

  if (!isCreator && !isOperator) {
    await ctx.reply(
      `抱歉，您不是群组的操作员。此群机器人由 ${
        creator.userName ||
        `${creator.firstName || ''} ${creator.lastName || ''}`.trim()
      } 首次设置.`,
    );
    return;
  } else {
    debug('✅ 当前用户是群组创建者或操作员');
    await next();
  }
};
