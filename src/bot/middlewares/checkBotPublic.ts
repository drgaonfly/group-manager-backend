import { MyContext } from '../types';
import createDebug from 'debug';

const debug = createDebug('bot:checkBotPublic');

export const checkBotPublic = async (
  ctx: MyContext,
  next: () => Promise<void>,
) => {
  debug('checkBotPublic');

  // 检查 bot 类型是否为 public
  const bot = ctx.currentBot;
  if (bot.type !== 'public') {
    debug('该功能仅对公共机器人开放');
    ctx.reply('该功能仅对公共机器人开放');
    return;
  }

  await next();
};
