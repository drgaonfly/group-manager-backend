import { Request, Response } from 'express';
import WalletShare from '../models/walletShare';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';

interface CustomRequest extends Request {
  user?: any; // Add user property to the request
}

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.customer) {
    query.customer = queryParams.customer;
  }

  if (queryParams.walletAddress) {
    query.walletAddress = {
      $regex: new RegExp(queryParams.walletAddress, 'i'),
    };
  }

  if (queryParams.shareType) {
    query.shareType = { $regex: new RegExp(queryParams.shareType, 'i') };
  }

  return query;
};

// 获取所有钱包分享记录
const getWalletShares = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = buildQuery(req.query);

    const walletShares = await WalletShare.find(query)
      .populate('user')
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await WalletShare.countDocuments(query).exec();

    res.json({
      success: true,
      data: walletShares,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

// 添加钱包分享记录
const addWalletShare = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const newId = await IdGen.next(WalletShare, 'id', 4);

    const newWalletShare = new WalletShare({
      ...req.body,
      user: req.user._id,
      id: newId,
    });

    const savedWalletShare = await newWalletShare.save();
    res.json({
      success: true,
      data: savedWalletShare,
    });
  },
);

// 根据 ID 获取钱包分享记录
const getWalletShareById = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const walletShare = await WalletShare.findById(req.params.id).populate(
      'customer',
    );

    res.json({
      success: true,
      data: walletShare,
    });
  },
);

// 更新钱包分享记录
const updateWalletShare = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const { id } = req.params;

    const updatedWalletShare = await WalletShare.findByIdAndUpdate(
      id,
      { ...req.body },
      { new: true, runValidators: true },
    );

    res.json({
      success: true,
      data: updatedWalletShare,
    });
  },
);

// 删除钱包分享记录
const deleteWalletShare = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const { id } = req.params;

    const walletShare = await WalletShare.findByIdAndDelete(id);

    res.json({
      success: true,
      message: walletShare,
    });
  },
);

// 批量删除钱包分享记录
const deleteMultipleWalletShares = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const { ids } = req.body;

    await WalletShare.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} wallet shares deleted successfully`,
    });
  },
);

// 导出控制器方法
export {
  deleteMultipleWalletShares,
  updateWalletShare,
  deleteWalletShare,
  getWalletShares,
  addWalletShare,
  getWalletShareById,
};
