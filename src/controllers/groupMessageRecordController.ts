import { Response } from 'express';
import GroupMessageRecord from '../models/groupMessageRecord';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { isProxy } from '../middlewares/authMiddleware';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  // 代理用户只能查看自己的记录
  if (isProxy(req.user)) {
    query.proxy = req.user._id;
  }

  if (queryParams.groupMessage) {
    query.groupMessage = queryParams.groupMessage;
  }

  if (queryParams.bot) {
    query.bot = queryParams.bot;
  }

  if (queryParams.group) {
    query.group = queryParams.group;
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

export const getGroupMessageRecords = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = await buildQuery(req.query, req);

    const records = await GroupMessageRecord.find(query)
      .populate('groupMessage')
      .populate('bot', 'botName userName')
      .populate('group', 'title id')
      .sort('-sentAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await GroupMessageRecord.countDocuments(query).exec();

    res.json({
      success: true,
      data: records,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

export const getGroupMessageRecordById = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const record = await GroupMessageRecord.findById(req.params.id)
      .populate('groupMessage')
      .populate('bot', 'botName userName')
      .populate('group', 'title id')
      .exec();

    if (!record) {
      res.status(404);
      throw new Error('Record not found');
    }

    res.json({
      success: true,
      data: record,
    });
  },
);

export const deleteGroupMessageRecord = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { id } = req.params;

    const record = await GroupMessageRecord.findByIdAndDelete(id).exec();

    if (!record) {
      res.status(404);
      throw new Error('Record not found');
    }

    res.json({
      success: true,
      data: { message: 'Record deleted successfully' },
    });
  },
);

export const deleteMultipleGroupMessageRecords = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { ids } = req.body;

    await GroupMessageRecord.deleteMany({
      _id: { $in: ids },
    }).exec();

    res.json({
      success: true,
      message: `${ids.length} records deleted successfully`,
    });
  },
);
