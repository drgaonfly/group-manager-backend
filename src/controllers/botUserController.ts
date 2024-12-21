import { Request, Response } from 'express';
import BotUser from '../models/botUser'; // 引入botUser模型
import handleAsync from '../utils/handleAsync';

// Build query based on query parameters
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.userName) {
    query.userName = { $regex: queryParams.userName, $options: 'i' };
  }
  if (queryParams.firstName) {
    query.firstName = { $regex: queryParams.firstName, $options: 'i' };
  }
  if (queryParams.lastName) {
    query.lastName = { $regex: queryParams.lastName, $options: 'i' };
  }
  if (queryParams.bot) {
    query.bot = queryParams.bot;
  }
  return query;
};

// 获取所有Telegram用户
const getbotUsers = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const botUsers = await BotUser.find(query)
    .populate('bot')
    .sort('-createdAt') // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  res.json({
    success: true,
    data: botUsers,
  });
});

// 根据 ID 获取Telegram用户
const getbotUserById = handleAsync(async (req: Request, res: Response) => {
  const getBotUser = await BotUser.findById(req.params.id).exec();

  if (!getBotUser) {
    res.status(404);
    throw new Error('botUser not found');
  }

  res.json({
    success: true,
    data: getBotUser,
  });
});

// 添加新Telegram用户
const addbotUser = handleAsync(async (req: Request, res: Response) => {
  const newbotUser = new BotUser({
    ...req.body,
  });

  const savedbotUser = await newbotUser.save();

  res.json({
    success: true,
    data: savedbotUser,
  });
});

// 更新Telegram用户
const updatebotUser = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedbotUser = await BotUser.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  ).exec();

  if (!updatedbotUser) {
    res.status(404);
    throw new Error('botUser not found');
  }

  res.json({
    success: true,
    data: updatedbotUser,
  });
});

// 删除Telegram用户
const deletebotUser = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const deletedBotUser = await BotUser.findByIdAndDelete(id).exec();

  if (!deletedBotUser) {
    res.status(404);
    throw new Error('botUser not found');
  }

  res.json({
    success: true,
    data: { message: 'botUser deleted successfully' },
  });
});

// 批量删除Telegram用户
const deleteMultiplebotUsers = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await BotUser.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `${ids.length} botUsers deleted successfully`,
    });
  },
);

export {
  getbotUsers,
  getbotUserById,
  addbotUser,
  updatebotUser,
  deletebotUser,
  deleteMultiplebotUsers,
};
