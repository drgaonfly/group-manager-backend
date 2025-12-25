import { Request, Response } from 'express';
import ChannelPost from '../models/channelPost';
import User from '../models/user';
import Bot from '../models/bot';
import Group from '../models/group';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { isProxy } from '../middlewares/authMiddleware';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  if (queryParams.title) {
    query.title = { $regex: queryParams.title, $options: 'i' };
  }

  if (queryParams.url) {
    query.url = { $regex: queryParams.url, $options: 'i' };
  }

  if (queryParams.proxy) {
    let searchText: string;
    try {
      const userParam = JSON.parse(String(queryParams.proxy));
      searchText = userParam.name;
    } catch (e) {
      searchText = String(queryParams.proxy).trim();
    }
    const userData = await User.find({
      name: {
        $regex: searchText,
        $options: 'i',
      },
    });

    if (userData && userData.length > 0) {
      query.proxy = { $in: userData.map((user) => user._id) };
    } else {
      query.proxy = null;
    }
  }

  if (queryParams.bot) {
    let searchText: string;
    try {
      const botParam = JSON.parse(String(queryParams.bot));
      searchText = botParam.botName;
    } catch (e) {
      searchText = String(queryParams.bot).trim();
    }
    const botData = await Bot.find({
      botName: {
        $regex: searchText,
        $options: 'i',
      },
    });

    if (botData && botData.length > 0) {
      query.bot = { $in: botData.map((bot) => bot._id) };
    } else {
      query.bot = null;
    }
  }

  if (isProxy(req.user)) {
    query.proxy = req.user._id;
  }

  return query;
};

export const getChannelPosts = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = await buildQuery(req.query, req);

    const channelPosts = await ChannelPost.find(query)
      .populate('proxy')
      .populate({
        path: 'bot',
        populate: { path: 'groups' },
      })
      .populate('channel')
      .populate('channels')
      .sort('weight createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .lean()
      .exec();

    const total = await ChannelPost.countDocuments(query).exec();

    res.json({
      success: true,
      data: channelPosts,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

export const getChannelPostById = handleAsync(
  async (req: Request, res: Response) => {
    const channelPost = await ChannelPost.findOne({
      _id: req.params.id,
    }).lean();

    if (!channelPost) {
      res.status(404);
      throw new Error('频道推广未找到');
    }

    res.json({
      success: true,
      data: channelPost,
    });
  },
);

export const addChannelPost = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { bot: botId, ...channelPostData } = req.body;

    // 验证机器人是否存在且属于当前用户
    const bot = await Bot.findOne({
      _id: botId,
      user: req.user._id,
    });

    if (!bot) {
      res.status(400);
      throw new Error('机器人不存在或无权限');
    }

    const channelPost = new ChannelPost({
      ...channelPostData,
      proxy: req.user._id,
      bot: botId,
    });

    const savedChannelPost = await channelPost.save();

    res.status(201).json({
      success: true,
      data: savedChannelPost,
    });
  },
);

export const updateChannelPost = handleAsync(
  async (req: Request, res: Response) => {
    const channelPost = await ChannelPost.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      },
    );

    if (!channelPost) {
      res.status(404);
      throw new Error('频道推广未找到');
    }

    res.json({
      success: true,
      data: channelPost,
    });
  },
);

export const deleteChannelPost = handleAsync(
  async (req: Request, res: Response) => {
    const channelPost = await ChannelPost.deleteOne({
      _id: req.params.id,
    });

    if (!channelPost) {
      res.status(404);
      throw new Error('频道推广未找到');
    }

    res.json({
      success: true,
      message: '频道推广已删除',
    });
  },
);

export const deleteMultipleChannelPosts = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;
    await ChannelPost.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: '频道推广批量删除成功',
    });
  },
);

export const getUserBots = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const bots = await Bot.find({
      user: req.user._id,
      isOnline: true,
    })
      .select('_id botName')
      .lean()
      .exec();

    res.json({
      success: true,
      data: bots,
    });
  },
);

// 获取用户的频道列表（type 为 channel 的 group）
export const getUserChannels = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { botId } = req.query;

    const query: any = {
      type: 'channel',
    };

    // 如果指定了 botId，则只查询该机器人的频道
    if (botId) {
      query.bot = botId;
    } else {
      // 否则查询用户所有机器人的频道
      const userBots = await Bot.find({ user: req.user._id }).select('_id');
      query.bot = { $in: userBots.map((bot) => bot._id) };
    }

    const channels = await Group.find(query)
      .select('_id id title bot')
      .populate('bot', 'botName')
      .lean()
      .exec();

    res.json({
      success: true,
      data: channels,
    });
  },
);
