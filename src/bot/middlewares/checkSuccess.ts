import { MyContext } from '../types';
import { findBotProxy } from '../services/findBotProxy';
import { PermissionChecker } from '../utils/permissionChecker';
import createDebug from 'debug';

const debug = createDebug('bot:checkSuccess');

export const checkSuccess = async (
  ctx: MyContext,
  next: () => Promise<void>,
) => {
  const { proxyUser } = await findBotProxy(ctx.currentBot);

  if (!PermissionChecker.canUseSuccess(proxyUser, ctx.currentBot)) {
    debug('未启用积分继承功能');
    return;
  }
  await next();
};
