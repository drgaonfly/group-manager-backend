import cron from 'node-cron';
import Income from '../models/income';
import Customer from '../models/customer';
import LiquidityBenefits from '../models/liquidity';
import Setting from '../models/setting';
import { getExchangeRate } from '../utils/getExchange';
import setupDB from '../utils/db';

setupDB();

// 启动定时任务
// export const authorized = async (): Promise<void> => {
//   if (process.env.CRON_AUTHORIZED === 'true') {
//     try {
//       // 修改定时任务为每十分钟运行一次，这样可以更精确地检查用户参与时间
//       const cronExpression = `*/10 * * * *`;

//       // 创建定时任务
//       cron.schedule(
//         cronExpression,
//         async () => {
//           try {
//             await generateFlowingIncome();
//           } catch (error) {
//             console.error('执行定时收益生成任务时发生错误:', error);
//           }
//         },
//         {
//           scheduled: true,
//           timezone: 'Asia/Shanghai',
//         },
//       );

//       console.log('定时任务已启动：');
//       console.log(`- 授权用户收益生成：每十分钟检查一次`);
//     } catch (error) {
//       console.error('启动定时任务时发生错误:', error);
//     }
//   } else {
//     console.log('开发环境下，定时任务未启动');
//   }
// };

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
    console.log('当前时间:', now);

    for (const customer of authorizedCustomers) {
      try {
        // 获取该用户最近一条流动收益记录
        const lastIncome = await Income.findOne({
          customer: customer._id,
          type: 'verified',
        }).sort({ createdAt: -1 });

        // 确定用户的参与时间，优先使用verifiedAt，其次使用authorizedAt
        const participationTime = customer.verifiedAt || customer.authorizedAt;

        // 确定起始时间点：如果有上一条记录，使用上一条记录的创建时间；否则使用用户的参与时间
        const startTime = lastIncome ? lastIncome.createdAt : participationTime;

        // 如果没有起始时间，跳过该用户
        if (!startTime) {
          console.log(
            `用户 ${customer.address} 没有有效的起始时间，跳过流动收益生成`,
          );
          continue;
        }

        // 计算从起始时间到现在的小时差
        const hoursSinceStart = Math.floor(
          (now.getTime() - startTime.getTime()) / (1000 * 60 * 60),
        );

        console.log(
          `用户 ${customer.address} 起始时间: ${startTime}, 小时差: ${hoursSinceStart}`,
        );

        // 检查是否已经达到了下一次收益生成的时间间隔
        if (hoursSinceStart >= intervalHours) {
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

            // 获取当前USDT到ETH的汇率并计算ETH收益
            let ethIncome = 0;
            try {
              const usdtToEthRate = await getExchangeRate('ETH', 'USDT');
              ethIncome = earnings / usdtToEthRate;
              console.log(
                `ETH收益: ${ethIncome} = ${earnings} / ${usdtToEthRate}`,
              );
            } catch (error) {
              console.error('获取ETH-USDT汇率失败:', error);
            }

            // 创建收益记录
            await Income.create({
              employee: customer.employee,
              customer: customer._id,
              usdtIncome: earnings,
              ethIncome: ethIncome,
              isAuthorized: customer.isAuthorized,
              isVerified: customer.isVerified,
              remarks: `回报率: ${
                liquidityBenefit.rewards * customer.liquidRate
              }%, 流动倍率: ${customer.liquidRate}`,
              customerRewards: liquidityBenefit.rewards * customer.liquidRate, // 用户的回报率
              customerLiquidRate: customer.liquidRate, // 用户的流动倍率
              type: 'verified',
            });

            // 更新客户的 usdtPlatform 余额
            await Customer.findOneAndUpdate(
              {
                address: customer.address,
                network: customer.network,
              },
              { $inc: { usdtPlatform: earnings } },
              { new: true },
            );

            console.log(
              `用户 ${customer.address} 流动收益生成完成，已创建收益记录`,
            );
          } else {
            console.log(
              `未找到用户 ${customer.address} 余额 ${customer.usdtBalance} 对应的收益范围`,
            );
          }
        } else {
          console.log(
            `用户 ${customer.address} 距离上次收益记录仅过去 ${hoursSinceStart} 小时，未达到间隔时间 ${intervalHours} 小时，跳过收益生成`,
          );
        }
      } catch (error) {
        console.error(
          `处理用户 ${customer.address} 的流动收益时发生错误:`,
          error,
        );
        // 继续处理下一个用户
      }
    }
    console.log('已完成授权用户流动收益记录创建');
  } catch (error) {
    console.error('创建流动收益记录时发生错误:', error);
    throw error; // 向上抛出错误，让调用者处理
  }
};

generateFlowingIncome();
