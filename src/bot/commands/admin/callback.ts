// src/composers/callback.ts
import { Composer } from 'grammy';
import createDebug from 'debug';

const debug = createDebug('bot:admin:callback');

// 创建一个 Composer 实例
const callbackComposer = new Composer();

// 处理回调查询数据
callbackComposer.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery?.data;
  await ctx.answerCallbackQuery(`您点击了按钮: ${data}`);
  debug(`用户点击了按钮: ${data}`);
  // 根据回调数据执行相应的操作
  // 例如，根据 data 执行不同的逻辑
});

export default callbackComposer;
