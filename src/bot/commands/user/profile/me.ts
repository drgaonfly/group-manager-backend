import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import { useUserProfile } from '../../../../utils/useEjsMessage';

const userProfileCommand = new Composer<MyContext>();
const debug = createDebug('bot:user-profile');

// 监听"用户中心"文本消息
userProfileCommand.hears(/个人信息/, async (ctx) => {
  debug('用户中心命令被触发');

  // 查找用户信息
  const botUser = ctx.currentBotUser;

  // 格式化注册日期
  const registerDate = botUser.createdAt.toISOString().split('T')[0];

  // 渲染用户资料模板
  const renderUserProfile = useUserProfile();

  const message = await renderUserProfile({
    userId: botUser.id,
    userName: botUser.userName,
    registerDate,
    totalPurchase: 0,
    // currentBalance: botUser,
  });

  // 添加联系客服按钮，使用url参数直接跳转到客服链接
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: ctx.currentBot.customer_service_link
      ? {
          inline_keyboard: [
            [
              {
                text: '📞 联系客服',
                url: ctx.currentBot.customer_service_link,
              },
            ],
          ],
        }
      : undefined,
  });
});

export default userProfileCommand;
