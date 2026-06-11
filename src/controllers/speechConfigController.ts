import { Response } from 'express';
import SpeechConfig from '../models/speechConfig';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from '../types/user';

/**
 * GET /api/speech-configs?botId=xxx
 * 获取指定 bot 的发言统计配置，不存在则返回默认值
 */
const getSpeechConfig = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { botId } = req.query;

    if (!botId) {
      res.status(400);
      throw new Error('botId 不能为空');
    }

    const config = await SpeechConfig.findOne({ bot: botId });

    res.json({
      success: true,
      data: config || null,
    });
  },
);

/**
 * PUT /api/speech-configs/:botId
 * 创建或更新指定 bot 的发言统计配置（upsert）
 */
const upsertSpeechConfig = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { botId } = req.params;

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

    const config = await SpeechConfig.findOneAndUpdate(
      { bot: botId },
      {
        $set: {
          bot: botId,
          proxy: req.user._id,
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
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    res.json({
      success: true,
      data: config,
    });
  },
);

export { getSpeechConfig, upsertSpeechConfig };
