import { MyContext } from '../types';
import createDebug from 'debug';

const debug = createDebug('bot:middleware:checkGroup');

/**
 * 检查是否在群组中的中间件
 * 注意：此中间件依赖 groupResolver 先执行，设置 ctx.currentGroup
 *
 * 用途：
 * - 用于需要群组上下文的命令
 * - groupResolver 已经处理了 chat type 检查和 currentGroup 设置
 * - 这里只需检查 currentGroup 是否存在即可
 */
export const checkGroup = async (ctx: MyContext, next: () => Promise<void>) => {
  if (!ctx.currentGroup) {
    debug('群组不存在或未初始化，跳过处理');
    // 不回复消息，静默跳过
    return;
  }

  await next();
};
