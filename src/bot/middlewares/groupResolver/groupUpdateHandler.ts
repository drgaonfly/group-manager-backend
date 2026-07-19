import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import Group from '../../../models/group';
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

  // 使用 $addToSet 将当前用户添加到群组的用户列表中，避免重复
  if (ctx.currentBotUser) {
    const result = await Group.updateOne(
      { _id: ctx.currentGroup._id },
      { $addToSet: { botUsers: ctx.currentBotUser._id } },
    );
    // 只在真正添加时打印日志
    if (result.modifiedCount > 0) {
      debug('Added user to group botUsers:', ctx.currentBotUser.userName);
    }
  }

  // 将群组添加到 bot 的 groups 列表
  await ctx.currentBot.updateOne({
    $addToSet: { groups: ctx.currentGroup._id },
  });

  await next();
};
