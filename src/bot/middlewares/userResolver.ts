import { Middleware } from 'grammy';
import BotUser from '../../models/botUser';
import { MyContext } from '../types';

const userResolver: Middleware<MyContext> = async (ctx, next) => {
  if (!ctx.currentBot) {
    await ctx.reply('请先初始化机器人');
    return;
  }

  try {
    const { id, username, first_name, last_name } = ctx.from!;

    // 查找或创建关联用户
    const botUser = await BotUser.findOneAndUpdate(
      { id: id.toString() },
      {
        $set: {
          userName: username,
          firstName: first_name,
          lastName: last_name,
          bot: ctx.currentBot._id,
          user: ctx.currentBot.user,
        },
      },
      { new: true, upsert: true },
    );

    ctx.botUser = botUser;
    await next();
  } catch (error) {
    console.error('用户解析失败:', error);
    await ctx.reply('用户信息加载失败，请重试');
  }
};

export default userResolver;
