/**
 * 迁移脚本：将旧的 bot 级别 groupVerify 配置迁移为按群组的验证配置
 *
 * 旧模式：Bot.groupVerify → GroupVerify（没有 bot/group 字段）
 * 新模式：GroupVerify 每条记录对应一个群组（包含 bot + group）
 *
 * 运行方式：npx ts-node src/migrations/migrateGroupVerifyToGroupBased.ts
 */

import setupDB, { closeDB } from '../utils/db';
import Bot from '../models/bot';
import GroupVerify from '../models/groupVerify';

async function migrateGroupVerify() {
  console.log('🔗 连接数据库...');
  await setupDB();
  console.log('✅ 数据库连接成功');

  try {
    // 1. 查询所有配置了 groupVerify 的 Bot
    const bots = await Bot.find({ groupVerify: { $exists: true, $ne: null } })
      .populate('groupVerify')
      .populate('groups')
      .exec();

    console.log(`\n📊 找到 ${bots.length} 个配置了群验证的 Bot`);

    if (bots.length === 0) {
      console.log('✅ 无需迁移，退出');
      return;
    }

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const bot of bots) {
      const oldVerify = bot.groupVerify as any;
      if (!oldVerify?.question || !oldVerify?.asks) {
        console.log(
          `⚠️  Bot ${bot.botName} (${bot._id}) 的验证配置不完整，跳过`,
        );
        totalSkipped++;
        continue;
      }

      const groups = bot.groups as any[];
      if (!groups || groups.length === 0) {
        console.log(`⚠️  Bot ${bot.botName} (${bot._id}) 没有关联群组，跳过`);
        totalSkipped++;
        continue;
      }

      console.log(`\n🔧 处理 Bot: ${bot.botName} (${bot._id})`);
      console.log(`   关联群组数: ${groups.length}`);
      console.log(`   验证问题: ${oldVerify.question.substring(0, 50)}...`);
      console.log(`   答案选项: ${oldVerify.asks.length} 个`);

      // 2. 为每个群组创建新的 GroupVerify 记录
      for (const group of groups) {
        try {
          // 检查该群组是否已有验证配置
          const existing = await GroupVerify.findOne({
            bot: bot._id,
            group: group._id,
          });

          if (existing) {
            console.log(`   ⏭️  群组 "${group.title}" 已有验证配置，跳过`);
            totalSkipped++;
            continue;
          }

          // 创建新记录
          await GroupVerify.create({
            bot: bot._id,
            group: group._id,
            question: oldVerify.question,
            asks: oldVerify.asks.map((ask: any) => ({
              name: ask.name,
              isCorrect: ask.isCorrect,
            })),
            isActive: true,
          });

          console.log(`   ✅ 为群组 "${group.title}" 创建验证配置`);
          totalCreated++;
        } catch (error: any) {
          console.error(`   ❌ 群组 "${group.title}" 创建失败:`, error.message);
        }
      }
    }

    console.log('\n');
    console.log('========================================');
    console.log('📈 迁移统计：');
    console.log(`   ✅ 成功创建: ${totalCreated} 条`);
    console.log(`   ⏭️  跳过: ${totalSkipped} 条`);
    console.log('========================================');
    console.log('\n💡 提示：');
    console.log('   - Bot 上的旧 groupVerify 字段已保留（向后兼容）');
    console.log('   - 新配置通过 /api/group-verifies 接口管理');
    console.log('   - groupResolver 会优先使用新配置（按群组查询）');
    console.log('');
  } catch (error) {
    console.error('❌ 迁移过程出错:', error);
    throw error;
  } finally {
    await closeDB();
    console.log('🔌 数据库连接已断开');
  }
}

// 执行迁移
migrateGroupVerify()
  .then(() => {
    console.log('✅ 迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  });
