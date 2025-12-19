import { Middleware } from 'grammy';
import { MyContext } from '../types';
import { findBotProxy } from '../services/findBotProxy';
import { PermissionChecker } from '../utils/permissionChecker';
import { sendGroupWelcomeMessage } from '../../services/sendGroupWelcomeMessage';
import { sendGroupVerifyMessage } from '../../services/sendGroupVerifyMessage';
import Group from '../../models/group';
import BotUser from '../../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:group');

const groupResolver: Middleware<MyContext> = async (ctx, next) => {
  // 检查是否在群组中
  if (!ctx.chat || ctx.chat.type === 'private') {
    debug('请在群组中使用此命令');
    ctx.currentGroup = null;
    return await next();
  }

  // 调试：打印完整的 message 对象
  debug('ctx.message:', JSON.stringify(ctx.message, null, 2));
  debug('ctx.update:', JSON.stringify(ctx.update, null, 2));

  // 检查是否有新成员加入群组
  const isNewMemberJoined =
    ctx.message?.new_chat_members && ctx.message.new_chat_members.length > 0;

  const chatId = ctx.chat.id;

  // 查询数据库中的群组信息
  const currentGroup = await Group.findOne({
    id: chatId,
  }).populate(['bot', 'creator', 'operators']);

  // 打印群组信息
  debug('Group info:', {
    id: ctx.chat.id,
    title: ctx.chat.title,
    type: ctx.chat.type,
  });

  const { proxyUser } = await findBotProxy(ctx.currentBot);

  if (!currentGroup) {
    if (ctx.message?.group_chat_created || ctx.message?.new_chat_members) {
      // 如果群组不存在且为群组创建事件，创建新群组记录
      const newGroup = new Group({
        id: chatId,
        title: ctx.chat.title,
        type: ctx.chat.type,
        bot: ctx.currentBot._id,
        creator: ctx.currentBotUser?._id,
        exchange_rate: 1,
        fee_rate: 0,
        proxy: proxyUser._id,
      });

      await newGroup.save();
      ctx.currentGroup = newGroup;

      await ctx.reply('感谢您把我添加到贵群!');
    } else {
      // 处理群组升级事件
      const oldChatId = ctx.message?.migrate_from_chat_id;
      const newChatId = ctx.message?.chat.id;

      if (oldChatId && newChatId) {
        debug(`🔄 检测到群组升级事件: ${oldChatId} -> ${newChatId}`);

        const updatedGroup = await Group.findOneAndUpdate(
          { id: oldChatId },
          {
            $set: {
              id: newChatId,
              type: ctx.message?.chat.type || 'supergroup',
            },
          },
          { new: true },
        );

        if (updatedGroup) {
          debug(`✅ 已更新群组 ID: ${oldChatId} -> ${newChatId}`);
        }

        ctx.currentGroup = updatedGroup;
      } else {
        ctx.currentGroup = null;
      }
    }
  } else {
    // 更新群组信息
    // 只在群组标题或类型发生变化时才更新
    if (
      currentGroup.title !== ctx.chat.title ||
      currentGroup.type !== ctx.chat.type
    ) {
      currentGroup.title = ctx.chat.title;
      currentGroup.type = ctx.chat.type;
      await currentGroup.save();
    }

    ctx.currentGroup = currentGroup;
  }

  // 如果没有群组记录，跳过后续处理
  if (!ctx.currentGroup) {
    return await next();
  }

  // 使用 $addToSet 将当前用户添加到群组的用户列表中，避免重复添加
  if (ctx.currentBotUser) {
    await Group.updateOne(
      { _id: ctx.currentGroup._id },
      {
        $addToSet: {
          botUsers: ctx.currentBotUser._id,
        },
      },
    );
  }

  await ctx.currentBot.updateOne({
    $addToSet: {
      groups: ctx.currentGroup._id,
    },
  });

  debug('Added user to group botUsers:', ctx.currentBotUser?.userName);

  // 处理成员离开事件
  if (ctx.message?.left_chat_member) {
    const leftMember = ctx.message.left_chat_member;
    debug(`Processing left member: ${leftMember.id}`);

    try {
      const botUser = await BotUser.findOne({
        id: leftMember.id.toString(),
      });

      if (botUser) {
        await Group.updateOne(
          { _id: ctx.currentGroup?._id },
          {
            $pull: {
              botUsers: botUser._id,
              operators: botUser._id,
            },
          },
        );
        debug(`Removed member ${leftMember.id} from group botUsers`);
      } else {
        debug(`BotUser not found for left member: ${leftMember.id}`);
      }
    } catch (error) {
      debug('Error processing left member:', error);
    }
  }

  // 处理新成员加入群组的欢迎消息和验证
  debug('isNewMemberJoined:', isNewMemberJoined);
  debug('new_chat_members:', ctx.message?.new_chat_members);

  if (isNewMemberJoined && ctx.message?.new_chat_members) {
    const { proxyUser } = await findBotProxy(ctx.currentBot);
    debug('Processing new members, proxyUser:', proxyUser?.name);

    const newMembers = ctx.message.new_chat_members;

    for (const member of newMembers) {
      // 跳过机器人自己
      if (member.is_bot && member.id === ctx.me.id) {
        continue;
      }

      const memberName =
        member.first_name + (member.last_name ? ` ${member.last_name}` : '');
      const username = member.username ? `@${member.username}` : memberName;

      // 处理群组验证（验证通过后会自动发送欢迎消息）
      if (PermissionChecker.canUseGroupVerify(proxyUser, ctx.currentBot)) {
        try {
          // 发送验证消息，使用新成员的 ID 来生成回调数据
          await sendGroupVerifyMessage(
            ctx,
            username,
            ctx.currentBot.groupVerify,
            member.id, // 传递新成员的 ID
          );
          debug(`Verification message sent for new member: ${username}`);
        } catch (error) {
          debug('Failed to send verification message:', error);
        }
      } else if (
        PermissionChecker.canUseGroupWelcome(proxyUser, ctx.currentBot)
      ) {
        // 没有开启验证时，直接发送欢迎消息
        try {
          await sendGroupWelcomeMessage(
            ctx,
            username,
            memberName,
            ctx.currentBot.groupWelcome,
          );
          debug(`Welcome message sent for new member: ${username}`);
        } catch (error) {
          debug('Failed to send welcome message:', error);
        }
      }
    }

    // 新成员加入消息不需要继续处理，直接返回
    // 这样可以避免 logger 中间件将其当成普通消息处理
    return;
  }

  // 继续处理后续中间件
  await next();
};

export default groupResolver;
