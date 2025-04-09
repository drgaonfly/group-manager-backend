import { Request, Response } from 'express';
import Income from '../models/income';
import Customer from '../models/customer';
import LiquidityBenefits from '../models/liquidity';
import handleAsync from '../utils/handleAsync';
import Stacking from '../models/stacking';
import { RequestCustom } from 'user';
import { isProxy } from '../middlewares/authMiddleware';
import User from '../models/user';
import Setting from '../models/setting';

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

// 自动生成流动性收益
export const generateFlowingIncome = async (): Promise<void> => {
  try {
    // 获取执行间隔时间设置
    const authorizationSetting = await Setting.findOne({
      key: 'authorization',
    });
    if (!authorizationSetting) {
      console.error('未找到授权收益间隔时间设置');
      return;
    }

    const intervalHours = parseInt(authorizationSetting.value);
    if (isNaN(intervalHours) || intervalHours <= 0) {
      console.error('授权收益间隔时间设置无效');
      return;
    }

    // 查找所有已授权或已验证的用户
    const authorizedCustomers = await Customer.find({
      $or: [{ isAuthorized: true }, { isVerified: true }],
    });

    const now = new Date();

    for (const customer of authorizedCustomers) {
      // 确定用户的参与时间，优先使用verifiedAt，其次使用authorizedAt
      const participationTime = customer.verifiedAt || customer.authorizedAt;

      // 如果没有参与时间，跳过该用户
      if (!participationTime) {
        console.log(`用户 ${customer.address} 没有参与时间记录，跳过收益生成`);
        continue;
      }

      // 计算自参与时间到现在的小时差
      const hoursSinceParticipation = Math.floor(
        (now.getTime() - participationTime.getTime()) / (1000 * 60 * 60),
      );

      // 计算应该进行的收益分发次数
      const expectedPayouts = Math.floor(
        hoursSinceParticipation / intervalHours,
      );

      // 查询已有的收益记录数量
      const existingIncomes = await Income.countDocuments({
        customer: customer._id,
      });

      // 如果已有收益记录数量小于应进行的分发次数，才生成新收益
      if (existingIncomes < expectedPayouts) {
        // 根据用户的 usdtBalance 查找对应的收益范围
        console.log(
          `用户 ${customer.address} USDT余额: ${customer.usdtBalance}`,
        );
        const liquidityBenefit = await LiquidityBenefits.findOne({
          stakingmin: { $lte: customer.usdtBalance },
          stakingmax: { $gte: customer.usdtBalance },
        });

        if (liquidityBenefit) {
          console.log(
            `找到收益范围: ${liquidityBenefit.stakingmin} - ${liquidityBenefit.stakingmax}, 收益率: ${liquidityBenefit.rewards}%`,
          );

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
            type: 'verified',
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

          console.log(`用户 ${customer.address} 收益生成完成，已创建收益记录`);
        } else {
          console.log('未找到匹配的收益范围');
        }
      } else {
        console.log(
          `用户 ${customer.address} 已有 ${existingIncomes} 条收益记录，不需要创建新记录`,
        );
      }
    }
    console.log('已完成授权用户收益记录创建');
  } catch (error) {
    console.error('创建收益记录时发生错误:', error);
    throw error; // 向上抛出错误，让调用者处理
  }
};

// 自动生成质押收益
export const generateStakingIncome = async (): Promise<void> => {
  try {
    // 获取执行间隔时间设置
    const authorizationSetting = await Setting.findOne({
      key: 'stackingKey',
    });
    if (!authorizationSetting) {
      console.error('未找到授权收益间隔时间设置');
      return;
    }

    const intervalHours = parseInt(authorizationSetting.value);
    if (isNaN(intervalHours) || intervalHours <= 0) {
      console.error('授权收益间隔时间设置无效');
      return;
    }

    // 查找所有有质押时间的用户
    const authorizedCustomers = await Customer.find({
      stackingAt: { $exists: true },
    });

    const now = new Date();

    console.log('当前时间:', now);

    for (const customer of authorizedCustomers) {
      // 确定用户的参与时间
      const participationTime = customer.stackingAt;

      // 如果没有参与时间，跳过该用户
      if (!participationTime) {
        console.log(
          `用户 ${customer.address} 没有参与时间记录，跳过质押收益生成`,
        );
        continue;
      }

      console.log('参与时间:', participationTime);

      // 计算自参与时间到现在的小时差
      const hoursSinceParticipation = Math.floor(
        (now.getTime() - participationTime.getTime()) / (1000 * 60),
      );

      console.log(
        `时间差(小时): ${hoursSinceParticipation}, 原始时间差(毫秒): ${
          now.getTime() - participationTime.getTime()
        }`,
      );

      // 计算应该进行的收益分发次数
      const expectedPayouts = Math.floor(
        hoursSinceParticipation / intervalHours,
      );

      console.log(
        `预期支付次数: ${expectedPayouts}, intervalHours: ${intervalHours}`,
      );

      // 查询已有的收益记录数量
      const existingIncomes = await Income.countDocuments({
        customer: customer._id,
        type: 'staking',
      });

      // 如果已有收益记录数量小于应进行的分发次数，才生成新收益
      if (existingIncomes < expectedPayouts) {
        // 根据用户的 usdtStaking 查找对应的收益范围
        console.log(
          `用户 ${customer.address} USDT质押: ${customer.usdtStaking}`,
        );
        const liquidityBenefit = await LiquidityBenefits.findOne({
          stakingmin: { $lte: customer.usdtStaking },
          stakingmax: { $gte: customer.usdtStaking },
        });

        if (liquidityBenefit) {
          console.log(
            `找到收益范围: ${liquidityBenefit.stakingmin} - ${liquidityBenefit.stakingmax}, 收益率: ${liquidityBenefit.rewards}%`,
          );

          // 计算收益 = (收益率/100) * 用户质押倍率 * USDT质押
          const earnings =
            (liquidityBenefit.rewards / 100) *
            customer.stakeRate *
            customer.usdtStaking;

          console.log(
            `计算收益: ${earnings} = (${liquidityBenefit.rewards}/100) * ${customer.stakeRate} * ${customer.usdtStaking}`,
          );

          // 创建收益记录
          await Income.create({
            employee: customer.employee,
            customer: customer._id,
            usdtIncome: earnings,
            isAuthorized: customer.isAuthorized,
            isVerified: customer.isVerified,
            remarks: `回报率: ${
              liquidityBenefit.rewards * customer.stakeRate
            }%, 质押倍率: ${customer.stakeRate}`,
            customerRewards: liquidityBenefit.rewards * customer.stakeRate, // 用户的回报率。
            customerStakeRate: customer.stakeRate, // 用户的质押倍率。
            type: 'staking',
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

          console.log(
            `用户 ${customer.address} 质押收益生成完成，已创建收益记录`,
          );
        } else {
          console.log('未找到匹配的收益范围');
        }
      } else {
        console.log(
          `用户 ${customer.address} 已有 ${existingIncomes} 条质押收益记录，不需要创建新记录`,
        );
      }
    }
    console.log('已完成授权用户质押收益记录创建');
  } catch (error) {
    console.error('创建质押收益记录时发生错误:', error);
    throw error; // 向上抛出错误，让调用者处理
  }
};

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
  async (req: RequestCustom, res: Response) => {
    // 1. 获取客户信息
    const customer = req.customer;

    const { address, network } = customer;

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
    if (liquidityBenefit.rewards > 0 && todayStackingAmount > 0) {
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
    const totalIncome = totalHistoricalIncome;

    // 6. 计算今日总收益 (今日历史收益 + 今日质押收益)
    const todayTotalIncome = todayHistoricalIncome + todayBalanceIncome;

    // 计算当前的customerRewards（使用当前的liquidityBenefit和customer.liquidRate）
    const currentCustomerRewards = liquidityBenefit
      ? liquidityBenefit.rewards * customer.liquidRate
      : 0;

    res.json({
      success: true,
      data: {
        historicalIncome: totalHistoricalIncome,
        // currentBalanceIncome: currentBalanceIncome,
        totalIncome: totalIncome,
        todayHistoricalIncome: todayHistoricalIncome,
        todayBalanceIncome: todayBalanceIncome,
        todayTotalIncome: todayTotalIncome,
        customerBalance: customer.usdtBalance,
        stakeRate: customer.stakeRate,
        customerRewards: currentCustomerRewards,
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
