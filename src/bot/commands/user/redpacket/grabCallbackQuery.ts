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
    const name = (() => {
      const u = botUser as any;
      const full = `${u?.firstName ?? ''}${
        u?.lastName ? ' ' + u.lastName : ''
      }`.trim();
      return full || (u?.userName ? `@${u.userName}` : '你');
    })();
    const msg = existing.isBomb
      ? `💣 ${name}，你已经领过了！\n\n踩雷扣了 ${Math.abs(
          existing.pointsDelta,
        )} 积分`
      : `✅ ${name}，你已经领过了！\n\n获得 +${existing.pointsDelta} 积分`;
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
  const pointsDelta = isBomb
    ? -Math.ceil(redPacket.pointsPerSlot * redPacket.bombMultiplier)
    : redPacket.pointsPerSlot;

  // 原子 $inc 更新余额，拿返回值做准确快照
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
      assignedNumber,
      isBomb,
      pointsBefore,
      pointsDelta,
      pointsAfter,
    });
  } catch (e: any) {
    // 唯一索引冲突 = 并发下重复领取，回滚余额
    if (e?.code === 11000) {
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

  const newClaimedCount = claimedCount + 1;
  const allClaimed = newClaimedCount >= redPacket.totalSlots;

  if (allClaimed) {
    await settleRedPacket(redPacket, bot._id, newClaimedCount);
  }

  // 更新消息正文 + 按钮
  if (redPacket.messageId && ctx.chat) {
    try {
      // 查发起人名称
      const creator = await BotUser.findById(redPacket.creator).lean();
      const creatorName = (creator as any)?.userName
        ? `@${(creator as any).userName}`
        : `${(creator as any)?.firstName ?? '用户'}`;

      // 结算后重新查一次以拿到 allBombed / status
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
