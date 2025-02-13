import { Request, Response } from 'express';
import Member from '../models/member';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { isProxy } from '../middlewares/authMiddleware';
import { IdGen } from '../utils/idGen';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.address) {
    query.address = { $regex: queryParams.address, $options: 'i' };
  }

  if (queryParams.network) {
    query.network = queryParams.network;
  }

  return query;
};

// 获取成员列表
export const getMembers = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = buildQuery({
      ...req.query,
      user: req.user,
      getAllData: req.getAllData,
    });

    const members = await Member.find(query)
      .populate('channel')
      .populate('proxy')
      .sort('-createdAt')
      .limit(+pageSize)
      .skip((+current - 1) * +pageSize)
      .exec();

    const total = await Member.countDocuments(query);

    res.json({
      success: true,
      data: members,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

// 添加成员
export const addMember = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const memberExists = await Member.findOne({ address: req.body.address });

    if (memberExists) {
      res.status(400);
      throw new Error('成员已存在');
    }

    // 生成唯一ID
    const newId = await IdGen.next(Member, 'id', 6);

    // 获取客户端IP
    const clientIP =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const normalizedIP =
      clientIP === '::1' || clientIP === ':::1' ? '127.0.0.1' : clientIP;

    const newMember = new Member({
      ...req.body,
      id: newId,
      createdIP: normalizedIP,
      createdAt: new Date(),
      proxy: isProxy(req.user) ? req.user._id : null,
    });

    const savedMember = await newMember.save();
    res.status(201).json({
      success: true,
      data: savedMember,
    });
  },
);

// 获取单个成员
export const getMemberById = handleAsync(
  async (req: Request, res: Response) => {
    const member = await Member.findById(req.params.id)
      .populate('channel')
      .populate('proxy');

    if (!member) {
      res.status(404);
      throw new Error('Member not found');
    }

    res.json({
      success: true,
      data: member,
    });
  },
);

// 更新成员
export const updateMember = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const member = await Member.findById(id);

  if (!member) {
    res.status(404);
    throw new Error('成员未找到');
  }

  // 如果更新登录信息
  if (updateData.logedinAt) {
    updateData.LogedinIP =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';
  }

  const updatedMember = await Member.findByIdAndUpdate(id, updateData, {
    new: true,
  });

  res.json({
    success: true,
    data: updatedMember,
  });
});

// 删除成员
export const deleteMember = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const member = await Member.findByIdAndDelete(id);

  if (!member) {
    res.status(404);
    throw new Error('成员未找到');
  }

  res.json({
    success: true,
    data: { message: 'Member deleted successfully' },
  });
});

// 批量删除成员
export const deleteMultipleMembers = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Member.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} members deleted successfully`,
    });
  },
);
