import { IBotUser } from '../../models/botUser';
import { MyContext } from '../types';
import createDebug from 'debug';

const debug = createDebug('bot:isGroupCreator');

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
