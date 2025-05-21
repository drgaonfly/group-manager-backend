import { Composer } from 'grammy';
import { Context } from 'grammy';
import { MyContext } from '../../../types';
import path from 'path';
import ejs from 'ejs';

const helpCommand = new Composer<Context & MyContext>();

helpCommand.command('help', async (ctx) => {
  // 渲染帮助信息模板
  const templatePath = path.join(__dirname, '../../../../templates/help.ejs');
  const helpText = await ejs.renderFile(templatePath);

  await ctx.reply(helpText, { parse_mode: 'HTML' });
});

export default helpCommand;
