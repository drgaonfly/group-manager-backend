import { Request, Response } from 'express';
import CheckinRule from '../models/checkInRule';
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

  if (queryParams.type) {
    query.type = queryParams.type;
  }

  if (queryParams.isOnline !== undefined && queryParams.isOnline !== '') {
    query.isOnline = queryParams.isOnline === 'true';
  }

  if (isProxy(req.user)) {
    query.proxy = req.user._id;
  }

  return query;
};

const getCheckinRules = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = await buildQuery(req.query, req);

    const checkinRules = await CheckinRule.find(query)
      .populate('bot', 'botName userName')
      .populate('proxy', 'name')
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await CheckinRule.countDocuments(query).exec();

    res.json({
      success: true,
      data: checkinRules,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

const getCheckinRuleById = handleAsync(async (req: Request, res: Response) => {
  const checkinRule = await CheckinRule.findById(req.params.id)
    .populate('bot', 'botName userName')
    .populate('proxy', 'name');

  if (!checkinRule) {
    res.status(404);
    throw new Error('签到规则不存在');
  }

  res.json({
    success: true,
    data: checkinRule,
  });
});

const addCheckinRule = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const checkinRule = new CheckinRule({
      ...req.body,
      proxy: req.user._id,
    });

    await checkinRule.save();

    res.status(201).json({
      success: true,
      data: checkinRule,
    });
  },
);

const updateCheckinRule = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const checkinRule = await CheckinRule.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  })
    .populate('bot', 'botName userName')
    .populate('proxy', 'name');

  if (!checkinRule) {
    res.status(404);
    throw new Error('签到规则不存在');
  }

  res.json({
    success: true,
    data: checkinRule,
  });
});

const deleteCheckinRule = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const checkinRule = await CheckinRule.findByIdAndDelete(id);

  if (!checkinRule) {
    res.status(404);
    throw new Error('签到规则不存在');
  }

  res.json({
    success: true,
    data: { message: '签到规则删除成功' },
  });
});

const deleteMultipleCheckinRules = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400);
      throw new Error('请提供要删除的签到规则 ID');
    }

    await CheckinRule.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `成功删除 ${ids.length} 个签到规则`,
    });
  },
);

export {
  getCheckinRules,
  getCheckinRuleById,
  addCheckinRule,
  updateCheckinRule,
  deleteCheckinRule,
  deleteMultipleCheckinRules,
};
