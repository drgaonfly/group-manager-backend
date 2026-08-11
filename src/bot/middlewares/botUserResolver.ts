import { Middleware } from 'grammy';
import BotUser from '../../models/botUser';
import { findBotProxy } from '../services/findBotProxy';
import { MyContext } from '../types';

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

  // 先查找现有用户，用于检测信息

  // 查找或创建关联用户，使用新架构
  const botUser = await BotUser.findOneAndUpdate(
    {
      id: id.toString(),
      proxy: proxyUser._id,
    },
    {
      $setOnInsert: {
        userName: username || '',
        firstName: first_name || '',
        lastName: last_name || '',
        bot: ctx.currentBot._id,
        proxy: proxyUser._id,
        groups: [], // 初始化空群组数组
      },
    },
    { new: true, upsert: true },
  ).populate('subscriptions');

  // 移除旧架构：不再更新 Bot.botUsers
  // await ctx.currentBot.updateOne({
  //   $addToSet: {
  //     botUsers: botUser._id,
  //   },
  // });

  ctx.currentBotUser = botUser;

  await next();
};

export default botUserResolver;
