import { Request, Response } from 'express';
import ServiceMessage from '../models/serviceMessage';
import Bot from '../models/bot';
import Group from '../models/group';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from '../types/user';
import { isProxy } from '../middlewares/authMiddleware';
import { getCache } from '../utils/cache';

/**
 * 构建查询参数
 */
const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  // 多租户：非管理员强制使用 JWT 中的 botId
  const botId = req.tenant || queryParams.botId;

  // 支持 botId 精确查询
  if (botId) {
    query.bot = botId;
  }

  // 支持 groupId 精确查询
  if (queryParams.groupId) {
    query.group = queryParams.groupId;
  }

  // 代理用户只看自己的；管理员可跨代理查看
  if (isProxy(req.user) && !req.user.isAdmin) {
    query.proxy = req.user._id;
  }

  return query;
};

/**
 * 获取服务消息配置列表
 */
export const getServiceMessages = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '50' } = req.query;

    const query = await buildQuery(req.query, req);

    const total = await ServiceMessage.countDocuments(query);
    const data = await ServiceMessage.find(query)
      .populate('bot', 'botName userName')
      .populate('group', 'title username id')
      .populate('proxy', 'name')
      .sort({ createdAt: -1 })
      .skip((Number(current) - 1) * Number(pageSize))
      .limit(Number(pageSize));

    res.json({
      success: true,
      data,
      total,
      current: Number(current),
      pageSize: Number(pageSize),
    });
  },
);

/**
 * 获取单条服务消息配置
 */
export const getServiceMessageById = handleAsync(
  async (req: Request, res: Response) => {
    const doc = await ServiceMessage.findById(req.params.id)
      .populate('bot', 'botName userName')
      .populate('group', 'title username id')
      .populate('proxy', 'name');

    if (!doc) {
      res.status(404);
      throw new Error('服务消息配置不存在');
    }

    res.json({ success: true, data: doc });
  },
);

/**
 * 按 bot 和 group 查询配置（前端常用）
 */
export const getServiceMessageByBotAndGroup = handleAsync(
  async (req: Request, res: Response) => {
    const { botId, groupId } = req.query;

    if (!botId || !groupId) {
      res.status(400);
      throw new Error('缺少 botId 或 groupId 参数');
    }

    const doc = await ServiceMessage.findOne({ bot: botId, group: groupId })
      .populate('bot', 'botName userName')
      .populate('group', 'title username id')
      .populate('proxy', 'name');

    res.json({ success: true, data: doc || null });
  },
);

/**
 * 创建服务消息配置
 */
export const createServiceMessage = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const body = req.body;

    if (!body.bot) {
      res.status(400);
      throw new Error('缺少 bot 参数');
    }
    if (!body.group) {
      res.status(400);
      throw new Error('缺少 group 参数');
    }

    const bot = await Bot.findById(body.bot);
    if (!bot) {
      res.status(404);
      throw new Error('机器人不存在');
    }

    const group = await Group.findById(body.group);
    if (!group || !bot.groups.some((g: any) => g.toString() === body.group)) {
      res.status(400);
      throw new Error('指定的群组不属于该机器人');
    }

    const existing = await ServiceMessage.findOne({
      bot: body.bot,
      group: body.group,
    });
    if (existing) {
      res.status(400);
      throw new Error('该群组已存在服务消息配置，请直接编辑');
    }

    const doc = await ServiceMessage.create({
      ...body,
      proxy: req.proxyUser._id,
    });
    const populated = await ServiceMessage.findById(doc._id)
      .populate('bot', 'botName userName')
      .populate('group', 'title username id')
      .populate('proxy', 'name');

    res.status(201).json({
      success: true,
      data: populated,
      message: '服务消息配置创建成功',
    });
  },
);

/**
 * 更新服务消息配置
 */
export const updateServiceMessage = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const doc = await ServiceMessage.findById(id);
    if (!doc) {
      res.status(404);
      throw new Error('服务消息配置不存在');
    }

    // 不允许修改 bot、group、proxy
    const updated = await ServiceMessage.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('bot', 'botName userName')
      .populate('group', 'title username id')
      .populate('proxy', 'name');

    // 清除缓存
    try {
      const cache = getCache();
      const cacheKey = `serviceMsg:${doc.bot}:${doc.group}`;
      await cache.del(cacheKey);
    } catch (err) {
      console.error('清除缓存失败:', err);
    }

    res.json({ success: true, data: updated, message: '服务消息配置更新成功' });
  },
);

/**
 * 删除服务消息配置
 */
export const deleteServiceMessage = handleAsync(
  async (req: Request, res: Response) => {
    const doc = await ServiceMessage.findById(req.params.id);
    if (!doc) {
      res.status(404);
      throw new Error('服务消息配置不存在');
    }

    await ServiceMessage.findByIdAndDelete(req.params.id);

    // 清除缓存
    try {
      const cache = getCache();
      const cacheKey = `serviceMsg:${doc.bot}:${doc.group}`;
      await cache.del(cacheKey);
    } catch (err) {
      console.error('清除缓存失败:', err);
    }

    res.json({ success: true, message: '服务消息配置删除成功' });
  },
);

/**
 * 批量删除服务消息配置
 */
export const deleteMultipleServiceMessages = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400);
      throw new Error('请提供要删除的配置 ID');
    }

    // 先查询所有要删除的配置，用于清除缓存
    const docs = await ServiceMessage.find({ _id: { $in: ids } });

    const result = await ServiceMessage.deleteMany({ _id: { $in: ids } });

    // 清除缓存
    try {
      const cache = getCache();
      for (const doc of docs) {
        const cacheKey = `serviceMsg:${doc.bot}:${doc.group}`;
        await cache.del(cacheKey);
      }
    } catch (err) {
      console.error('清除缓存失败:', err);
    }

    res.json({
      success: true,
      message: `成功删除 ${result.deletedCount} 条配置`,
    });
  },
);
