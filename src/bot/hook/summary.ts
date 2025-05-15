import Transaction from '../../models/transaction';
import { IGroup } from '../../models/group';

/**
 * 获取交易数据的Hook
 * @param bot 当前机器人
 * @returns 返回交易次数和交易列表
 */
export const useTransactionData = async (group: IGroup) => {
  // 获取所有交易数据
  // 获取今天的开始和结束时间
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let [deposits, withdraws] = await Promise.all([
    Transaction.find({
      group: group._id,
      type: 'deposit',
      createdAt: {
        $gte: today,
        $lt: tomorrow,
      },
    })
      .sort({ createdAt: -1 })
      .limit(10),
    Transaction.find({
      group: group._id,
      type: 'withdraw',
      createdAt: {
        $gte: today,
        $lt: tomorrow,
      },
    })
      .sort({ createdAt: -1 })
      .limit(10),
  ]);

  // 按照创建时间正序排序
  deposits = deposits.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  withdraws = withdraws.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  return {
    deposits,
    withdraws,
  };
};
