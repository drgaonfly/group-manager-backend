import { Middleware } from 'grammy';
import BotUserConfig from '../../models/botUserConfig';
import { MyContext } from '../types';
import { findBotProxy } from '../services/findBotProxy';

const botUserConfigResolver: Middleware<MyContext> = async (ctx, next) => {
  if (!ctx.currentBot) {
    await ctx.reply('请先初始化机器人');
    return;
  }

  if (!ctx.currentBotUser) {
    // await ctx.reply('请先初始化用户');
    return;
  }

  const { proxyUser } = await findBotProxy(ctx.currentBot);

  // 查找或创建用户配置
  const botUserConfig = await BotUserConfig.findOneAndUpdate(
    {
      botUser: ctx.currentBotUser._id,
      bot: ctx.currentBot._id,
    },
    {
      $setOnInsert: {
        botUser: ctx.currentBotUser._id,
        bot: ctx.currentBot._id,
        proxy: proxyUser._id,
      },
    },
    { new: true, upsert: true },
  );

  ctx.currentBotUserConfig = botUserConfig;

  await next();
};

export default botUserConfigResolver;
