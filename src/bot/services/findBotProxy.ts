import { IBot } from '../../models/bot';
import BotUser from '../../models/botUser';
import BotUserConfig from '../../models/botUserConfig';
import User from '../../models/user';

export async function findBotProxy(bot: IBot) {
  // 查找代理电报用户
  const proxyBotUser = await BotUser.findById(bot.botUser);

  // 查找代理电报用户配置
  const proxyBotUserConfig = await BotUserConfig.findOne({
    bot: bot._id,
    botUser: bot.botUser,
  });

  // 查找代理用户
  const proxyUser = await User.findById(bot.user);

  return {
    proxyBotUser,
    proxyBotUserConfig,
    proxyUser,
  };
}
