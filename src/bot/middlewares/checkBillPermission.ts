import { MyContext } from '../types';
import createDebug from 'debug';

const debug = createDebug('bot:checkBillPermission');

export const checkBillPermission = async (
  ctx: MyContext,
  next: () => Promise<void>,
) => {
  debug('checkBillPermission');
  const botUser = ctx.currentBotUser;
  if (!ctx.chat || ctx.chat.type !== 'private') {
    debug('在群里使用机器人');
    // TODO 检查用户是否有权限使用机器人
    if (!botUser.isAuthorized) {
      ctx.reply('您没有权限或权限已过期，请打开机器人申请使用或联系客服授权', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '点击申请使用', url: `https://t.me/${ctx.me.username}` }],
          ],
        },
      });
      return;
    }
  }

  await next();
};
