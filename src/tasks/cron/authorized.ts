import Income from '../../models/income';
import Customer from '../../models/customer';
import LiquidityBenefits from '../../models/liquidity';
import Setting from '../../models/setting';
import { getExchangeRate } from '../../utils/getExchange';
import { formatUSDT, formatETH } from '../../services/format';
import DepthIncome from '../../models/depthIncome';
import TeamBenefit from '../../models/teamBenefit';

// 自动生成收益
export const generateIncome = async (): Promise<void> => {
  try {
    console.log('========== 开始执行收益生成任务 ==========');
    const currentTime = new Date();
    console.log(
      `[当前时间] ${currentTime.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
      })}`,
    );

    // 获取流动性和质押收益的执行间隔时间设置
    const [liquiditySetting, stakingSetting] = await Promise.all([
      Setting.findOne({ key: 'authorization' }),
      Setting.findOne({ key: 'stackingKey' }),
    ]);

    if (!liquiditySetting || !stakingSetting) {
      console.error('[配置错误] 未找到收益间隔时间设置');
      return;
    }

    const liquidityIntervalHours = parseFloat(liquiditySetting.value);
    const stakingIntervalHours = parseFloat(stakingSetting.value);

    // 查找所有符合条件的用户
    const customers = await Customer.find({
      $and: [
        { $or: [{ isAuthorized: true }, { isVerified: true }] },
        { $or: [{ usdtBalance: { $gt: 0 } }, { usdtStaking: { $gt: 0 } }] },
        { isPausedIncome: false },
      ],
    });

    console.log(`[用户统计] 找到符合条件的用户总数: ${customers.length}`);

    let stats = {
      processed: 0,
      generated: 0,
      skipped: 0,
      errors: 0,
    };

    for (const customer of customers) {
      try {
        // 处理流动性收益
        if (customer.usdtBalance > 0) {
          await processLiquidityIncome(customer, liquidityIntervalHours, stats);
        }

        // 处理质押收益
        if (customer.usdtStaking > 0) {
          await processStakingIncome(customer, stakingIntervalHours, stats);
        }
      } catch (error) {
        console.error(
          `[处理错误] 处理用户 ${customer.address} 时发生错误:`,
          error,
        );
        stats.errors++;
      }
    }

    // 输出统计信息
    const endTime = new Date();
    const taskDuration = (endTime.getTime() - currentTime.getTime()) / 1000;

    console.log('\n========== 收益生成任务统计 ==========');
    console.log(`[统计信息] 总用户数: ${customers.length}`);
    console.log(`[统计信息] 处理用户数: ${stats.processed}`);
    console.log(`[统计信息] 生成收益数: ${stats.generated}`);
    console.log(`[统计信息] 跳过用户数: ${stats.skipped}`);
    console.log(`[统计信息] 错误用户数: ${stats.errors}`);
    console.log(`[统计信息] 任务总耗时: ${taskDuration.toFixed(2)}秒`);
    console.log('========== 收益记录创建完成 ==========');
  } catch (error) {
    console.error('[系统错误] 创建收益记录时发生错误:', error);
    throw error;
  }
};

// 处理流动性收益
async function processLiquidityIncome(
  customer: any,
  intervalHours: number,
  stats: any,
) {
  const incomeType = 'verified';
  const lastIncome = await getLastIncome(customer._id, incomeType);
  const participationTime = getParticipationTime(customer, lastIncome);

  if (!shouldGenerateIncome(participationTime, intervalHours)) {
    stats.skipped++;
    return;
  }

  const liquidityBenefit = await getLiquidityBenefit(customer.usdtBalance);
  if (!liquidityBenefit) {
    stats.skipped++;
    return;
  }

  const { earnings, ethIncome } = await calculateIncome(
    liquidityBenefit.rewards,
    customer.liquidRate,
    customer.usdtBalance,
  );

  if (!isValidIncome(earnings, ethIncome)) {
    stats.skipped++;
    return;
  }

  const earningTime = new Date(
    participationTime.getTime() + intervalHours * 60 * 60 * 1000,
  );

  await createIncomeRecord(
    customer,
    earnings,
    ethIncome,
    liquidityBenefit,
    incomeType,
    earningTime,
    intervalHours,
  );

  await handleTeamBenefit(customer, earnings, ethIncome, earningTime);

  stats.generated++;
  stats.processed++;
}

// 处理质押收益
async function processStakingIncome(
  customer: any,
  intervalHours: number,
  stats: any,
) {
  const incomeType = 'staking';
  const lastIncome = await getLastIncome(customer._id, incomeType);
  const participationTime = getParticipationTime(customer, lastIncome);

  if (!shouldGenerateIncome(participationTime, intervalHours)) {
    stats.skipped++;
    return;
  }

  const liquidityBenefit = await getLiquidityBenefit(customer.usdtStaking);
  if (!liquidityBenefit) {
    stats.skipped++;
    return;
  }

  const { earnings, ethIncome } = await calculateIncome(
    liquidityBenefit.rewards,
    customer.stakeRate,
    customer.usdtStaking,
  );

  if (!isValidIncome(earnings, ethIncome)) {
    stats.skipped++;
    return;
  }

  const earningTime = new Date(
    participationTime.getTime() + intervalHours * 60 * 60 * 1000,
  );

  await createIncomeRecord(
    customer,
    earnings,
    ethIncome,
    liquidityBenefit,
    incomeType,
    earningTime,
    intervalHours,
    true,
  );

  stats.generated++;
  stats.processed++;
}

// 工具函数
async function getLastIncome(customerId: string, type: string) {
  return await Income.findOne({
    customer: customerId,
    type,
    isManual: false,
  }).sort({ earningTime: -1 });
}

function getParticipationTime(customer: any, lastIncome: any): Date {
  let participationTime = customer.isVerified
    ? customer.verifiedAt
    : customer.authorizedAt;

  if (lastIncome && lastIncome.earningTime > participationTime) {
    participationTime = lastIncome.earningTime;
  }

  return participationTime;
}

function shouldGenerateIncome(
  participationTime: Date,
  intervalHours: number,
): boolean {
  const hoursSinceParticipation = Number(
    (
      (new Date().getTime() - participationTime.getTime()) /
      (1000 * 60 * 60)
    ).toFixed(2),
  );
  return hoursSinceParticipation >= intervalHours;
}

async function getLiquidityBenefit(amount: number) {
  return await LiquidityBenefits.findOne({
    stakingmin: { $lte: amount },
    stakingmax: { $gte: amount },
  });
}

async function calculateIncome(rewards: number, rate: number, balance: number) {
  const earnings = (rewards / 100) * rate * balance;
  const usdtToEthRate = await getExchangeRate('ETH', 'USDT');
  const ethIncome = earnings / usdtToEthRate;
  return { earnings, ethIncome };
}

function isValidIncome(earnings: number, ethIncome: number): boolean {
  return formatUSDT(earnings) !== 0 && formatETH(ethIncome) !== 0;
}

async function createIncomeRecord(
  customer: any,
  earnings: number,
  ethIncome: number,
  benefit: any,
  type: string,
  earningTime: Date,
  intervalHours: number,
  isStaking: boolean = false,
) {
  const rate = isStaking ? customer.stakeRate : customer.liquidRate;
  const remarks = `回报率: ${benefit.rewards * rate}%, ${
    isStaking ? '质押' : '流动'
  }倍率: ${rate}`;

  await Income.create({
    employee: customer.employee,
    customer: customer._id,
    proxy: customer.proxy,
    usdtIncome: earnings,
    ethIncome: ethIncome,
    isAuthorized: customer.isAuthorized,
    isVerified: customer.isVerified,
    remarks,
    customerRewards: benefit.rewards * rate,
    customerLiquidRate: customer.liquidRate,
    customerStakeRate: customer.stakeRate,
    type,
    stakingIcome: isStaking,
    earningTime,
    intervalHours,
  });

  await Customer.findOneAndUpdate(
    { _id: customer._id },
    { $inc: { ethPlatform: ethIncome } },
  );
}

async function handleTeamBenefit(
  customer: any,
  earnings: number,
  ethIncome: number,
  earningTime: Date,
  depth: number = 1,
) {
  const maxDepth = await DepthIncome.countDocuments();

  if (depth > maxDepth || !customer.parent) {
    return;
  }

  const parentCustomer = await Customer.findById(customer.parent);
  if (!parentCustomer) {
    return;
  }

  const depthIncome = await DepthIncome.findOne({ depth });
  if (!depthIncome) {
    return;
  }

  const incomeRate = depthIncome.incomeRate / 100;
  const teamEthIncome = ethIncome * incomeRate;
  const teamUsdtIncome = earnings * incomeRate;

  await TeamBenefit.create({
    customer: customer._id,
    parent: parentCustomer._id,
    fromAddress: customer.address,
    fromNetwork: customer.network,
    depth,
    incomeRate: depthIncome.incomeRate,
    usdtIncome: teamUsdtIncome,
    ethIncome: teamEthIncome,
    toAddress: parentCustomer.address,
    toNetwork: parentCustomer.network,
    earningTime,
  });

  await handleTeamBenefit(
    parentCustomer,
    earnings,
    ethIncome,
    earningTime,
    depth + 1,
  );
}
