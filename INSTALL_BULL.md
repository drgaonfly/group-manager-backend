# 安装 Bull Queue 依赖

## 安装命令

```bash
pnpm add bull
pnpm add -D @types/bull
```

## Bull Queue 简介

Bull 是 Node.js 最流行的 Redis 队列库：

- ✅ 生产级稳定性
- ✅ 支持分布式多实例
- ✅ 自动重试和错误处理
- ✅ 作业优先级和延迟
- ✅ 监控和状态追踪

## 使用场景

适用于：

- 多实例部署
- 需要持久化队列
- 需要作业监控
- 高可用性要求

## 配置说明

安装后重启服务即可使用新的分布式队列。

环境变量保持不变：

```env
SERVICE_MSG_BATCH_SIZE=100
SERVICE_MSG_BATCH_INTERVAL=200
SERVICE_MSG_MAX_QUEUE_SIZE=10000
```
