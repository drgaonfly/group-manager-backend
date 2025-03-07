import Setting from '../../models/setting';

// 更新池子数值的函数
export const updatePoolValues = async (): Promise<void> => {
  try {
    // 获取当前设置
    const setting = await Setting.findOne();

    if (!setting) {
      // 如果没有设置，创建初始设置
      const newSetting = new Setting({
        key: 'pool_settings',
        revenuePool: 1000, // 初始值
        incomePool: 1000, // 初始值
        StakingApy: 5, // 初始 APY
      });
      await newSetting.save();
      return;
    }

    // 计算增长值
    const revenueIncrease = setting.revenuePool * 0.001; // 每次增长 0.1%
    const incomeIncrease = setting.incomePool * 0.001; // 每次增长 0.1%
    const apyIncrease = 0.01; // APY 每次增长 0.01

    // 更新值
    setting.revenuePool += revenueIncrease;
    setting.incomePool += incomeIncrease;
    setting.StakingApy += apyIncrease;

    // 保存更新
    await setting.save();

    console.log('Pool values updated:', {
      revenuePool: setting.revenuePool,
      incomePool: setting.incomePool,
      StakingApy: setting.StakingApy,
    });
  } catch (error) {
    console.error('Error updating pool values:', error);
  }
};
