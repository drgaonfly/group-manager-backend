// src/composers/callback.ts
import { CallbackQueryContext, Composer } from 'grammy';
import createDebug from 'debug';
import { handleRenewalMessage } from './renewal';
import { MyContext } from '../../../types';

const debug = createDebug('help:callback');

// 创建一个 Composer 实例
const callbackComposer = new Composer();

callbackComposer.callbackQuery(
  'auto_renew',
  async (ctx: CallbackQueryContext<MyContext>) => {
    const data = ctx.callbackQuery?.data;

    debug(`用户点击了按钮: ${data}`);
    // await ctx.answerCallbackQuery(`您点击了按钮: ${data}`);
    await handleRenewalMessage(ctx);
  },
);

export default callbackComposer;
