import Customer from '../models/customer';
import Income from '../models/income';
import LiquidityBenefits from '../models/liquidity';
import Setting from '../models/setting';
import { getExchangeRate } from '../utils/getExchange';
import setupDB from '../utils/db';

setupDB();

// 启动定时任务
// export const stacking = async (): Promise<void> => {
//   if (process.env.CRON_STACKING === 'true') {
//     try {
//       // 修改定时任务为每小时运行一次，这样可以更精确地检查用户参与时间
//       // const cronExpression = `*/10 * * * *`;
//       // 修改为每3分钟执行一次
//       const cronExpression = `*/3 * * * *`;
//       // const cronExpression = `* * * * *`;

//       // 创建定时任务
//       cron.schedule(
//         cronExpression,
//         async () => {
//           try {
//             // 自动生成质押收益
//             await generateStakingIncome();
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
//       console.log(`- 授权用户收益生成：每3分钟检查一次`);
//     } catch (error) {
//       console.error('启动定时任务时发生错误:', error);
//     }
//   } else {
//     console.log('开发环境下，定时任务未启动');
//   }
// };

// 自动生成质押收益
const generateStakingIncome = async (): Promise<void> => {
  try {
    console.log('开始执行质押收益生成任务...');

    // 获取执行间隔时间设置
    const authorizationSetting = await Setting.findOne({
      key: 'stackingKey',
    });
    if (!authorizationSetting) {
      console.error('未找到质押收益间隔时间设置');
      return;
    }
    console.log(`找到质押设置: ${JSON.stringify(authorizationSetting)}`);

    // 原始代码
    // const intervalHours = parseInt(authorizationSetting.value);
    // 临时修改为3分钟（0.05小时）
    const intervalHours = 0.05;
    console.log(`当前设置的收益间隔时间: ${intervalHours} 小时`);

    if (isNaN(intervalHours) || intervalHours <= 0) {
      console.error('质押收益间隔时间设置无效');
      return;
    }

    // 查找所有有质押时间的用户
    const authorizedCustomers = await Customer.find({
      stackingAt: { $exists: true },
      usdtStaking: { $gt: 0 }, // 只处理有质押金额的用户
    });
    console.log(`找到符合条件的质押用户数量: ${authorizedCustomers.length}`);
    console.log(
      `用户ID列表: ${authorizedCustomers.map((c) => c._id).join(', ')}`,
    );

    const now = new Date();
    console.log('当前时间:', now);
    console.log('当前时间戳:', now.getTime());

    for (const customer of authorizedCustomers) {
      try {
        console.log(
          `\n========== 开始处理用户 ${customer.address} ${customer.network}==========`,
        );
        console.log(
          `用户详情: ID=${customer._id}, 网络=${customer.network}, 质押金额=${customer.usdtStaking}, 质押倍率=${customer.stakeRate}`,
        );

        // 获取该用户最近一条质押收益记录
        const lastIncome = await Income.findOne({
          customer: customer._id,
          type: 'staking',
        }).sort({ createdAt: -1 });

        console.log(
          `用户最近一条质押收益记录: ${
            lastIncome
              ? JSON.stringify({
                  id: lastIncome._id,
                  createdAt: lastIncome.createdAt,
                  usdtIncome: lastIncome.usdtIncome,
                })
              : '无'
          }`,
        );

        // 确定起始时间点：如果有上一条记录，使用上一条记录的创建时间；否则使用用户的质押时间
        const startTime = lastIncome
          ? lastIncome.createdAt
          : customer.stackingAt;

        console.log(
          `收益计算起始时间来源: ${
            lastIncome ? '上次收益记录' : '用户质押时间'
          }`,
        );

        if (!startTime) {
          console.log(
            `用户 ${customer.address} 没有有效的起始时间，跳过质押收益生成`,
          );
          continue;
        }
        console.log(`起始时间: ${startTime}, 时间戳: ${startTime.getTime()}`);

        // 计算从起始时间到现在的小时差
        const hoursSinceStart =
          (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        const minutesSinceStart = hoursSinceStart * 60;

        console.log(
          `用户 ${
            customer.address
          } 起始时间: ${startTime}, 小时差: ${hoursSinceStart.toFixed(
            4,
          )}, 分钟差: ${minutesSinceStart.toFixed(2)}`,
        );

        // 检查是否已经达到了下一次收益生成的时间间隔
        if (hoursSinceStart >= intervalHours) {
          console.log(
            `已达到收益生成时间间隔 (${hoursSinceStart.toFixed(
              4,
            )} >= ${intervalHours}), 开始生成收益`,
          );

          // 根据用户的 usdtStaking 查找对应的收益范围
          console.log(
            `用户 ${customer.address} USDT质押: ${customer.usdtStaking}`,
          );

          const liquidityBenefit = await LiquidityBenefits.findOne({
            stakingmin: { $lte: customer.usdtStaking },
            stakingmax: { $gte: customer.usdtStaking },
          });

          console.log(
            `查询收益范围条件: stakingmin <= ${customer.usdtStaking} <= stakingmax`,
          );

          if (liquidityBenefit) {
            console.log(
              `找到收益范围: ${liquidityBenefit.stakingmin} - ${
                liquidityBenefit.stakingmax
              }, 收益率: ${
                liquidityBenefit.rewards
              }%, 完整数据: ${JSON.stringify(liquidityBenefit)}`,
            );

            // 计算收益 = (收益率/100) * 用户质押倍率 * USDT质押
            const earnings =
              (liquidityBenefit.rewards / 100) *
              customer.stakeRate *
              customer.usdtStaking;

            console.log(
              `计算收益: ${earnings} = (${liquidityBenefit.rewards}/100) * ${customer.stakeRate} * ${customer.usdtStaking}`,
            );
            console.log(
              `用户实际收益率: ${(
                (liquidityBenefit.rewards * customer.stakeRate) /
                100
              ).toFixed(4)}%`,
            );

            // 获取当前USDT到ETH的汇率并计算ETH收益
            let ethIncome = 0;
            try {
              const usdtToEthRate = await getExchangeRate('ETH', 'USDT');
              console.log(`获取到ETH-USDT汇率: 1 ETH = ${usdtToEthRate} USDT`);
              ethIncome = earnings / usdtToEthRate;
              console.log(
                `ETH收益: ${ethIncome} = ${earnings} / ${usdtToEthRate}`,
              );
            } catch (error) {
              console.error('获取ETH-USDT汇率失败:', error);
            }

            // 创建收益记录
            const incomeData = {
              employee: customer.employee,
              customer: customer._id,
              usdtIncome: earnings,
              ethIncome: ethIncome,
              isAuthorized: customer.isAuthorized,
              isVerified: customer.isVerified,
              remarks: `回报率: ${
                liquidityBenefit.rewards * customer.stakeRate
              }%, 质押倍率: ${customer.stakeRate}`,
              customerRewards: liquidityBenefit.rewards * customer.stakeRate, // 用户的回报率
              customerLiquidRate: customer.liquidRate, // 用户的流动倍率
              customerStakeRate: customer.stakeRate, // 用户的质押倍率
              type: 'staking',
              stakingIcome: true, // 标记为质押收益
            };

            console.log(`准备创建收益记录: ${JSON.stringify(incomeData)}`);
            const newIncome = await Income.create(incomeData);
            console.log(`收益记录创建成功, ID: ${newIncome._id}`);

            // 更新客户的 usdtPlatform 余额
            const updateQuery = {
              address: customer.address,
              network: customer.network,
            };
            const updateOperation = { $inc: { usdtPlatform: earnings } };

            console.log(
              `准备更新用户余额, 查询条件: ${JSON.stringify(
                updateQuery,
              )}, 更新操作: ${JSON.stringify(updateOperation)}`,
            );

            const updatedCustomer = await Customer.findOneAndUpdate(
              updateQuery,
              updateOperation,
              { new: true },
            );

            console.log(
              `用户 ${customer.address} 余额更新成功, 新余额: ${updatedCustomer.usdtPlatform}`,
            );
            console.log(
              `用户 ${customer.address} 质押收益生成完成，已创建收益记录`,
            );
          } else {
            console.log(
              `未找到用户 ${customer.address} 质押金额 ${customer.usdtStaking} 对应的收益范围, 已查询所有收益范围`,
            );
            // 打印所有收益范围以便调试
            const allRanges = await LiquidityBenefits.find({}).sort({
              stakingmin: 1,
            });
            console.log(
              `系统中所有收益范围: ${JSON.stringify(
                allRanges.map((r) => ({
                  min: r.stakingmin,
                  max: r.stakingmax,
                  rewards: r.rewards,
                })),
              )}`,
            );
          }
        } else {
          console.log(
            `用户 ${
              customer.address
            } 距离上次收益记录仅过去 ${hoursSinceStart.toFixed(4)} 小时 (${(
              hoursSinceStart * 60
            ).toFixed(
              2,
            )} 分钟), 未达到间隔时间 ${intervalHours} 小时, 跳过收益生成`,
          );
        }
        console.log(
          `========== 用户 ${customer.address} 处理完成 ==========\n`,
        );
      } catch (error) {
        console.error(
          `处理用户 ${customer.address} 的质押收益时发生错误:`,
          error,
        );
        // 继续处理下一个用户
      }
    }
    console.log('已完成质押用户收益记录创建');
    process.exit(0); // 退出进程
  } catch (error) {
    console.error('创建质押收益记录时发生错误:', error);
    throw error; // 向上抛出错误，让调用者处理
  }
};

generateStakingIncome();
