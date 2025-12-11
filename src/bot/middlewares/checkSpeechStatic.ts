import { MyContext } from '../types';
import { findBotProxy } from '../services/findBotProxy';
import createDebug from 'debug';

const debug = createDebug('bot:checkSpeechStatic');

export const checkSpeechStatic = async (
  ctx: MyContext,
  next: () => Promise<void>,
) => {
  const { proxyUser } = await findBotProxy(ctx.currentBot);

  if (!proxyUser.speech_static) {
    debug('未启用群内统计');
    // ctx.reply('请在群组中使用此命令');
    return;
  } else {
    await next();
  }
};
