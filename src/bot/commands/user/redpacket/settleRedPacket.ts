import RedPacket from '../../../../models/redPacket';
import RedPacketClaim from '../../../../models/redPacketClaim';
import BotUserConfig from '../../../../models/botUserConfig';
import createDebug from 'debug';

const debug = createDebug('bot:redpacket:settle');

/**
 * 红包结算
 * - 整除余数无条件退还发起人
 * - 未领份额退还发起人
 * - 全炸时把所有扣款也退还发起人
 *
 * @param finalStatus 结算后的状态，正常领完传 'completed'，过期传 'expired'
 */
export async function settleRedPacket(
  redPacket: any,
  botId: any,
  claimedCount: number,
  finalStatus: 'completed' | 'expired' = 'completed',
): Promise<void> {
  const claims = await RedPacketClaim.find({ redPacket: redPacket._id }).lean();
  const bombClaims = claims.filter((c: any) => c.isBomb);
  const allBombed = bombClaims.length > 0 && bombClaims.length === claimedCount;

  let refundToCreator = 0;

  // 整除余数无条件退还（totalPoints 不能被 totalSlots 整除时产生）
  const remainder = redPacket.totalPoints % redPacket.totalSlots;
  if (remainder > 0) {
    refundToCreator += remainder;
    debug('余数 %d 积分退还发起人', remainder);
  }

  // 未领份额退还
  const unclaimedSlots = redPacket.totalSlots - claimedCount;
  if (unclaimedSlots > 0) {
    refundToCreator += unclaimedSlots * redPacket.pointsPerSlot;
    debug(
      '未领 %d 份，退还 %d 积分',
      unclaimedSlots,
      unclaimedSlots * redPacket.pointsPerSlot,
    );
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
}
