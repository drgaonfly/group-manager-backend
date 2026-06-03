# 数据迁移脚本

## 群验证配置迁移（Bot 级别 → 群组级别）

**背景**：原本每个 Bot 只有一套群验证配置（`Bot.groupVerify`），所有群组共用。现在改为每个群组可以单独配置验证规则。

**脚本**：`migrateGroupVerifyToGroupBased.ts`

### 运行方式

```bash
# 方式一：使用 npm 脚本
npm run migrate:group-verify

# 方式二：直接运行
npx ts-node src/migrations/migrateGroupVerifyToGroupBased.ts
```

### 迁移逻辑

1. 查找所有 `bot.groupVerify` 不为空的 Bot
2. 读取旧验证配置的 `question` 和 `asks`
3. 为该 Bot 关联的**每个群组**创建一条新的 GroupVerify 记录（带 `bot` + `group` 字段）
4. 如果群组已有配置则跳过（幂等性）

### 注意事项

- 旧 Bot 上的 `groupVerify` 字段**保留不删除**（向后兼容）
- 新代码优先使用群组级别的配置（按 `group._id` 查询）
- 迁移后前端可通过 `/api/group-verifies` 接口管理各群组的验证规则
- 可重复运行（已存在的配置会跳过）

### 回滚

如果需要回滚到旧模式，删除所有新建的 GroupVerify 记录：

```javascript
// 在 MongoDB shell 或迁移脚本中执行
db.groupverifies.deleteMany({
  bot: { $exists: true },
  group: { $exists: true },
});
```

然后恢复代码到旧版本即可。
