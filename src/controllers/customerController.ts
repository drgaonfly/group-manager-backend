import { Request, Response } from 'express';
import Customer, { ICustomer } from '../models/customer';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from '../types/user';
import { IdGen } from '../utils/idGen';
import User from '../models/user';
import { isProxy } from '../middlewares/authMiddleware';

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

  // 代理用户只看自己的；管理员可跨代理查看
  if (isProxy(req.user) && !req.user.isAdmin) {
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
  }

  // Add recursive children query
  if (queryParams.children) {
    query.children = [
      { 'children.id': { $regex: queryParams.children, $options: 'i' } },
      // Add conditions for other child properties if needed
    ];
  }

  // query 为空对象
  if (Object.keys(query).length === 0) {
    query.parent = null;
  }

  console.log('Built query:', query); // 添加日志1
  return query;
};

export const getCustomerChildren = async (
  parentId: string | null,
): Promise<ICustomer[]> => {
  const children = await Customer.find({ parent: parentId })
    .populate('parent') // 填充 parent 字段
    .exec();
  return Promise.all(
    children.map(async (child) => {
      const childWithChildren = child.toObject();
      childWithChildren.children = await getCustomerChildren(
        child._id.toString(),
      );
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
      .populate('parent')
      .sort('-createdAt')
      .limit(+pageSize)
      .skip((+current - 1) * +pageSize)
      .exec();

    // 处理customer对应字段小数点位置
    const formattedMembers = await Promise.all(
      members.map(async (member) => ({
        ...member.toObject(),
        children: await getCustomerChildren(member._id.toString()),
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
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

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

    const updatedMember = await Customer.findByIdAndUpdate(id, {
      new: true,
    });

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
