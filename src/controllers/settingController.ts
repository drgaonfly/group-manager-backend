import { Response } from 'express';
import Setting from '../models/setting';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from '../types/user';

// 获取系统设置
const getSetting = handleAsync(async (req: RequestCustom, res: Response) => {
  let setting = await Setting.findOne();

  // 如果不存在，创建默认设置
  if (!setting) {
    setting = new Setting({
      defaultFreeDays: 7,
      trx20Address: '',
      orderTimeoutMinutes: 30,
    });
    await setting.save();
  }

  res.json({
    success: true,
    data: setting,
  });
});

// 更新系统设置（仅管理员）
const updateSetting = handleAsync(async (req: RequestCustom, res: Response) => {
  // 检查是否是管理员
  if (!req.user.isAdmin) {
    res.status(403);
    throw new Error('只有管理员可以修改系统设置');
  }

  let setting = await Setting.findOne();

  if (!setting) {
    // 如果不存在，创建新设置
    setting = new Setting(req.body);
  } else {
    // 更新现有设置
    Object.assign(setting, req.body);
  }

  await setting.save();

  res.json({
    success: true,
    data: setting,
  });
});

export { getSetting, updateSetting };
