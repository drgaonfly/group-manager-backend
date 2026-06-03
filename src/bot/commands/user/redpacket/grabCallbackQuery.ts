import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import RedPacket from '../../../../models/redPacket';
import RedPacketClaim from '../../../../models/redPacketClaim';
import BotUserConfig from '../../../../models/botUserConfig';
import { settleRedPacket } from './settleRedPacket';
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

  // 已领过
  const existing = await RedPacketClaim.findOne({
    redPacket: redPacketId,
    botUser: botUser._id,
  });
  if (existing) {
    const msg = existing.isBomb
      ? `💣 你踩雷了！扣了 ${Math.abs(existing.pointsDelta)} 积分`
      : `✅ 你已领过 +${existing.pointsDelta} 积分（第 ${existing.assignedNumber} 号）`;
    await ctx.answerCallbackQuery({ text: msg, show_alert: true });
    return;
  }

  // 随机分配未用数字
  const usedNumbers = new Set(
    (
      await RedPacketClaim.find({ redPacket: redPacketId })
        .select('assignedNumber')
        .lean()
    ).map((c: any) => c.assignedNumber),
  );
  const available = Array.from(
    { length: redPacket.totalSlots },
    (_, i) => i + 1,
  ).filter((n) => !usedNumbers.has(n));

  if (available.length === 0) {
    await ctx.answerCallbackQuery({
      text: '😢 红包已被领完啦',
      show_alert: true,
    });
    return;
  }

  const assignedNumber =
    available[Math.floor(Math.random() * available.length)];
  const isBomb = redPacket.bombNumbers.includes(assignedNumber);

  const config = await BotUserConfig.findOne({
    bot: bot._id,
    botUser: botUser._id,
  });
  if (!config) {
    await ctx.answerCallbackQuery({ text: '❌ 账户异常', show_alert: true });
    return;
  }

  const pointsBefore = config.usdt_balance || 0;
  const pointsDelta = isBomb
    ? -Math.ceil(redPacket.pointsPerSlot * redPacket.bombMultiplier)
    : redPacket.pointsPerSlot;
  const pointsAfter = pointsBefore + pointsDelta;

  config.usdt_balance = pointsAfter;
  await config.save();

  await RedPacketClaim.create({
    redPacket: redPacketId,
    botUser: botUser._id,
    assignedNumber,
    isBomb,
    pointsBefore,
    pointsDelta,
    pointsAfter,
  });

  const newClaimedCount = claimedCount + 1;
  const allClaimed = newClaimedCount >= redPacket.totalSlots;

  if (allClaimed) {
    await settleRedPacket(redPacket, bot._id, newClaimedCount);
  }

  // 更新按钮文字
  if (redPacket.messageId && ctx.chat) {
    const label = allClaimed
      ? `🧧 红包已领完（${newClaimedCount}/${redPacket.totalSlots}）`
      : `🧧 抢红包（${newClaimedCount}/${redPacket.totalSlots}）`;
    try {
      await ctx.api.editMessageReplyMarkup(ctx.chat.id, redPacket.messageId, {
        reply_markup: allClaimed
          ? undefined
          : new InlineKeyboard().text(label, `grab_rp_${redPacketId}`),
      });
    } catch {
      // 消息已删或无权限，忽略
    }
  }

  const resultMsg = isBomb
    ? `💣 你踩雷了！第 ${assignedNumber} 号是炸弹，扣了 ${Math.abs(
        pointsDelta,
      )} 积分\n当前余额：${pointsAfter}`
    : `🎉 恭喜！你领到第 ${assignedNumber} 号，获得 +${pointsDelta} 积分\n当前余额：${pointsAfter}`;

  await ctx.answerCallbackQuery({ text: resultMsg, show_alert: true });

  debug(
    'user=%s grabbed rp=%s number=%d isBomb=%s delta=%d',
    botUser._id,
    redPacketId,
    assignedNumber,
    isBomb,
    pointsDelta,
  );
});

export default grabCallbackQuery;
