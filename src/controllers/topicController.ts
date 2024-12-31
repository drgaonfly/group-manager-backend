import { Request, Response } from 'express';
import Topic from '../models/topic';
import handleAsync from '../utils/handleAsync';
import {
  transformDocumentImages,
  transformDocumentImage,
} from '../utils/transformUtils';

const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.video1) {
    query.video1 = { $regex: queryParams.video1, $options: 'i' };
  }

  if (queryParams.video2) {
    query.video2 = { $regex: queryParams.video2, $options: 'i' };
  }

  if (queryParams.issue) {
    query.issue = { $regex: queryParams.issue, $options: 'i' };
  }

  return query;
};

// 获取所有topic
const getTopics = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  // 执行查询并使用 populate 填充 answers 数据
  const topics = await Topic.find(query)
    .populate('answers')
    .populate('correctAnswers.answer')
    .sort('-createdAt') // 按创建时间倒序排序
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  // 处理视频路径
  const processedTopics = await transformDocumentImages(topics, [
    'video1',
    'video2',
  ]);

  const total = await Topic.countDocuments(query).exec();

  res.json({
    success: true,
    data: processedTopics,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 添加topic
const addTopic = handleAsync(async (req: Request, res: Response) => {
  const uniqueNum = await generateUniqueNumber(); // 直接调用 generateUniqueNumber
  const newTopic = new Topic({
    ...req.body,
    topicNumber: uniqueNum, // 在新建时设置 topicNumber 字段
  });

  const savedTopic = await newTopic.save();

  // 处理视频路径
  const processedTopic = await transformDocumentImage(savedTopic, [
    'video1',
    'video2',
  ]);

  res.json({
    success: true,
    data: processedTopic,
  });
});

// 根据ID获取topic
const getTopicById = handleAsync(async (req: Request, res: Response) => {
  const topic = await Topic.findById(req.params.id).populate('answers');

  if (!topic) {
    res.status(404);
    throw new Error('Topic not found');
  } else {
    res.json({
      success: true,
      data: topic,
    });
  }
});

// 更新客户
const updateTopic = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { video1, video2, ...otherFields } = req.body;

  const topic = await Topic.findById(id);
  if (!topic) {
    res.status(404);
    throw new Error('Topic not found');
  }

  // 更新字段
  const updates = {
    ...(video1 && !video1.startsWith('http') && { video1 }),
    ...(video2 && !video2.startsWith('http') && { video2 }),
    ...otherFields,
  };

  const updatedTopic = await Topic.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  // 处理视频路径
  const processedTopic = await transformDocumentImage(updatedTopic, [
    'video1',
    'video2',
  ]);

  res.json({
    success: true,
    data: processedTopic,
  });
});

// 删除topic
const deleteTopic = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 删除topic
  const topic = await Topic.findByIdAndDelete(id);

  if (!topic) {
    res.status(404);
    throw new Error('Topic not found');
  }

  res.json({
    success: true,
    data: { message: 'Topic deleted successfully' },
  });
});

// 批量删除topic
const deleteMultipleTopics = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    // 使用 Mongoose 的 deleteMany 方法进行批量删除
    await Topic.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} topics deleted successfully`,
    });
  },
);

// 新增生成唯一数字的编号
const generateUniqueNumber = async (): Promise<string> => {
  const now = new Date();
  const prefix = `${now.getFullYear()}${(now.getMonth() + 1)
    .toString()
    .padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  let uniqueNumber;
  do {
    uniqueNumber = Math.floor(Math.random() * Math.pow(10, 5)) // 假设长度为5
      .toString()
      .padStart(5, '0'); // 生成指定长度的随机数字
  } while (await Topic.findOne({ topicNumber: `${prefix}${uniqueNumber}` })); // 确保唯一性
  return `${prefix}${uniqueNumber}`; // 返回带前缀的唯一数字
};

export {
  getTopics,
  addTopic,
  getTopicById,
  updateTopic,
  deleteTopic,
  deleteMultipleTopics,
};
