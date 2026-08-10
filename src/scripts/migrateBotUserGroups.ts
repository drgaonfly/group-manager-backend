import mongoose from 'mongoose';
import Group from '../models/group';
import BotUser from '../models/botUser';
import createDebug from 'debug';

const debug = createDebug('migration:botuser-groups');

/**
 * 数据迁移脚本：将 Group.botUsers 转换为 BotUser.groups
 *
 * 执行方式：
 * npm run migrate:botuser-groups
 *
 * 或者在代码中调用：
 * import { migrateBotUserGroups } from './scripts/migrateBotUserGroups';
 * await migrateBotUserGroups();
 */

interface MigrationStats {
  groupsProcessed: number;
  usersUpdated: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
}

export async function migrateBotUserGroups(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    groupsProcessed: 0,
    usersUpdated: 0,
    errors: 0,
    startTime: new Date(),
  };

  try {
    debug('🚀 开始迁移 Group.botUsers → BotUser.groups');

    // 获取所有有成员的群组
    const groups = await Group.find({
      botUsers: { $exists: true, $ne: [] },
    }).select('_id botUsers title');

    debug(`📊 找到 ${groups.length} 个需要迁移的群组`);

    for (const group of groups) {
      try {
        if (group.botUsers && group.botUsers.length > 0) {
          debug(`处理群组: ${group.title} (${group.botUsers.length} 个成员)`);

          // 批量更新所有成员的 groups 字段
          const result = await BotUser.updateMany(
            { _id: { $in: group.botUsers } },
            { $addToSet: { groups: group._id } },
          );

          stats.usersUpdated += result.modifiedCount;
          debug(
            `✅ 群组 ${group.title}: 更新了 ${result.modifiedCount} 个用户`,
          );
        }

        stats.groupsProcessed++;
      } catch (error) {
        stats.errors++;
        debug(`❌ 处理群组 ${group.title} 失败:`, error);
      }
    }

    stats.endTime = new Date();
    const duration = stats.endTime.getTime() - stats.startTime.getTime();

    debug('🎉 迁移完成!');
    debug(`📈 统计信息:`);
    debug(`  - 处理群组: ${stats.groupsProcessed}`);
    debug(`  - 更新用户: ${stats.usersUpdated}`);
    debug(`  - 错误数量: ${stats.errors}`);
    debug(`  - 耗时: ${duration}ms`);

    return stats;
  } catch (error) {
    debug('💥 迁移失败:', error);
    throw error;
  }
}

/**
 * 验证数据迁移结果
 */
export async function validateMigration(): Promise<boolean> {
  debug('🔍 开始验证迁移结果...');

  try {
    // 随机抽取一些群组验证
    const sampleGroups = await Group.aggregate([
      { $match: { botUsers: { $exists: true, $ne: [] } } },
      { $sample: { size: 10 } },
      { $project: { _id: 1, botUsers: 1, title: 1 } },
    ]);

    let validationPassed = true;

    for (const group of sampleGroups) {
      // 检查该群组的成员是否都正确添加了 groups 字段
      const membersWithGroup = await BotUser.countDocuments({
        _id: { $in: group.botUsers },
        groups: group._id,
      });

      const expectedCount = group.botUsers.length;

      if (membersWithGroup !== expectedCount) {
        debug(`❌ 验证失败: 群组 ${group.title}`);
        debug(
          `   期望: ${expectedCount} 个成员，实际: ${membersWithGroup} 个成员`,
        );
        validationPassed = false;
      } else {
        debug(`✅ 验证通过: 群组 ${group.title} (${membersWithGroup} 个成员)`);
      }
    }

    debug(`🔍 验证结果: ${validationPassed ? '通过' : '失败'}`);
    return validationPassed;
  } catch (error) {
    debug('💥 验证失败:', error);
    return false;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const MONGODB_URI =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';

  mongoose
    .connect(MONGODB_URI)
    .then(async () => {
      debug('📡 数据库连接成功');

      const stats = await migrateBotUserGroups();

      if (stats.errors === 0) {
        const isValid = await validateMigration();
        if (isValid) {
          debug('🎊 迁移和验证全部成功!');
          process.exit(0);
        } else {
          debug('⚠️ 迁移完成但验证失败，请检查数据');
          process.exit(1);
        }
      } else {
        debug(`⚠️ 迁移完成但有 ${stats.errors} 个错误`);
        process.exit(1);
      }
    })
    .catch((error) => {
      debug('💥 数据库连接失败:', error);
      process.exit(1);
    });
}
