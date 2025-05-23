import { Request, Response } from 'express';
import Payment from '../models/payment';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import { generateOrderNumber } from '../utils/generateOrderNumber';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  // orderNumber`
  if (queryParams.orderNumber) {
    query.orderNumber = queryParams.orderNumber;
  }

  if (queryParams.status) {
    query.status = queryParams.status;
  }

  return query;
};

export const getPayments = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const payments = await Payment.find(query)
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .populate('botUser')
    .populate('bot')
    .lean()
    .exec();

  const total = await Payment.countDocuments(query).exec();

  res.json({
    success: true,
    data: payments,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

export const getPaymentById = handleAsync(
  async (req: Request, res: Response) => {
    const payment = await Payment.findOne({
      _id: req.params.id,
    })
      .populate('botUser')
      .populate('bot')
      .lean();

    if (!payment) {
      res.status(404);
      throw new Error('支付记录未找到');
    }

    res.json({
      success: true,
      data: payment,
    });
  },
);

export const addPayment = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(Payment, 'id', 6);

  const payment = new Payment({
    ...req.body,
    id: newId,
    orderNumber: await generateOrderNumber(),
    status: 'pending',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30分钟后过期
  });

  const savedPayment = await payment.save();

  res.status(201).json({
    success: true,
    data: savedPayment,
  });
});

export const updatePayment = handleAsync(
  async (req: Request, res: Response) => {
    const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!payment) {
      res.status(404);
      throw new Error('支付记录未找到');
    }

    res.json({
      success: true,
      data: payment,
    });
  },
);

export const deletePayment = handleAsync(
  async (req: Request, res: Response) => {
    const payment = await Payment.deleteOne({
      _id: req.params.id,
    });

    if (!payment) {
      res.status(404);
      throw new Error('支付记录未找到');
    }

    res.json({
      success: true,
      message: '支付记录已删除',
    });
  },
);

export const deleteMultiplePayments = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;
    await Payment.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: '支付记录批量删除成功',
    });
  },
);
