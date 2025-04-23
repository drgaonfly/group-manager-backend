import Income from '../../models/income';
import Customer from '../../models/customer';
import LiquidityBenefits from '../../models/liquidity';
import Setting from '../../models/setting';
import { getExchangeRate } from '../../utils/getExchange';
import { formatUSDT, formatETH } from '../../services/format';

// 自动生成流动性收益
export const generateFlowingIncome = async (): Promise<void> => {
  try {
    console.log('========== 开始执行流动收益生成任务 =========='); // 任务开始标记
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
      `[系统配置] 流动收益间隔时间: ${intervalHours} 小时, 原始值: ${authorizationSetting.value}`,
    ); // 显示原始值和解析后的值

    // 查找所有已授权或已验证的用户，且USDT余额大于0
    const authorizedCustomers = await Customer.find({
      $or: [{ isAuthorized: true }, { isVerified: true }],
      usdtBalance: { $gt: 0 }, // 只处理有USDT金额的用户
      isPausedIncome: false, // 只处理未暂停收益的用户
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

        // 获取该用户已有的收益记录数量
        const existingIncomes = await Income.find({
          customer: customer._id,
          type: 'verified',
          isManual: false,
        }).sort({ earningTime: -1 });

        console.log(
          `[收益记录] 用户已有收益记录数量: ${existingIncomes.length}`,
        );

        // 确定用户的参与时间，优先使用verifiedAt，其次使用authorizedAt
        let participationTime: Date;
        if (customer.isVerified) {
          participationTime = customer.verifiedAt;
        } else if (customer.isAuthorized) {
          participationTime = customer.authorizedAt;
        }

        // 如果最后一条收益的时间大于 participationTime，就用最后一条收益的时间
        if (existingIncomes.length > 0) {
          const lastIncome = existingIncomes[0];
          if (lastIncome.earningTime > participationTime) {
            console.log(
              `[参与时间] 用户最后一条收益时间: ${lastIncome.earningTime}, 大于参与时间，使用最后一条收益时间`,
            );
            participationTime = lastIncome.earningTime;
          }
        }

        if (!participationTime) {
          console.log(`[参与时间] 警告: 用户没有设置授权或验证时间，跳过处理`);
          skippedCount++;
          continue;
        }

        console.log(
          `[参与时间] 用户参与时间: ${participationTime}, 来源: ${
            customer.verifiedAt ? '验证时间' : '授权时间'
          }`,
        );

        // 计算从参与时间到现在应该生成的收益记录数量
        // 计算从参与时间到现在的小时数，并保留两位小数
        const hoursSinceParticipation = Number(
          (
            (new Date().getTime() - participationTime.getTime()) /
            (1000 * 60 * 60)
          ).toFixed(2),
        );
        console.log(
          `[收益计算] 用户参与时间: ${participationTime}, 已经过去 ${hoursSinceParticipation} 小时`,
        );

        // 计算当前收益记录的生成时间
        const earningTime = new Date(
          participationTime.getTime() + intervalHours * 60 * 60 * 1000,
        );

        if (earningTime > new Date()) {
          console.log(`[收益跳过] 收益时间 ${earningTime} 超过当前时间，跳过`);
          skippedCount++;
          continue;
        }

        if (hoursSinceParticipation < intervalHours) {
          console.log(
            `[收益跳过] 距离上次收益时间不足${intervalHours}小时，跳过`,
          );
          skippedCount++;
          continue;
        }

        // 查找用户USDT余额对应的收益范围
        const liquidityBenefit = await LiquidityBenefits.findOne({
          stakingmin: { $lte: customer.usdtBalance },
          stakingmax: { $gte: customer.usdtBalance },
        });

        if (!liquidityBenefit) {
          console.log(
            `[查询失败] 未找到用户 ${customer.address} 余额 ${customer.usdtBalance} USDT 对应的收益范围`,
          );
          skippedCount++;
          continue;
        }

        console.log(
          `[收益范围] 找到匹配的收益范围: ${liquidityBenefit.stakingmin} - ${liquidityBenefit.stakingmax}, 收益率: ${liquidityBenefit.rewards}%`,
        );

        // 计算收益
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

        if (formatUSDT(earnings) === 0) {
          console.log('[收益处理] 由于收益为0，跳过');
          skippedCount++;
          continue;
        }

        if (formatETH(ethIncome) === 0) {
          console.log('[收益处理] 由于ETH收益为0，跳过');
          skippedCount++;
          continue;
        }

        // 创建收益记录
        const incomeRecord = await Income.create({
          employee: customer.employee,
          customer: customer._id,
          proxy: customer.proxy,
          usdtIncome: earnings,
          ethIncome: ethIncome,
          isAuthorized: customer.isAuthorized,
          isVerified: customer.isVerified,
          remarks: `回报率: ${
            liquidityBenefit.rewards * customer.liquidRate
          }%, 流动倍率: ${customer.liquidRate}`,
          customerRewards: liquidityBenefit.rewards * customer.liquidRate,
          customerLiquidRate: customer.liquidRate,
          type: 'verified',
          earningTime: earningTime, // 添加收益生成时间
          intervalHours,
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
          } 平台ETH余额更新: ${oldEthPlatformBalance.toFixed(8)} -> ${(
            updatedCustomer?.ethPlatform || 0
          ).toFixed(8)} (增加: ${ethIncome.toFixed(8)})`,
        );

        generatedIncomeCount++;
        processedCount++;
        console.log(`--------- 用户 ${customer.address} 处理完成 ---------\n`);
      } catch (error) {
        console.error(
          `[处理错误] 处理用户 ${customer.address} 的流动收益时发生错误:`,
          error,
        );
        errorCount++;
      }
    }

    // 添加任务完成统计信息
    const endTime = new Date();
    const taskDuration = (endTime.getTime() - currentTime.getTime()) / 1000;

    console.log('\n========== 流动收益生成任务统计 ==========');
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
    throw error;
  }
};
