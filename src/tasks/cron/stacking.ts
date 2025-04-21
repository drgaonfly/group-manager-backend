import Customer from '../../models/customer';
import Income from '../../models/income';
import LiquidityBenefits from '../../models/liquidity';
import Setting from '../../models/setting';
import { getExchangeRate } from '../../utils/getExchange';
import { formatUSDT, formatETH } from '../../services/format';
// 自动生成质押收益
export const generateStakingIncome = async (): Promise<void> => {
  try {
    console.log('========== 开始执行质押收益生成任务 =========='); // 任务开始标记
    // 打印当前时间
    const currentTime = new Date();
    console.log(
      `[当前时间] ${currentTime.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
      })}`,
    );

    // 获取执行间隔时间设置
    const authorizationSetting = await Setting.findOne({
      key: 'stackingKey',
    });

    if (!authorizationSetting) {
      console.error('未找到质押收益间隔时间设置 [stackingKey]'); // 添加键名以便识别
      return;
    }

    const intervalHours = parseFloat(authorizationSetting.value);
    console.log(
      `[系统配置] 质押收益间隔时间: ${intervalHours} 小时, 原始值: ${authorizationSetting.value}`,
    ); // 显示原始值和解析后的值

    // 查找所有有质押时间的用户
    const authorizedCustomers = await Customer.find({
      stackingAt: { $exists: true },
      usdtStaking: { $gt: 0 }, // 只处理有质押金额的用户
    });

    const now = new Date();
    console.log(
      `[时间信息] 当前时间: ${now}, 时间戳: ${now.getTime()}, ISO格式: ${now.toISOString()}`,
    ); // 添加多种时间格式
    console.log(
      `[用户统计] 找到符合条件的质押用户总数: ${authorizedCustomers.length}`,
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
          `[质押信息] USDT质押金额: ${customer.usdtStaking}, 质押倍率: ${customer.stakeRate}, 流动倍率: ${customer.liquidRate}`,
        );

        // 确认用户的质押时间
        if (!customer.stackingAt) {
          console.log(`[参与时间] 警告: 用户没有设置质押时间，跳过处理`);
          skippedCount++;
          continue;
        }

        console.log(`[质押时间] 用户质押时间: ${customer.stackingAt}`);

        // 获取该用户已有的收益记录
        const existingIncomes = await Income.find({
          customer: customer._id,
          type: 'staking',
          isManual: false,
        }).sort({ earningTime: -1 });

        console.log(
          `[收益记录] 用户已有质押收益记录数量: ${existingIncomes.length}`,
        );

        // 计算从质押时间到现在应该生成的收益记录数量
        const hoursSinceStaking = Math.floor(
          (now.getTime() - customer.stackingAt.getTime()) / (1000 * 60 * 60),
        );
        const expectedIncomeCount = Math.floor(
          hoursSinceStaking / intervalHours,
        );

        console.log(
          `[收益计算] 用户质押时间: ${customer.stackingAt}, 已经过去 ${hoursSinceStaking} 小时`,
        );
        console.log(
          `[收益计算] 按照 ${intervalHours} 小时间间隔，应该生成 ${expectedIncomeCount} 条收益记录`,
        );

        // 需要创建的收益记录数量
        const incomesToCreate = expectedIncomeCount - existingIncomes.length;

        if (incomesToCreate <= 0) {
          console.log(
            `[收益生成] 用户 ${customer.address} 的收益记录已是最新，无需生成`,
          );
          skippedCount++;
          continue;
        }

        console.log(
          `[收益生成] 需要为用户 ${customer.address} 创建 ${incomesToCreate} 条收益记录`,
        );

        // 创建缺失的收益记录
        for (let i = 0; i < incomesToCreate; i++) {
          // 计算当前收益记录的生成时间
          const earningTime = new Date(
            customer.stackingAt.getTime() +
              (existingIncomes.length + i + 1) * intervalHours * 60 * 60 * 1000,
          );

          if (earningTime > now) {
            console.log(
              `[收益跳过] 收益时间 ${earningTime} 超过当前时间，跳过`,
            );
            continue;
          }

          console.log(
            `[收益生成] 正在创建第 ${
              i + 1
            }/${incomesToCreate} 条收益记录，时间: ${earningTime}`,
          );

          // 查找用户质押金额对应的收益范围
          const liquidityBenefit = await LiquidityBenefits.findOne({
            stakingmin: { $lte: customer.usdtStaking },
            stakingmax: { $gte: customer.usdtStaking },
          });

          if (!liquidityBenefit) {
            console.log(
              `[查询失败] 未找到用户 ${customer.address} 质押金额 ${customer.usdtStaking} USDT 对应的收益范围`,
            );
            continue;
          }

          console.log(
            `[收益范围] 找到匹配的收益范围: ${liquidityBenefit.stakingmin} - ${liquidityBenefit.stakingmax}, 收益率: ${liquidityBenefit.rewards}%`,
          );

          // 计算收益
          const rewards = liquidityBenefit.rewards;
          const stakeRate = customer.stakeRate;
          const usdtStaking = customer.usdtStaking;
          const earnings = (rewards / 100) * stakeRate * usdtStaking;

          console.log(
            `[收益计算] 收益率: ${rewards}%, 质押倍率: ${stakeRate}, 质押金额: ${usdtStaking} USDT`,
          );
          console.log(
            `[收益结果] 计算收益: ${earnings.toFixed(
              6,
            )} USDT = (${rewards}/100) * ${stakeRate} * ${usdtStaking}`,
          );
          console.log(
            `[有效收益率] 用户实际收益率: ${(
              (rewards * stakeRate) /
              100
            ).toFixed(4)}% (收益率 * 质押倍率)`,
          );

          // 获取ETH汇率并计算ETH收益
          let ethIncome = 0;
          let usdtToEthRate = 0;
          try {
            usdtToEthRate = await getExchangeRate('ETH', 'USDT');
            ethIncome = earnings / usdtToEthRate;
            console.log(
              `[汇率转换] ETH-USDT汇率: ${usdtToEthRate}, ETH收益: ${ethIncome.toFixed(
                8,
              )}`,
            );
          } catch (error) {
            console.error('[汇率错误] 获取ETH-USDT汇率失败:', error);
            console.log('[汇率处理] 由于汇率获取失败，ETH收益将设为0');
          }

          // 创建收益记录
          const incomeRecord = await Income.create({
            employee: customer.employee,
            customer: customer._id,
            proxy: customer.proxy,
            usdtIncome: formatUSDT(earnings),
            ethIncome: formatETH(ethIncome),
            isAuthorized: customer.isAuthorized,
            isVerified: customer.isVerified,
            remarks: `回报率: ${
              liquidityBenefit.rewards * customer.stakeRate
            }%, 质押倍率: ${customer.stakeRate}`,
            customerRewards: liquidityBenefit.rewards * customer.stakeRate,
            customerLiquidRate: customer.liquidRate,
            customerStakeRate: customer.stakeRate,
            type: 'staking',
            stakingIcome: true,
            earningTime: earningTime, // 添加收益生成时间
          });

          console.log(
            `[收益记录] 成功创建收益记录，ID: ${incomeRecord._id}, 时间: ${earningTime}`,
          );

          // 更新客户的ethPlatform余额
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
            } 平台ETH余额更新: ${oldEthPlatformBalance.toFixed(
              8,
            )} -> ${updatedCustomer.ethPlatform.toFixed(
              8,
            )} (增加: ${ethIncome.toFixed(8)})`,
          );

          generatedIncomeCount++;
        }

        processedCount++;
        console.log(`--------- 用户 ${customer.address} 处理完成 ---------\n`);
      } catch (error) {
        console.error(
          `[处理错误] 处理用户 ${customer.address} 的质押收益时发生错误:`,
          error,
        );
        errorCount++;
      }
    }

    // 添加任务完成统计信息
    const endTime = new Date();
    const taskDuration = (endTime.getTime() - currentTime.getTime()) / 1000;

    console.log('\n========== 质押收益生成任务统计 ==========');
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
    console.log('========== 质押用户收益记录创建完成 ==========');
  } catch (error) {
    console.error('[系统错误] 创建质押收益记录时发生错误:', error);
    throw error; // 向上抛出错误，让调用者处理
  }
};
