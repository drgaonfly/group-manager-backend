import { Composer } from 'grammy';
import { MyContext } from '../../../types';

const grantAdminCommand = new Composer<MyContext>();

grantAdminCommand.callbackQuery('how_to_grant_admin', async (ctx) => {
  await ctx.answerCallbackQuery({
    text: [
      '💡 授权方式：',
      '在群组中把成员设置为管理员，',
      '该成员即可登录后台管理对应的群。',
      '撤销管理员则同步失去后台权限。',
    ].join('\n'),
    show_alert: true,
  });
});

export default grantAdminCommand;
