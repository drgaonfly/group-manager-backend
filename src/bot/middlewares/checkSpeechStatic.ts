import { MyContext } from '../types';
import { findBotProxy } from '../services/findBotProxy';
import { PermissionChecker } from '../utils/permissionChecker';
import createDebug from 'debug';

const debug = createDebug('bot:checkSpeechStatic');

export const checkSpeechStatic = async (
  ctx: MyContext,
  next: () => Promise<void>,
) => {
  const { proxyUser } = await findBotProxy(ctx.currentBot);

  if (!PermissionChecker.canUseSpeechStatic(proxyUser, ctx.currentBot)) {
    debug('未启用群内统计');
    // ctx.reply('请在群组中使用此命令');
    return;
  } else {
    await next();
  }
};
