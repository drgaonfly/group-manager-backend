// src/commands/admin/banUser.ts
import { Composer } from 'grammy';
import { MyContext } from '../../types';

const banUserCommand = new Composer<MyContext>();

banUserCommand.command('ban', async (ctx) => {
  await ctx.reply('请输入要封禁的用户ID：');
});

export default banUserCommand;
