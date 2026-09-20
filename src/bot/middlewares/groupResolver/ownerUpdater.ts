import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import Group from '../../../models/group';
import BotUser from '../../../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:group:ownerUpdater');

/**
 * 管理员管理处理中间件
 * 职责：
 * 1. 检测用户被提升为管理员
 * 2. 检测用户被提升为群主（包括群主转移）
 * 3. 检测用户被撤销管理员
 * 4. 检测群主转移（creator -> administrator, member/administrator -> creator）
 * 5. 更新 Group.operators 和 Group.creator
 *
 * 注意：basicResolver 已处理类型检查，这里只需检查 ctx.currentGroup
 */
export const ownerUpdater: Middleware<MyContext> = async (ctx, next) => {
  if (!ctx.currentGroup) {
    return await next();
  }

  if (ctx.currentGroup.type === 'channel') {
    return await next();
  }

  const proxyUser = ctx.currentProxyUser;

  // ── 群主离开（chat_owner_left）─────────────────────────────────────
  // 群主离开群组，如果有 new_owner 则更新 Group.creator
  const ownerLeft = ctx.message?.chat_owner_left;
  if (ownerLeft) {
    try {
      if (ownerLeft.new_owner) {
        const newOwner = ownerLeft.new_owner;
        const newOwnerBotUser = await BotUser.findOneAndUpdate(
          { id: newOwner.id.toString(), proxy: proxyUser._id },
          {
            $setOnInsert: {
              userName: newOwner.username || '',
              firstName: newOwner.first_name,
              lastName: newOwner.last_name || '',
              bot: ctx.currentBot._id,
              proxy: proxyUser._id,
            },
            $addToSet: { groups: ctx.currentGroup._id },
          },
          { upsert: true, new: true },
        );
        await Group.updateOne(
          { _id: ctx.currentGroup._id },
          {
            $set: { creator: newOwnerBotUser._id },
            $pull: { operators: newOwnerBotUser._id },
          },
        );
        debug(`👑 群主离开，新群主 ${newOwner.id} 已更新到 Group.creator`);
      } else {
        // 没有接任群主，清空 creator
        await Group.updateOne(
          { _id: ctx.currentGroup._id },
          { $unset: { creator: '' } },
        );
        debug(`👑 群主离开，无接任者，Group.creator 已清空`);
      }
    } catch (error) {
      debug('Error processing chat_owner_left:', error);
    }
    return await next();
  }

  // ── 群主转移（chat_owner_changed）──────────────────────────────────
  // 群主主动转让，new_owner 是新群主
  const ownerChanged = ctx.message?.chat_owner_changed;
  if (ownerChanged) {
    try {
      const newOwner = ownerChanged.new_owner;
      const newOwnerBotUser = await BotUser.findOneAndUpdate(
        { id: newOwner.id.toString(), proxy: proxyUser._id },
        {
          $setOnInsert: {
            userName: newOwner.username || '',
            firstName: newOwner.first_name,
            lastName: newOwner.last_name || '',
            bot: ctx.currentBot._id,
            proxy: proxyUser._id,
          },
          $addToSet: { groups: ctx.currentGroup._id },
        },
        { upsert: true, new: true },
      );
      await Group.updateOne(
        { _id: ctx.currentGroup._id },
        {
          $set: { creator: newOwnerBotUser._id },
          $pull: { operators: newOwnerBotUser._id },
        },
      );
      debug(`👑 群主转移，新群主 ${newOwner.id} 已更新到 Group.creator`);
    } catch (error) {
      debug('Error processing chat_owner_changed:', error);
    }
    return await next();
  }

  await next();
};
