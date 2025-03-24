import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync';
import { getExchangeRate } from '../utils/getExchange';
import Customer from '../models/customer';
import Record from '../models/record';
import { IdGen } from '../utils/idGen';

// eth 兑 usdt
const ethToUsdt = handleAsync(async (req: Request, res: Response) => {
  const { id, ethAmount, employee } = req.body;

  const exchangeRate = await getExchangeRate('ETH', 'USDT');

  const usdt = ethAmount * exchangeRate;

  const customer = await Customer.findById(id);

  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  if (!ethAmount) {
    res.status(400);
    throw new Error('请输入ETH数量');
  }

  if (ethAmount <= 0) {
    res.status(400);
    throw new Error('请输入大于0的ETH数量');
  }

  if (ethAmount > customer.ethPlatform) {
    res.status(400);
    throw new Error('ETH数量超过可用余额');
  }

  customer.usdtPlatform += usdt;
  customer.ethPlatform -= ethAmount;

  await customer.save();

  const recordId = await IdGen.next(Record, 'id', 6);

  await Record.create({
    id: recordId,
    employee,
    customer: customer._id,
    type: 'eth to usdt',
    amount: ethAmount,
  });

  res.json({
    success: true,
    data: usdt,
  });
});

// usdt 兑 eth
const usdtToEth = handleAsync(async (req: Request, res: Response) => {
  const { id, usdtAmount, employee } = req.body;

  console.log('usdtAmount', usdtAmount);

  const exchangeRate = await getExchangeRate('ETH', 'USDT');

  const eth = usdtAmount / exchangeRate;

  console.log('eth', eth);

  const customer = await Customer.findById(id);

  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  if (!usdtAmount) {
    res.status(400);
    throw new Error('请输入USDT数量');
  }

  if (usdtAmount <= 0) {
    res.status(400);
    throw new Error('请输入大于0的USDT数量');
  }

  if (usdtAmount > customer.usdtPlatform) {
    res.status(400);
    throw new Error('USDT数量超过可用余额');
  }

  customer.ethPlatform += eth;
  customer.usdtPlatform -= usdtAmount;

  await customer.save();

  const recordId = await IdGen.next(Record, 'id', 6);

  await Record.create({
    id: recordId,
    employee,
    customer: customer._id,
    type: 'usdt to eth',
    amount: usdtAmount,
  });

  res.json({
    success: true,
    data: eth,
  });
});

export { ethToUsdt, usdtToEth };
