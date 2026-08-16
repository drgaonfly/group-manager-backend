import { redis } from '../../utils/redis';
import { setupBot } from '../../bot/botSetup';
import { SVC_DEL_QUEUE_KEY } from '../../bot/middlewares/serviceMessageDeleter';
import createDebug from 'debug';

const debug = createDebug('task:service-deleter');

/** 单次任务最多消费的条数，防止一次取太多 */
const MAX_BATCH = 500;

/** Telegram deleteMessages 单次上限 */
const TG_BATCH_SIZE = 100;

interface PendingItem {
  token: string;
  chatId: number;
  messageId: number;
}

/**
 * 从 Redis List 批量读取入群消息，按 token+chatId 分组后批量删除。
 *
 * 流程：
 * 1. LRANGE 0 MAX_BATCH-1 读取队列头部
 * 2. LTRIM MAX_BATCH -1 截断（原子性由两步各自保证，极端情况重复删无害）
 * 3. 按 token+chatId 分组，每组切成 100 条分片调用 deleteMessages
 */
export async function deleteServiceMessages(): Promise<void> {
  if (!redis) {
    debug('⚠️ Redis 未连接，跳过本次执行');
    return;
  }

  // 原子读取并截断：先读，再 trim
  const raw = await redis.lrange(SVC_DEL_QUEUE_KEY, 0, MAX_BATCH - 1);
  if (raw.length === 0) {
    debug('队列为空，无需处理');
    return;
  }

  // 只 trim 已读取的部分
  await redis.ltrim(SVC_DEL_QUEUE_KEY, raw.length, -1);

  debug(`📥 本次读取 ${raw.length} 条入群消息待删除`);

  // 解析，忽略格式错误的条目
  const items: PendingItem[] = [];
  for (const s of raw) {
    try {
      items.push(JSON.parse(s) as PendingItem);
    } catch {
      debug(`⚠️ 解析失败，跳过: ${s}`);
    }
  }

  // 按 token+chatId 分组
  const groups = new Map<
    string,
    { token: string; chatId: number; ids: number[] }
  >();

  for (const { token, chatId, messageId } of items) {
    const key = `${token}::${chatId}`;
    if (!groups.has(key)) {
      groups.set(key, { token, chatId, ids: [] });
    }
    groups.get(key)!.ids.push(messageId);
  }

  debug(`分组数: ${groups.size}`);

  // 逐组删除
  for (const { token, chatId, ids } of groups.values()) {
    const bot = setupBot(token);

    // 切片，每片最多 TG_BATCH_SIZE 条
    for (let i = 0; i < ids.length; i += TG_BATCH_SIZE) {
      const slice = ids.slice(i, i + TG_BATCH_SIZE);
      try {
        await bot.api.deleteMessages(chatId, slice);
        debug(`✅ 删除成功 chatId=${chatId} count=${slice.length}`);
      } catch (e: any) {
        console.error(
          `❌ 删除失败 chatId=${chatId}:`,
          e?.description ?? e?.message ?? e,
        );
      }
    }
  }
}
