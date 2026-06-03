import RedPacket from '../../../../models/redPacket';
import RedPacketClaim from '../../../../models/redPacketClaim';
import BotUserConfig from '../../../../models/botUserConfig';
import createDebug from 'debug';

const debug = createDebug('bot:redpacket:settle');

/**
 * 红包结算
 * - 检查是否全炸，若是则把所有扣款退还给发起人
 * - 退还未领份额（整除余数也一并退回）
 */
export async function settleRedPacket(
  redPacket: any,
  botId: any,
  claimedCount: number,
): Promise<void> {
  const claims = await RedPacketClaim.find({ redPacket: redPacket._id }).lean();
  const bombClaims = claims.filter((c: any) => c.isBomb);
  const allBombed = bombClaims.length > 0 && bombClaims.length === claimedCount;

  let refundToCreator = 0;

  // 全炸退款
  if (allBombed) {
    refundToCreator += bombClaims.reduce(
      (sum: number, c: any) => sum + Math.abs(c.pointsDelta),
      0,
    );
    debug('全炸，退还发起人 %d 积分', refundToCreator);
  }

  // 未领份额退还（unclaimedSlots * pointsPerSlot + 整除余数）
  const unclaimedSlots = redPacket.totalSlots - claimedCount;
  if (unclaimedSlots > 0) {
    const remainder = redPacket.totalPoints % redPacket.totalSlots;
    refundToCreator += unclaimedSlots * redPacket.pointsPerSlot + remainder;
    debug(
      '未领 %d 份，退还 %d 积分',
      unclaimedSlots,
      unclaimedSlots * redPacket.pointsPerSlot + remainder,
    );
  }

  if (refundToCreator > 0) {
    const creatorConfig = await BotUserConfig.findOne({
      bot: botId,
      botUser: redPacket.creator,
    });
    if (creatorConfig) {
      creatorConfig.usdt_balance =
        (creatorConfig.usdt_balance || 0) + refundToCreator;
      await creatorConfig.save();
    }
  }

  await RedPacket.findByIdAndUpdate(redPacket._id, {
    status: 'completed',
    allBombed,
    settled: true,
  });

  debug('红包 %s 结算完成，allBombed=%s', redPacket._id, allBombed);
}
