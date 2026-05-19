import { Request, Response } from 'express';
import Success from '../models/success';
import handleAsync from '../utils/handleAsync';
import Bot from '../models/bot';
import BotUser from '../models/botUser';

const buildQuery = async (queryParams: any): Promise<any> => {
  const query: any = {};

  if (queryParams.bot) {
    const botData = await Bot.find({
      botName: { $regex: queryParams.bot, $options: 'i' },
    });
    query.bot = botData.length > 0 ? { $in: botData.map((b) => b._id) } : null;
  }

  if (queryParams.botUser) {
    const botUsers = await BotUser.find({
      userName: { $regex: queryParams.botUser, $options: 'i' },
    });
    query.botUser =
      botUsers.length > 0 ? { $in: botUsers.map((u) => u._id) } : null;
  }

  if (queryParams.code) {
    query.code = { $regex: queryParams.code, $options: 'i' };
  }

  if (queryParams.used !== undefined) {
    query.used = queryParams.used === 'true';
  }

  return query;
};

export const getSuccesses = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query);

  const data = await Success.find(query)
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .populate('bot', 'botName userName')
    .populate('botUser', 'userName firstName lastName')
    .populate('targetBotUser', 'userName firstName lastName')
    .populate('proxy', 'name email')
    .lean()
    .exec();

  const total = await Success.countDocuments(query).exec();

  res.json({
    success: true,
    data,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

export const getSuccessById = handleAsync(
  async (req: Request, res: Response) => {
    const record = await Success.findById(req.params.id)
      .populate('bot', 'botName userName')
      .populate('botUser', 'userName firstName lastName')
      .populate('targetBotUser', 'userName firstName lastName')
      .populate('proxy', 'name email')
      .lean();

    if (!record) {
      res.status(404);
      throw new Error('继承记录未找到');
    }

    res.json({
      success: true,
      data: record,
    });
  },
);

export const deleteSuccess = handleAsync(
  async (req: Request, res: Response) => {
    const record = await Success.deleteOne({ _id: req.params.id });

    if (!record) {
      res.status(404);
      throw new Error('继承记录未找到');
    }

    res.json({
      success: true,
      message: '继承记录已删除',
    });
  },
);

export const deleteMultipleSuccesses = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;
    await Success.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: '继承记录批量删除成功',
    });
  },
);
