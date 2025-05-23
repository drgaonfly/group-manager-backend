import Subscription, { SubscriptionStatus } from '../../models/subscription';
import BotUser from '../../models/botUser';

export async function checkExpiredSubscriptions() {
  try {
    // 查询所有已过期的订阅
    const expiredSubscriptions = await Subscription.find({
      expiredAt: { $lte: new Date() },
      status: SubscriptionStatus.Active,
    });

    for (const subscription of expiredSubscriptions) {
      // 设置订阅状态为过期
      subscription.status = SubscriptionStatus.Expired;
      await subscription.save();

      // 获取关联的 botUser
      const botUser = await BotUser.findById(subscription.botUser);

      if (botUser?.id) {
        console.log(`用户 ${botUser.id} 的订阅已过期`);
        // 这里可以添加通知逻辑，例如发送消息给用户
      }
    }

    return { processed: expiredSubscriptions.length };
  } catch (error) {
    console.error('处理过期订阅时出错:', error);
    return { error: error.message };
  }
}
