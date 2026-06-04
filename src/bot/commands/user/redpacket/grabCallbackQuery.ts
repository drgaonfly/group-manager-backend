import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import RedPacket from '../../../../models/redPacket';
import RedPacketClaim from '../../../../models/redPacketClaim';
import BotUserConfig from '../../../../models/botUserConfig';
import BotUser from '../../../../models/botUser';
import { settleRedPacket } from './settleRedPacket';
import { buildRedPacketMessage } from './buildRedPacketMessage';
import createDebug from 'debug';

const debug = createDebug('bot:redpacket:grab');

const grabCallbackQuery = new Composer<MyContext>();

grabCallbackQuery.callbackQuery(/^grab_rp_(.+)$/, async (ctx) => {
  const redPacketId = ctx.match[1];
  const botUser = ctx.currentBotUser;
  const bot = ctx.currentBot;

  if (!botUser || !bot) {
    await ctx.answerCallbackQuery({
      text: '❌ 无法识别用户',
      show_alert: true,
    });
    return;
  }

  const redPacket = await RedPacket.findOne({
    _id: redPacketId,
    bot: bot._id,
    status: 'active',
  });

  if (!redPacket) {
    await ctx.answerCallbackQuery({
      text: '❌ 红包不存在或已结束',
      show_alert: true,
    });
    return;
  }

  if (new Date() > new Date(redPacket.expiredAt)) {
    await ctx.answerCallbackQuery({ text: '⏰ 红包已过期', show_alert: true });
    return;
  }

  const claimedCount = await RedPacketClaim.countDocuments({
    redPacket: redPacketId,
  });

  if (claimedCount >= redPacket.totalSlots) {
    await ctx.answerCallbackQuery({
      text: '😢 红包已被领完啦',
      show_alert: true,
    });
    return;
  }

  // 发起人不能领自己的红包
  if (String(redPacket.creator) === String(botUser._id)) {
    await ctx.answerCallbackQuery({
      text: '🙅 发起人不能领自己的红包',
      show_alert: true,
    });
    return;
  }

  // 已领过
  const existing = await RedPacketClaim.findOne({
    redPacket: redPacketId,
    botUser: botUser._id,
  });
  if (existing) {
    const u = botUser as any;
    const full = `${u?.firstName ?? ''}${
      u?.lastName ? ' ' + u.lastName : ''
    }`.trim();
    const name = full || (u?.userName ? `@${u.userName}` : '你');
    const msg = existing.isBomb
      ? `💣 ${name}，你已经领过了！\n\n踩雷扣了 ${Math.abs(
          existing.pointsDelta,
        )} 积分`
      : `✅ ${name}，你已经领过了！\n\n获得 +${existing.pointsDelta} 积分`;
    await ctx.answerCallbackQuery({ text: msg, show_alert: true });
    return;
  }

  // 二倍均值法动态计算本次领取金额
  const remainingCount = redPacket.totalSlots - claimedCount;
  const remainingAmount = redPacket.remainingAmount;

  let claimAmount: number;
  if (remainingCount === 1) {
    // 最后一份全拿剩余，保留两位小数
    claimAmount = Math.round(remainingAmount * 100) / 100;
  } else {
    const maxAmount = (remainingAmount / remainingCount) * 2;
    const minAmount = 0.01;
    const cap = remainingAmount - (remainingCount - 1) * 0.01;
    const raw = Math.random() * (maxAmount - minAmount) + minAmount;
    claimAmount = Math.round(Math.min(raw, cap) * 100) / 100;
  }

  // 取金额最后一位小数（百分位数字）判断是否炸弹
  // 例如 12.37 → 最后一位 = 7；12.30 → 最后一位 = 0
  const lastDigit = Math.round(claimAmount * 100) % 10;
  const isBomb = redPacket.bombNumbers.includes(lastDigit);

  const pointsDelta = isBomb
    ? -Math.ceil(claimAmount * redPacket.bombMultiplier)
    : claimAmount;

  // 原子 $inc 更新用户余额，拿返回值做准确快照
  const updatedConfig = await BotUserConfig.findOneAndUpdate(
    { bot: bot._id, botUser: botUser._id },
    { $inc: { usdt_balance: pointsDelta } },
    { new: true },
  );
  if (!updatedConfig) {
    await ctx.answerCallbackQuery({ text: '❌ 账户异常', show_alert: true });
    return;
  }

  const pointsAfter = updatedConfig.usdt_balance ?? 0;
  const pointsBefore = pointsAfter - pointsDelta;

  // 写入 Claim，唯一索引 (redPacket, botUser) 兜底并发重复
  try {
    await RedPacketClaim.create({
      redPacket: redPacketId,
      botUser: botUser._id,
      assignedNumber: lastDigit, // 记录命中的末位数字，方便审计
      isBomb,
      pointsBefore,
      pointsDelta,
      pointsAfter,
    });
  } catch (e: any) {
    if (e?.code === 11000) {
      // 并发重复领取，回滚余额
      await BotUserConfig.updateOne(
        { bot: bot._id, botUser: botUser._id },
        { $inc: { usdt_balance: -pointsDelta } },
      );
      await ctx.answerCallbackQuery({
        text: '❌ 手速太快，请稍后再试',
        show_alert: true,
      });
      return;
    }
    throw e;
  }

  // 扣减红包剩余金额（只在未踩雷时扣）
  if (!isBomb) {
    await RedPacket.updateOne(
      { _id: redPacketId },
      { $inc: { remainingAmount: -claimAmount } },
    );
  }

  const newClaimedCount = claimedCount + 1;
  const allClaimed = newClaimedCount >= redPacket.totalSlots;

  if (allClaimed) {
    await settleRedPacket(redPacket, bot._id, newClaimedCount);
  }

  // 更新消息正文 + 按钮
  if (redPacket.messageId && ctx.chat) {
    try {
      const creator = await BotUser.findById(redPacket.creator).lean();
      const creatorName = (creator as any)?.firstName
        ? `${(creator as any).firstName}${
            (creator as any).lastName ? ' ' + (creator as any).lastName : ''
          }`
        : (creator as any)?.userName
          ? `@${(creator as any).userName}`
          : '用户';

      const freshRp = allClaimed
        ? await RedPacket.findById(redPacket._id).lean()
        : redPacket;
      const text = await buildRedPacketMessage(freshRp, creatorName);
      const keyboard = allClaimed
        ? undefined
        : new InlineKeyboard().text(
            `🧧 抢红包（${newClaimedCount}/${redPacket.totalSlots}）`,
            `grab_rp_${redPacketId}`,
          );

      await ctx.api.editMessageText(ctx.chat.id, redPacket.messageId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch {
      // 消息已删或无权限，忽略
    }
  }

  const bombTip = isBomb ? `\n💣 末位数字 ${lastDigit} 是炸弹！` : '';
  const resultMsg = isBomb
    ? `💣 你踩雷了！\n金额末位 ${lastDigit} 是炸弹，扣了 ${Math.abs(
        pointsDelta,
      )} 积分${bombTip}\n当前余额：${pointsAfter}`
    : `🎉 恭喜！获得 ${claimAmount} 积分\n当前余额：${pointsAfter}`;

  await ctx.answerCallbackQuery({ text: resultMsg, show_alert: true });

  debug(
    'user=%s grabbed rp=%s amount=%d lastDigit=%d isBomb=%s delta=%d',
    botUser._id,
    redPacketId,
    claimAmount,
    lastDigit,
    isBomb,
    pointsDelta,
  );
});

export default grabCallbackQuery;
