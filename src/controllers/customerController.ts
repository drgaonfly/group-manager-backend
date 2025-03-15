import { Request, Response } from 'express';
import Customer from '../models/customer';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { IdGen } from '../utils/idGen';
import User from '../models/user';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  console.log('Received query params:', queryParams); // 添加日志

  if (queryParams.network) {
    query.network = queryParams.network;
  }

  if (queryParams.isVerified !== undefined) {
    query.isVerified = queryParams.isVerified === 'true';
  }

  if (queryParams.isAuthorized !== undefined) {
    query.isAuthorized = queryParams.isAuthorized === 'true';
  }

  console.log('Built query:', query); // 添加日志
  return query;
};

// 获取成员列表
export const getCustomers = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = buildQuery(req.query);
    console.log('Final query:', query);

    // 添加这个日志来查看实际查询结果的内容
    const members = await Customer.find(query)
      .populate('proxy')
      .sort('-createdAt')
      .limit(+pageSize)
      .skip((+current - 1) * +pageSize)
      .exec();

    console.log(
      'Actual results:',
      members.map((m) => ({
        id: m.id,
        network: m.network,
      })),
    ); // 添加详细日志

    const total = await Customer.countDocuments(query);

    // 处理返回数据，添加邀请人信息
    const formattedMembers = await Promise.all(
      members.map(async (member) => {
        const memberObj = member.toObject();
        if (memberObj.invitedBy) {
          const inviter = await User.findOne({
            inviteCode: memberObj.invitedBy,
          }).select('name email');
          if (inviter) {
            memberObj.inviter = {
              name: inviter.name || inviter.email,
              email: inviter.email,
            };
          }
        }
        return memberObj;
      }),
    );

    console.log(
      'Final formatted results:',
      formattedMembers.map((m) => ({
        id: m.id,
        network: m.network,
      })),
    ); // 添加格式化后的日志

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
    const customer = await Customer.findById(req.params.id)
      .populate('channel')
      .populate('proxy');

    if (!customer) {
      res.status(404);
      throw new Error('Customer not found');
    }

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
    const updateData = req.body;

    const customer = await Customer.findById(id);

    if (!customer) {
      res.status(404);
      throw new Error('成员未找到');
    }

    // 检查 isAuthorized 和 isVerified 不能同时为 true
    if (
      (updateData.isVerified === true && customer.isAuthorized === true) ||
      (updateData.isAuthorized === true && customer.isVerified === true) ||
      (updateData.isVerified === true && updateData.isAuthorized === true)
    ) {
      res.status(400);
      throw new Error('授权账户和模拟账户不能同时存在');
    }

    // 如果更新登录信息
    if (updateData.logedinAt) {
      updateData.LogedinIP =
        req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
        req.socket.remoteAddress ||
        'unknown';
    }

    const updatedMember = await Customer.findByIdAndUpdate(id, updateData, {
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

export const verifyCustomer = handleAsync(
  async (req: Request, res: Response) => {
    const { network, address } = req.body;

    // 检查是否存在具有相同网络和地址组合的客户
    const existingCustomer = await Customer.findOne({ network, address });

    if (!existingCustomer) {
      res.status(404);
      throw new Error('Customer not found');
    }

    // 更新验证状态
    existingCustomer.isVerified = true;
    await existingCustomer.save();

    res.json({
      success: true,
      data: existingCustomer,
    });
  },
);
