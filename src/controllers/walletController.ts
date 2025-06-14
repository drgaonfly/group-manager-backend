import { Request, Response } from 'express';
import Wallet from '../models/wallet';
import handleAsync from '../utils/handleAsync';
// import { IdGen } from '../utils/idGen';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.address) {
    query.address = queryParams.address;
  }

  if (queryParams.isOnline !== undefined) {
    query.isOnline = queryParams.isOnline;
  }

  return query;
};

export const getWallets = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const wallets = await Wallet.find(query)
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .populate('botUser')
    .populate('bot')
    .lean()
    .exec();

  const total = await Wallet.countDocuments(query).exec();

  res.json({
    success: true,
    data: wallets,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

export const getWalletById = handleAsync(
  async (req: Request, res: Response) => {
    const wallet = await Wallet.findOne({
      _id: req.params.id,
    })
      .populate('botUser')
      .populate('bot')
      .lean();

    if (!wallet) {
      res.status(404);
      throw new Error('钱包未找到');
    }

    res.json({
      success: true,
      data: wallet,
    });
  },
);

// export const addWallet = handleAsync(async (req: Request, res: Response) => {
//   const newId = await IdGen.next(Wallet, 'id', 6);

//   const wallet = new Wallet({
//     ...req.body,
//     id: newId,
//     balance: 0,
//     isOnline: true,
//     createdAt: new Date(),
//   });

//   const savedWallet = await wallet.save();

//   res.status(201).json({
//     success: true,
//     data: savedWallet,
//   });
// });

export const updateWallet = handleAsync(async (req: Request, res: Response) => {
  const wallet = await Wallet.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });

  if (!wallet) {
    res.status(404);
    throw new Error('钱包未找到');
  }

  res.json({
    success: true,
    data: wallet,
  });
});

export const deleteWallet = handleAsync(async (req: Request, res: Response) => {
  const wallet = await Wallet.deleteOne({
    _id: req.params.id,
  });

  if (!wallet) {
    res.status(404);
    throw new Error('钱包未找到');
  }

  res.json({
    success: true,
    message: '钱包已删除',
  });
});

export const deleteMultipleWallets = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;
    await Wallet.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: '钱包批量删除成功',
    });
  },
);
