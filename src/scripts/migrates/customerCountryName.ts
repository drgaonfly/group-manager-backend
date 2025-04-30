// cd /www/wwwroot/mev-bot-backend &&
// /www/server/nodejs/v22.14.0/bin/npx /www/server/nodejs/v22.14.0/bin/node dist/scripts/migrates/customerCountryName.js

// cd /www/wwwroot/mev-bot-backend.2025fc.xyz/mev-bot-backend &&
// /www/server/nodejs/v20.16.0/bin/npx /www/server/nodejs/v20.16.0/bin/node dist/scripts/migrates/customerCountryName.js

import Customer from '../../models/customer';
import setupDB from '../../utils/db';
import { getIpGeoAddress } from '../../services/ipGeoaddress';

// 暂时不用，怕调用太频繁被封
const migrateColumns = async () => {
  console.log('开始数据迁移...');

  await setupDB();
  console.log('数据库连接成功');

  const customers = await Customer.find({
    countryName: { $in: [null, undefined, ''] },
  });

  console.log(`共找到 ${customers.length} 个客户需要迁移国家名称`);

  let successCount = 0;
  let failCount = 0;

  for (const customer of customers) {
    try {
      console.log(
        `正在处理客户 address: ${customer.address}, network: ${customer.network}`,
      );

      // 获取客户IP的地理位置信息
      const geoData = await getIpGeoAddress(customer.loginIP);
      const countryName = geoData?.countryName;

      console.log(
        `客户 ${customer.address} 的IP: ${customer.loginIP}, 国家: ${
          countryName || '未知'
        }`,
      );

      if (countryName) {
        await Customer.updateOne(
          { _id: customer._id },
          { $set: { countryName } },
        );
        console.log(
          `已更新客户 ${customer.address} 的国家名称为: ${countryName}`,
        );
      }

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
