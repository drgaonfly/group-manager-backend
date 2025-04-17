// cd /www/wwwroot/mev-bot-backend &&
// /www/server/nodejs/v22.14.0/bin/npx /www/server/nodejs/v22.14.0/bin/node dist/scripts/migrates/withdraw.js

// cd /www/wwwroot/mev-bot-backend.2025fc.xyz/mev-bot-backend &&
// /www/server/nodejs/v20.16.0/bin/npx /www/server/nodejs/v20.16.0/bin/node dist/scripts/migrates/withdraw.js

import User, { IUser } from '../../models/user';
import Withdraw from '../../models/withdraw';
import setupDB from '../../utils/db';

const migrateColumns = async () => {
  console.log(`[${new Date().toISOString()}] 开始数据迁移...`);

  await setupDB();
  console.log(`[${new Date().toISOString()}] 数据库连接成功`);

  // 查询所有提现记录
  const withdraws = await Withdraw.find().populate({
    path: 'employee',
    model: User,
  });
  console.log(
    `[${new Date().toISOString()}] 查询到 ${withdraws.length} 条提现记录`,
  );

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const withdraw of withdraws) {
    try {
      // 迁移提现记录
      if (!withdraw.isFrozen) {
        withdraw.status = 'pending';
        console.log(
          `[${new Date().toISOString()}] 记录 ${
            withdraw._id
          } 状态更新为 pending`,
        );
      } else {
        console.log(
          `[${new Date().toISOString()}] 记录 ${
            withdraw._id
          } 已冻结，跳过状态更新`,
        );
        skippedCount++;
      }

      const employee = withdraw.employee as IUser;

      if (employee) {
        withdraw.proxy = employee.proxy;
        console.log(
          `[${new Date().toISOString()}] 记录 ${withdraw._id} 设置代理为 ${
            employee.proxy
          }`,
        );
        updatedCount++;
      } else {
        console.log(
          `[${new Date().toISOString()}] 记录 ${
            withdraw._id
          } 未找到关联员工信息`,
        );
      }

      await withdraw.save();
    } catch (error) {
      console.log(
        `[${new Date().toISOString()}] 记录 ${
          withdraw._id
        } 保存失败，错误信息:`,
        error,
      );
      errorCount++;
      continue;
    }
  }

  console.log(`[${new Date().toISOString()}] 迁移完成:`);
  console.log(`- 总记录数: ${withdraws.length}`);
  console.log(`- 更新记录数: ${updatedCount}`);
  console.log(`- 跳过记录数: ${skippedCount}`);
  console.log(`- 错误记录数: ${errorCount}`);
};

migrateColumns()
  .then(() => {
    console.log(`[${new Date().toISOString()}] 迁移脚本执行成功`);
    process.exit(0);
  })
  .catch((error) => {
    console.log(`[${new Date().toISOString()}] 迁移冻结状态数据失败:`, error);
    process.exit(1);
  });
