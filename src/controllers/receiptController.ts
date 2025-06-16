import { Request, Response } from 'express';
import Receipt from '../models/receipt';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import Bot from '../models/bot';
import BotUser from '../models/botUser';

const buildQuery = async (queryParams: any): Promise<any> => {
  const query: any = {};

  if (queryParams.hash) {
    query.hash = queryParams.hash;
  }

  if (queryParams.bot) {
    const botData = await Bot.find({
      botName: {
        $regex: queryParams.bot,
        $options: 'i',
      },
    });

    if (botData && botData.length > 0) {
      query.bot = { $in: botData.map((bot) => bot._id) };
    } else {
      query.bot = null;
    }
  }

  if (queryParams.botUser) {
    const botUsers = await BotUser.find({
      userName: {
        $regex: queryParams.botUser,
        $options: 'i',
      },
    });

    if (botUsers && botUsers.length > 0) {
      query.botUser = { $in: botUsers.map((botUser) => botUser._id) };
    } else {
      query.botUser = null;
    }
  }

  return query;
};

export const getReceipts = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query);

  const receipts = await Receipt.find(query)
    .populate('botUser')
    .populate('bot')
    .populate('wallet')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .populate('botUser')
    .populate('bot')
    .populate('wallet')
    .lean()
    .exec();

  const total = await Receipt.countDocuments(query).exec();

  res.json({
    success: true,
    data: receipts,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

export const getReceiptById = handleAsync(
  async (req: Request, res: Response) => {
    const receipt = await Receipt.findOne({
      _id: req.params.id,
    })
      .populate('botUser')
      .populate('bot')
      .populate('wallet')
      .lean();

    if (!receipt) {
      res.status(404);
      throw new Error('收据未找到');
    }

    res.json({
      success: true,
      data: receipt,
    });
  },
);

export const addReceipt = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(Receipt, 'id', 6);

  const receipt = new Receipt({
    ...req.body,
    id: newId,
    time: Date.now(),
  });

  const savedReceipt = await receipt.save();

  res.status(201).json({
    success: true,
    data: savedReceipt,
  });
});

export const updateReceipt = handleAsync(
  async (req: Request, res: Response) => {
    const receipt = await Receipt.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!receipt) {
      res.status(404);
      throw new Error('收据未找到');
    }

    res.json({
      success: true,
      data: receipt,
    });
  },
);

export const deleteReceipt = handleAsync(
  async (req: Request, res: Response) => {
    const receipt = await Receipt.deleteOne({
      _id: req.params.id,
    });

    if (!receipt) {
      res.status(404);
      throw new Error('收据未找到');
    }

    res.json({
      success: true,
      message: '收据已删除',
    });
  },
);

export const deleteMultipleReceipts = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;
    await Receipt.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: '收据批量删除成功',
    });
  },
);
