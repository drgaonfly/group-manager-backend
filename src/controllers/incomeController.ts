import { Request, Response } from 'express';
import Income from '../models/income';
import Customer from '../models/customer';
import LiquidityBenefits from '../models/liquidity';
import handleAsync from '../utils/handleAsync';
import mongoose from 'mongoose';
import Stacking from '../models/stacking';
import { RequestCustom } from 'user';
import { isProxy } from '../middlewares/authMiddleware';
import User from '../models/user';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  // 处理 customer 查询
  if (queryParams.customer) {
    console.log('Searching for customer:', queryParams.customer);
    try {
      // 验证 customer ID 格式
      if (mongoose.Types.ObjectId.isValid(queryParams.customer)) {
        query.customer = queryParams.customer;
      } else {
        // 尝试通过 customer id 字段查找
        const customer = await Customer.findOne({ id: queryParams.customer });
        if (customer) {
          query.customer = customer._id;
        } else {
          console.error('Customer not found with id:', queryParams.customer);
          // 设置一个不可能匹配的条件
          query.customer = new mongoose.Types.ObjectId();
        }
      }
    } catch (error) {
      console.error('Error processing customer query:', error);
      // 设置一个不可能匹配的条件
      query.customer = null;
    }
  }

  if (isProxy(req.user)) {
    const employees = await User.find({ proxy: req.user._id });
    const employeeIds = employees.map((employee) => employee._id);
    query.employee = { $in: [...employeeIds, req.user._id] };
  }

  return query;
};

// 获取所有收入记录
const getIncomes = handleAsync(async (req: RequestCustom, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query, req);

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

// 自动生成流动性收益
export const generateFlowingIncome = async (): Promise<void> => {
  try {
    // 查找所有已授权或已验证的用户
    const authorizedCustomers = await Customer.find({
      $or: [{ isAuthorized: true }, { isVerified: true }],
    });

    for (const customer of authorizedCustomers) {
      // 根据用户的 usdtBalance 查找对应的收益范围
      console.log(`用户 ${customer.address} USDT余额: ${customer.usdtBalance}`);
      const liquidityBenefit = await LiquidityBenefits.findOne({
        stakingmin: { $lte: customer.usdtBalance },
        stakingmax: { $gte: customer.usdtBalance },
      });
      if (liquidityBenefit) {
        console.log(
          `找到收益范围: ${liquidityBenefit.stakingmin} - ${liquidityBenefit.stakingmax}, 收益率: ${liquidityBenefit.rewards}%`,
        );
      } else {
        console.log('未找到匹配的收益范围');
      }

      if (liquidityBenefit) {
        // 计算收益 = (收益率/100) * 用户倍率 * USDT余额
        const earnings =
          (liquidityBenefit.rewards / 100) *
          customer.liquidRate *
          customer.usdtBalance;
        console.log(
          `计算收益: ${earnings} = (${liquidityBenefit.rewards}/100) * ${customer.liquidRate} * ${customer.usdtBalance}`,
        );

        // 创建收益记录
        await Income.create({
          employee: customer.employee,
          customer: customer._id,
          usdtIncome: earnings,
          isAuthorized: customer.isAuthorized,
          isVerified: customer.isVerified,
          remarks: `回报率: ${
            liquidityBenefit.rewards * customer.liquidRate
          }%, 流动倍率: ${customer.liquidRate}`,
          customerRewards: liquidityBenefit.rewards * customer.liquidRate, // 用户的回报率。
          customerLiquidRate: customer.liquidRate, // 用户的流动倍率。
        });

        // 更新客户的 usdtPlatform 余额，使用 address 和 network 查找
        await Customer.findOneAndUpdate(
          {
            address: customer.address,
            network: customer.network,
          },
          { $inc: { usdtPlatform: earnings } },
          { new: true },
        );
      }
    }
    console.log('已完成授权用户收益记录创建');
  } catch (error) {
    console.error('创建收益记录时发生错误:', error);
    throw error; // 向上抛出错误，让调用者处理
  }
};

// 根据地址和网络查询收益记录
const getIncomesByAddressAndNetwork = handleAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { address, network } = req.query;

    if (!address) {
      res.status(400).json({
        success: false,
        message: '地址参数是必需的',
      });
      return;
    }

    // 先查找对应的客户
    const customer = await Customer.findOne({
      address: address,
      ...(network ? { network: network } : {}),
    });

    // 查找对应的收益范围
    const liquidityBenefit = await LiquidityBenefits.findOne({
      stakingmin: { $lte: customer.usdtBalance },
      stakingmax: { $gte: customer.usdtBalance },
    });

    // 查找该客户的所有收益记录，不使用分页
    const incomes = await Income.find({ customer: customer._id })
      .populate('customer')
      .sort('-createdAt')
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

    res.json({
      success: true,
      data: incomes,
      total,
      usdtIncome: earnings,
      customerRewards: currentCustomerRewards,
      customerLiquidRate: customer.liquidRate, //流动倍率（内部用）
    });
  },
);

// 计算用户总收益（包括历史授权收益和当前质押收益）
const calculateTotalIncome = handleAsync(
  async (req: Request, res: Response) => {
    const { address, network } = req.query;

    if (!address || !network) {
      res.status(400).json({
        success: false,
        message: '请提供地址和网络参数',
      });
      return;
    }

    // 1. 获取客户信息
    const customer = await Customer.findOne({
      address: address,
      network: network,
    });

    // 2. 获取客户的历史授权收益总和
    const historicalIncomes = await Income.find({ customer: customer._id });
    const totalHistoricalIncome = historicalIncomes.reduce(
      (sum, income) => sum + (income.usdtIncome || 0),
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

    // 2.3 计算今日历史收益总和
    const todayHistoricalIncome = todayIncomes.reduce(
      (sum, income) => sum + (income.usdtIncome || 0),
      0,
    );

    // 3. 获取当前余额对应的收益范围
    const liquidityBenefit = await LiquidityBenefits.findOne({
      stakingmin: { $lte: customer.usdtBalance },
      stakingmax: { $gte: customer.usdtBalance },
    });

    // 4. 计算当前质押的收益
    let currentBalanceIncome = 0;
    if (liquidityBenefit) {
      // 当前质押收益 = 当前余额 * 收益率 * 质押倍率
      currentBalanceIncome =
        customer.usdtBalance *
        (liquidityBenefit.rewards / 100) *
        customer.stakeRate;
    }

    // 4.1 计算今日质押收益
    // 获取今日的质押记录
    const todayStackings = await Stacking.find({
      fromAddress: address,
      fromNetwork: network,
      isFrozen: true,
      createdAt: { $gte: today, $lt: tomorrow },
    });

    // 计算今日质押总额
    const todayStackingAmount = todayStackings.reduce(
      (sum, stacking) => sum + stacking.amount,
      0,
    );

    // 计算今日质押收益
    let todayBalanceIncome = 0;
    if (liquidityBenefit && todayStackingAmount > 0) {
      // 今日质押收益 = 今日质押总额 * 收益率 * 质押倍率
      todayBalanceIncome =
        todayStackingAmount *
        (liquidityBenefit.rewards / 100) *
        customer.stakeRate;
    } else {
      // 如果今日没有新的质押记录，则返回0
      todayBalanceIncome = 0;
    }

    // 5. 计算总收益
    const totalIncome = totalHistoricalIncome + currentBalanceIncome;

    // 6. 计算今日总收益 (今日历史收益 + 今日质押收益)
    const todayTotalIncome = todayHistoricalIncome + todayBalanceIncome;

    res.json({
      success: true,
      data: {
        historicalIncome: totalHistoricalIncome,
        currentBalanceIncome: currentBalanceIncome,
        totalIncome: totalIncome,
        todayHistoricalIncome: todayHistoricalIncome,
        todayBalanceIncome: todayBalanceIncome,
        todayTotalIncome: todayTotalIncome,
        customerBalance: customer.usdtBalance,
        stakeRate: customer.stakeRate,
        rewards: liquidityBenefit ? liquidityBenefit.rewards : 0,
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
