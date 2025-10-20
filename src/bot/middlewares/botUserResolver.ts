import { Middleware } from 'grammy';
import BotUser from '../../models/botUser';
import { findBotProxy } from '../services/findBotProxy';
import { MyContext } from '../types';

const botUserResolver: Middleware<MyContext> = async (ctx, next) => {
  if (!ctx.currentBot) {
    await ctx.reply('请先初始化机器人');
    return;
  }

  const { id, username, first_name, last_name } = ctx.from!;

  const { proxyUser } = await findBotProxy(ctx.currentBot);

  // 查找或创建关联用户
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
