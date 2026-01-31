import { Middleware } from 'grammy';
import { MyContext } from '../types';
import { findBotProxy } from '../services/findBotProxy';
import createDebug from 'debug';

const debug = createDebug('botProxy:Resolver');

const proxyResolver: Middleware<MyContext> = async (ctx, next) => {
  const currentBot = ctx.currentBot;

  const { proxyUser, proxyBotUser, proxyBotUserConfig } =
    await findBotProxy(currentBot);

  ctx.currentProxyUser = proxyUser;
  if (!proxyUser) {
    debug('找不到代理');
  }

  ctx.currentProxyBotUser = proxyBotUser;
  if (!proxyBotUser) {
    debug('找不到代理机器人');
  }

  ctx.currentProxyBotUserConfig = proxyBotUserConfig;
  if (!proxyBotUserConfig) {
    debug('找不到代理机器人配置');
  }

  // 继续处理后续中间件
  await next();
};

export default proxyResolver;
