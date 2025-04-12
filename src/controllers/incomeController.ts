import { Request, Response } from 'express';
import Income from '../models/income';
import Customer from '../models/customer';
import LiquidityBenefits from '../models/liquidity';
import handleAsync from '../utils/handleAsync';
// import Stacking from '../models/stacking';
import { RequestCustom } from 'user';
import { isProxy } from '../middlewares/authMiddleware';
import User from '../models/user';
import { getExchangeRate } from '../utils/getExchange';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  if (queryParams.customer) {
    let searchText;
    try {
      const userParam = JSON.parse(String(queryParams.customer));
      searchText = userParam.address;
    } catch (e) {
      searchText = String(queryParams.customer).trim();
    }
    const customerData = await Customer.find({
      address: {
        $regex: searchText,
        $options: 'i',
      },
    });

    if (customerData && customerData.length > 0) {
      query.customer = { $in: customerData.map((customer) => customer._id) };
    } else {
      return null;
    }
  }

  if (isProxy(req.user)) {
    const employees = await User.find({ proxy: req.user._id });
    const employeeIds = employees.map((employee) => employee._id);
    query.employee = { $in: [...employeeIds, req.user._id] };
  }

  return query;
};

export const filterCustomerAddress = async (
  req: RequestCustom,
  query: any,
  res: Response,
) => {
  if (req.query.customer) {
    const customerDoc = await Customer.find({
      address: {
        $regex: JSON.parse(req.query.customer as string).address,
        $options: 'i',
      },
    });

    if (customerDoc.length > 0) {
      query.customer = { $in: customerDoc.map((doc) => doc._id) };
    } else {
      res.json({
        success: true,
        data: [],
      });
      return;
    }
  }

  return query;
};

// 获取所有收入记录
const getIncomes = handleAsync(async (req: RequestCustom, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  let query = await buildQuery(req.query, req);

  query = await filterCustomerAddress(req, query, res);

  const incomes = await Income.find(query)
    .populate('customer')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Income.countDocuments(query).exec();

  res.json({
    success: true,
    data: incomes,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 添加收入记录
const addIncome = handleAsync(async (req: Request, res: Response) => {
  const newIncome = new Income({
    ...req.body,
  });

  const savedIncome = await newIncome.save();
  res.json({
    success: true,
    data: savedIncome,
  });
});

// 根据 ID 获取收入记录
const getIncomeById = handleAsync(async (req: Request, res: Response) => {
  const income = await Income.findById(req.params.id).populate('customer');

  res.json({
    success: true,
    data: income,
  });
});

// 更新收入记录
const updateIncome = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedIncome = await Income.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true, runValidators: true },
  );

  res.json({
    success: true,
    data: updatedIncome,
  });
});

// 删除收入记录
const deleteIncome = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const income = await Income.findByIdAndDelete(id);

  res.json({
    success: true,
    message: income,
  });
});

// 批量删除收入记录
const deleteMultipleIncomes = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Income.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} incomes deleted successfully`,
    });
  },
);

// 根据地址和网络查询收益记录
const getIncomesByAddressAndNetwork = handleAsync(
  async (req: RequestCustom, res: Response): Promise<void> => {
    const customer = req.customer;
    // 查找对应的收益范围
    const liquidityBenefit = await LiquidityBenefits.findOne({
      stakingmin: { $lte: customer.usdtBalance },
      stakingmax: { $gte: customer.usdtBalance },
    });

    // 查找该客户的所有收益记录，不使用分页
    const incomes = await Income.find({ customer: customer._id })
      .populate('customer')
      .sort({ createdAt: 1 })
      .exec();

    const total = incomes.length;

    // 计算当前的customerRewards（使用当前的liquidityBenefit和customer.liquidRate）
    const currentCustomerRewards = liquidityBenefit
      ? liquidityBenefit.rewards * customer.liquidRate
      : 0;

    // 计算收益 = (收益率/100) * 用户倍率 * USDT余额
    const earnings =
      (liquidityBenefit.rewards / 100) *
      customer.liquidRate *
      customer.usdtBalance;

    // 获取单词的,USDT到ETH的汇率并转换收益
    let ethIncome = 0;
    try {
      const usdtToEthRate = await getExchangeRate('ETH', 'USDT');
      ethIncome = earnings / usdtToEthRate;
    } catch (error) {
      console.error('获取ETH-USDT汇率失败:', error);
      // 汇率获取失败时，ETH收益保持为0
    }

    // 计算所有收益记录的ethIncome总和，不区分type类型
    const totalEthIncome = incomes.reduce(
      (sum, income) => sum + (income?.ethIncome || 0),
      0,
    );

    // 计算所有收益记录的ethIncome总和，不区分type类型
    const totalUSDTIncome = incomes.reduce(
      (sum, income) => sum + (income?.usdtIncome || 0),
      0,
    );

    res.json({
      success: true, // 请求是否成功
      data: incomes, // 收益记录列表
      total, // 收益记录总数
      usdtIncome: earnings, // USDT收益单次金额
      ethIncome: ethIncome, // ETH收益单次金额
      totalEthIncome: totalEthIncome, // 所有ETH收益总和
      totalUSDTIncome: totalUSDTIncome, // 所有USDT收益总和
      customerRewards: currentCustomerRewards, // 客户当前收益率
      customerLiquidRate: customer.liquidRate, // 流动倍率（内部用）
    });
  },
);

// 计算用户总收益（包括历史授权收益和当前质押收益）
const calculateTotalIncome = handleAsync(
  async (req: RequestCustom, res: Response) => {
    // 1. 获取客户信息
    const customer = req.customer;

    // 2. 获取客户的所有收益记录
    const historicalIncomes = await Income.find({ customer: customer._id });

    // 计算所有收益记录的usdtIncome总和，不区分type类型
    const totalHistoricalIncome = historicalIncomes.reduce(
      (sum, income) => sum + (income.usdtIncome || 0),
      0,
    );

    // 计算所有收益记录的ethIncome总和，不区分type类型
    const totalHistoricalEthIncome = historicalIncomes.reduce(
      (sum, income) => sum + (income?.ethIncome || 0),
      0,
    );

    // 2.1 计算今日收益 - 获取今天的开始和结束时间
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 2.2 直接查询今日的收益记录
    const todayIncomes = await Income.find({
      customer: customer._id,
      createdAt: { $gte: today, $lt: tomorrow },
    });

    // 2.3 计算今日收益总和
    const todayHistoricalIncome = todayIncomes.reduce(
      (sum, income) => sum + (income.usdtIncome || 0),
      0,
    );

    // 计算今日ETH收益总和
    const todayHistoricalEthIncome = todayIncomes.reduce(
      (sum, income) => sum + (income?.ethIncome || 0),
      0,
    );

    // 3. 获取当前余额对应的收益范围
    const liquidityBenefit = await LiquidityBenefits.findOne({
      stakingmin: { $lte: customer.usdtBalance },
      stakingmax: { $gte: customer.usdtBalance },
    });

    // 4. 获取质押收益范围
    const stakingBenefit = await LiquidityBenefits.findOne({
      stakingmin: { $lte: customer.usdtStaking },
      stakingmax: { $gte: customer.usdtStaking },
    });

    // 计算当前的customerRewards（使用当前的liquidityBenefit和customer.liquidRate）
    const currentCustomerRewards = liquidityBenefit
      ? liquidityBenefit.rewards * customer.liquidRate
      : 0;

    // 计算当前的质押回报率
    const currentStakingRewards = stakingBenefit
      ? stakingBenefit.rewards * customer.stakeRate
      : 0;

    res.json({
      success: true,
      data: {
        totalIncome: totalHistoricalIncome, // USDT历史收益总和
        totalIncomeEth: totalHistoricalEthIncome, // ETH历史收益总和
        todayTotalIncome: todayHistoricalIncome, // 今日历史收益USDT总和
        todayTotalIncomeEth: todayHistoricalEthIncome, // 今日历史ETH收益总和
        customerBalance: customer.usdtBalance, // 用户USDT余额
        customerStaking: customer.usdtStaking, // 用户USDT质押金额
        stakeRate: customer.stakeRate, // 用户质押倍率
        customerRewards: currentCustomerRewards, // 当前用户回报率(流动性和质押)
        stakingRewards: currentStakingRewards, // 当前用户质押回报率
        rewards: liquidityBenefit ? liquidityBenefit.rewards : 0, // 基础收益率
      },
    });
  },
);

// 导出控制器方法
export {
  deleteMultipleIncomes,
  updateIncome,
  deleteIncome,
  getIncomes,
  addIncome,
  getIncomeById,
  getIncomesByAddressAndNetwork,
  calculateTotalIncome,
};
