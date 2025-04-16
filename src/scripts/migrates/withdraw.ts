// cd /www/wwwroot/mev-bot-backend &&
// /www/server/nodejs/v22.14.0/bin/npx /www/server/nodejs/v22.14.0/bin/node dist/scripts/migrates/withdraw.js

// cd /www/wwwroot/mev-bot-backend.2025fc.xyz/mev-bot-backend &&
// /www/server/nodejs/v20.16.0/bin/npx /www/server/nodejs/v20.16.0/bin/node dist/scripts/migrates/withdraw.js

import Withdraw from '../../models/withdraw';
import setupDB from '../../utils/db';

const migrateColumns = async () => {
  await setupDB();

  // 查询所有提现记录
  const withdraws = await Withdraw.find();

  for (const withdraw of withdraws) {
    // 迁移提现记录
    withdraw.frozen = withdraw.isFrozen;
    await withdraw.save();
  }
};

migrateColumns()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.log('迁移冻结状态数据:', error);
    process.exit(1);
  });
