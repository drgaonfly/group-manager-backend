import { Composer } from 'grammy';
import { MyContext } from '../../../types';

const presetCommand = new Composer<MyContext>();

presetCommand.on('message:text', async (ctx, next) => {
  const presets = ctx.currentBot?.presets || [];
  const text = ctx.message.text?.trim();

  for (const item of presets) {
    if (item.keyword && text.includes(item.keyword)) {
      await ctx.reply(item.response, { parse_mode: 'HTML' });
      return;
    }
  }

  await next();
});

export default presetCommand;
