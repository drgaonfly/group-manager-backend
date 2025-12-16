import { Middleware } from 'grammy';
import { MyContext } from '../types';
import { findBotProxy } from '../services/findBotProxy';
import { PermissionChecker } from '../utils/permissionChecker';
import { sendGroupWelcomeMessage } from '../../services/sendGroupWelcomeMessage';
import Group from '../../models/group';
import createDebug from 'debug';

const debug = createDebug('bot:group');

const groupResolver: Middleware<MyContext> = async (ctx, next) => {
  // 检查是否在群组中
  if (!ctx.chat || ctx.chat.type === 'private') {
    debug('请在群组中使用此命令');
    ctx.currentGroup = null;
    return await next();
  }

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
    // 如果群组不存在，创建新群组记录
    const newGroup = new Group({
      id: chatId,
      title: ctx.chat.title,
      type: ctx.chat.type,
      bot: ctx.currentBot._id, // 假设botResolver中间件已经运行并设置了currentBot
      creator: ctx.currentBotUser._id, // 假设已有用户记录
      exchange_rate: 1,
      fee_rate: 0,
      proxy: proxyUser._id,
    });

    await newGroup.save();
    ctx.currentGroup = newGroup;

    if (ctx.currentBot?.message) {
      await ctx.reply(ctx.currentBot.message || '欢迎使用机器人');
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

  // 使用 $addToSet 将当前用户添加到群组的用户列表中，避免重复添加
  await Group.updateOne(
    { _id: ctx.currentGroup._id },
    {
      $addToSet: {
        botUsers: ctx.currentBotUser._id,
      },
    },
  );

  await ctx.currentBot.updateOne({
    $addToSet: {
      // 使用 $addToSet 来避免重复添加
      groups: ctx.currentGroup._id,
    },
  });

  debug('Added user to group botUsers:', ctx.currentBotUser._id);

  // 处理新成员加入群组的欢迎消息
  if (isNewMemberJoined && ctx.message?.new_chat_members) {
    const { proxyUser } = await findBotProxy(ctx.currentBot);

    // 检查代理用户是否开启了群组欢迎功能
    if (PermissionChecker.canUseGroupWelcome(proxyUser, ctx.currentBot)) {
      const newMembers = ctx.message.new_chat_members;

      for (const member of newMembers) {
        // 跳过机器人自己
        if (member.is_bot && member.id === ctx.me.id) {
          continue;
        }

        const memberName =
          member.first_name + (member.last_name ? ` ${member.last_name}` : '');
        const username = member.username ? `@${member.username}` : memberName;

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
  }

  // 继续处理后续中间件
  await next();
};

export default groupResolver;
