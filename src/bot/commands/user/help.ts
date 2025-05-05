import { Composer } from 'grammy';
import { Context } from 'grammy';
import { MyContext } from '../../types';

const helpCommand = new Composer<Context & MyContext>();

helpCommand.command('help', async (ctx) => {
  await ctx.reply(
    '可用命令:\n/start - 开始使用机器人\n/help - 查看帮助信息\n/collect - 收集数据\n/register - 注册',
  );
});

export default helpCommand;
