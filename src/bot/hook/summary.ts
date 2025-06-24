import Transaction from '../../models/transaction';
import { IGroup } from '../../models/group';

/**
 * 获取交易数据和汇总手续费的Hook
 * @param group 当前群组
 * @returns 返回交易次数、交易列表和汇总手续费
 */
export const useTransactionData = async (group: IGroup) => {
  // 获取今天的开始和结束时间
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [deposits, withdraws] = await Promise.all([
    Transaction.find({
      group: group._id,
      type: 'deposit',
      createdAt: {
        $gte: today,
        $lt: tomorrow,
      },
    }).sort({ createdAt: -1 }),
    Transaction.find({
      group: group._id,
      type: 'withdraw',
      createdAt: {
        $gte: today,
        $lt: tomorrow,
      },
    }).sort({ createdAt: -1 }),
  ]);

  // 计算汇总手续费
  // 汇总手续费 = (总入款 + 总下发) * 费率 / 100
  const totalDepositAmount = deposits.reduce(
    (sum, item) => sum + (item.amount || 0),
    0,
  );
  const totalWithdrawAmount = withdraws.reduce(
    (sum, item) => sum + (item.amount || 0),
    0,
  );
  const summary = Number(
    (
      ((totalDepositAmount + totalWithdrawAmount) * (group.fee_rate || 0)) /
      100
    ).toFixed(2),
  );

  return {
    deposits,
    withdraws,
    summary,
  };
};
