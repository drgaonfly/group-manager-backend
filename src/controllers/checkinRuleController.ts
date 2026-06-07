import { Request, Response } from 'express';
import CheckinRule from '../models/checkInRule';
import CheckinHistory from '../models/checkinHistory';
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

  if (queryParams.groupId) {
    query.group = queryParams.groupId;
  }

  if (queryParams.type) {
    query.type = queryParams.type;
  }

  if (queryParams.isOnline !== undefined && queryParams.isOnline !== '') {
    query.isOnline = queryParams.isOnline === 'true';
  }

  // 代理用户只看自己的；管理员可跨代理查看
  if (isProxy(req.user) && !req.user.isAdmin) {
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
      .populate('group', 'id title username')
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
    .populate('proxy', 'name')
    .populate('group', 'id title username');

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
    const { bot, group } = req.body;

    // 检查是否已存在相同 bot + group 的规则（group 为空时检查默认规则）
    const query: any = { bot };
    if (group) {
      query.group = group;
    } else {
      query.group = { $in: [null, undefined] };
    }
    const existing = await CheckinRule.findOne(query);
    if (existing) {
      const label = group ? '该群组' : '该机器人（默认）';
      res.status(400);
      throw new Error(`${label}已有签到规则，请编辑现有规则`);
    }

    const checkinRule = new CheckinRule({
      ...req.body,
      proxy: req.user._id,
    });

    await checkinRule.save();

    const populated = await CheckinRule.findById(checkinRule._id)
      .populate('bot', 'botName userName')
      .populate('proxy', 'name')
      .populate('group', 'id title username');

    res.status(201).json({
      success: true,
      data: populated,
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
    .populate('proxy', 'name')
    .populate('group', 'id title username');

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

/**
 * 获取签到记录（按 botId 或 groupId 过滤）
 */
const getCheckinHistories = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const {
      current = '1',
      pageSize = '20',
      botId,
      groupId,
      botUserId,
    } = req.query;

    const query: any = {};

    if (isProxy(req.user) && !req.user.isAdmin) {
      query.proxy = req.user._id;
    }

    if (botId) query.bot = botId;
    if (groupId) query.group = groupId;
    if (botUserId) query.botUser = botUserId;

    const histories = await CheckinHistory.find(query)
      .populate('botUser', 'userName firstName lastName')
      .populate('group', 'id title username')
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await CheckinHistory.countDocuments(query).exec();

    res.json({
      success: true,
      data: histories,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

/**
 * 删除单条签到记录
 */
const deleteCheckinHistory = handleAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const history = await CheckinHistory.findByIdAndDelete(id);

    if (!history) {
      res.status(404);
      throw new Error('签到记录不存在');
    }

    res.json({
      success: true,
      message: '签到记录删除成功',
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
  getCheckinHistories,
  deleteCheckinHistory,
};
