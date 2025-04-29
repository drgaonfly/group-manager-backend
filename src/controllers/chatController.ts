import { Request, Response } from 'express';
import Chat from '../models/chat';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { io } from '../services/socket';
import User, { IUser } from '../models/user';
import Customer, { ICustomer } from '../models/customer';
import { isProxy } from '../middlewares/authMiddleware';
import {
  transformDocumentImage,
  // transformDocumentImage,
  transformDocumentImages,
} from '../utils/transformUtils'; // 用于处理图像路径

// Build query based on query parameters
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  // 根据用户ID查询聊天记录
  if (queryParams.user) {
    // 处理用户ID为对象字符串的情况
    if (typeof queryParams.user === 'string') {
      try {
        const userObj = JSON.parse(queryParams.user);
        query.user = userObj._id;
      } catch (e) {
        query.user = queryParams.user;
      }
    } else {
      query.user = queryParams.user;
    }
  }

  if (queryParams.sender) {
    query.sender = queryParams.sender;
  }

  if (queryParams.isSoftDeleted) {
    query.isSoftDeleted = queryParams.isSoftDeleted;
  }

  // if (queryParams.customer) {

  //   query['customer.address'] = queryParams.customer;
  // }

  return query;
};

export const findCustomerUser = async (customer: ICustomer): Promise<IUser> => {
  let user = customer.proxy as IUser;

  if (!user) {
    // 找一下超级管理员
    user = await User.findOne({ isAdmin: true });
  }

  return user;
};

// 后台表格获取所有聊天记录
const getChats = handleAsync(async (req: Request, res: Response) => {
  const { current = '1' } = req.query;

  const query = buildQuery(req.query);

  const chats = await Chat.find(query)
    .sort('createdAt')
    .skip((+current - 1) * +'20')
    .exec();

  // 填充客户和用户信息
  const populatedChats = await Chat.populate(chats, [
    { path: 'customer' },
    { path: 'user', select: '-password' },
  ]);

  res.json({
    success: true,
    data: populatedChats,
  });
});

// 后台表格根据 ID 获取聊天记录
const getChatById = handleAsync(async (req: Request, res: Response) => {
  const chat = await Chat.findById(req.params.id).exec();

  if (!chat) {
    res.status(404);
    throw new Error('Chat not found');
  }

  res.json({
    success: true,
    data: chat,
  });
});

// 后台表格添加新聊天记录
const addChat = handleAsync(async (req: Request, res: Response) => {
  const newChat = new Chat({
    ...req.body,
  });

  const savedChat = await newChat.save();

  res.json({
    success: true,
    data: savedChat,
  });
});

// 后台表格更新聊天记录
const updateChat = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedChat = await Chat.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  ).exec();

  if (!updatedChat) {
    res.status(404);
    throw new Error('Chat not found');
  }

  res.json({
    success: true,
    data: updatedChat,
  });
});

// 后台表格删除聊天记录
const deleteChat = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const chat = await Chat.findByIdAndDelete(id).exec();

  if (!chat) {
    res.status(404);
    throw new Error('Chat not found');
  }

  res.json({
    success: true,
    data: { message: 'Chat deleted successfully' },
  });
});

// 后台表格批量删除聊天记录
const deleteMultipleChats = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  await Chat.deleteMany({
    _id: { $in: ids },
  }).exec();

  res.json({
    success: true,
    message: `${ids.length} chats deleted successfully`,
  });
});

// 后台代理获取与客户的最新聊天记录
const getLatestChats = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '50' } = req.query;
    const query = buildQuery(req.query);

    // 如果是代理用户，只能看到自己的聊天记录
    if (isProxy(req.user)) {
      query.user = req.user._id;
    }

    // 获取所有客户的最新一条消息和未读消息数量
    const latestChatsWithUnread = await Chat.aggregate([
      { $match: query },
      {
        $facet: {
          // 获取最新消息
          latestMessages: [
            { $sort: { createdAt: -1 } },
            {
              $group: {
                _id: '$customer',
                latestMessage: { $first: '$$ROOT' },
              },
            },
            { $replaceRoot: { newRoot: '$latestMessage' } },
            // 添加分页
            { $skip: (+current - 1) * +pageSize },
            { $limit: +pageSize },
          ],
          // 统计每个客户的未读消息数
          unreadCounts: [
            {
              $match: {
                sender: 'customer',
                isRead: false,
                isSoftDeleted: false,
              },
            },
            {
              $group: {
                _id: '$customer',
                unreadCount: { $sum: 1 },
              },
            },
          ],
          // 获取总数
          total: [
            {
              $group: {
                _id: '$customer',
              },
            },
            {
              $count: 'count',
            },
          ],
        },
      },
    ]).exec();

    // 合并最新消息和未读数量
    const latestChats = latestChatsWithUnread[0].latestMessages.map(
      (chat: any) => {
        const unreadInfo = latestChatsWithUnread[0].unreadCounts.find(
          (unread: any) => unread._id.toString() === chat.customer.toString(),
        );

        return {
          ...chat,
          unreadCount: unreadInfo ? unreadInfo.unreadCount : 0,
        };
      },
    );

    // 填充客户和用户信息
    const populatedChats = await Chat.populate(latestChats, [
      { path: 'customer' },
      { path: 'user', select: '-password' },
    ]);

    res.json({
      success: true,
      data: populatedChats,
      total: latestChatsWithUnread[0].total[0]?.count || 0,
    });
  },
);
// 后台代理获取与客户的所有聊天记录
const getChatUserMessagesByCustomer = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { customerId } = req.query;

    if (!customerId) {
      res.status(400);
      throw new Error('客户ID是必需的');
    }

    // 填充customer信息
    const customer = await Customer.findById(customerId).exec();

    if (!customer) {
      res.status(404);
      throw new Error('客户不存在');
    }

    // 获取employee的_id，如果没有则使用req.user._id
    let userId = req.user._id;
    if (customer.proxy) {
      userId = customer.proxy;
    }

    const query: any = {
      customer: customerId,
      user: userId,
    };

    if (!req.user.isAdmin) {
      query.isSoftDeleted = false;
    }

    // 查询数据库获取聊天记录
    const messages = await Chat.find(query)
      .sort('createdAt')
      .populate('customer')
      .populate('user')
      .exec();

    //处理消息中的图片路径
    const processedMessages = await transformDocumentImages(messages, [
      'image',
    ]);

    // 更新消息为已读状态
    await Chat.updateMany(
      {
        customer: customerId,
        user: userId,
        sender: 'customer',
        isRead: false,
      },
      {
        $set: { isRead: true },
      },
    ).exec();

    // emit 一个消息已读
    io.emit('chatMessageRead', {
      customerId,
      userId,
    });

    res.json({
      success: true,
      data: processedMessages,
    });
  },
);

// 后台代理添加与客户的聊天消息
const addChatUserMessage = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { customerId, message } = req.body;

    // 填充customer信息
    const customer = await Customer.findById(customerId).exec();

    // 获取employee的_id，如果没有则使用req.user._id
    //超级管理员发送了信息，如果这个customer有代理会以代理的身份发送信息
    let userId = req.user._id;
    if (customer.proxy) {
      userId = customer.proxy;
    }

    if (!customerId || !message) {
      res.status(400);
      throw new Error('客户ID和消息内容是必需的');
    }

    const newChat = new Chat({
      customer: customerId,
      user: userId,
      message: message,
      sender: 'user',
    });

    const savedChat = await newChat.save();
    const populatedChat = await Chat.findById(savedChat._id)
      .populate('customer')
      .populate('user');

    const processedMessage = await transformDocumentImage(populatedChat, [
      'image',
    ]);

    // 获取该客户与用户之间的未读消息数
    const unreadCount = await Chat.countDocuments({
      customer: customerId,
      user: userId,
      sender: 'user',
      isRead: false,
      isSoftDeleted: false,
    });

    const chat = {
      ...processedMessage,
      unreadCount,
    };

    io.emit('chatMessage', chat);

    res.json({
      success: true,
      data: chat,
    });
  },
);

// 前端客户获取与客服的聊天记录
const getChatMessages = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '100' } = req.query;

    const customerId = req.customer._id;
    const userId = await findCustomerUser(req.customer);

    const query = {
      customer: customerId,
      user: userId,
    };

    // 查询数据库获取聊天记录
    const messages = await Chat.find(query)
      .sort('createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .populate('customer')
      .populate('user', '-password')
      .exec();

    // 处理消息中的图片路径
    const processedMessages = await transformDocumentImages(messages, [
      'image',
    ]);

    // emit 一个消息已读
    io.emit('chatMessageRead', {
      customerId,
      userId,
    });

    res.json({
      success: true,
      data: processedMessages,
    });
  },
);

// 前端客户添加与客服的聊天消息
const addChatMessage = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const customerId = req.customer._id;
    const { message, image } = req.body;

    const userId = await findCustomerUser(req.customer);

    const newChat = new Chat({
      customer: customerId,
      user: userId,
      message,
      image,
      sender: 'customer',
    });

    const savedChat = await newChat.save();

    const populatedChat = await Chat.findById(savedChat._id)
      .populate('customer')
      .populate('user', '-password');

    const processedMessage = await transformDocumentImage(populatedChat, [
      'image',
    ]);

    // 获取该客户与用户之间的未读消息数
    const unreadCount = await Chat.countDocuments({
      customer: customerId,
      user: userId,
      sender: 'customer',
      isRead: false,
      isSoftDeleted: false,
    });

    const chat = {
      ...processedMessage,
      unreadCount,
    };

    io.emit('chatMessage', chat);

    res.json({
      success: true,
      data: chat,
    });
  },
);

// 后台代理软删除
const softDeleteChats = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  await Chat.updateMany(
    {
      _id: { $in: ids },
    },
    {
      $set: { isSoftDeleted: true, DeletedAt: new Date() },
    },
  ).exec();

  res.json({
    success: true,
    message: `${ids.length} chats  deleted successfully`,
  });
});

// 前端客户软删除
const softDeleteChatsByFrontendCustomer = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { ids } = req.body;
    const customerId = req.customer._id;

    // 确保只能删除自己的消息
    await Chat.updateMany(
      {
        _id: { $in: ids },
        customer: customerId,
        sender: 'customer', // 确保只能删除自己发送的消息
      },
      {
        $set: { isSoftDeleted: true, DeletedAt: new Date() },
      },
    ).exec();

    res.json({
      success: true,
      message: `${ids.length} 条消息已成功删除`,
    });
  },
);

export {
  getChats,
  getChatById,
  addChat,
  updateChat,
  deleteChat,
  deleteMultipleChats,
  getChatMessages,
  addChatMessage,
  getChatUserMessagesByCustomer,
  softDeleteChatsByFrontendCustomer,
  addChatUserMessage,
  softDeleteChats,
  getLatestChats,
};
