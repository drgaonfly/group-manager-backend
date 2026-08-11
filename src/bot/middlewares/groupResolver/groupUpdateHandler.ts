import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import BotUser from '../../../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:group:update');

/**
 * 群组更新处理中间件
 * 职责：
 * 1. 将当前用户添加到群组的 botUsers 列表（仅对普通消息，成员事件由 memberJoinLeaveHandler 处理）
 * 2. 将群组添加到 bot 的 groups 列表
 *
 * 注意：避免与 memberJoinLeaveHandler 冲突
 */
export const groupUpdateHandler: Middleware<MyContext> = async (ctx, next) => {
  if (!ctx.currentGroup) {
    return await next();
  }

  // 只有在非成员事件时才处理用户群组关系，避免与 memberJoinLeaveHandler 冲突
  const isMessage = !!ctx.message;
  const isChatMemberUpdate = !!ctx.chatMember;

  if (isMessage && !isChatMemberUpdate && ctx.currentBotUser) {
    // 对于普通消息，确保用户在群组关系中
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
