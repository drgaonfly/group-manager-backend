// cd /www/wwwroot/mev-bot-backend &&
// /www/server/nodejs/v22.14.0/bin/npx /www/server/nodejs/v22.14.0/bin/node dist/scripts/migrates/record.js

// cd /www/wwwroot/mev-bot-backend.2025fc.xyz/mev-bot-backend &&
// /www/server/nodejs/v20.16.0/bin/npx /www/server/nodejs/v20.16.0/bin/node dist/scripts/migrates/record.js

import Record from '../../models/record';
import setupDB from '../../utils/db';
import User from '../../models/user';
import Customer, { ICustomer } from '../../models/customer';
const migrateColumns = async () => {
  console.log('开始数据迁移...');

  await setupDB();
  console.log('数据库连接成功');

  // 需要先导入 User 模型以避免 MissingSchemaError
  const records = await Record.find().populate([
    {
      path: 'employee',
      model: User,
    },
    {
      path: 'customer',
      model: Customer,
    },
  ]);
  console.log(`共找到 ${records.length} 个记录需要迁移`);

  let successCount = 0;
  let failCount = 0;

  for (const record of records) {
    try {
      console.log(`正在处理记录 ID: ${record._id}`);

      // 从客户信息中获取网络和地址
      const customer = record.customer as ICustomer;
      if (customer) {
        record.network = customer.network;
        record.address = customer.address;
        console.log(
          `更新网络信息: ${customer.network}, 地址: ${customer.address}`,
        );
      }

      await record.save();
      successCount++;
      console.log(`记录 ${record._id} 处理成功`);
    } catch (err) {
      failCount++;
      console.error(`记录 ${record._id} 处理失败:`, err);
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
