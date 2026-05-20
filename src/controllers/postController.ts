import { Request, Response } from 'express';
import Post from '../models/post';
import Bot from '../models/bot';
import handleAsync from '../utils/handleAsync';

const buildQuery = async (queryParams: any): Promise<any> => {
  const query: any = {};

  if (queryParams.botId) {
    query.bot = queryParams.botId;
  } else if (queryParams.bot) {
    const bots = await Bot.find({
      botName: { $regex: queryParams.bot, $options: 'i' },
    });
    query.bot = bots.length > 0 ? { $in: bots.map((b) => b._id) } : null;
  }

  if (queryParams.proxy) {
    query.proxy = queryParams.proxy;
  }

  if (queryParams.source) {
    query.source = queryParams.source;
  }

  if (queryParams.title) {
    query.title = { $regex: queryParams.title, $options: 'i' };
  }

  return query;
};

export const getPosts = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '20' } = req.query;

  const query = await buildQuery(req.query);

  const data = await Post.find(query)
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .populate('bot', 'botName userName')
    .populate('source', 'title username id')
    .populate('proxy', 'name email')
    .lean()
    .exec();

  const total = await Post.countDocuments(query).exec();

  res.json({
    success: true,
    data,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

export const getPostById = handleAsync(async (req: Request, res: Response) => {
  const record = await Post.findById(req.params.id)
    .populate('bot', 'botName userName')
    .populate('source', 'title username id')
    .populate('proxy', 'name email')
    .lean();

  if (!record) {
    res.status(404);
    throw new Error('帖子记录未找到');
  }

  res.json({ success: true, data: record });
});

export const deletePost = handleAsync(async (req: Request, res: Response) => {
  const record = await Post.findByIdAndDelete(req.params.id);

  if (!record) {
    res.status(404);
    throw new Error('帖子记录未找到');
  }

  res.json({ success: true, message: '帖子记录已删除' });
});

export const deleteMultiplePosts = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;
    await Post.deleteMany({ _id: { $in: ids } });

    res.json({ success: true, message: '帖子记录批量删除成功' });
  },
);
