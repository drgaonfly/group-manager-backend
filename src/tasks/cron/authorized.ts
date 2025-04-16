import Income from '../../models/income';
import Customer from '../../models/customer';
import LiquidityBenefits from '../../models/liquidity';
import Setting from '../../models/setting';
import { getExchangeRate } from '../../utils/getExchange';
import { formatUSDT, formatETH } from '../../services/format';

// 自动生成流动性收益
export const generateFlowingIncome = async (): Promise<void> => {
  try {
    console.log('========== 开始执行流动性收益生成任务 =========='); // 任务开始标记
    // 打印当前时间
    const currentTime = new Date();
    console.log(
      `[当前时间] ${currentTime.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
      })}`,
    );

    // 获取执行间隔时间设置
    const authorizationSetting = await Setting.findOne({
      key: 'authorization',
    });

    if (!authorizationSetting) {
      console.error('[配置错误] 未找到授权收益间隔时间设置 [authorization]'); // 添加键名以便识别
      return;
    }

    const intervalHours = parseFloat(authorizationSetting.value);
    console.log(
      `[系统配置] 流动性收益间隔时间: ${intervalHours} 小时, 原始值: ${authorizationSetting.value}`,
    ); // 显示原始值和解析后的值

    // if (isNaN(intervalHours) || intervalHours <= 0) {
    //   console.error(
    //     `[配置错误] 授权收益间隔时间设置无效: ${authorizationSetting.value} -> ${intervalHours}`,
    //   ); // 显示转换前后的值
    //   return;
    // }

    // 查找所有已授权或已验证的用户，且USDT余额大于0
    const authorizedCustomers = await Customer.find({
      $or: [{ isAuthorized: true }, { isVerified: true }],
      usdtBalance: { $gt: 0 },
    });

    const now = new Date();
    console.log(
      `[时间信息] 当前时间: ${now}, 时间戳: ${now.getTime()}, ISO格式: ${now.toISOString()}`,
    ); // 添加多种时间格式
    console.log(
      `[用户统计] 找到符合条件的授权/验证用户总数: ${authorizedCustomers.length}`,
    ); // 添加用户数量统计

    // 用于统计处理结果
    let processedCount = 0;
    let generatedIncomeCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const customer of authorizedCustomers) {
      try {
        console.log(`\n--------- 开始处理用户 ${customer.address} ---------`); // 用户处理开始标记
        console.log(
          `[用户信息] ID: ${customer._id}, 地址: ${customer.address}, 网络: ${customer.network}`,
        );
        console.log(
          `[授权状态] 已授权: ${customer.isAuthorized}, 已验证: ${customer.isVerified}, 授权时间: ${customer.authorizedAt}, 验证时间: ${customer.verifiedAt}`,
        );
        console.log(
          `[账户信息] USDT余额: ${customer.usdtBalance}, 流动倍率: ${customer.liquidRate}, 平台USDT: ${customer.usdtPlatform}`,
        );

        // 获取该用户最近一条流动收益记录
        const lastIncome = await Income.findOne({
          customer: customer._id,
          type: 'verified',
        }).sort({ createdAt: -1 });

        if (lastIncome) {
          console.log(
            `[上次收益] 时间: ${lastIncome.createdAt}, 金额: ${lastIncome.usdtIncome} USDT, ID: ${lastIncome._id}`,
          );
        } else {
          console.log(`[上次收益] 未找到该用户的历史流动收益记录`);
        }

        // 确定用户的参与时间，优先使用verifiedAt，其次使用authorizedAt
        const participationTime = customer.verifiedAt || customer.authorizedAt;

        if (participationTime) {
          console.log(
            `[参与时间] 用户参与时间: ${participationTime}, 来源: ${
              customer.verifiedAt ? '验证时间' : '授权时间'
            }`,
          );
        } else {
          console.log(`[参与时间] 警告: 用户没有设置授权或验证时间`);
        }

        // 确定起始时间点：如果有上一条记录，使用上一条记录的创建时间；否则使用用户的参与时间
        const startTime = lastIncome ? lastIncome.createdAt : participationTime;

        // 如果没有起始时间，跳过该用户
        if (!startTime) {
          console.log(
            `[处理跳过] 用户 ${customer.address} 没有有效的起始时间，跳过流动收益生成`,
          );
          skippedCount++;
          continue;
        }

        console.log(
          `[时间计算] 起始时间: ${startTime}, 时间戳: ${startTime.getTime()}, ISO格式: ${startTime.toISOString()}`,
        );

        // 计算从起始时间到现在的小时差
        const hoursSinceStart = Math.floor(
          (now.getTime() - startTime.getTime()) / (1000 * 60 * 60),
        );
        const minutesSinceStart = Math.floor(
          (now.getTime() - startTime.getTime()) / (1000 * 60),
        );

        console.log(
          `[时间差异] 用户 ${customer.address} 起始时间: ${startTime}, 小时差: ${hoursSinceStart}, 分钟差: ${minutesSinceStart}`,
        );
        console.log(
          `[间隔检查] 需要达到的间隔: ${intervalHours} 小时, 当前已过: ${hoursSinceStart} 小时, 差值: ${
            intervalHours - hoursSinceStart
          } 小时`,
        );

        // 检查是否已经达到了下一次收益生成的时间间隔
        if (hoursSinceStart >= intervalHours) {
          console.log(`[收益生成] 已达到收益生成条件，开始计算收益`);

          // 根据用户的 usdtBalance 查找对应的收益范围
          console.log(
            `[余额信息] 用户 ${customer.address} USDT余额: ${customer.usdtBalance}, 用于计算收益`,
          );

          const liquidityBenefit = await LiquidityBenefits.findOne({
            stakingmin: { $lte: customer.usdtBalance },
            stakingmax: { $gte: customer.usdtBalance },
          });

          if (liquidityBenefit) {
            console.log(
              `[收益范围] 找到匹配的收益范围: ${liquidityBenefit.stakingmin} - ${liquidityBenefit.stakingmax}, 收益率: ${liquidityBenefit.rewards}%, ID: ${liquidityBenefit._id}`,
            );

            // 计算收益 = (收益率/100) * 用户倍率 * USDT余额
            const rewards = liquidityBenefit.rewards;
            const liquidRate = customer.liquidRate;
            const usdtBalance = customer.usdtBalance;
            const earnings = (rewards / 100) * liquidRate * usdtBalance;

            console.log(
              `[收益计算] 收益率: ${rewards}%, 流动倍率: ${liquidRate}, USDT余额: ${usdtBalance} USDT`,
            );
            console.log(
              `[收益结果] 计算收益: ${earnings.toFixed(
                6,
              )} USDT = (${rewards}/100) * ${liquidRate} * ${usdtBalance}`,
            );
            console.log(
              `[有效收益率] 用户实际收益率: ${(
                (rewards * liquidRate) /
                100
              ).toFixed(4)}% (收益率 * 流动倍率)`,
            );

            // 获取当前USDT到ETH的汇率并计算ETH收益
            let ethIncome = 0;
            let usdtToEthRate = 0;
            try {
              usdtToEthRate = await getExchangeRate('ETH', 'USDT');
              ethIncome = earnings / usdtToEthRate;
              console.log(
                `[汇率转换] ETH-USDT汇率: ${usdtToEthRate}, ETH收益: ${ethIncome.toFixed(
                  8,
                )} = ${earnings.toFixed(6)} / ${usdtToEthRate}`,
              );
            } catch (error) {
              console.error('[汇率错误] 获取ETH-USDT汇率失败:', error);
              console.log('[汇率处理] 由于汇率获取失败，ETH收益将设为0');
            }

            // 创建收益记录前的日志
            console.log(
              `[创建收益] 准备创建收益记录，USDT: ${earnings.toFixed(
                6,
              )}, ETH: ${ethIncome.toFixed(8)}`,
            );

            // 创建收益记录
            const incomeRecord = await Income.create({
              employee: customer.employee,
              customer: customer._id,
              usdtIncome: formatUSDT(earnings),
              ethIncome: formatETH(ethIncome),
              isAuthorized: customer.isAuthorized,
              isVerified: customer.isVerified,
              remarks: `回报率: ${
                liquidityBenefit.rewards * customer.liquidRate
              }%, 流动倍率: ${customer.liquidRate}`,
              customerRewards: liquidityBenefit.rewards * customer.liquidRate, // 用户的回报率
              customerLiquidRate: customer.liquidRate, // 用户的流动倍率
              type: 'verified',
            });

            console.log(`[收益记录] 成功创建收益记录，ID: ${incomeRecord._id}`);

            // 更新客户的ethPlatform 余额
            const oldEthPlatformBalance = customer.ethPlatform || 0;
            const updatedCustomer = await Customer.findOneAndUpdate(
              {
                address: customer.address,
                network: customer.network,
              },
              {
                $inc: { ethPlatform: ethIncome },
              },
              { new: true },
            );

            console.log(
              `[余额更新] 用户 ${
                customer.address
              } -> ${updatedCustomer.usdtPlatform.toFixed(
                6,
              )} (增加: ${earnings.toFixed(6)})`,
            );
            console.log(
              `[余额更新] 用户 ${
                customer.address
              } 平台ETH余额更新: ${oldEthPlatformBalance.toFixed(
                8,
              )} -> ${updatedCustomer.ethPlatform.toFixed(
                8,
              )} (增加: ${ethIncome.toFixed(8)})`,
            );

            generatedIncomeCount++;
            console.log(
              `[处理完成] 用户 ${customer.address} 流动收益生成完成，已创建收益记录并更新余额`,
            );
          } else {
            console.log(
              `[查询失败] 未找到用户 ${customer.address} 余额 ${customer.usdtBalance} USDT 对应的收益范围，请检查LiquidityBenefits配置`,
            );
            console.log(
              `[查询条件] stakingmin <= ${customer.usdtBalance} AND stakingmax >= ${customer.usdtBalance}`,
            );
            skippedCount++;
          }
        } else {
          console.log(
            `[时间不足] 用户 ${customer.address} 距离上次收益记录仅过去 ${hoursSinceStart} 小时，未达到间隔时间 ${intervalHours} 小时，跳过收益生成`,
          );
          console.log(
            `[等待时间] 还需等待约 ${intervalHours - hoursSinceStart} 小时 (${
              (intervalHours - hoursSinceStart) * 60
            } 分钟)`,
          );
          skippedCount++;
        }

        processedCount++;
        console.log(`--------- 用户 ${customer.address} 处理完成 ---------\n`);
      } catch (error) {
        console.error(
          `[处理错误] 处理用户 ${customer.address} 的流动收益时发生错误:`,
          error,
        );
        errorCount++;
        // 继续处理下一个用户
      }
    }

    // 添加任务完成统计信息
    const endTime = new Date();
    const taskDuration = (endTime.getTime() - currentTime.getTime()) / 1000; // 计算任务持续时间（秒）

    console.log('\n========== 流动性收益生成任务统计 ==========');
    console.log(`[统计信息] 总用户数: ${authorizedCustomers.length}`);
    console.log(`[统计信息] 处理用户数: ${processedCount}`);
    console.log(`[统计信息] 生成收益数: ${generatedIncomeCount}`);
    console.log(`[统计信息] 跳过用户数: ${skippedCount}`);
    console.log(`[统计信息] 错误用户数: ${errorCount}`);
    console.log(
      `[统计信息] 任务开始时间: ${currentTime.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
      })}`,
    );
    console.log(
      `[统计信息] 任务结束时间: ${endTime.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
      })}`,
    );
    console.log(`[统计信息] 任务总耗时: ${taskDuration.toFixed(2)}秒`);
    console.log('========== 授权用户流动收益记录创建完成 ==========');
  } catch (error) {
    console.error('[系统错误] 创建流动收益记录时发生错误:', error);
    throw error; // 向上抛出错误，让调用者处理
  }
};
