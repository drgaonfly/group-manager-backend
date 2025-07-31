import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import BotUserConfig from '../../../../models/botUserConfig';
import createDebug from 'debug';

const linkCommand = new Composer<MyContext>();

const debug = createDebug('bot:link');

/**
 * 获取排行榜数据
 * @param filter 查询条件
 * @param groupId 可选，群组ID，用于统计群内邀请数
 */
async function getTopInviters(filter: any, groupId?: string) {
  // 查询所有 BotUserConfig，并关联 botUser 字段
  const sortedConfigs = await BotUserConfig.find(filter).populate('botUser');

  // 并行统计每个 config 的邀请数
  const counts = await Promise.all(
    sortedConfigs.map((config: any) =>
      BotUserConfig.find({
        parent: config._id,
        ...(groupId ? { invited_group: groupId } : {}),
      }).countDocuments(),
    ),
  );

  // 组合 config 和 count
  const configsWithCounts = sortedConfigs.map((config: any, idx: number) => ({
    config,
    count: counts[idx] || 0,
  }));

  // 按 count 降序排序，取前10
  const topConfigsWithCounts = configsWithCounts
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return topConfigsWithCounts;
}

/**
 * 生成排行榜文本
 */
function generateLeaderboardText(topConfigsWithCounts: any[]) {
  if (!topConfigsWithCounts || topConfigsWithCounts.length === 0) {
    return '\nNo data';
  }
  let text = '';
  topConfigsWithCounts.forEach(({ config, count }, idx) => {
    text += `${idx + 1}. ${
      config.botUser.firstName && config.botUser.lastName
        ? config.botUser.firstName + config.botUser.lastName
        : config.botUser.userName
    } - <b>${count}</b> people\n`;
  });
  return text;
}

/**
 * 生成邀请链接
 */
function generateInviteLink(ctx: MyContext, isPrivate: boolean) {
  if (isPrivate) {
    return `https://t.me/${ctx.currentBot.userName}?start=${ctx.currentBotUserConfig.spread_code}`;
  } else {
    return `https://t.me/${ctx.currentBot.userName}?start=${ctx.currentBotUserConfig.spread_code}_${ctx.currentGroup.id}`;
  }
}

/**
 * 生成消息头部
 */
function generateMessageHeader(
  ctx: MyContext,
  isPrivate: boolean,
  invitationCount?: number,
) {
  const name =
    ctx.currentBotUser.firstName && ctx.currentBotUser.lastName
      ? ctx.currentBotUser.firstName + ctx.currentBotUser.lastName
      : ctx.currentBotUser.userName;

  const inviteLink = generateInviteLink(ctx, isPrivate);

  const header = `${name},Your invitation link is <code>${inviteLink}</code> (Click to copy)\nYou have invited ${invitationCount} people \n Invitation ranking:\n`;

  return header;
}

export async function handleLink(ctx: MyContext) {
  if (ctx.chat.type === 'private') {
    // 私聊场景
    const topConfigsWithCounts = await getTopInviters({});

    let message = generateMessageHeader(
      ctx,
      true,
      ctx.currentBotUserConfig.invited_counts,
    );
    message += generateLeaderboardText(topConfigsWithCounts);

    await ctx.reply(message, {
      parse_mode: 'HTML',
    });
    return;
  } else {
    // 群聊场景
    const groupId = ctx.currentGroup._id;
    const topConfigsWithCounts = await getTopInviters(
      { invited_group: groupId },
      groupId,
    );

    const invitation_counts_in_group = await BotUserConfig.find({
      parent: ctx.currentBotUserConfig._id,
      bot: ctx.currentBotUser._id.toString(),
      invited_group: groupId.toString(),
    }).countDocuments();

    let message = generateMessageHeader(ctx, false, invitation_counts_in_group);
    message += generateLeaderboardText(topConfigsWithCounts);

    await ctx.reply([message, `\n`, ctx.currentGroup.message].join('\n'), {
      parse_mode: 'HTML',
    });
  }
}

// 邀请链接命令处理
linkCommand.command('links', async (ctx) => {
  debug('link');
  await handleLink(ctx);
});

export default linkCommand;
