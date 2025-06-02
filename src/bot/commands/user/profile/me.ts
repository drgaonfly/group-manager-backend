import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { useUserProfile } from '../../../../utils/useEjsMessage';
import { checkInBot } from '../../../../bot/middlewares/checkInBot';
import { renewalOptions } from '../../../../models/subscription';
import dayjs from 'dayjs';
import profile from '../../../menus/inline/profile';
import createDebug from 'debug';
import { checkBotCustom } from '../../../../bot/middlewares/checkBotCustom';
const userProfileCommand = new Composer<MyContext>();
const debug = createDebug('bot:user-profile');

userProfileCommand.command(
  'profile',
  checkInBot,
  checkBotCustom,
  async (ctx) => {
    debug('用户中心命令被触发');
    await sendUserProfile(ctx);
  },
);

// 监听"用户中心"文本消息
userProfileCommand.hears(
  /个人信息/,
  checkInBot,
  checkBotCustom,
  async (ctx) => {
    debug('用户中心命令被触发');
    await sendUserProfile(ctx);
  },
);

async function sendUserProfile(ctx: MyContext) {
  // 查找用户信息
  const botUser = ctx.currentBotUser;
  const botUserConfig = ctx.currentBotUserConfig;

  // 格式化注册日期
  const registerDate = dayjs(botUserConfig.createdAt).format(
    'YYYY-MM-DD HH:mm:ss',
  );
  // 渲染用户资料模板
  const renderUserProfile = useUserProfile();

  // 获取当前套餐的 label
  let currentPlanLabel = '无';
  if (botUserConfig.currentPlan && renewalOptions[botUserConfig.currentPlan]) {
    currentPlanLabel = renewalOptions[botUserConfig.currentPlan].label;
  } else if (botUserConfig.currentPlan) {
    currentPlanLabel = botUserConfig.currentPlan;
  }

  const message = await renderUserProfile({
    userId: botUser.id,
    userName: botUser.userName,
    nickname: `${botUser.firstName || ''} ${botUser.lastName || ''}`.trim(),
    registerDate,
    currentBalance: botUserConfig.balance,
    botUserConfig,
    currentPlan: currentPlanLabel,
    bot: ctx.currentBot,
  });
  // 添加联系客服按钮，使用url参数直接跳转到客服链接
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: profile,
  });
}

export default userProfileCommand;
