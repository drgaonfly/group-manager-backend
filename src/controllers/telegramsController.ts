import { Request, Response } from 'express';
import Telegram from '../models/telegrams';
import handleAsync from '../utils/handleAsync';

// 构建查询条件
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.botToken) {
    query.botToken = queryParams.botToken;
  }

  if (queryParams.botName) {
    query.botName = { $regex: queryParams.botName, $options: 'i' };
  }

  if (queryParams.isActive !== undefined) {
    query.isActive = queryParams.isActive;
  }

  return query;
};

// 获取Telegram机器人列表
const getTelegrams = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const telegrams = await Telegram.find(query)
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Telegram.countDocuments(query).exec();

  res.json({
    success: true,
    data: telegrams,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 创建新Telegram机器人
const addTelegram = handleAsync(async (req: Request, res: Response) => {
  const { botToken, url, botName, isActive, remarks } = req.body;

  const telegramExists = await Telegram.findOne({ botToken });
  if (telegramExists) {
    res.status(400);
    throw new Error('该Bot Token已被使用，请使用其他Token');
  }

  const telegram = await Telegram.create({
    botToken,
    url,
    botName,
    isActive,
    remarks,
  });

  res.status(201).json({
    success: true,
    data: telegram,
  });
});

// 获取单个Telegram机器人
const getTelegramById = handleAsync(async (req: Request, res: Response) => {
  const telegram = await Telegram.findById(req.params.id);

  if (!telegram) {
    res.status(404);
    throw new Error('Telegram机器人不存在');
  }

  res.json({
    success: true,
    data: telegram,
  });
});

// 更新Telegram机器人
const updateTelegram = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { botToken } = req.body;

  const telegram = await Telegram.findById(id);
  if (!telegram) {
    res.status(404);
    throw new Error('Telegram机器人不存在');
  }

  if (botToken && botToken !== telegram.botToken) {
    const tokenExists = await Telegram.findOne({ botToken, _id: { $ne: id } });
    if (tokenExists) {
      res.status(400);
      throw new Error('该Bot Token已被其他机器人使用');
    }
  }

  const updatedTelegram = await Telegram.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  res.json({
    success: true,
    data: updatedTelegram,
  });
});

// 删除Telegram机器人
const deleteTelegram = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const telegram = await Telegram.findByIdAndDelete(id);

  if (!telegram) {
    res.status(404);
    throw new Error('Telegram机器人不存在');
  }

  res.json({
    success: true,
    data: { message: 'Telegram机器人删除成功' },
  });
});

// 批量删除Telegram机器人
const deleteMultipleTelegrams = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Telegram.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `成功删除 ${ids.length} 个Telegram机器人`,
    });
  },
);

export {
  getTelegrams,
  addTelegram,
  getTelegramById,
  updateTelegram,
  deleteTelegram,
  deleteMultipleTelegrams,
};
