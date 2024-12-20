import { Request, Response } from 'express';
import TelegramUser from '../models/telegramUser'; // 引入TelegramUser模型
import handleAsync from '../utils/handleAsync';

// Build query based on query parameters
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.userName) {
    query.userName = { $regex: queryParams.userName, $options: 'i' };
  }
  if (queryParams.botName) {
    query.botName = { $regex: queryParams.botName, $options: 'i' };
  }
  if (queryParams.botFirstName) {
    query.botFirstName = { $regex: queryParams.botFirstName, $options: 'i' };
  }
  if (queryParams.botId) {
    query.botId = queryParams.botId;
  }
  if (queryParams.message) {
    query.message = { $regex: queryParams.message, $options: 'i' };
  }

  if (queryParams.id) {
    query.id = queryParams.id;
  }

  return query;
};

// 获取所有Telegram用户
const getTelegramUsers = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const telegramUsers = await TelegramUser.find(query)
    .populate('bot')
    .sort('-createdAt') // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  res.json({
    success: true,
    data: telegramUsers,
  });
});

// 根据 ID 获取Telegram用户
const getTelegramUserById = handleAsync(async (req: Request, res: Response) => {
  const telegramUser = await TelegramUser.findById(req.params.id).exec();

  if (!telegramUser) {
    res.status(404);
    throw new Error('TelegramUser not found');
  }

  res.json({
    success: true,
    data: telegramUser,
  });
});

// 添加新Telegram用户
const addTelegramUser = handleAsync(async (req: Request, res: Response) => {
  const newTelegramUser = new TelegramUser({
    ...req.body,
  });

  const savedTelegramUser = await newTelegramUser.save();

  res.json({
    success: true,
    data: savedTelegramUser,
  });
});

// 更新Telegram用户
const updateTelegramUser = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedTelegramUser = await TelegramUser.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  ).exec();

  if (!updatedTelegramUser) {
    res.status(404);
    throw new Error('TelegramUser not found');
  }

  res.json({
    success: true,
    data: updatedTelegramUser,
  });
});

// 删除Telegram用户
const deleteTelegramUser = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const telegramUser = await TelegramUser.findByIdAndDelete(id).exec();

  if (!telegramUser) {
    res.status(404);
    throw new Error('TelegramUser not found');
  }

  res.json({
    success: true,
    data: { message: 'TelegramUser deleted successfully' },
  });
});

// 批量删除Telegram用户
const deleteMultipleTelegramUsers = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await TelegramUser.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `${ids.length} TelegramUsers deleted successfully`,
    });
  },
);

export {
  getTelegramUsers,
  getTelegramUserById,
  addTelegramUser,
  updateTelegramUser,
  deleteTelegramUser,
  deleteMultipleTelegramUsers,
};
