// src/commands/admin/banUser.ts
import { Composer } from 'grammy';
import { MyContext } from '../../types';
import { adminMenu } from '../../menus/adminMenu';

const banUserCommand = new Composer<MyContext>();

banUserCommand.command('ban', async (ctx) => {
  ctx.session.step = 'admin_action';
  ctx.session.admin = { targetUserId: ctx.from?.id };
  await ctx.reply('请输入要封禁的用户ID：', { reply_markup: adminMenu });
});

export default banUserCommand;
