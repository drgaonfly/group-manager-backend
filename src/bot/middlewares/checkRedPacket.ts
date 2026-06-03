import { MyContext } from '../types';
import { findBotProxy } from '../services/findBotProxy';
import { PermissionChecker } from '../utils/permissionChecker';
import createDebug from 'debug';

const debug = createDebug('bot:checkRedPacket');

export const checkRedPacket = async (
  ctx: MyContext,
  next: () => Promise<void>,
) => {
  const { proxyUser } = await findBotProxy(ctx.currentBot);

  if (!PermissionChecker.canUseRedPacket(proxyUser, ctx.currentBot)) {
    debug('未启用红包功能');
    return;
  }
  await next();
};
