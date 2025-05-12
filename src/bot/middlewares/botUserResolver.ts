import { Middleware } from 'grammy';
import BotUser from '../../models/botUser';
import { MyContext } from '../types';

const botUserResolver: Middleware<MyContext> = async (ctx, next) => {
  if (!ctx.currentBot) {
    await ctx.reply('请先初始化机器人');
    return;
  }

  const { id, username, first_name, last_name } = ctx.from!;

  // 查找或创建关联用户
  const botUser = await BotUser.findOneAndUpdate(
    { id: id.toString() },
    {
      $set: {
        userName: username,
        firstName: first_name,
        lastName: last_name,
      },
    },
    { new: true, upsert: true },
  );

  ctx.currentBotUser = botUser;
  await next();
};

export default botUserResolver;
