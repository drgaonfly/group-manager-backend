import { IBotUser } from '../../models/botUser';
import { MyContext } from '../types';
import createDebug from 'debug';

const debug = createDebug('bot:checkBotOwner');

/**
 * 检查当前用户是否为机器人的 owner
 */
export const isBotOwner = async (ctx: MyContext, next: () => Promise<void>) => {
  const currentBot = ctx.currentBot;
  const currentBotUser = ctx.currentBotUser;

  if (!currentBot || !currentBotUser) {
    await ctx.reply('无法获取机器人或用户信息');
    return;
  }

  const ownerIdStr = currentBot.owner?.toString();
  const currentBotUserIdStr = currentBotUser._id?.toString();
  const isOwner =
    ownerIdStr && currentBotUserIdStr && ownerIdStr === currentBotUserIdStr;

  debug('当前用户ID:', currentBotUserIdStr);
  debug('Owner ID:', ownerIdStr);
  debug('是否为 Owner:', isOwner);

  if (!isOwner) {
    await ctx.reply('❌ 此操作仅限机器人 owner 使用');
    return;
  }

  await next();
};

/**
 * 检查当前用户是否为机器人的 owner 或授权用户
 */
export const isBotOwnerOrAuthorized = async (
  ctx: MyContext,
  next: () => Promise<void>,
) => {
  const currentBot = ctx.currentBot;
  const currentBotUser = ctx.currentBotUser;

  if (!currentBot || !currentBotUser) {
    await ctx.reply('无法获取机器人或用户信息');
    return;
  }

  // 填充 authorized_users
  await currentBot.populate('authorized_users');
  await currentBot.populate('owner');

  const ownerIdStr = currentBot.owner?.toString();
  const currentBotUserIdStr = currentBotUser._id?.toString();
  const isOwner =
    ownerIdStr && currentBotUserIdStr && ownerIdStr === currentBotUserIdStr;

  const authorizedUsers = (currentBot.authorized_users || []) as IBotUser[];
  const isAuthorized = authorizedUsers.some(
    (user: IBotUser) => user._id.toString() === currentBotUserIdStr,
  );

  debug('当前用户ID:', currentBotUserIdStr);
  debug('Owner ID:', ownerIdStr);
  debug('是否为 Owner:', isOwner);
  debug(
    '授权用户列表:',
    authorizedUsers.map((u: IBotUser) => u._id.toString()),
  );
  debug('是否为授权用户:', isAuthorized);

  if (!isOwner && !isAuthorized) {
    const ownerInfo = currentBot.owner as IBotUser;
    const ownerName = ownerInfo?.userName
      ? `@${ownerInfo.userName}`
      : `${ownerInfo?.firstName || ''} ${ownerInfo?.lastName || ''}`.trim();

    await ctx.reply(
      `❌ 此操作仅限机器人 owner 或授权用户使用。\n当前机器人由 ${ownerName} 拥有。`,
    );
    return;
  }

  debug('✅ 当前用户是机器人 owner 或授权用户');
  await next();
};
