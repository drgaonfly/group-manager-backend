import { Middleware } from 'grammy';
import BotUser from '../../models/botUser';
import { findBotProxy } from '../services/findBotProxy';
import { MyContext } from '../types';
import { PermissionChecker } from '../utils/permissionChecker';

const botUserResolver: Middleware<MyContext> = async (ctx, next) => {
  if (!ctx.currentBot) {
    await ctx.reply('请先初始化机器人');
    return;
  }

  // 系统消息（如新成员加入）可能没有 from
  if (!ctx.from) {
    return await next();
  }

  const { id, username, first_name, last_name } = ctx.from;

  const { proxyUser } = await findBotProxy(ctx.currentBot);

  // 先查找现有用户，用于检测信息变更
  const existingUser = await BotUser.findOne({ id: id.toString() });

  // 查找或创建关联用户，并填充 subscriptions 字段
  const botUser = await BotUser.findOneAndUpdate(
    { id: id.toString() },
    {
      $set: {
        userName: username,
        firstName: first_name,
        lastName: last_name,
        proxy: proxyUser._id,
      },
    },
    { new: true, upsert: true },
  ).populate('subscriptions');

  // 检测用户信息变更并报告到群组
  if (
    existingUser &&
    ctx.chat &&
    ctx.chat.type !== 'private' &&
    PermissionChecker.canReportMemberNameUpdated(proxyUser, ctx.currentBot)
  ) {
    const changes: string[] = [];

    if (
      existingUser.userName !== username &&
      (existingUser.userName || username)
    ) {
      changes.push(`用户名: @${existingUser.userName} → @${username}`);
    }
    if (
      existingUser.firstName !== first_name &&
      (existingUser.firstName || first_name)
    ) {
      changes.push(`名字: ${existingUser.firstName} → ${first_name}`);
    }
    if (
      existingUser.lastName !== last_name &&
      (existingUser.lastName || last_name)
    ) {
      changes.push(`姓氏: ${existingUser.lastName} → ${last_name}`);
    }

    if (changes.length > 0) {
      const message = [`🔔 用户信息变更 (ID: ${id})`, ...changes].join('\n');
      await ctx.reply(message);
    }
  }

  // 将当前用户添加到机器人的用户列表中
  await ctx.currentBot.updateOne({
    $addToSet: {
      // 使用 $addToSet 来避免重复添加
      botUsers: botUser._id,
    },
  });

  ctx.currentBotUser = botUser;

  await next();
};

export default botUserResolver;
