import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import CheckinRule from '../../../../models/checkInRule';
import CheckinHistory from '../../../../models/checkinHistory';
import BotUserConfig from '../../../../models/botUserConfig';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';
import {
  hasCheckedInToday,
  isFirstTimeCheckin,
  getStreakDays,
  calculateMultiplier,
} from './handleCheckin';
import { replaceMessageVariables } from '../../../../utils/telegramHtmlConvert';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import {
  getGroupUserRanking,
  getGroupUserRankingList,
  getUserCurrentRank,
} from '../../../../services/rankingService';
import createDebug from 'debug';

const debug = createDebug('bot:checkin');

// 延迟删除消息（与 replyRuleHandler 保持一致）
const scheduleMessageDeletion = (
  ctx: MyContext,
  chatId: number,
  messageId: number,
  delaySeconds: number,
): void => {
  if (delaySeconds <= 0) return;
  setTimeout(async () => {
    try {
      await ctx.api.deleteMessage(chatId, messageId);
      debug(`Deleted message ${messageId} after ${delaySeconds}s`);
    } catch (error) {
      debug('Error deleting message:', error);
    }
  }, delaySeconds * 1000);
};

const checkinCommand = new Composer<MyContext>();

checkinCommand.on('message:text', checkGroup, async (ctx, next) => {
  // 只处理文本消息
  if (!ctx.message?.text) {
    return next();
  }

  const messageText = ctx.message.text.trim();
  const botId = ctx.currentBot?._id;
  const botUserId = ctx.currentBotUser?._id;
  const userId = ctx.currentProxyUser?._id;
  const groupId = ctx.currentGroup?._id;

  if (!botId || !botUserId || !userId) {
    return next();
  }

  debug('Checking checkin rules for message:', messageText);

  try {
    // 优先匹配当前群组的专属规则，找不到再用 bot 级默认规则（group 为空）
    let matchedRule = await CheckinRule.findOne({
      bot: botId,
      group: groupId,
      isOnline: true,
    }).exec();

    if (!matchedRule) {
      matchedRule = await CheckinRule.findOne({
        bot: botId,
        group: { $in: [null, undefined] },
        isOnline: true,
      }).exec();
    }

    if (!matchedRule) {
      return next();
    }

    // 检查关键词是否匹配
    const isKeywordMatch = matchedRule.keywords.some((keyword) => {
      // 支持精确匹配和包含匹配
      return messageText === keyword || messageText.includes(keyword);
    });

    if (!isKeywordMatch) {
      return next();
    }

    debug('Matched checkin rule:', matchedRule._id);

    // 检查用户今天是否已经签到过（如果是每日签到）
    if (matchedRule.type === 'daily') {
      const alreadyCheckedIn = await hasCheckedInToday(
        botId,
        botUserId,
        groupId,
        'daily',
      );
      if (alreadyCheckedIn) {
        await ctx.reply('今天已经签到过了，明天再来吧！');
        return;
      }
    }

    // 检查是否是首次签到
    const isFirstTime = await isFirstTimeCheckin(botUserId);

    // 如果规则是初次签到，但用户已经签到过，跳过
    if (matchedRule.type === 'first' && !isFirstTime) {
      return next();
    }

    // 获取用户的配置
    const botUserConfig = await BotUserConfig.findOne({
      botUser: botUserId,
      bot: botId,
    });

    if (!botUserConfig) {
      debug('BotUserConfig not found for user:', botUserId);
      return next();
    }

    // 计算实际奖励（考虑连续签到倍率）
    let actualReward = matchedRule.reward;
    let streakDays = 1;
    let multiplier = 1;

    if (matchedRule.type === 'daily' && matchedRule.enableStreakBonus) {
      // 计算连续签到天数
      streakDays = await getStreakDays(botId, botUserId, groupId);

      // 计算倍率
      multiplier = calculateMultiplier(
        streakDays,
        matchedRule.streakCycles,
        matchedRule.maxMultiplier,
      );

      // 计算实际奖励
      actualReward = Math.round(matchedRule.reward * multiplier);
    }

    // 更新用户余额
    const previoususdt_balance = botUserConfig.usdt_balance || 0;
    botUserConfig.usdt_balance = previoususdt_balance + actualReward;
    await botUserConfig.save();

    // 创建签到历史记录
    const checkinHistory = new CheckinHistory({
      proxy: userId,
      bot: botId,
      botUser: botUserId,
      type: matchedRule.type,
      reward: actualReward,
      baseReward: matchedRule.reward,
      streakDays,
      multiplier,
      group: ctx.currentGroup._id,
    });
    await checkinHistory.save();

    debug('Checkin data saved successfully, about to send reply');

    // 发送成功消息
    let successMessage = matchedRule.success_content;

    // 如果没有自定义消息，使用默认消息
    if (!successMessage || successMessage.trim() === '') {
      const checkinTypeText =
        matchedRule.type === 'first' ? '首次签到' : '每日签到';

      const lines = [
        `🎉 ${checkinTypeText}成功！`,
        `💰 获得 ${actualReward} 积分`,
      ];

      // 添加连续签到信息
      if (matchedRule.type === 'daily' && matchedRule.enableStreakBonus) {
        lines.push(`📅 连续签到: ${streakDays} 天`);
        if (multiplier > 1) {
          lines.push(`⚡ 倍率: ${multiplier} 倍`);
        }
      }

      lines.push(
        `💎 当前余额: ${botUserConfig.usdt_balance} 积分`,
        `⏰ 签到时间: ${formatBeijingDate(new Date())}`,
      );

      successMessage = lines.join('\n');
    }

    // 替换消息中的变量（昵称优先于用户名；userBalance 为签到后的当前积分）
    const rankingNum = await getGroupUserRanking(
      botId,
      botUserConfig.usdt_balance || 0,
      ctx.currentGroup?.botUsers as any,
    );
    const userBalanceRanking = rankingNum ? String(rankingNum) : undefined;

    const rankingListData = await getGroupUserRankingList(
      ctx,
      botId,
      ctx.currentGroup?.botUsers as any,
    );
    const userBalanceRankingList = rankingListData.text;

    const currentRank = await getUserCurrentRank(
      botId,
      botUserConfig.usdt_balance ?? 0,
    );

    const variables = {
      username: ctx.currentBotUser.userName
        ? `@${ctx.currentBotUser.userName}`
        : '',
      memberName: ctx.currentBotUser.displayName || '',
      userId: String(ctx.currentBotUser.id),
      userBalance: String(botUserConfig.usdt_balance ?? 0),
      userBalanceRanking,
      userBalanceRankingList,
      groupTitle: ctx.currentGroup.title || '',
      currentTime: formatBeijingDate(new Date()),
      currentBot: `@${ctx.currentBot.userName}`,
      currentRank,
    };

    successMessage = replaceMessageVariables(successMessage, variables);

    debug('About to send success message:', successMessage);
    const sentMessage = await ctx.reply(successMessage, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
    debug('Success message sent successfully');

    // 阅后即焚：延迟删除签到成功消息
    scheduleMessageDeletion(
      ctx,
      ctx.chat!.id,
      sentMessage.message_id,
      matchedRule.deleteAfterSeconds,
    );
    // 延迟删除用户触发消息
    scheduleMessageDeletion(
      ctx,
      ctx.chat!.id,
      ctx.message.message_id,
      matchedRule.deleteUserMsgAfterSeconds,
    );

    debug(
      `User ${botUserId} checked in successfully. Reward: ${actualReward} (base: ${matchedRule.reward} × ${multiplier}), Streak: ${streakDays} days, New usdt_balance: ${botUserConfig.usdt_balance}`,
    );
  } catch (error) {
    debug('Error in checkin command:', error);
    debug('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    await ctx.reply('签到失败，请稍后重试。');
  }
});

export default checkinCommand;
