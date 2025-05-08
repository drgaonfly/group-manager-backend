import { Middleware } from 'grammy';
import Bot from '../../models/bot';
import { MyContext } from '../types';
import createDebug from 'debug';

const debug = createDebug('bot:error');

const botResolver: Middleware<MyContext> = async (ctx, next) => {
  // 从Webhook路径或消息中获取机器人token
  const token = ctx.api.token;

  if (!token) {
    await ctx.reply('无效的机器人访问令牌');
    return;
  }

  try {
    // 查询数据库中的机器人
    const currentBot = await Bot.findOne({
      token,
      isOnline: true,
    }).populate('user');

    if (!currentBot) {
      await ctx.reply('机器人已离线或不存在');
      return;
    }

    // 更新机器人元信息
    currentBot.userName = ctx.me?.username || currentBot.userName;
    currentBot.botName = ctx.me?.first_name || currentBot.botName;
    currentBot.id = ctx.me?.id || currentBot.id;
    await currentBot.save();

    // 附加到上下文
    ctx.currentBot = currentBot;

    // 继续处理后续中间件
    await next();
  } catch (error) {
    debug('机器人解析失败: %O', error);
    await ctx.reply('机器人初始化失败，请联系管理员');
  }
};

export default botResolver;
