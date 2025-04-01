import { Request, Response } from 'express';
import WalletShare from '../models/walletShare';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';
import Setting from '../models/setting';
import User from '../models/user';

interface CustomRequest extends Request {
  user?: any; // Add user property to the request
}

const buildQuery = (queryParams: any, req: CustomRequest): any => {
  const query: any = {};

  if (queryParams.network) {
    query.network = queryParams.network;
  }

  // 如果不是超级管理员，只能查看自己的钱包
  if (req.user && req.user.isAdmin !== true) {
    query.user = req.user._id;
  }

  return query;
};

// 获取所有钱包分享记录
const getWalletShares = handleAsync(
  async (req: CustomRequest, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = buildQuery(req.query, req);

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

// 根据邀请码获取钱包地址
const getWalletByInviteCode = handleAsync(
  async (req: Request, res: Response) => {
    const { inviteCode, network } = req.query;

    console.log(inviteCode, network, '++++++++++++++++++++++++');

    if (!network) {
      res.status(400);
      throw new Error('网络类型不能为空');
    }

    let user;
    if (!inviteCode) {
      const superAdminKey = `${network}SuperAdmin`;
      const setting = await Setting.findOne({ key: superAdminKey });
      // 直接返回设置表中的地址
      res.json({
        success: true,
        data: {
          network: network,
          address: setting?.value,
          balance: '0',
        },
      });
    } else {
      // 根据邀请码查找用户，同时关联查询创建者信息
      user = await User.findOne({ inviteCode }).populate('creator');
    }

    if (!user) {
      res.status(404);
      throw new Error('未找到用户');
    }

    // 检查用户的质押通道
    if (user.stackingChannel === 'platform') {
      const superAdminKey = `${network}SuperAdmin`;
      const setting = await Setting.findOne({ key: superAdminKey });
      res.json({
        success: true,
        data: {
          network: network,
          address: setting?.value,
          balance: '0',
        },
      });
      return;
    }

    // 1. 先查找用户自己是否有对应网络的钱包
    let wallet = await WalletShare.findOne({
      user: user._id,
      network: network,
    });

    // 2. 递归查找创建者链上的钱包，直到找到钱包或到达顶级管理员
    async function findWalletInCreatorChain(currentUser: any): Promise<any> {
      // 如果是管理员或没有创建者，返回null
      if (currentUser.isAdmin || !currentUser.creator) {
        return null;
      }

      // 获取创建者ID
      const creatorId =
        typeof currentUser.creator === 'object' && '_id' in currentUser.creator
          ? currentUser.creator._id
          : currentUser.creator;

      // 查找创建者的钱包
      const creatorWallet = await WalletShare.findOne({
        user: creatorId,
        network: network,
      });

      if (creatorWallet) {
        return creatorWallet;
      }

      // 如果创建者没有钱包，递归查找创建者的创建者
      const creator = await User.findById(creatorId).populate('creator');
      if (creator) {
        return findWalletInCreatorChain(creator);
      }

      return null;
    }

    // 如果用户没有钱包，递归查找创建者链上的钱包
    if (!wallet && !user.isAdmin) {
      wallet = await findWalletInCreatorChain(user);
    }

    // 3. 如果都没找到，返回授权失败
    if (!wallet) {
      res.status(403);
      throw new Error('授权失败：未找到可用的钱包');
    }

    // 返回找到的钱包信息
    res.json({
      success: true,
      data: {
        network: wallet.network,
        address: wallet.address,
      },
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
  getWalletByInviteCode,
};
