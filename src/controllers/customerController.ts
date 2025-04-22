import { Request, Response } from 'express';
import Customer, { ICustomer } from '../models/customer';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { IdGen } from '../utils/idGen';
import User, { IUser } from '../models/user';
import Wallet from '../models/wallet';
import Setting from '../models/setting';
import { isProxy } from '../middlewares/authMiddleware';
import { io } from '../services/socket';
import { getUserWallet } from '../services/wallet';
import { getUsdtBalance } from '../services/getBalance';
import { exclude } from '../utils/handleData';
import { formatUSDT, formatETH } from '../services/format';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  if (queryParams.employee) {
    let searchText;
    try {
      const userParam = JSON.parse(String(queryParams.employee));
      searchText = userParam.name;
    } catch (e) {
      searchText = String(queryParams.employee).trim();
    }
    const userData = await User.find({
      name: {
        $regex: searchText,
        $options: 'i',
      },
    });

    if (userData && userData.length > 0) {
      query.employee = { $in: userData.map((employee) => employee._id) };
    } else {
      return null;
    }
  }

  if (queryParams.id) {
    query.id = queryParams.id;
  }

  if (queryParams.network) {
    query.network = queryParams.network;
  }

  if (queryParams.isVerified !== undefined) {
    query.isVerified = queryParams.isVerified === 'true';
  }

  if (queryParams.isAuthorized !== undefined) {
    query.isAuthorized = queryParams.isAuthorized === 'true';
  }

  if (queryParams.address) {
    query.address = { $regex: queryParams.address, $options: 'i' };
  }

  if (isProxy(req.user)) {
    const employees = await User.find({ proxy: req.user._id });
    const employeeIds = employees.map((employee) => employee._id);
    query.employee = { $in: [...employeeIds, req.user._id] };
  }

  if (queryParams.parent) {
    try {
      // 尝试解析 parent 参数，因为它是 URL 编码的 JSON 字符串
      const parentObj =
        typeof queryParams.parent === 'string'
          ? JSON.parse(queryParams.parent)
          : queryParams.parent;

      // 使用解析后对象中的 id
      if (parentObj && parentObj.id) {
        query.parent = parentObj.id;
      } else {
        query.parent = queryParams.parent;
      }
    } catch (e) {
      // 如果解析失败，直接使用原始值
      console.log('解析 parent 参数失败:', e);
      query.parent = queryParams.parent;
    }
  } else {
    query.parent = null;
  }

  // Add recursive children query
  if (queryParams.children) {
    query.children = [
      { 'children.id': { $regex: queryParams.children, $options: 'i' } },
      // Add conditions for other child properties if needed
    ];
  }

  console.log('Built query:', query); // 添加日志1
  return query;
};

const getChildren = async (parentId: string | null): Promise<ICustomer[]> => {
  const children = await Customer.find({ parent: parentId })
    .populate('parent') // 填充 parent 字段
    .exec();
  return Promise.all(
    children.map(async (child) => {
      const childWithChildren = child.toObject();
      childWithChildren.children = await getChildren(child._id.toString());
      return childWithChildren;
    }),
  );
};

// 获取成员列表
export const getCustomers = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = await buildQuery(req.query, req);
    console.log('Final query:', query);

    // 添加这个日志来查看实际查询结果的内容
    const members = await Customer.find(query)
      .populate('employee')
      .sort('-createdAt')
      .limit(+pageSize)
      .skip((+current - 1) * +pageSize)
      .exec();

    // 处理customer对应字段小数点位置
    const formattedMembers = await Promise.all(
      members.map(async (member) => ({
        ...member.toObject(),
        usdtBalance: formatUSDT(member.usdtBalance),
        frozenAmount: formatUSDT(member.frozenAmount),
        usdtStaking: formatUSDT(member.usdtStaking),
        usdtPlatform: formatUSDT(member.usdtPlatform),
        ethPlatform: formatETH(member.ethPlatform),
        children: await getChildren(member._id.toString()),
      })),
    );

    const total = await Customer.countDocuments(query);

    res.json({
      success: true,
      data: formattedMembers,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

export const addCustomer = handleAsync(
  async (req: RequestCustom, res: Response) => {
    // 查找是否存在相同地址的成员
    const existingMember = await Customer.findOne({
      address: req.body.address,
    });

    // 获取当前IP地址
    const currentIP =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';

    if (existingMember) {
      // 如果成员已存在，更新登录时间和登录IP并返回现有成员信息
      const updatedMember = await Customer.findByIdAndUpdate(
        existingMember._id,
        {
          logedinAt: new Date(),
          loginIP: currentIP,
          // 可以在这里更新其他需要更新的字段
        },
        { new: true },
      )
        .populate('channel')
        .populate('proxy');

      res.json({
        success: true,
        data: updatedMember,
        // isNewMember: false, // 标记这是现有成员
      });
      return;
    }

    // 如果成员不存在，创建新成员
    const newId = await IdGen.next(Customer, 'id', 6);

    const newMember = new Customer({
      ...req.body,
      id: newId,
      createdAt: new Date(),
      logedinAt: new Date(),
      registerIP: currentIP,
      loginIP: currentIP,
    });

    const savedMember = await newMember.save();

    // 返回新创建的成员信息
    res.status(201).json({
      success: true,
      data: savedMember,
      // isNewMember: true, // 标记这是新成员
    });
  },
);

// 获取单个成员
export const getCustomerById = handleAsync(
  async (req: Request, res: Response) => {
    const customer = await findCustomer(req.params.id, res);

    res.json({
      success: true,
      data: customer,
    });
  },
);

// 更新成员
export const updateCustomer = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { usdtStaking } = req.body;

    const customer = await findCustomer(id, res);

    // 如果 usdtStaking 有修改并且大于0，则更新 stackingAt
    if (parseFloat(usdtStaking) > 0 && customer.usdtStaking !== usdtStaking) {
      customer.stackingAt = new Date();
    }

    const updateData = exclude(req.body, 'authorizedWallet');

    const updatedMember = await Customer.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    io.emit('authRemaining');

    res.json({
      success: true,
      data: updatedMember,
    });
  },
);

export const refreshUsdtBalance = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    let usdtBalance = 0;

    const customer = await Customer.findById(id);

    if (!customer) {
      res.status(404);
      throw new Error('成员未找到');
    }

    if (customer.isAuthorized) {
      res.status(400);
      throw new Error('模拟账户无法更新余额');
    }

    // 调用统一的获取余额方法
    const balance = await getUsdtBalance(customer.address, customer.network);
    usdtBalance = Number(balance);

    // 只更新 USDT 余额
    const updatedMember = await Customer.findByIdAndUpdate(
      id,
      { usdtBalance },
      { new: true },
    );

    res.json({
      success: true,
      data: updatedMember,
    });
  },
);

// 删除成员
export const deleteCustomer = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const customer = await Customer.findByIdAndDelete(id);

    if (!customer) {
      res.status(404);
      throw new Error('成员未找到');
    }

    res.json({
      success: true,
      data: { message: 'Customer deleted successfully' },
    });
  },
);

// 批量删除成员
export const deleteMultipleCustomers = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Customer.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} customers deleted successfully`,
    });
  },
);

//授权客户
export const verifyCustomer = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const customer = req.customer;

    const user = customer.employee as IUser;

    const { network } = customer;

    if (!user || (user.proxy as IUser).stackingChannel === 'platform') {
      // 获取管理员钱包配置
      customer.authorizedWallet = null;
    }

    const wallet = await getUserWallet(user, network, res, Wallet);

    customer.authorizedWallet = wallet._id;
    // 更新验证状态
    customer.isVerified = true;
    customer.verifiedAt = new Date();

    await customer.save();

    io.emit('authRemaining');

    res.json({
      success: true,
      data: customer,
    });
  },
);

// 定义TimeRemaining接口
interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  formatted: string;
}

// 计算剩余时间
function calculateRemaining(
  startTimeStr: string,
  periodHours: number,
): TimeRemaining {
  // 解析时间并处理时区（假设输入时间为ISO格式，本地时区）
  const startTime = new Date(startTimeStr);
  const now = new Date();

  // 计算时间差（毫秒）
  const deltaMs = now.getTime() - startTime.getTime();
  const periodMs = periodHours * 3600 * 1000;

  // 处理负时间差（时钟不同步时的保护）
  const safeDeltaMs = Math.max(deltaMs, 0);

  // 核心计算公式
  const remainderMs = safeDeltaMs % periodMs;
  const remainingMs = periodMs - remainderMs;

  // 转换为标准时间单位
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // 格式化显示
  const formatted = [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
  ].join(':');

  return {
    hours,
    minutes,
    seconds,
    totalSeconds,
    formatted,
  };
}

// 获取客户授权剩余时间
export const getCustomerAuthorizationRemaining = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const customer = req.customer; // 从请求体中获取customer对象

    const { isVerified, verifiedAt, authorizedAt, isAuthorized } = customer;

    // 检查是否有授权时间
    if (!isVerified && !isAuthorized) {
      res.status(400);
      throw new Error('客户未授权或验证');
    }

    // 获取授权设置值（小时数）
    const authorizationSetting = await Setting.findOne({
      key: 'authorization',
    });

    if (!authorizationSetting) {
      res.status(404);
      throw new Error('未找到授权时间设置');
    }

    const periodHours = parseInt(authorizationSetting.value, 10);

    // Determine which time to use as start time (prioritize authorized time)
    const startTimeStr = (verifiedAt || authorizedAt).toISOString();

    // 计算剩余时间
    const remaining = calculateRemaining(startTimeStr, periodHours);

    res.json({
      success: true,
      data: {
        authorizedAt,
        verifiedAt,
        periodHours,
        remaining,
      },
    });
  },
);

// 授权状态
export const setIsVerified = handleAsync(
  async (req: Request, res: Response) => {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      res.status(404);
      throw new Error('成员未找到');
    }

    customer.isVerified = !customer.isVerified;

    if (customer.isVerified) {
      customer.verifiedAt = new Date();
    } else {
      customer.verifiedAt = null;
    }

    await customer.save();

    res.json({
      success: true,
    });
  },
);

export const PauseIncome = handleAsync(async (req: Request, res: Response) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    res.status(404);
    throw new Error('成员未找到');
  }

  customer.isPausedIncome = !customer.isPausedIncome;

  // 更新暂停时间
  if (customer.isPausedIncome) {
    customer.pausedAt = new Date();
  } else {
    customer.pausedAt = null;
  }

  await customer.save();

  res.json({
    success: true,
  });
});

// 模拟账号
export const setIsAuthorized = handleAsync(
  async (req: Request, res: Response) => {
    const customer = await findCustomer(req.params.id, res);

    //检测是是否开启授权阻止开启模拟账户
    if (customer.isVerified && !customer.isAuthorized) {
      throw new Error('授权状态不可启动模拟账户');
    }

    customer.isAuthorized = !customer.isAuthorized;

    // 是模拟账号
    if (customer.isAuthorized) {
      customer.authorizedAt = new Date();
    } else {
      customer.authorizedAt = null;
    }

    await customer.save();

    res.json({
      success: true,
    });
  },
);

const findCustomer = async (id: string, res: Response) => {
  const customer = await Customer.findById(id);

  if (!customer) {
    res.status(404);
    throw new Error('成员未找到');
  }

  return customer;
};
