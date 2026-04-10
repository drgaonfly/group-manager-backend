import { Response } from 'express';
import ChannelPostHistory from '../models/channelPostHistory';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { isProxy } from '../middlewares/authMiddleware';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  // 代理用户只能查看自己的记录
  if (isProxy(req.user) && !req.user.isAdmin) {
    query.proxy = req.user._id;
  }

  if (queryParams.channelPost) {
    query.channelPost = queryParams.channelPost;
  }

  if (queryParams.bot) {
    query.bot = queryParams.bot;
  }

  if (queryParams.channel) {
    query.channel = queryParams.channel;
  }

  if (queryParams.status) {
    query.status = queryParams.status;
  }

  // 日期范围查询
  if (queryParams.startDate || queryParams.endDate) {
    query.sentAt = {};
    if (queryParams.startDate) {
      query.sentAt.$gte = new Date(queryParams.startDate);
    }
    if (queryParams.endDate) {
      query.sentAt.$lte = new Date(queryParams.endDate);
    }
  }

  return query;
};

export const getChannelPostHistories = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = await buildQuery(req.query, req);

    const histories = await ChannelPostHistory.find(query)
      .populate('channelPost')
      .populate('bot', 'botName userName')
      .populate('channel', 'title id')
      .sort('-sentAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await ChannelPostHistory.countDocuments(query).exec();

    res.json({
      success: true,
      data: histories,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

export const getChannelPostHistoryById = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const history = await ChannelPostHistory.findById(req.params.id)
      .populate('channelPost')
      .populate('bot', 'botName userName')
      .populate('channel', 'title id')
      .exec();

    if (!history) {
      res.status(404);
      throw new Error('History not found');
    }

    res.json({
      success: true,
      data: history,
    });
  },
);

export const deleteChannelPostHistory = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { id } = req.params;

    const history = await ChannelPostHistory.findByIdAndDelete(id).exec();

    if (!history) {
      res.status(404);
      throw new Error('History not found');
    }

    res.json({
      success: true,
      data: { message: 'History deleted successfully' },
    });
  },
);

export const deleteMultipleChannelPostHistories = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { ids } = req.body;

    await ChannelPostHistory.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `${ids.length} histories deleted successfully`,
    });
  },
);
