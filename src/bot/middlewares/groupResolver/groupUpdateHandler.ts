import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import BotUser from '../../../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:group:update');

/**
 * 群组更新处理中间件
 * 职责：
 * 1. 将当前用户添加到群组的 botUsers 列表
 * 2. 将群组添加到 bot 的 groups 列表
 *
 * 注意：basicResolver 已处理基础检查，这里只需检查 currentGroup
 */
export const groupUpdateHandler: Middleware<MyContext> = async (ctx, next) => {
  if (!ctx.currentGroup) {
    return await next();
  }

  // 新逻辑：将用户添加到 BotUser.groups 而不是 Group.botUsers
  if (ctx.currentBotUser) {
    await BotUser.updateOne(
      { _id: ctx.currentBotUser._id },
      { $addToSet: { groups: ctx.currentGroup._id } },
    );
    debug('Added user to groups:', ctx.currentBotUser.userName);
  }

  // 将群组添加到 bot 的 groups 列表
  await ctx.currentBot.updateOne({
    $addToSet: { groups: ctx.currentGroup._id },
  });

  await next();
};
