import { Request, Response } from 'express';
import Message from '../models/messages';
import handleAsync from '../utils/handleAsync';

// 构建查询条件
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.messageId) {
    query.messageId = queryParams.messageId;
  }

  if (queryParams.botName) {
    query.botName = { $regex: queryParams.botName, $options: 'i' };
  }

  if (queryParams.chatGroup) {
    query.chatGroup = { $regex: queryParams.chatGroup, $options: 'i' };
  }

  if (queryParams.sender) {
    query.sender = { $regex: queryParams.sender, $options: 'i' };
  }

  if (queryParams.messageType) {
    query.messageType = queryParams.messageType;
  }

  return query;
};

// 获取消息列表
const getMessages = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const messages = await Message.find(query)
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Message.countDocuments(query).exec();

  res.json({
    success: true,
    data: messages,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 创建新消息
const addMessage = handleAsync(async (req: Request, res: Response) => {
  const { messageId, botName, chatGroup, sender, content, messageType } =
    req.body;

  const messageExists = await Message.findOne({ messageId });
  if (messageExists) {
    res.status(400);
    throw new Error('该消息ID已存在');
  }

  const message = await Message.create({
    messageId,
    botName,
    chatGroup,
    sender,
    content,
    messageType,
  });

  res.status(201).json({
    success: true,
    data: message,
  });
});

// 获取单个消息
const getMessageById = handleAsync(async (req: Request, res: Response) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    res.status(404);
    throw new Error('消息不存在');
  }

  res.json({
    success: true,
    data: message,
  });
});

// 更新消息
const updateMessage = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { messageId } = req.body;

  const message = await Message.findById(id);
  if (!message) {
    res.status(404);
    throw new Error('消息不存在');
  }

  if (messageId && messageId !== message.messageId) {
    const messageExists = await Message.findOne({
      messageId,
      _id: { $ne: id },
    });
    if (messageExists) {
      res.status(400);
      throw new Error('该消息ID已被使用');
    }
  }

  const updatedMessage = await Message.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  res.json({
    success: true,
    data: updatedMessage,
  });
});

// 删除消息
const deleteMessage = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const message = await Message.findByIdAndDelete(id);

  if (!message) {
    res.status(404);
    throw new Error('消息不存在');
  }

  res.json({
    success: true,
    data: { message: '消息删除成功' },
  });
});

// 批量删除消息
const deleteMultipleMessages = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Message.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `成功删除 ${ids.length} 条消息`,
    });
  },
);

export {
  getMessages,
  addMessage,
  getMessageById,
  updateMessage,
  deleteMessage,
  deleteMultipleMessages,
};
