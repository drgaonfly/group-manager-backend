import { IBotUser } from '../../models/botUser';
import { IBotUserConfig, UserStatus } from '../../models/botUserConfig';
import { MyContext } from '../types';
import createDebug from 'debug';
import { IGroup } from '../../models/group';
import { IBot } from '../../models/bot';

const debug = createDebug('bot:checkPermission');

// 检查用户是否有权限使用机器人
const checkUserPermission = (
  group: IGroup,
  botUser: IBotUser,
  botUserConfig: IBotUserConfig,
  bot: IBot,
): boolean => {
  // 后台设置过的授权用户
  // 这是授权所有的机器人
  if (botUser.isAuthorized) return true;

  // 如果邀请进群的人也是授权用户
  if ((group.creator as IBotUser)?.isAuthorized) return true;

  // 单个机器人授权拥有者/授权用户
  // owners 和 authorized_users 可能是 ObjectId[] 或 IBotUser[]，需要统一取出 id 字符串
  const owners: string[] = (bot.owners || []).map((owner: any) =>
    owner.toString(),
  );
  const authorizedUsers: string[] = (bot.authorized_users || []).map(
    (user: any) => user.toString(),
  );

  const botUserId = botUser._id?.toString();
  const groupCreatorId = (group.creator as IBotUser)?._id?.toString();

  if (owners.includes(botUserId)) return true;
  if (owners.includes(groupCreatorId)) return true;

  if (authorizedUsers.includes(botUserId)) return true;
  if (authorizedUsers.includes(groupCreatorId)) return true;

  // 如果是授权订阅，允许使用
  if (
    botUserConfig.status === UserStatus.AUTHORIZED &&
    botUserConfig.subscriptionEndDate &&
    new Date() < new Date(botUserConfig.subscriptionEndDate)
  ) {
    return true;
  }

  // 如果是授权过期状态，不允许使用
  if (botUserConfig.status === UserStatus.SUBSCRIPTION_EXPIRED) return false;

  // 如果是试用过期状态，不允许使用
  if (botUserConfig.status === UserStatus.TRIAL_EXPIRED) return false;

  // 检查是否在试用期内
  if (botUserConfig.status === UserStatus.TRIAL && botUserConfig.trialEndDate) {
    const now = new Date();
    if (now < new Date(botUserConfig.trialEndDate)) {
      return true;
    }
  }

  return false;
};

/**
 * 检查机器人是否已到期的中间件，仅对 custom 类型 bot 生效
 */
/**
 * 检查传入 bot 是否已到期
 * @param bot
 * @returns {boolean} true 表示已到期，false 表示未到期
 */
export function isBotExpired(bot: IBot): boolean {
  // 仅 custom 类型 bot 需要检查过期
  if (bot.type !== 'custom') {
    return false;
  }

  // 如果没有设置到期时间，或者明确标记未过期，则未到期
  if (!bot.expireAt || !bot.isExpired) {
    return false;
  }

  // 检查是否已到期
  const now = new Date();
  if (bot.isExpired || (bot.expireAt && now > new Date(bot.expireAt))) {
    return true;
  }

  return false;
}

export const checkPermission = async (
  ctx: MyContext,
  next: () => Promise<void>,
) => {
  debug('checkBillPermission');
  const botUser = ctx.currentBotUser;
  const group = ctx.currentGroup;
  const botUserConfig = ctx.currentBotUserConfig;
  const bot = ctx.currentBot;

  if (!ctx.chat || ctx.chat.type !== 'private') {
    debug('在群里使用机器人');

    if (!checkUserPermission(group, botUser, botUserConfig, bot)) {
      ctx.reply('您没有权限或权限已过期，请打开机器人申请使用或联系客服授权', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '点击申请使用', url: `https://t.me/${ctx.me.username}` }],
          ],
        },
      });
      return;
    }

    if (isBotExpired(bot)) {
      ctx.reply('机器人已到期，请续费或联系管理员', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📞 联系客服',
                url: bot.customer_service_link || 'https://t.me/example',
              },
            ],
          ],
        },
      });
      return;
    }
  }

  await next();
};
