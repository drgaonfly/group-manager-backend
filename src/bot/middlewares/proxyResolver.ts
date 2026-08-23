import { Middleware } from 'grammy';
import { MyContext } from '../types';
import User from '../../models/user';
import createDebug from 'debug';

const debug = createDebug('botProxy:Resolver');

const proxyResolver: Middleware<MyContext> = async (ctx, next) => {
  const proxyUser = await User.findById(ctx.currentBot.user);

  ctx.currentProxyUser = proxyUser;
  if (!proxyUser) {
    debug('找不到代理');
  }

  await next();
};

export default proxyResolver;
