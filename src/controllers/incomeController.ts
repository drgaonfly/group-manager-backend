import { Request, Response } from 'express';
import Income from '../models/income';
import Customer from '../models/customer';
import LiquidityBenefits from '../models/liquidity';
import handleAsync from '../utils/handleAsync';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.customer) {
    query.customer = queryParams.customer;
  }

  if (queryParams.coinName) {
    query.coinName = { $regex: new RegExp(queryParams.coinName, 'i') };
  }

  return query;
};

// 获取所有收入记录
const getIncomes = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

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

    // 查找该客户的所有收益记录，不使用分页
    const incomes = await Income.find({ customer: customer._id })
      .populate('customer')
      .sort('-createdAt')
      .exec();

    const total = incomes.length;

    // 计算总的usdtIncome
    const totalUsdtIncome = incomes.reduce(
      (sum, income) => sum + (income.usdtIncome || 0),
      0,
    );

    // 获取最新的customerRewards（取最新一条记录的customerRewards）
    const latestCustomerRewards =
      incomes.length > 0 ? incomes[0].customerRewards : 0;

    // 获取最新的customerLiquidRate（取最新一条记录的customerLiquidRate）
    const latestCustomerLiquidRate =
      incomes.length > 0 ? incomes[0].customerLiquidRate : 0;

    res.json({
      success: true,
      data: incomes,
      total,
      totalUsdtIncome,
      customerRewards: latestCustomerRewards,
      customerLiquidRate: latestCustomerLiquidRate,
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
};
