import { Request, Response } from 'express';
import Recharge from '../models/recharge';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import Bot from '../models/bot';
import BotUser from '../models/botUser';
import { RequestCustom } from '../types/user';
import { isEmployee, isProxy } from '../middlewares/authMiddleware';
import User from '../models/user';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  if (queryParams.id) {
    query.id = { $regex: queryParams.id, $options: 'i' };
  }

  if (queryParams.status) {
    query.status = queryParams.status;
  }

  if (queryParams.bot) {
    const botData = await Bot.find({
      $or: [
        { botName: { $regex: queryParams.bot, $options: 'i' } },
        { userName: { $regex: queryParams.bot, $options: 'i' } },
      ],
    });

    if (botData && botData.length > 0) {
      query.bot = { $in: botData.map((bot) => bot._id) };
    } else {
      query.bot = null;
    }
  }

  if (queryParams.botUser) {
    const botUsers = await BotUser.find({
      $or: [
        { userName: { $regex: queryParams.botUser, $options: 'i' } },
        { id: { $regex: queryParams.botUser, $options: 'i' } },
      ],
    });

    if (botUsers && botUsers.length > 0) {
      query.botUser = { $in: botUsers.map((botUser) => botUser._id) };
    } else {
      query.botUser = null;
    }
  }

  // 代理查询逻辑 - 包括员工数据
  if (isProxy(req.user)) {
    const employees = await User.find({ proxy: req.user._id });
    const employeeIds = employees.map((employee) => employee._id);
    query.proxy = { $in: [...employeeIds, req.user._id] };
  }

  if (isEmployee(req.user)) {
    query.proxy = req.user.proxy || req.user._id;
  }

  return query;
};

export const getRecharges = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = await buildQuery(req.query, req);

    // 执行查询
    const recharges = await Recharge.find(query)
      .populate('botUser')
      .populate('bot')
      .populate('proxy')
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .lean()
      .exec();

    const total = await Recharge.countDocuments(query).exec();

    res.json({
      success: true,
      data: recharges,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

export const getRechargeById = handleAsync(
  async (req: Request, res: Response) => {
    const recharge = await Recharge.findOne({
      _id: req.params.id,
    })
      .populate('botUser')
      .populate('bot')
      .lean();

    if (!recharge) {
      res.status(404);
      throw new Error('充值记录未找到');
    }

    res.json({
      success: true,
      data: recharge,
    });
  },
);

export const addRecharge = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(Recharge, 'id', 6);

  const recharge = new Recharge({
    ...req.body,
    id: newId,
    status: 'pending',
    createdAt: new Date(),
    expiredAt: new Date(Date.now() + 30 * 60 * 1000), // 30分钟后过期
  });

  const savedRecharge = await recharge.save();

  res.status(201).json({
    success: true,
    data: savedRecharge,
  });
});

export const updateRecharge = handleAsync(
  async (req: Request, res: Response) => {
    const recharge = await Recharge.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!recharge) {
      res.status(404);
      throw new Error('充值记录未找到');
    }

    res.json({
      success: true,
      data: recharge,
    });
  },
);

export const deleteRecharge = handleAsync(
  async (req: Request, res: Response) => {
    const recharge = await Recharge.deleteOne({
      _id: req.params.id,
    });

    if (!recharge) {
      res.status(404);
      throw new Error('充值记录未找到');
    }

    res.json({
      success: true,
      message: '充值记录已删除',
    });
  },
);

export const deleteMultipleRecharges = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;
    await Recharge.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: '充值记录批量删除成功',
    });
  },
);
