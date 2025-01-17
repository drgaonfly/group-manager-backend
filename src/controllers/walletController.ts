import { Request, Response } from 'express';
import Wallet from '../models/wallet';
import handleAsync from '../utils/handleAsync';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.type) {
    query.type = queryParams.type;
  }

  if (queryParams.Address) {
    query.Address = queryParams.Address;
  }

  if (queryParams.network) {
    query.network = queryParams.network;
  }

  if (queryParams.balance) {
    query.balance = queryParams.balance;
  }

  return query;
};

// 生成随机字符串的方法
function generateRandomString(length: number) {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const getWallets = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const wallet = await Wallet.find(query)
    .populate({
      path: 'user',
      populate: 'proxy',
    })
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Wallet.countDocuments(query).exec();

  // 为每个 wallet 填充随机字符串到 secretKey 字段
  const walletsWithSecretKey = wallet.map((w) => {
    const randomString = generateRandomString(32);
    return {
      ...w.toObject(),
      secretKey: randomString,
    };
  });

  res.json({
    success: true,
    data: walletsWithSecretKey,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

const addWallet = handleAsync(async (req: Request, res: Response) => {
  const newWallet = new Wallet({
    ...req.body,
  });

  const savedWallet = await newWallet.save();

  res.json({
    success: true,
    data: savedWallet,
  });
});

const getWalletById = handleAsync(async (req: Request, res: Response) => {
  const wallet = await Wallet.findById(req.params.id).populate({
    path: 'user',
    populate: 'proxy',
  });

  res.json({
    success: true,
    data: wallet,
  });
});

const updateWallet = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const updatedWallet = await Wallet.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true, runValidators: true },
  );

  res.json({
    success: true,
    data: updatedWallet,
  });
});

const deleteWallet = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const wallet = await Wallet.findByIdAndDelete(id);

  res.json({
    success: true,
    message: wallet,
  });
});

const deleteMultipleWallets = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Wallet.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} Wallets deleted successfully`,
    });
  },
);

export {
  getWallets,
  addWallet,
  getWalletById,
  updateWallet,
  deleteWallet,
  deleteMultipleWallets,
};
