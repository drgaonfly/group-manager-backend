import { Middleware } from 'grammy';
import BotUser from '../../models/botUser';
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

  const proxyUser = ctx.currentProxyUser;

  // 查询条件只使用 id 和 bot（匹配唯一索引）
  const botUser = await BotUser.findOneAndUpdate(
    {
      id: id.toString(),
      bot: ctx.currentBot._id,
    },
    {
      $setOnInsert: {
        userName: username || '',
        firstName: first_name || '',
        lastName: last_name || '',
        bot: ctx.currentBot._id,
        groups: [], // 初始化空群组数组
      },
      $set: {
        proxy: proxyUser._id, // 确保 proxy 字段是最新的
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
