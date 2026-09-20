import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import Group from '../../../../models/group';
import BotUser from '../../../../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:command:setadmin');

const setadminComposer = new Composer<MyContext>();

/**
 * /setadmin — 群主在群聊中设置/撤销群管
 *
 * 用法：
 *   回复某成员消息：/setadmin        → 设置为群管
 *                  /setadmin remove  → 撤销群管
 *
 * 权限：仅群主（Group.creator）可用
 */
setadminComposer.command('setadmin', async (ctx) => {
  // 只在群组中生效
  if (!ctx.currentGroup) return;
  if (ctx.currentGroup.type === 'channel') return;

  const senderId = ctx.from?.id;
  if (!senderId) return;

  // 权限检查：只有群主可以操作
  const group = ctx.currentGroup;
  const creator = group.creator as any;
  const creatorTgId = creator?.id ? String(creator.id) : null;

  if (!creatorTgId || String(senderId) !== creatorTgId) {
    await ctx.reply('❌ 只有群主可以使用此命令', {
      reply_parameters: { message_id: ctx.message!.message_id },
    });
    return;
  }

  // 必须回复某条消息才能知道目标用户
  const replyTo = ctx.message?.reply_to_message;
  if (!replyTo || !replyTo.from) {
    await ctx.reply(
      '💡 使用方法：回复某成员的消息，然后发送\n/setadmin — 设置为群管\n/setadmin remove — 撤销群管',
      { reply_parameters: { message_id: ctx.message!.message_id } },
    );
    return;
  }

  const targetUser = replyTo.from;

  // 不能操作机器人自己
  if (targetUser.is_bot) {
    await ctx.reply('❌ 不能对机器人执行此操作', {
      reply_parameters: { message_id: ctx.message!.message_id },
    });
    return;
  }

  // 不能操作自己
  if (targetUser.id === senderId) {
    await ctx.reply('❌ 不能对自己执行此操作', {
      reply_parameters: { message_id: ctx.message!.message_id },
    });
    return;
  }

  const proxyUser = ctx.currentProxyUser;
  const isRemove = ctx.match?.toString().trim().toLowerCase() === 'remove';

  const displayName = targetUser.username
    ? `@${targetUser.username}`
    : targetUser.first_name;

  try {
    // 查找或创建 BotUser
    const botUser = await BotUser.findOneAndUpdate(
      { id: String(targetUser.id), proxy: proxyUser._id },
      {
        $setOnInsert: {
          userName: targetUser.username || '',
          firstName: targetUser.first_name,
          lastName: targetUser.last_name || '',
          bot: ctx.currentBot._id,
          proxy: proxyUser._id,
        },
        $addToSet: { groups: group._id },
      },
      { upsert: true, new: true },
    );

    if (isRemove) {
      // 撤销群管
      await Group.updateOne(
        { _id: group._id },
        { $pull: { operators: botUser._id } },
      );
      debug(`撤销群管: ${targetUser.id} (${displayName})`);
      await ctx.reply(`✅ 已撤销 ${displayName} 的群管权限`, {
        reply_parameters: { message_id: ctx.message!.message_id },
      });
    } else {
      // 设置群管
      await Group.updateOne(
        { _id: group._id },
        { $addToSet: { operators: botUser._id } },
      );
      debug(`设置群管: ${targetUser.id} (${displayName})`);
      await ctx.reply(`✅ 已将 ${displayName} 设置为群管`, {
        reply_parameters: { message_id: ctx.message!.message_id },
      });
    }
  } catch (error) {
    debug('setadmin 操作失败:', error);
    await ctx.reply('❌ 操作失败，请稍后重试', {
      reply_parameters: { message_id: ctx.message!.message_id },
    });
  }
});

export default setadminComposer;
