import { Middleware } from 'grammy';
import Bot from '../../models/bot';
import '../../models/groupWelcome';
import '../../models/groupVerify';
import { MyContext } from '../types';
import createDebug from 'debug';
// import { startClientAndGetSession } from '../services/gramClient';

const debug = createDebug('bot:Resolver');

const botResolver: Middleware<MyContext> = async (ctx, next) => {
  // 从Webhook路径或消息中获取机器人token
  const token = ctx.api.token;

  if (!token) {
    await ctx.reply('无效的机器人访问令牌');
    return;
  }
  // 查询数据库中的机器人
  // 先查询机器人基本信息,避免User模型未注册的错误
  const currentBot = await Bot.findOne({
    token,
    isOnline: true,
  })
    .populate('groupWelcome')
    .populate('groupVerify');

  if (!currentBot) {
    await ctx.reply('机器人已离线或不存在');
    return;
  }

  // 打印机器人信息
  debug('Bot info:', {
    username: ctx.me?.username,
    firstName: ctx.me?.first_name,
    id: ctx.me?.id,
  });

  // 更新机器人元信息
  currentBot.userName = ctx.me?.username || currentBot.userName;
  currentBot.botName = ctx.me?.first_name || currentBot.botName;
  currentBot.id = ctx.me?.id || currentBot.id;
  await currentBot.save();

  // 附加到上下文
  ctx.currentBot = currentBot;
  ctx.currentBotSession = currentBot.session;

  // 继续处理后续中间件
  await next();
};

export default botResolver;
