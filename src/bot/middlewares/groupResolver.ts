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
  // 检查是否在群组或频道中
  if (!ctx.chat || ctx.chat.type === 'private') {
    debug('请在群组或频道中使用此命令');
    ctx.currentGroup = null;
    return await next();
  }

  // 调试：打印完整的 message 对象
  debug('ctx.message:', JSON.stringify(ctx.message, null, 2));
  debug('ctx.update:', JSON.stringify(ctx.update, null, 2));

  // 检查是否是机器人自己被添加到频道/群组（my_chat_member 事件）
  const myChatMemberUpdate = ctx.myChatMember;
  const isBotAddedToChat =
    myChatMemberUpdate &&
    ['left', 'kicked'].includes(myChatMemberUpdate.old_chat_member.status) &&
    ['member', 'administrator', 'creator'].includes(
      myChatMemberUpdate.new_chat_member.status,
    );

  // 检查是否有新成员加入群组
  // 在 supergroup 中，新成员事件通过 chat_member update 传递
  const chatMemberUpdate = ctx.chatMember;
  const isNewMemberFromChatMember =
    chatMemberUpdate &&
    chatMemberUpdate.old_chat_member.status === 'left' &&
    ['member', 'administrator', 'creator'].includes(
      chatMemberUpdate.new_chat_member.status,
    );

  // 普通群组仍然使用 message.new_chat_members
  const isNewMemberJoined =
    isNewMemberFromChatMember ||
    (ctx.message?.new_chat_members && ctx.message.new_chat_members.length > 0);

  const chatId = ctx.chat.id;

  // 查询数据库中的群组信息
  let currentGroup = await Group.findOne({
    id: chatId,
  }).populate(['bot', 'creator', 'operators']);

  // 如果找不到，尝试用 title 和 bot 匹配（处理群组升级后 ID 变化的情况）
  if (!currentGroup && ctx.chat.type === 'supergroup') {
    const groupByTitle = await Group.findOne({
      title: ctx.chat.title,
      bot: ctx.currentBot._id,
      type: 'group', // 找升级前的普通群组
    }).populate(['bot', 'creator', 'operators']);

    if (groupByTitle) {
      debug(`🔄 检测到群组升级: ${groupByTitle.id} -> ${chatId}`);
      // 更新群组 ID、类型和用户名（有则填上）
      groupByTitle.id = chatId;
      groupByTitle.type = 'supergroup';
      groupByTitle.username = ctx.chat.username ?? '';
      await groupByTitle.save();
      currentGroup = groupByTitle;
      debug(`✅ 已更新群组 ID 和类型`);
    }
  }

  // 打印群组信息
  debug('Group info:', {
    id: ctx.chat.id,
    title: ctx.chat.title,
    type: ctx.chat.type,
  });

  const { proxyUser } = await findBotProxy(ctx.currentBot);

  if (!currentGroup) {
    // 判断是否应该创建新群组记录
    // 1. 群组创建事件
    // 2. 新成员加入事件（包括机器人被添加到群组）
    // 3. 机器人被添加到频道（my_chat_member 事件）
    const shouldCreateGroup =
      ctx.message?.group_chat_created ||
      ctx.message?.new_chat_members ||
      (isBotAddedToChat && ctx.chat.type === 'channel');

    if (shouldCreateGroup) {
      // 如果群组不存在且为群组创建事件，创建新群组记录
      const newGroup = new Group({
        id: chatId,
        title: ctx.chat.title,
        username: ctx.chat.username ?? '',
        type: ctx.chat.type,
        bot: ctx.currentBot._id,
        creator: ctx.currentBotUser?._id,
        exchange_rate: 1,
        fee_rate: 0,
        proxy: proxyUser._id,
      });

      await newGroup.save();
      ctx.currentGroup = newGroup;

      // 频道和群组使用不同的欢迎消息
      if (ctx.chat.type === 'channel') {
        debug(`✅ 已创建频道记录: ${ctx.chat.title} (${chatId})`);
        // 频道中不发送欢迎消息，因为机器人通常没有发送权限
      } else {
        await ctx.reply('感谢您把我添加到贵群!');
      }
    } else {
      // 处理群组升级事件
      const oldChatId = ctx.message?.migrate_from_chat_id;
      const newChatId = ctx.message?.chat.id;

      if (oldChatId && newChatId) {
        debug(`🔄 检测到群组升级事件: ${oldChatId} -> ${newChatId}`);

        const updatePayload = {
          id: newChatId,
          type: ctx.message?.chat.type || 'supergroup',
          username: ctx.message?.chat.username ?? '',
        };
        const updatedGroup = await Group.findOneAndUpdate(
          { id: oldChatId },
          { $set: updatePayload },
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
    // 只在群组标题、类型或用户名发生变化时才更新
    const chatUsername = ctx.chat.username ?? '';
    const groupUsername = currentGroup.username ?? '';
    if (
      currentGroup.title !== ctx.chat.title ||
      currentGroup.type !== ctx.chat.type ||
      groupUsername !== chatUsername
    ) {
      currentGroup.title = ctx.chat.title;
      currentGroup.type = ctx.chat.type;
      currentGroup.username = chatUsername;
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

  // 处理频道订阅/取消订阅事件
  if (ctx.chat.type === 'channel' && chatMemberUpdate) {
    const oldStatus = chatMemberUpdate.old_chat_member.status;
    const newStatus = chatMemberUpdate.new_chat_member.status;
    const user = chatMemberUpdate.new_chat_member.user;

    // 用户订阅频道
    const isChannelSubscribed =
      ['left', 'kicked'].includes(oldStatus) &&
      ['member', 'administrator', 'creator'].includes(newStatus);

    // 用户取消订阅频道
    const isChannelUnsubscribed =
      ['member', 'administrator', 'creator'].includes(oldStatus) &&
      ['left', 'kicked'].includes(newStatus);

    if (isChannelSubscribed) {
      debug(`📢 用户订阅频道: ${user.id} (${user.first_name})`);

      try {
        // 查找或创建 BotUser
        let botUser = await BotUser.findOne({ id: user.id.toString() });

        if (!botUser) {
          botUser = new BotUser({
            id: user.id.toString(),
            userName: user.username || '',
            firstName: user.first_name,
            lastName: user.last_name || '',
            bot: ctx.currentBot._id,
          });
          await botUser.save();
          debug(`✅ 创建新 BotUser: ${user.id}`);
        }

        // 将用户添加到频道的 botUsers 列表
        await Group.updateOne(
          { _id: ctx.currentGroup._id },
          {
            $addToSet: {
              botUsers: botUser._id,
            },
          },
        );
        debug(`✅ 用户 ${user.id} 已添加到频道订阅者列表`);
      } catch (error) {
        debug('处理频道订阅事件失败:', error);
      }

      return;
    }

    if (isChannelUnsubscribed) {
      debug(`📢 用户取消订阅频道: ${user.id} (${user.first_name})`);

      try {
        const botUser = await BotUser.findOne({ id: user.id.toString() });

        if (botUser) {
          await Group.updateOne(
            { _id: ctx.currentGroup._id },
            {
              $pull: {
                botUsers: botUser._id,
              },
            },
          );
          debug(`✅ 用户 ${user.id} 已从频道订阅者列表移除`);
        }
      } catch (error) {
        debug('处理频道取消订阅事件失败:', error);
      }

      return;
    }
  }

  // 处理成员离开事件（群组）
  // 在 supergroup 中，离开事件通过 chat_member update 传递
  const isMemberLeft =
    (chatMemberUpdate &&
      ['member', 'administrator', 'creator'].includes(
        chatMemberUpdate.old_chat_member.status,
      ) &&
      chatMemberUpdate.new_chat_member.status === 'left') ||
    ctx.message?.left_chat_member;

  if (isMemberLeft && ctx.chat.type !== 'channel') {
    // 获取离开成员的 ID
    const leftMemberId =
      chatMemberUpdate?.new_chat_member.user.id ||
      ctx.message?.left_chat_member?.id;

    if (leftMemberId) {
      debug(`Processing left member: ${leftMemberId}`);

      try {
        const botUser = await BotUser.findOne({
          id: leftMemberId.toString(),
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
          debug(`Removed member ${leftMemberId} from group botUsers`);
        } else {
          debug(`BotUser not found for left member: ${leftMemberId}`);
        }
      } catch (error) {
        debug('Error processing left member:', error);
      }
    }
  }

  // 处理新成员加入群组的欢迎消息和验证
  debug('isNewMemberJoined:', isNewMemberJoined);
  debug('isNewMemberFromChatMember:', isNewMemberFromChatMember);
  debug('new_chat_members:', ctx.message?.new_chat_members);
  debug('chatMemberUpdate:', chatMemberUpdate);

  if (isNewMemberJoined) {
    const { proxyUser } = await findBotProxy(ctx.currentBot);
    debug('Processing new members, proxyUser:', proxyUser?.name);

    // 构建新成员列表，支持两种来源
    type NewMember = {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };

    const newMembers: NewMember[] = [];

    // 从 chat_member update 获取（supergroup）
    if (isNewMemberFromChatMember && chatMemberUpdate) {
      const user = chatMemberUpdate.new_chat_member.user;
      newMembers.push({
        id: user.id,
        is_bot: user.is_bot,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
      });
    }

    // 从 message.new_chat_members 获取（普通群组）
    if (ctx.message?.new_chat_members) {
      for (const member of ctx.message.new_chat_members) {
        // 避免重复添加
        if (!newMembers.some((m) => m.id === member.id)) {
          newMembers.push({
            id: member.id,
            is_bot: member.is_bot,
            first_name: member.first_name,
            last_name: member.last_name,
            username: member.username,
          });
        }
      }
    }

    for (const member of newMembers) {
      // 跳过机器人自己
      if (member.is_bot && member.id === ctx.me.id) {
        debug('Skipping bot itself');
        continue;
      }

      const memberName =
        member.first_name + (member.last_name ? ` ${member.last_name}` : '');
      const username = member.username ? `@${member.username}` : memberName;

      debug(`Processing member: ${username} (ID: ${member.id})`);
      debug('Bot groupVerify:', ctx.currentBot.groupVerify);
      debug('Bot groupWelcome:', ctx.currentBot.groupWelcome);
      debug(
        'canUseGroupVerify:',
        PermissionChecker.canUseGroupVerify(proxyUser, ctx.currentBot),
      );
      debug(
        'canUseGroupWelcome:',
        PermissionChecker.canUseGroupWelcome(proxyUser, ctx.currentBot),
      );

      // 处理群组验证（验证通过后会自动发送欢迎消息）
      if (PermissionChecker.canUseGroupVerify(proxyUser, ctx.currentBot)) {
        debug('Attempting to send verification message...');
        try {
          // 发送验证消息，使用新成员的 ID 来生成回调数据
          await sendGroupVerifyMessage(
            ctx,
            username,
            ctx.currentBot.groupVerify,
            member.id, // 传递新成员的 ID
          );
          debug(`✅ Verification message sent for new member: ${username}`);
        } catch (error) {
          debug('❌ Failed to send verification message:', error);
        }
      } else if (
        PermissionChecker.canUseGroupWelcome(proxyUser, ctx.currentBot)
      ) {
        // 没有开启验证时，直接发送欢迎消息
        debug('Attempting to send welcome message...');
        try {
          await sendGroupWelcomeMessage(
            ctx,
            username,
            memberName,
            ctx.currentBot.groupWelcome,
          );
          debug(`✅ Welcome message sent for new member: ${username}`);
        } catch (error) {
          debug('❌ Failed to send welcome message:', error);
        }
      } else {
        debug('⚠️ No welcome or verify permission, skipping message');
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
