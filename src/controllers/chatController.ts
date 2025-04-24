import { Request, Response } from 'express';
import Chat from '../models/chat';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { io } from '../services/socket';
import User, { IUser } from '../models/user';
import Customer, { ICustomer } from '../models/customer';

// Build query based on query parameters
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.message) {
    query.message = { $regex: queryParams.message, $options: 'i' };
  }

  return query;
};

// 获取所有聊天记录
const getChats = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  // 获取所有客户的最新一条消息，实现群聊列表
  const latestChats = await Chat.aggregate([
    { $match: query },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$customer',
        latestMessage: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$latestMessage' } },
    { $skip: (+current - 1) * +pageSize },
    { $limit: +pageSize },
  ]).exec();

  // 填充客户和用户信息
  const populatedChats = await Chat.populate(latestChats, [
    { path: 'customer' },
    { path: 'user', select: '-password' },
  ]);

  res.json({
    success: true,
    data: populatedChats,
  });
});

// 获取后台用户与客户的聊天记录
const getChatUserMessagesByCustomer = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { customerId } = req.query;

    if (!customerId) {
      res.status(400);
      throw new Error('客户ID是必需的');
    }

    // 填充customer信息
    const customer = await Customer.findById(customerId).exec();

    console.log(customer, '+++++++++++++++++++++++++++----------------');

    if (!customer) {
      res.status(404);
      throw new Error('客户不存在');
    }

    // 获取employee的_id，如果没有则使用req.user._id
    let userId = req.user._id;
    if (customer.proxy) {
      userId = customer.proxy;
    }

    const query = {
      customer: customerId,
      user: userId,
    };

    // 查询数据库获取聊天记录
    const messages = await Chat.find(query)
      .sort('createdAt')
      .populate('customer')
      .populate('user')
      .exec();

    res.json({
      success: true,
      data: messages,
    });
  },
);

// 添加后台用户与客户的聊天消息
const addChatUserMessage = handleAsync(
  async (req: RequestCustom, res: Response) => {
    console.log('req.body', req.body);
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
      isRead: false,
    });

    const savedChat = await newChat.save();
    const populatedChat = await Chat.findById(savedChat._id)
      .populate('customer')
      .populate('user');

    io.emit('chatMessage', populatedChat);

    res.json({
      success: true,
      data: populatedChat,
    });
  },
);

// 获取客户与客服的聊天记录
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

    res.json({
      success: true,
      data: messages,
    });
  },
);

const findCustomerUser = async (customer: ICustomer): Promise<IUser> => {
  let user = customer.proxy as IUser;

  if (!user) {
    // 找一下超级管理员
    user = await User.findOne({ isAdmin: true });
  }

  return user;
};

// 添加客户与客服的聊天消息
const addChatMessage = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const customerId = req.customer._id;
    const { message } = req.body;

    if (!message) {
      res.status(400);
      throw new Error('消息内容是必需的');
    }

    const userId = await findCustomerUser(req.customer);

    const newChat = new Chat({
      customer: customerId,
      user: userId,
      message,
      sender: 'customer',
      isRead: false,
    });

    const savedChat = await newChat.save();

    const populatedChat = await Chat.findById(savedChat._id)
      .populate('customer')
      .populate('user', '-password');

    io.emit('chatMessage', populatedChat);

    res.json({
      success: true,
      data: savedChat,
    });
  },
);

// 根据 ID 获取聊天记录
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

// 添加新聊天记录
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

// 更新聊天记录
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

// 删除聊天记录
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

// 批量删除聊天记录
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
  addChatUserMessage,
};
