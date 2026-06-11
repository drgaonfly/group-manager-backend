import RedPacket from '../../../../models/redPacket';
import RedPacketClaim from '../../../../models/redPacketClaim';
import BotUserConfig from '../../../../models/botUserConfig';
import BotUser from '../../../../models/botUser';
import Bot from '../../../../models/bot';
import { setupBot } from '../../../botSetup';
import createDebug from 'debug';

const debug = createDebug('bot:redpacket:settle');

/**
 * 构建结算广播消息文本
 */
function buildSettleNotification(
  redPacket: any,
  claim: any,
  allBombed: boolean,
  finalStatus: 'completed' | 'expired',
  creatorName: string,
  groupTitle: string,
): string {
  const statusLabel =
    finalStatus === 'expired' ? '⏰ 红包已过期' : '✅ 红包已领完';
  const lines: string[] = [
    `🧧 <b>红包结算通知</b>`,
    ``,
    `${statusLabel}`,
    `发包人：<b>${creatorName}</b>`,
    `群组：<b>${groupTitle}</b>`,
    ``,
  ];

  if (claim.isBomb) {
    lines.push(`你领到了 💣 <b>炸弹</b>！`);
    lines.push(`分得数字：<b>${claim.assignedNumber}</b>（炸弹数字）`);
    lines.push(`积分变动：<b>${claim.pointsDelta.toFixed(2)}</b>`);
  } else {
    lines.push(`你抢到了 🎁 <b>${claim.pointsDelta.toFixed(2)} 积分</b>`);
    lines.push(`分得数字：<b>${claim.assignedNumber}</b>`);
  }

  lines.push(`当前余额：<b>${claim.pointsAfter.toFixed(2)}</b>`);

  if (allBombed) {
    lines.push(``);
    lines.push(`💥 本红包触发<b>全炸</b>，发包人已全额退款`);
  }

  return lines.join('\n');
}

/**
 * 红包结算
 * - 整除余数无条件退还发起人
 * - 未领份额退还发起人
 * - 全炸时把所有扣款也退还发起人
 * - 结算完成后向所有参与者发送私信通知
 *
 * @param finalStatus 结算后的状态，正常领完传 'completed'，过期传 'expired'
 */
export async function settleRedPacket(
  redPacket: any,
  botId: any,
  claimedCount: number,
  finalStatus: 'completed' | 'expired' = 'completed',
): Promise<void> {
  const claims = await RedPacketClaim.find({ redPacket: redPacket._id })
    .populate('botUser', 'id firstName lastName userName')
    .lean();
  const bombClaims = claims.filter((c: any) => c.isBomb);
  const allBombed = bombClaims.length > 0 && bombClaims.length === claimedCount;

  let refundToCreator = 0;

  // 未领份额退还：直接用剩余金额字段（随机分配后的准确剩余）
  const remainingAmount = redPacket.remainingAmount ?? 0;
  if (remainingAmount > 0) {
    refundToCreator += remainingAmount;
    debug('未领剩余金额 %d 积分退还发起人', remainingAmount);
  }

  // 全炸退款：把所有炸弹扣款退还给发起人
  if (allBombed) {
    const bombRefund = bombClaims.reduce(
      (sum: number, c: any) => sum + Math.abs(c.pointsDelta),
      0,
    );
    refundToCreator += bombRefund;
    debug('全炸，额外退还发起人 %d 积分', bombRefund);
  }

  if (refundToCreator > 0) {
    await BotUserConfig.updateOne(
      { bot: botId, botUser: redPacket.creator },
      { $inc: { usdt_balance: refundToCreator } },
    );
  }

  await RedPacket.findByIdAndUpdate(redPacket._id, {
    status: finalStatus,
    allBombed,
    settled: true,
  });

  debug(
    '红包 %s 结算完成，status=%s allBombed=%s refund=%d',
    redPacket._id,
    finalStatus,
    allBombed,
    refundToCreator,
  );

  // ── 广播私信给所有参与者 ───────────────────────────────────────
  if (claims.length === 0) return;

  try {
    const bot = await Bot.findById(botId).lean();
    if (!bot?.token) return;

    const botInstance = setupBot(bot.token);

    // 获取发包人名称
    const creator = await BotUser.findById(redPacket.creator)
      .select('id firstName lastName userName')
      .lean();
    const creatorName = creator
      ? (creator.userName
          ? `@${creator.userName}`
          : `${creator.firstName ?? ''}${
              creator.lastName ? ' ' + creator.lastName : ''
            }`.trim()) || '用户'
      : '用户';

    // 获取群名称
    const Group = (await import('../../../../models/group')).default;
    const group = await Group.findById(redPacket.group)
      .select('title name')
      .lean();
    const groupTitle = (group as any)?.title || (group as any)?.name || '群组';

    // 逐一发送私信，出错不中断其他人的通知
    for (const claim of claims) {
      const user = claim.botUser as any;
      if (!user?.id) continue;

      const text = buildSettleNotification(
        redPacket,
        claim,
        allBombed,
        finalStatus,
        creatorName,
        groupTitle,
      );

      try {
        await botInstance.api.sendMessage(user.id, text, {
          parse_mode: 'HTML',
        });
        debug('红包结算通知已发送给用户 %s', user.id);
      } catch (err: any) {
        // 用户未开启 bot 私信等情况，忽略
        debug('发送结算通知给用户 %s 失败: %s', user.id, err?.message);
      }
    }
  } catch (err) {
    // 广播失败不影响结算本身
    debug('广播结算通知失败: %o', err);
  }
}
