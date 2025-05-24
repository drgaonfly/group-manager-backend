// src/composers/callback.ts
import { CallbackQueryContext, Composer } from 'grammy';
import createDebug from 'debug';
import { MyContext } from '../../../types';
import { handleContactCommand } from './contact';

const debug = createDebug('contact:callback');

// 创建一个 Composer 实例
const callbackComposer = new Composer();

callbackComposer.callbackQuery(
  'contact',
  async (ctx: CallbackQueryContext<MyContext>) => {
    debug(ctx.callbackQuery?.data);
    await handleContactCommand(ctx);
    await ctx.answerCallbackQuery();
  },
);

export default callbackComposer;
