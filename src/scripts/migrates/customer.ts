// cd /www/wwwroot/mev-bot-backend &&
// /www/server/nodejs/v22.14.0/bin/npx /www/server/nodejs/v22.14.0/bin/node dist/scripts/migrates/customer.js

// cd /www/wwwroot/mev-bot-backend.2025fc.xyz/mev-bot-backend &&
// /www/server/nodejs/v20.16.0/bin/npx /www/server/nodejs/v20.16.0/bin/node dist/scripts/migrates/customer.js

import Customer from '../../models/customer';
import setupDB from '../../utils/db';
import User from '../../models/user';

const migrateColumns = async () => {
  console.log('开始数据迁移...');

  await setupDB();
  console.log('数据库连接成功');

  // 需要先导入 User 模型以避免 MissingSchemaError
  const customers = await Customer.find({
    $or: [
      { isVerified: true, verifiedAt: { $in: [null, undefined] } },
      { isAuthorized: true, authorizedAt: { $in: [null, undefined] } },
      { frozenAmount: { $lt: 0 } },
    ],
  }).populate({
    path: 'employee',
    model: User,
  });

  console.log(`共找到 ${customers.length} 个客户需要迁移`);

  let successCount = 0;
  let failCount = 0;

  for (const customer of customers) {
    try {
      console.log(
        `正在处理客户 address: ${customer.address}, netword: ${customer.network}`,
      );

      // 检查并打印客户验证和授权状态
      console.log(
        `客户 ${customer.address} 的验证状态: ${customer.isVerified}`,
      );
      console.log(
        `客户 ${customer.address} 的验证时间: ${customer.verifiedAt}`,
      );
      console.log(
        `客户 ${customer.address} 的授权状态: ${customer.isAuthorized}`,
      );
      console.log(
        `客户 ${customer.address} 的授权时间: ${customer.authorizedAt}`,
      );
      // frozenAmount
      console.log(
        `客户 ${customer.address} 的冻结金额: ${customer.frozenAmount}`,
      );

      successCount++;
      console.log(`客户 ${customer.address} 处理成功`);
    } catch (err) {
      failCount++;
      console.error(`客户 ${customer.address} 处理失败:`, err);
    }
  }

  console.log('迁移完成统计:');
  console.log(`成功: ${successCount} 个`);
  console.log(`失败: ${failCount} 个`);
};

migrateColumns()
  .then(() => {
    console.log('数据迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移表数据失败:', error);
    process.exit(1);
  });
