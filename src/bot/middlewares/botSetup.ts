import { Bot } from 'grammy';
import logger from './logger';
import adminComposer from '../commands/admin';
import userComposer from '../commands/user';
import errorHandler from './errorHandler';
import { commandsList } from '../commandsList';

export const setupBot = (bot: Bot) => {
  bot.use(errorHandler);
  bot.use(logger);
  bot.use(userComposer.middleware());
  bot.use(adminComposer.middleware());

  // bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

  // 回复任何消息 "Hi there!"。
  bot.on('message', (ctx) => ctx.reply('Hi there!'));

  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery?.data;
    await ctx.answerCallbackQuery(`您点击了按钮: ${data}`);
  });

  bot.api
    .setMyCommands(commandsList)
    .then(() => {
      console.log('命令已设置成功');
    })
    .catch((error) => {
      console.error('设置命令时发生错误:', error);
    });
};
