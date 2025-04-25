import { Response } from 'express';
import handleAsync from '../utils/handleAsync';
import { getExchangeRate } from '../utils/getExchange';
import Record from '../models/record';
import { IdGen } from '../utils/idGen';
import { RequestCustom } from 'user';
import { IUser } from '../models/user';
import Customer from '../models/customer';

// eth 兑 usdt
const ethToUsdt = handleAsync(async (req: RequestCustom, res: Response) => {
  const { ethAmount } = req.body;

  if (!ethAmount) {
    res.status(400);
    throw new Error('请输入ETH数量');
  }

  const customer = req.customer;

  if (ethAmount <= 0) {
    res.status(400);
    throw new Error('请输入大于0的ETH数量');
  }

  if (ethAmount > customer.ethPlatform) {
    res.status(400);
    throw new Error('Amount exceeds available balance');
  }

  const exchangeRate = await getExchangeRate('ETH', 'USDT');

  const usdt = ethAmount * exchangeRate;

  // 使用更新操作而不是 save 方法
  await Customer.findByIdAndUpdate(customer._id, {
    $inc: {
      usdtPlatform: usdt,
      ethPlatform: -ethAmount,
    },
  });

  const recordId = await IdGen.next(Record, 'id', 6);

  await Record.create({
    id: recordId,
    employee: (customer.employee as IUser)?._id,
    customer: customer._id,
    type: 'eth to usdt',
    amount: ethAmount,
    network: customer.network,
    address: customer.address,
  });

  res.json({
    success: true,
    data: usdt,
  });
});

// usdt 兑 eth
const usdtToEth = handleAsync(async (req: RequestCustom, res: Response) => {
  const { usdtAmount } = req.body;

  if (!usdtAmount) {
    res.status(400);
    throw new Error('请输入USDT数量');
  }

  if (usdtAmount <= 0) {
    res.status(400);
    throw new Error('请输入大于0的USDT数量');
  }

  const customer = req.customer;

  if (usdtAmount > customer.usdtPlatform) {
    res.status(400);
    throw new Error('Amount exceeds available balance');
  }

  const exchangeRate = await getExchangeRate('ETH', 'USDT');

  const eth = usdtAmount / exchangeRate;

  // 使用更新操作而不是 save 方法
  await Customer.findByIdAndUpdate(customer._id, {
    $inc: {
      ethPlatform: eth,
      usdtPlatform: -usdtAmount,
    },
  });

  const recordId = await IdGen.next(Record, 'id', 6);

  await Record.create({
    id: recordId,
    employee: (customer.employee as IUser)?._id,
    customer: customer._id,
    type: 'usdt to eth',
    amount: usdtAmount,
    network: customer.network,
    address: customer.address,
  });

  res.json({
    success: true,
    data: eth,
  });
});

export { ethToUsdt, usdtToEth };
