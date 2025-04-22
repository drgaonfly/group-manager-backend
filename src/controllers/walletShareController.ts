import { Response } from 'express';
import WalletShare from '../models/walletShare';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import { RequestCustom } from 'user';
import User from '../models/user';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
  res: Response,
) => {
  const query: any = {};

  if (queryParams.network) {
    query.network = queryParams.network;
  }

  // 如果不是超级管理员，只能查看自己的钱包
  if (req.user && req.user.isAdmin !== true) {
    query.user = req.user._id;
  }

  if (queryParams.address) {
    query.address = { $regex: queryParams.address, $options: 'i' };
  }

  if (queryParams.user) {
    let searchText;
    try {
      const userParam = JSON.parse(String(queryParams.user));
      searchText = userParam.name;
    } catch (e) {
      searchText = String(queryParams.user).trim();
    }
    const userData = await User.find({
      $or: [
        { name: { $regex: searchText, $options: 'i' } },
        { email: { $regex: searchText, $options: 'i' } },
      ],
    });

    if (userData && userData.length > 0) {
      query.user = { $in: userData.map((user) => user._id) };
    } else {
      res.json({
        success: true,
        data: [],
      });
      return;
    }
  }

  return query;
};

// 获取所有钱包分享记录
const getWalletShares = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = await buildQuery(req.query, req, res);

    const walletShares = await WalletShare.find(query)
      .populate({
        path: 'user',
        populate: {
          path: 'creator',
        },
      })
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
  async (req: RequestCustom, res: Response) => {
    const newId = await IdGen.next(WalletShare, 'id', 4);

    const existingShare = await WalletShare.findOne({
      user: req.user._id,
      network: req.body.network,
    });

    if (existingShare) {
      res.status(400);
      throw new Error('该网络已存在，不能重复添加');
    }

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
  async (req: RequestCustom, res: Response) => {
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
  async (req: RequestCustom, res: Response) => {
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
  async (req: RequestCustom, res: Response) => {
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
  async (req: RequestCustom, res: Response) => {
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
