import { Request, Response } from 'express';
import Record from '../models/record';
import handleAsync from '../utils/handleAsync';
import Topic from '../models/topic';
import { RequestCustom } from '../types/user';
import { exclude } from '../utils/handleData';
import User from '../models/user';
import {
  transformDocumentImage,
  transformDocumentImages,
} from '../utils/transformUtils';

//获取记录管理列表
export const getRecords = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10', user, topic } = req.query;

  const queryConditions: any = {};
  if (user) {
    queryConditions.user = user;
  }
  if (topic) {
    queryConditions.topic = topic;
  }

  // 查询记录
  const records = await Record.find(queryConditions)
    .populate('user')
    .populate('topic')
    .sort('-createdAt') // 按创建时间降序排序
    .skip((+current - 1) * +pageSize) // 跳过前面的记录
    .limit(+pageSize) // 限制返回的记录数
    .exec();

  const total = await Record.countDocuments(queryConditions); // 计算总记录数

  res.json({
    success: true,
    data: records,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 提交新手训练记录
export const submitNewbieTraining = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const topicId = req.params.id; // 从路由参数中获取 topicId
    const { answers, issue } = req.body; // 提交的内容包含 answers
    const currentUser = await User.findById(req.user._id);

    const topicInUser = currentUser.topics.find(
      (topic) => topic.topic.toString() === topicId,
    );

    if (!topicInUser) {
      res.status(400);
      throw new Error('topicId is not in your topics');
    }

    const topic = await Topic.findById(topicId).populate('answers').populate({
      path: 'correctAnswers.answer',
      model: 'Answer',
    });

    if (!topic) {
      res.status(404);
      throw new Error('Topic not found');
    }

    // 如果 issue 是无异常才是要 answers
    let answersToSave = [];

    if (issue === 'No Issue') {
      answersToSave = answers;
    }

    // 创建新的记录
    const newRecord = await Record.create({
      user: currentUser._id,
      topic: topicId,
      answers: answersToSave,
      issue,
    });

    let status: 'pending' | 'success' | 'fail' = 'pending';

    if (topic.correctAnswers === answers) {
      status = 'success';
    } else {
      status = 'fail';
    }

    newRecord.status = status;

    currentUser.topics = currentUser.topics.map((topic) => {
      if (topic.topic.toString() === topicId) {
        return {
          topic: topic.topic,
          status: status,
        };
      }
      return topic;
    });

    let nextTopic;
    let currentIndex = currentUser.topics.findIndex(
      (topic) => topic.topic.toString() === topicId,
    );

    do {
      currentIndex = currentIndex + 1;
      if (currentIndex >= currentUser.topics.length) {
        break;
      }
      nextTopic = currentUser.topics[currentIndex];
    } while (nextTopic?.status === 'pending');

    if (!nextTopic) {
      res.status(400);
      throw new Error('所有题目都已经完成了');
    }

    console.log('下一个对象：', nextTopic);
    currentUser.currentTopic = nextTopic.topic;

    await newRecord.save();

    await currentUser.save();

    const currentTopic = await Topic.findById(currentUser.currentTopic)
      .populate('answers')
      .populate({
        path: 'correctAnswers.answer',
        model: 'Answer',
      });

    res.json({
      success: true,
      data: {
        record: newRecord,
        currentTopic,
        user: exclude(currentUser.toObject(), 'password'),
      },
    });
  },
);

// 获取题目数据
export const getNewbieTraining = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { emptyRecordFlag } = req.query;

    if (emptyRecordFlag === 'true') {
      req.user.topics = [];
      req.user.currentTopic = null;
      await req.user.save();
    }

    if (true) {
      const allTopics = await Topic.aggregate([
        { $sample: { size: await Topic.countDocuments().exec() } },
      ]);

      req.user.topics = allTopics.map((topic) => ({
        topic: topic._id,
        status: 'pending',
      }));

      req.user.currentTopic = req.user.topics[0].topic;

      await req.user.save();
    }

    const currentUser = await User.findById(req.user._id)
      .populate({ path: 'currentTopic', model: 'Topic' })
      .populate({
        path: 'topics',
        populate: { path: 'topic', model: 'Topic' },
      });

    const currentTopic = await Topic.findById(currentUser.currentTopic)
      .populate('answers')
      .populate({
        path: 'correctAnswers.answer',
        model: 'Answer',
      });

    const processedCurrentTopic = await transformDocumentImage(currentTopic, [
      'video1',
      'video2',
    ]);

    const processedAnswers = await transformDocumentImages(
      currentTopic.answers,
      ['image'],
    );

    res.json({
      success: true,
      data: {
        currentUser: { ...exclude(currentUser.toObject(), 'password') },
        currentTopic: processedCurrentTopic,
        answers: processedAnswers,
        topics: currentUser.topics,
        isHasTopics: req.user.topics?.length > 0,
      },
    });
  },
);

export const addRecord = handleAsync(async (req: Request, res: Response) => {
  const savedRecord = await Record.create(req.body);
  res.json({
    success: true,
    data: savedRecord,
  });
});

export const getRecordById = handleAsync(
  async (req: Request, res: Response) => {
    const record = await Record.findById(req.params.id).populate('user topic');
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

export const updateRecord = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedRecord = await Record.findByIdAndUpdate(id, req.body, {
    new: true,
  });
  if (!updatedRecord) {
    res.status(404);
    throw new Error('Record not found');
  }
  res.json({
    success: true,
    data: updatedRecord,
  });
});

export const deleteRecord = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const record = await Record.findByIdAndDelete(id);
  if (!record) {
    res.status(404);
    throw new Error('Record not found');
  }
  res.json({
    success: true,
    data: { message: 'Record deleted successfully' },
  });
});

export const deleteMultipleRecords = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400);
      throw new Error('Invalid request: No IDs provided');
    }

    const result = await Record.deleteMany({ _id: { $in: ids } });
    res.json({
      success: true,
      message: `${result.deletedCount} records deleted successfully`,
      data: { deletedCount: result.deletedCount },
    });
  },
);
