// cd /www/wwwroot/mev-bot-backend &&  /www/server/nodejs/v22.14.0/bin/npx /www/server/nodejs/v22.14.0/bin/node dist/scripts/getUnfrozenStackings.js
// cd /www/wwwroot/mev-bot-backend.2025fc.xyz/mev-bot-backend && /www/server/nodejs/v20.16.0/bin/npx /www/server/nodejs/v20.16.0/bin/node dist/scripts/getUnfrozenStackings.js

import Stacking from '../models/stacking';
import Customer from '../models/customer';
import setupDB from '../utils/db';

const start = async () => {
  await setupDB();

  const customers = await Customer.find();

  // 遍历所有客户
  console.log('开始处理客户质押数据 -----', new Date().toLocaleString());
  console.log(`总共需要处理 ${customers.length} 个客户`);

  for (const customer of customers) {
    const { address, network } = customer;
    console.log(`\n处理客户: ${address} (${network})`);

    // 查找未冻结的质押记录
    const stackings = await Stacking.find({
      fromAddress: address,
      fromNetwork: network,
      isFrozen: false,
    }).sort('-createdAt');

    console.log(`找到 ${stackings.length} 条未冻结质押记录`);

    // 计算总质押金额
    const totalAmount = stackings.reduce((sum, record) => {
      const amount = parseFloat(record.amount.toString());
      return sum + amount;
    }, 0);

    console.log(`当前未冻结总质押金额: ${totalAmount}`);

    // 更新客户记录
    const updateResult = await Customer.updateOne(
      { _id: customer._id },
      { $set: { stakingFrozenAmount: totalAmount } },
    );

    console.log(`更新结果: ${updateResult.modifiedCount ? '成功' : '未变更'}`);
  }

  console.log('\n所有客户处理完成 -----', new Date().toLocaleString());
};

start();
