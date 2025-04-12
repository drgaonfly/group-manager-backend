// cd /www/wwwroot/mev-bot-backend &&  /www/server/nodejs/v22.14.0/bin/npx /www/server/nodejs/v22.14.0/bin/node dist/scripts/getUnfrozenStackings.js
// cd /www/wwwroot/mev-bot-backend.2025fc.xyz/mev-bot-backend && /www/server/nodejs/v20.16.0/bin/npx /www/server/nodejs/v20.16.0/bin/node dist/scripts/getUnfrozenStackings.js

import Stacking from '../models/stacking';
import Customer from '../models/customer';
import setupDB from '../utils/db';
import chalk from 'chalk';

const start = async () => {
  await setupDB();

  const customers = await Customer.find();

  // 遍历所有客户
  console.log(
    chalk.cyan('开始处理客户质押数据 -----'),
    chalk.yellow(new Date().toLocaleString()),
  );
  console.log(
    chalk.cyan(`总共需要处理 ${chalk.yellow(customers.length)} 个客户`),
  );

  for (const customer of customers) {
    const { address, network } = customer;
    console.log(
      chalk.green(
        `\n处理客户: ${chalk.yellow(address)} (${chalk.blue(network)})`,
      ),
    );

    // 查找未冻结的质押记录
    const stackings = await Stacking.find({
      fromAddress: address,
      fromNetwork: network,
      isFrozen: false,
    }).sort('-createdAt');

    console.log(
      chalk.green(`找到 ${chalk.yellow(stackings.length)} 条未冻结质押记录`),
    );

    // 计算总质押金额
    const totalAmount = stackings.reduce((sum, record) => {
      const amount = parseFloat(record.amount.toString());
      return sum + amount;
    }, 0);

    console.log(
      chalk.green(`当前未冻结总质押金额: ${chalk.yellow(totalAmount)}`),
    );

    // 更新客户记录
    const updateResult = await Customer.updateOne(
      { _id: customer._id },
      { $set: { stakingFrozenAmount: totalAmount } },
    );

    console.log(
      chalk.green(
        `更新结果: ${
          updateResult.modifiedCount ? chalk.blue('成功') : chalk.red('未变更')
        }`,
      ),
    );
  }

  console.log(
    chalk.cyan('\n所有客户处理完成 -----'),
    chalk.yellow(new Date().toLocaleString()),
  );
  process.exit(0);
};

start();
