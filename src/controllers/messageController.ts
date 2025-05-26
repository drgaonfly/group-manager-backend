import { Request, Response } from 'express';
import Message from '../models/message';
import handleAsync from '../utils/handleAsync';

// 构建查询参数
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  // messageType
  if (queryParams.messageType) {
    query.messageType = queryParams.messageType;
  }

  // chat_type
  if (queryParams.chat_title) {
    query.chat_title = queryParams.chat_title;
  }

  // chat_id
  if (queryParams.username) {
    query.username = queryParams.username;
  }

  return query;
};

// 获取所有消息
const getMessages = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const messages = await Message.find(query)
    .sort('-date')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  res.json({
    success: true,
    data: messages,
  });
});

// 获取消息详情
const getMessageById = handleAsync(async (req: Request, res: Response) => {
  const message = await Message.findById(req.params.id).exec();

  if (!message) {
    res.status(404);
    throw new Error('Message not found');
  }

  res.json({
    success: true,
    data: message,
  });
});

export { getMessages, getMessageById };
