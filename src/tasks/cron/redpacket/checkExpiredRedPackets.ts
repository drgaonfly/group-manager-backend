import cron from 'node-cron';
import RedPacket from '../../../models/redPacket';
import RedPacketClaim from '../../../models/redPacketClaim';
import { settleRedPacket } from '../../../bot/commands/user/redpacket/settleRedPacket';

// 每分钟扫描一次过期未结算的红包
export const checkExpiredRedPackets = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const expiredList = await RedPacket.find({
        status: 'active',
        expiredAt: { $lte: new Date() },
        settled: false,
      }).lean();

      if (expiredList.length === 0) return;

      console.log(`🧧 发现 ${expiredList.length} 个过期红包，开始结算...`);

      for (const redPacket of expiredList) {
        try {
          const claimedCount = await RedPacketClaim.countDocuments({
            redPacket: redPacket._id,
          });
          await settleRedPacket(
            redPacket,
            redPacket.bot,
            claimedCount,
            'expired',
          );
          console.log(`✅ 过期红包 ${redPacket._id} 结算完成`);
        } catch (err) {
          console.error(`❌ 过期红包 ${redPacket._id} 结算失败:`, err);
        }
      }
    } catch (err) {
      console.error('❌ 检查过期红包任务失败:', err);
    }
  });

  console.log('🧧 过期红包检查任务已启动');
};
