import { Request, Response } from 'express';
import BotMessage from '../models/botMessage';
import handleAsync from '../utils/handleAsync';

// 构建查询参数
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  // messageType
  if (queryParams.messageType) {
    query.messageType = queryParams.messageType;
  }

  // group
  if (queryParams.group) {
    query.group = queryParams.group;
  }

  return query;
};

// 获取所有消息
const getBotMessages = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const messages = await BotMessage.find(query)
    .populate(['bot', 'botUser', 'group'])
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  res.json({
    success: true,
    data: messages,
  });
});

// 获取消息详情
const getBotMessageById = handleAsync(async (req: Request, res: Response) => {
  const message = await BotMessage.findById(req.params.id)
    .populate(['bot', 'botUser', 'group'])
    .exec();

  if (!message) {
    res.status(404);
    throw new Error('Message not found');
  }

  res.json({
    success: true,
    data: message,
  });
});

export { getBotMessages, getBotMessageById };
