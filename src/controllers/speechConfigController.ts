import { Response } from 'express';
import SpeechConfig from '../models/speechConfig';
import Bot from '../models/bot';
import Group from '../models/group';
import handleAsync from '../utils/handleAsync';
import { findBotProxy } from '../bot/services/findBotProxy';
import { RequestCustom } from '../types/user';

/**
 * GET /api/speech-configs?botId=xxx
 * 获取指定 bot 下所有群组的发言统计配置列表
 */
const getSpeechConfigs = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { botId, groupId, current = 1, pageSize = 50 } = req.query;

    if (!botId) {
      res.status(400);
      throw new Error('botId 不能为空');
    }

    const filter: any = { bot: botId };
    if (groupId) {
      filter.group = groupId;
    }

    const total = await SpeechConfig.countDocuments(filter);
    const data = await SpeechConfig.find(filter)
      .populate('group', 'title username id')
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
 * GET /api/speech-configs/:id
 * 获取单条配置详情
 */
const getSpeechConfig = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const config = await SpeechConfig.findById(req.params.id).populate(
      'group',
      'title username id',
    );

    if (!config) {
      res.status(404);
      throw new Error('配置不存在');
    }

    res.json({ success: true, data: config });
  },
);

/**
 * POST /api/speech-configs
 * 为指定 bot+group 创建一条配置
 */
const createSpeechConfig = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const {
      botId,
      groupId,
      minSpeechLength,
      allowPureNumberSpeech,
      enableActivityReward,
      activityRewardCycle,
      activityRewardTopN,
      activityRewardPoints,
      enableSpeechReward,
      speechRewardCycle,
      speechRewardPoints,
      speechRewardMaxTimes,
    } = req.body;

    if (!botId || !groupId) {
      res.status(400);
      throw new Error('botId 和 groupId 不能为空');
    }

    // 验证群组属于该 bot
    const bot = await Bot.findById(botId);
    if (!bot) {
      res.status(404);
      throw new Error('机器人不存在');
    }

    const group = await Group.findById(groupId);
    if (
      !group ||
      !(bot.groups as any[]).some((g) => g.toString() === groupId)
    ) {
      res.status(400);
      throw new Error('指定的群组不属于该机器人');
    }

    // 检查是否已存在
    const existing = await SpeechConfig.findOne({ bot: botId, group: groupId });
    if (existing) {
      res.status(400);
      throw new Error(`该群组「${group.title}」已有发言统计配置，请直接编辑`);
    }

    const { proxyUser } = await findBotProxy(bot);

    const config = await SpeechConfig.create({
      bot: botId,
      group: groupId,
      proxy: proxyUser._id,
      ...(minSpeechLength !== undefined && { minSpeechLength }),
      ...(allowPureNumberSpeech !== undefined && { allowPureNumberSpeech }),
      ...(enableActivityReward !== undefined && { enableActivityReward }),
      ...(activityRewardCycle !== undefined && { activityRewardCycle }),
      ...(activityRewardTopN !== undefined && { activityRewardTopN }),
      ...(activityRewardPoints !== undefined && { activityRewardPoints }),
      ...(enableSpeechReward !== undefined && { enableSpeechReward }),
      ...(speechRewardCycle !== undefined && { speechRewardCycle }),
      ...(speechRewardPoints !== undefined && { speechRewardPoints }),
      ...(speechRewardMaxTimes !== undefined && { speechRewardMaxTimes }),
    });

    const populated = await SpeechConfig.findById(config._id).populate(
      'group',
      'title username id',
    );

    res.status(201).json({ success: true, data: populated });
  },
);

/**
 * PUT /api/speech-configs/:id
 * 更新一条配置
 */
const updateSpeechConfig = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const {
      minSpeechLength,
      allowPureNumberSpeech,
      enableActivityReward,
      activityRewardCycle,
      activityRewardTopN,
      activityRewardPoints,
      enableSpeechReward,
      speechRewardCycle,
      speechRewardPoints,
      speechRewardMaxTimes,
    } = req.body;

    const config = await SpeechConfig.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...(minSpeechLength !== undefined && { minSpeechLength }),
          ...(allowPureNumberSpeech !== undefined && { allowPureNumberSpeech }),
          ...(enableActivityReward !== undefined && { enableActivityReward }),
          ...(activityRewardCycle !== undefined && { activityRewardCycle }),
          ...(activityRewardTopN !== undefined && { activityRewardTopN }),
          ...(activityRewardPoints !== undefined && { activityRewardPoints }),
          ...(enableSpeechReward !== undefined && { enableSpeechReward }),
          ...(speechRewardCycle !== undefined && { speechRewardCycle }),
          ...(speechRewardPoints !== undefined && { speechRewardPoints }),
          ...(speechRewardMaxTimes !== undefined && { speechRewardMaxTimes }),
        },
      },
      { new: true, runValidators: true },
    ).populate('group', 'title username id');

    if (!config) {
      res.status(404);
      throw new Error('配置不存在');
    }

    res.json({ success: true, data: config });
  },
);

/**
 * DELETE /api/speech-configs/:id
 * 删除一条配置
 */
const deleteSpeechConfig = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const config = await SpeechConfig.findByIdAndDelete(req.params.id);

    if (!config) {
      res.status(404);
      throw new Error('配置不存在');
    }

    res.json({ success: true, message: '删除成功' });
  },
);

export {
  getSpeechConfigs,
  getSpeechConfig,
  createSpeechConfig,
  updateSpeechConfig,
  deleteSpeechConfig,
};
