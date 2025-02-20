import { Request, Response } from 'express';
import Notification from '../models/notification'; // 确保路径正确
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';

interface CustomRequest extends Request {
  customer: any;
  user?: any; // 用于携带用户信息，根据你的实际情况调整
}

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.title) {
    query.title = { $regex: new RegExp(queryParams.title, 'i') };
  }

  if (queryParams.type) {
    query.type = { $regex: new RegExp(queryParams.type, 'i') };
  }

  if (queryParams.content) {
    query.content = { $regex: new RegExp(queryParams.content, 'i') };
  }

  if (queryParams.readAt) {
    query.readAt = queryParams.readAt;
  }

  return query;
};

// 获取所有通知
const getNotifications = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;
    const query = buildQuery(req.query);

    const notifications = await Notification.find(query)
      .populate('customer')
      .populate('user')
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await Notification.countDocuments(query).exec();

    res.json({
      success: true,
      data: notifications,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

// 添加通知
const addNotification = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const newId = await IdGen.next(Notification, 'id', 4);

    const newNotification = new Notification({
      ...req.body,
      id: newId,
      user: req.user._id, // 添加当前登录用户ID
    });

    const savedNotification = await newNotification.save();
    res.json({
      success: true,
      data: savedNotification,
    });
  },
);

// 根据 ID 获取通知
const getNotificationById = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const notification = await Notification.findById(req.params.id)
      .populate('sender')
      .populate('receiver');

    if (!notification) {
      res.status(404);
      throw new Error('Notification not found');
    }

    res.json({
      success: true,
      data: notification,
    });
  },
);

// 更新通知
const updateNotification = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const { id } = req.params;

    const updatedNotification = await Notification.findByIdAndUpdate(
      id,
      { ...req.body },
      { new: true, runValidators: true },
    );

    if (!updatedNotification) {
      res.status(404);
      throw new Error('Notification not found');
    }

    res.json({
      success: true,
      data: updatedNotification,
    });
  },
);

// 删除通知
const deleteNotification = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const { id } = req.params;

    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      res.status(404);
      throw new Error('Notification not found');
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully',
      data: notification, // 返回被删除的文档可能对前端有用
    });
  },
);

// 批量删除通知
const deleteMultipleNotifications = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const { ids } = req.body;

    const deleteResult = await Notification.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${deleteResult.deletedCount} notifications deleted successfully`,
    });
  },
);

// 获取当前用户的通知
const getCustomerNotifications = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    // 使用 req.customer._id 获取当前登录用户的 ID
    const customerId = req.customer._id;

    // 构建查询条件
    const query = {
      customer: customerId, // 只查询当前用户的通知
      ...buildQuery(req.query),
    };

    // 查询通知列表
    const notifications = await Notification.find(query)
      .sort('-createdAt') // 按创建时间倒序
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    // 获取总数
    const total = await Notification.countDocuments(query).exec();

    // 返回数据
    res.json({
      success: true,
      data: notifications,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

export {
  getNotifications,
  addNotification,
  getNotificationById,
  updateNotification,
  deleteNotification,
  deleteMultipleNotifications,
  getCustomerNotifications,
};
