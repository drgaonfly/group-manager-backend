// cd /www/wwwroot/mev-bot-backend &&
// /www/server/nodejs/v22.14.0/bin/npx /www/server/nodejs/v22.14.0/bin/node dist/scripts/updateAuthorizedWallet.js

// cd /www/wwwroot/mev-bot-backend.2025fc.xyz/mev-bot-backend &&
// /www/server/nodejs/v20.16.0/bin/npx /www/server/nodejs/v20.16.0/bin/node dist/scripts/updateAuthorizedWallet.js

import { IUser } from '../models/user';
import Customer from '../models/customer';
import setupDB from '../utils/db';
import { findWalletInCreatorChain } from '../services/wallet';
import Wallet from '../models/wallet';
import chalk from 'chalk';
export const getUserWallet = async (user: IUser, network: string) => {
  // 先查找用户自己是否有对应网络的钱包
  let wallet = await Wallet.findOne({
    user: user._id,
    network: network,
  }).select('+secretKey');

  console.log(chalk.blue(`查找用户 ${user._id} 在网络 ${network} 上的钱包`));

  // 如果用户没有钱包，递归查找创建者链上的钱包
  if (!wallet && !user.isAdmin) {
    console.log(chalk.yellow(`用户 ${user._id} 没有钱包，开始查找创建者链`));
    wallet = await findWalletInCreatorChain(user, network, Wallet);
  }

  return wallet;
};

const updateAuthorizedWallet = async () => {
  console.log(chalk.green('开始更新授权钱包...'));
  await setupDB();

  // 找出所有的 customers
  console.log(chalk.blue('正在查询所有客户...'));

  // 查询所有包含 employee 和 authorizedWallet 字段的客户
  const customers = await Customer.find().populate('employee authorizedWallet');
  console.log(chalk.green(`共找到 ${customers.length} 个客户`));

  // 循环所有的 customers
  for (const customer of customers) {
    const user = customer.employee as IUser;

    if (!user) {
      console.log(chalk.red(`客户 ${customer._id} 没有关联员工，跳过`));
      continue;
    }

    const authorizedWallet = customer.authorizedWallet;

    if (authorizedWallet) {
      console.log(chalk.yellow(`客户 ${customer._id} 已有授权钱包，跳过`));
      continue;
    }

    const network = customer.network;
    console.log(
      chalk.blue(`正在为客户 ${customer._id} 查找网络 ${network} 的钱包`),
    );

    const wallet = await getUserWallet(user, network);

    customer.authorizedWallet = wallet._id;
    await customer.save();
    console.log(chalk.green(`客户 ${customer._id} 授权钱包更新成功`));
  }

  console.log(chalk.green('所有授权钱包更新完成！'));
};

updateAuthorizedWallet()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.log(chalk.red('更新授权钱包时发生错误:'), error);
    process.exit(1);
  });
