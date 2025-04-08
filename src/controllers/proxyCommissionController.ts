import { Request, Response } from 'express';
import ProxyCommissionRecord from '../models/proxyCommissionRecord';
import handleAsync from '../utils/handleAsync';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.wallet) {
    query.wallet = queryParams.wallet;
  }

  if (queryParams.paymentAddress) {
    query.paymentAddress = {
      $regex: new RegExp(queryParams.paymentAddress, 'i'),
    };
  }

  if (queryParams.hash) {
    query.hash = { $regex: new RegExp(queryParams.hash, 'i') };
  }

  return query;
};

// 获取所有代理佣金记录
const getProxyCommissionRecords = handleAsync(
  async (req: Request, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = buildQuery(req.query);

    const proxyCommissionRecords = await ProxyCommissionRecord.find(query)
      .populate({
        path: 'wallet',
        populate: {
          path: 'user',
          select: '-password', // Exclude password field
        },
      })
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await ProxyCommissionRecord.countDocuments(query).exec();

    res.json({
      success: true,
      data: proxyCommissionRecords,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

// 添加代理佣金记录
const addProxyCommissionRecord = handleAsync(
  async (req: Request, res: Response) => {
    const newProxyCommissionRecord = new ProxyCommissionRecord({
      ...req.body,
    });

    const savedProxyCommissionRecord = await newProxyCommissionRecord.save();
    res.json({
      success: true,
      data: savedProxyCommissionRecord,
    });
  },
);

// 根据 ID 获取代理佣金记录
const getProxyCommissionRecordById = handleAsync(
  async (req: Request, res: Response) => {
    const proxyCommissionRecord = await ProxyCommissionRecord.findById(
      req.params.id,
    ).populate('wallet');

    res.json({
      success: true,
      data: proxyCommissionRecord,
    });
  },
);

// 更新代理佣金记录
const updateProxyCommissionRecord = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const updatedProxyCommissionRecord =
      await ProxyCommissionRecord.findByIdAndUpdate(
        id,
        { ...req.body },
        { new: true, runValidators: true },
      );

    res.json({
      success: true,
      data: updatedProxyCommissionRecord,
    });
  },
);

// 删除代理佣金记录
const deleteProxyCommissionRecord = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const proxyCommissionRecord =
      await ProxyCommissionRecord.findByIdAndDelete(id);

    res.json({
      success: true,
      message: proxyCommissionRecord,
    });
  },
);

// 批量删除代理佣金记录
const deleteMultipleProxyCommissionRecords = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await ProxyCommissionRecord.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} proxy commission records deleted successfully`,
    });
  },
);

// 导出控制器方法
export {
  deleteMultipleProxyCommissionRecords,
  updateProxyCommissionRecord,
  deleteProxyCommissionRecord,
  getProxyCommissionRecords,
  addProxyCommissionRecord,
  getProxyCommissionRecordById,
};
