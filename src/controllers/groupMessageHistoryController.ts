import { Response } from 'express';
import GroupMessageHistory from '../models/groupMessageHistory';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from '../types/user';

const buildQuery = async (queryParams: any): Promise<any> => {
  const query: any = {};

  if (queryParams.groupMessage || queryParams.lastSentMessage) {
    query.lastSentMessage =
      queryParams.groupMessage || queryParams.lastSentMessage;
  }

  if (queryParams.group) {
    query.group = queryParams.group;
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

export const getGroupMessageHistories = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = await buildQuery(req.query);

    const histories = await GroupMessageHistory.find(query)
      .populate({
        path: 'lastSentMessage',
        select: 'content medias menus bot',
        populate: {
          path: 'bot',
          select: 'botName userName',
        },
      })
      .populate('group', 'title id type')
      .sort('-sentAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await GroupMessageHistory.countDocuments(query).exec();

    res.json({
      success: true,
      data: histories,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

export const getGroupMessageHistoryById = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const history = await GroupMessageHistory.findById(req.params.id)
      .populate({
        path: 'lastSentMessage',
        populate: {
          path: 'bot',
          select: 'botName userName',
        },
      })
      .populate('group', 'title id type')
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

export const deleteGroupMessageHistory = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { id } = req.params;

    const history = await GroupMessageHistory.findByIdAndDelete(id).exec();

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

export const deleteMultipleGroupMessageHistories = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { ids } = req.body;

    await GroupMessageHistory.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `${ids.length} histories deleted successfully`,
    });
  },
);
