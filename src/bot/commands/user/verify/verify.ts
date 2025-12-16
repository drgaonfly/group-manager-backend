import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { handleVerifyCallback } from '../../../../services/sendGroupVerifyMessage';
import createDebug from 'debug';

const debug = createDebug('bot:verify-callback');

const verifyCallback = new Composer<MyContext>();

// 处理验证回调
verifyCallback.callbackQuery(/^verify_/, async (ctx) => {
  debug('收到验证回调:', ctx.callbackQuery.data);

  try {
    await handleVerifyCallback(ctx, ctx.callbackQuery.data);
  } catch (error) {
    debug('处理验证回调时发生错误:', error);
    await ctx.answerCallbackQuery('处理验证时发生错误，请联系管理员');
  }
});

export default verifyCallback;
