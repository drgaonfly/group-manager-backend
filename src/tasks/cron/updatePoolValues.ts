import Setting from '../../models/setting';

// 更新池子数值的函数
export const updatePoolValues = async (): Promise<void> => {
  try {
    // 获取所有设置项
    const settings = await Setting.find();

    for (const setting of settings) {
      const currentValue = parseFloat(setting.value);
      const minValue = setting.minValue;
      const maxValue = setting.maxValue;
      let newValue: number = currentValue;

      // 根据 key 应用不同的增长规则
      switch (setting.key) {
        case 'StakingApy': {
          // 质押apy增长 - 在最小值和最大值之间取一个随机数，加到当前值上
          const randomValue = minValue + Math.random() * (maxValue - minValue);
          newValue = currentValue + randomValue;
          break;
        }
        case 'incomePool': {
          // 玩家收入增长
          const randomValue = minValue + Math.random() * (maxValue - minValue);
          newValue = currentValue + randomValue;
          break;
        }
        case 'revenuePool': {
          // 收益池增长
          const randomValue = minValue + Math.random() * (maxValue - minValue);
          newValue = currentValue + randomValue;
          break;
        }
        case 'totalOutput': {
          // 总产出增长
          const randomValue = minValue + Math.random() * (maxValue - minValue);
          newValue = currentValue + randomValue;
          break;
        }
        case 'validNodes':
          // 有效节点增长或减少
          newValue = Math.random() < 0.5 ? currentValue + 1 : currentValue - 4;
          break;
        case 'participants':
          // 参与人数增长
          newValue = currentValue + 2;
          break;
        case 'userEarnings': {
          // 用户收益增长
          const randomValue = minValue + Math.random() * (maxValue - minValue);
          newValue = currentValue + randomValue;
          break;
        }
        default:
          // 其他 key 不进行任何操作
          console.log(`Skipping update for unknown key: ${setting.key}`);
          continue;
      }

      // 只有在 key 匹配的情况下才更新设置值
      setting.value = newValue.toFixed(3); // 保留3位小数
      await setting.save();

      console.log(`Updated ${setting.key}:`, {
        parameter: setting.parameter,
        oldValue: currentValue,
        newValue: newValue,
        minValue: minValue,
        maxValue: maxValue,
        addedValue: newValue - currentValue,
      });
    }

    console.log('All values updated successfully');
  } catch (error) {
    console.error('Error updating values:', error);
  }
};
