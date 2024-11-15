import { Request, Response } from 'express';
import Chat from '../models/chat';
import handleAsync from '../utils/handleAsync';
import Bot from '../models/bot';

// Build query based on query parameters
const buildQuery = async (queryParams: any): Promise<any> => {
  const query: any = {};

  if (queryParams.chatId) {
    query.chatId = queryParams.chatId; // 精确匹配聊天ID
  }

  if (queryParams.type) {
    query.type = queryParams.type; // 精确匹配类型
  }

  if (queryParams.title) {
    query.title = { $regex: queryParams.title, $options: 'i' };
  }

  if (queryParams.username) {
    query.username = { $regex: queryParams.username, $options: 'i' };
  }

  if (queryParams.bot) {
    const botData = await Bot.find({ botName: queryParams.bot });
    if (botData && botData.length > 0) {
      query.bot = {
        $in: botData.map((bot) => bot._id),
      };
    } else {
      throw new Error('Bot not found');
    }
  }

  return query;
};

// 获取所有聊天
const getChats = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query);

  const chats = await Chat.find(query)
    .populate('bot') // 关联查询机器人信息
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Chat.countDocuments(query);

  res.json({
    success: true,
    data: chats,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 根据 ID 获取聊天
const getChatById = handleAsync(async (req: Request, res: Response) => {
  const chat = await Chat.findById(req.params.id).populate('bot').exec();

  if (!chat) {
    res.status(404);
    throw new Error('Chat not found');
  }

  res.json({
    success: true,
    data: chat,
  });
});

// 添加新聊天
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

// 更新聊天
const updateChat = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedChat = await Chat.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  )
    .populate('bot')
    .exec();

  if (!updatedChat) {
    res.status(404);
    throw new Error('Chat not found');
  }

  res.json({
    success: true,
    data: updatedChat,
  });
});

// 删除聊天
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

// 批量删除聊天
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
};
