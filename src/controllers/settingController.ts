import { Request, Response } from 'express';
import Setting from '../models/setting'; // 假设有设置模型
import Customer from '../models/customer';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import User from '../models/user';
import { IUser } from '../models/user';
import { io } from '../services/socket';

// 构建查询条件
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.parameter) {
    query.parameter = queryParams.parameter;
  }

  // 通过 key 查询
  if (queryParams.value) {
    query.value = queryParams.value;
  }

  return query;
};

// 获取设置列表
const getSettings = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const settings = await Setting.find(query)
    .sort('-createdAt') // 按创建时间排序
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .lean()
    .exec();

  const total = await Setting.countDocuments(query).exec();

  res.json({
    success: true,
    data: settings,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 创建新设置
const addSetting = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(Setting, 'id', 6);

  const setting = await Setting.create({
    ...req.body,
    id: newId,
  });

  res.status(201).json({
    success: true,
    data: setting,
  });
});

// 获取单个设置
const getSettingById = handleAsync(async (req: Request, res: Response) => {
  const setting = await Setting.findById(req.params.id);

  if (!setting) {
    res.status(404);
    throw new Error('设置项不存在');
  }

  res.json({
    success: true,
    data: setting,
  });
});

// 更新设置
const updateSetting = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const setting = await Setting.findById(id);
  if (!setting) {
    res.status(404);
    throw new Error('设置项不存在');
  }

  const updatedSetting = await Setting.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true, runValidators: true },
  );

  io.emit('settingUpdated');
  io.emit('authRemaining');

  res.json({
    success: true,
    data: updatedSetting,
  });
});

// 删除设置
const deleteSetting = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const setting = await Setting.findByIdAndDelete(id);

  if (!setting) {
    res.status(404);
    throw new Error('设置项不存在');
  }

  io.emit('settingUpdated');

  res.json({
    success: true,
    data: { message: '设置项删除成功' },
  });
});

// 批量删除设置
const deleteMultipleSettings = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Setting.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `成功删除 ${ids.length} 条设置项`,
    });
  },
);

// Get statistics data
export const getStatistics = handleAsync(
  async (req: Request, res: Response) => {
    // Define keys to fetch
    const keys = [
      'StakingApy',
      'incomePool',
      'revenuePool',
      'totalOutput',
      'validNodes',
      'participants',
      'userEarnings',
    ];

    // Fetch all settings in parallel
    const settingsData = await Setting.find({ key: { $in: keys } }).lean();

    // Create a map for easy value lookup
    const settingsMap = settingsData
      .map((setting) => ({
        [setting.key]: parseFloat(setting.value),
      }))
      .reduce((acc, curr) => ({ ...acc, ...curr }), {});

    // Prepare response data
    const statisticsData = {
      totalOutput: settingsMap.totalOutput || 0,
      validNodes: settingsMap.validNodes || 0,
      participants: settingsMap.participants || 0,
      userEarnings: settingsMap.userEarnings || 0,
      StakingApy: settingsMap.StakingApy || 0,
      incomePool: settingsMap.incomePool || 0,
      revenuePool: settingsMap.revenuePool || 0,
    };

    res.json({
      success: true,
      data: statisticsData,
    });
  },
);

// 根据 key 获取设置
const getSettingByKey = handleAsync(async (req: Request, res: Response) => {
  const { key } = req.query;

  const setting = await Setting.findOne({ key });

  if (!setting) {
    res.status(404);
    throw new Error('未找到对应的设置项');
  }

  res.json({
    success: true,
    data: setting,
  });
});

// 根据客户信息获取授权设置
const getCustomerAuthorizationSetting = handleAsync(
  async (req: Request, res: Response) => {
    const { address, network } = req.query;

    if (!address || !network) {
      res.status(400);
      throw new Error('地址和网络参数是必需的');
    }

    // 查找客户
    const customer = await Customer.findOne({
      address: address as string,
      network: network as string,
    });

    if (!customer) {
      res.status(404);
      throw new Error('未找到客户信息');
    }

    // 获取授权设置
    const authorizationSetting = await Setting.findOne({
      key: 'authorization',
    });

    if (!authorizationSetting) {
      res.status(404);
      throw new Error('未找到授权设置');
    }

    res.json({
      success: true,
      data: {
        value: authorizationSetting.value,
        isAuthorized: customer.isAuthorized,
        isVerified: customer.isVerified,
      },
    });
  },
);

// 获取服务链接
const getServiceLink = handleAsync(async (req: Request, res: Response) => {
  const { employee } = req.query;

  // 如果没有提供employee参数，直接返回setting中的serviceLink
  if (!employee) {
    const serviceLinkSetting = await Setting.findOne({ key: 'serviceLink' });
    if (!serviceLinkSetting) {
      res.status(404);
      throw new Error('未找到服务链接设置');
    }
    res.json({
      success: true,
      data: {
        serviceLink: serviceLinkSetting.value,
      },
    });
    return;
  }

  // 查找员工信息
  const employeeUser = await User.findById(employee).populate('proxy');
  if (!employeeUser) {
    res.status(404);
    throw new Error('未找到员工信息');
  }

  // 获取代理的serviceLinks
  const proxy = employeeUser.proxy as IUser;
  if (proxy.serviceLinks) {
    res.json({
      success: true,
      data: {
        serviceLink: proxy.serviceLinks,
      },
    });
    return;
  }

  // 如果代理没有serviceLinks，返回setting中的serviceLink
  const serviceLinkSetting = await Setting.findOne({ key: 'serviceLink' });
  if (!serviceLinkSetting) {
    res.status(404);
    throw new Error('未找到服务链接设置');
  }
  res.json({
    success: true,
    data: {
      serviceLink: serviceLinkSetting.value,
    },
  });
});

export {
  getSettings,
  addSetting,
  getSettingById,
  updateSetting,
  deleteSetting,
  deleteMultipleSettings,
  getSettingByKey,
  getCustomerAuthorizationSetting,
  getServiceLink,
};
