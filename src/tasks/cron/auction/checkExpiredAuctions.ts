import cron from 'node-cron';
import Auction from '../../../models/auction';
import { executeAuctionEnd } from '../../../controllers/auctionController';

// 每分钟检查一次过期的竞拍活动
export const checkExpiredAuctions = () => {
  cron.schedule('* * * * *', async () => {
    try {
      console.log('🏆 检查过期的竞拍活动...');

      // 查找已过期但未完成的竞拍活动
      const expiredAuctions = await Auction.find({
        status: 'ongoing',
        endTime: { $lte: new Date() },
      })
        .populate('bot', 'token userName botName')
        .populate('group', 'id title');

      if (expiredAuctions.length === 0) {
        return;
      }

      console.log(`🏆 发现 ${expiredAuctions.length} 个过期的竞拍活动`);

      // 处理每个过期的竞拍
      for (const auction of expiredAuctions) {
        try {
          console.log(`🏆 处理过期竞拍: ${auction.title}`);
          await executeAuctionEnd(auction);
          console.log(`✅ 竞拍 ${auction.title} 已结束`);
        } catch (error) {
          console.error(`❌ 处理竞拍 ${auction.title} 失败:`, error);
        }
      }
    } catch (error) {
      console.error('❌ 检查过期竞拍任务失败:', error);
    }
  });

  console.log('🏆 竞拍过期检查任务已启动');
};
