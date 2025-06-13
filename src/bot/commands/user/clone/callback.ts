// src/composers/callback.ts
import { CallbackQueryContext, Composer } from 'grammy';
import createDebug from 'debug';
import { MyContext } from '../../../types';

const debug = createDebug('help:callback');

// 创建一个 Composer 实例
const callbackComposer = new Composer();

callbackComposer.callbackQuery(
  'help',
  async (ctx: CallbackQueryContext<MyContext>) => {
    const data = ctx.callbackQuery?.data;

    debug(`用户点击了按钮: ${data}`);
  },
);

export default callbackComposer;
