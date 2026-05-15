import { Request, Response } from 'express';
import Badge from '../models/badge';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { isProxy } from '../middlewares/authMiddleware';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  if (queryParams.botId) {
    query.bot = queryParams.botId;
  }

  // 代理用户只看自己的；管理员可跨代理查看
  if (isProxy(req.user) && !req.user.isAdmin) {
    query.proxy = req.user._id;
  }

  return query;
};

/**
 * 获取称号列表（按 threshold 升序，方便前端展示等级梯度）
 */
const getBadges = handleAsync(async (req: RequestCustom, res: Response) => {
  const { current = '1', pageSize = '50' } = req.query;

  const query = await buildQuery(req.query, req);

  const badges = await Badge.find(query)
    .populate('bot', 'botName userName')
    .populate('proxy', 'name')
    .sort({ threshold: 1 })
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Badge.countDocuments(query).exec();

  res.json({
    success: true,
    data: badges,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

const getBadgeById = handleAsync(async (req: Request, res: Response) => {
  const badge = await Badge.findById(req.params.id)
    .populate('bot', 'botName userName')
    .populate('proxy', 'name');

  if (!badge) {
    res.status(404);
    throw new Error('称号不存在');
  }

  res.json({ success: true, data: badge });
});

const addBadge = handleAsync(async (req: RequestCustom, res: Response) => {
  const badge = new Badge({
    ...req.body,
    proxy: req.user._id,
    order: req.body.threshold ?? 0,
  });

  await badge.save();

  res.status(201).json({ success: true, data: badge });
});

const updateBadge = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 如果更新了 threshold，同步更新 order
  const updateData = { ...req.body };
  if (updateData.threshold !== undefined) {
    updateData.order = updateData.threshold;
  }

  const badge = await Badge.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  })
    .populate('bot', 'botName userName')
    .populate('proxy', 'name');

  if (!badge) {
    res.status(404);
    throw new Error('称号不存在');
  }

  res.json({ success: true, data: badge });
});

const deleteBadge = handleAsync(async (req: Request, res: Response) => {
  const badge = await Badge.findByIdAndDelete(req.params.id);

  if (!badge) {
    res.status(404);
    throw new Error('称号不存在');
  }

  res.json({ success: true, data: { message: '称号删除成功' } });
});

const deleteMultipleBadges = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400);
      throw new Error('请提供要删除的称号 ID');
    }

    await Badge.deleteMany({ _id: { $in: ids } });

    res.json({ success: true, message: `成功删除 ${ids.length} 个称号` });
  },
);

export {
  getBadges,
  getBadgeById,
  addBadge,
  updateBadge,
  deleteBadge,
  deleteMultipleBadges,
};
