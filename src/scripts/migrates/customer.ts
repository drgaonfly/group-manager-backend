// cd /www/wwwroot/mev-bot-backend &&
// /www/server/nodejs/v22.14.0/bin/npx /www/server/nodejs/v22.14.0/bin/node dist/scripts/migrates/customer.js

// cd /www/wwwroot/mev-bot-backend.2025fc.xyz/mev-bot-backend &&
// /www/server/nodejs/v20.16.0/bin/npx /www/server/nodejs/v20.16.0/bin/node dist/scripts/migrates/customer.js

import Customer from '../../models/customer';
import setupDB from '../../utils/db';

const migrateColumns = async () => {
  await setupDB();

  const customers = await Customer.find();

  for (const customer of customers) {
    customer.isDemoAccount = customer.isAuthorized;
    customer.demoAt = customer.authorizedAt;

    await customer.save();
  }
};

migrateColumns()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.log('迁移表数据:', error);
    process.exit(1);
  });
