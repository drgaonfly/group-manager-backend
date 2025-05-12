import { Composer } from 'grammy';
import { MyContext } from '../../types';
import createDebug from 'debug';

const initiateCommand = new Composer<MyContext>();

const debug = createDebug('bot:initiate');

initiateCommand.hears(/^开始$/, async (ctx) => {
  debug('initiate');

  ctx.currentGroup.isOnline = true;

  await ctx.currentGroup.save();

  await ctx.reply('我已在记录账单啦');
});

export default initiateCommand;
