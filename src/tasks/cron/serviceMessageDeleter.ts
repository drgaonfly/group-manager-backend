import { redis } from '../../utils/redis';
import { setupBot } from '../../bot/botSetup';
import { SVC_DEL_QUEUE_KEY } from '../../bot/middlewares/serviceMessageDeleter';
import createDebug from 'debug';

const debug = createDebug('task:service-message-deleter');

/** Telegram deleteMessages 单次上限（同一 chatId） */
const TG_BATCH_SIZE = 100;

interface PendingItem {
  token: string;
  chatId: number;
  messageId: number;
}

export async function deleteServiceMessages(): Promise<void> {
  if (!redis) {
    debug('⚠️ Redis 未连接，跳过本次执行');
    return;
  }

  const raw = await redis.lrange(SVC_DEL_QUEUE_KEY, 0, -1);
  if (raw.length === 0) return;

  await redis.del(SVC_DEL_QUEUE_KEY);
  debug(`📥 本次读取 ${raw.length} 条`);

  // 解析
  const items: PendingItem[] = [];
  for (const s of raw) {
    try {
      items.push(JSON.parse(s) as PendingItem);
    } catch {
      debug(`⚠️ 解析失败，跳过: ${s}`);
    }
  }

  // 先按 token+chatId 分组
  const groups = new Map<
    string,
    { token: string; chatId: number; ids: number[] }
  >();
  for (const { token, chatId, messageId } of items) {
    const key = `${token}::${chatId}`;
    if (!groups.has(key)) groups.set(key, { token, chatId, ids: [] });
    groups.get(key)!.ids.push(messageId);
  }

  // 每组超出 100 条的放回队列尾，下一分钟继续
  const overflow: string[] = [];
  for (const group of groups.values()) {
    if (group.ids.length > TG_BATCH_SIZE) {
      const extra = group.ids.splice(TG_BATCH_SIZE);
      for (const id of extra) {
        overflow.push(
          JSON.stringify({
            token: group.token,
            chatId: group.chatId,
            messageId: id,
          }),
        );
      }
    }
  }
  if (overflow.length > 0) {
    await redis.rpush(SVC_DEL_QUEUE_KEY, ...overflow);
    debug(`↩️ ${overflow.length} 条超出部分放回队列，下次处理`);
  }

  debug(`分组数: ${groups.size}`);

  // 各组并行，每组 ≤100 条，直接调 bot.api.deleteMessages
  await Promise.all(
    Array.from(groups.values()).map(async ({ token, chatId, ids }) => {
      try {
        const bot = setupBot(token);
        await bot.api.deleteMessages(chatId, ids);
        debug(`✅ 删除成功 chatId=${chatId} count=${ids.length}`);
      } catch (e: any) {
        debug(`❌ 删除失败 chatId=${chatId}: ${e?.description ?? e?.message}`);
      }
    }),
  );
}
