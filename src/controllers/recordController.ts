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
import * as _ from 'lodash';

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
    .populate('answers.answer', 'sn')
    .populate('user')
    .populate('topic')
    .sort('-createdAt') // 按创建时间降序排序
    .skip((+current - 1) * +pageSize) // 跳过前面的记录
    .limit(+pageSize) // 限制返回的记录数
    .exec();

  console.log(JSON.stringify(records, null, 2)); // 打印填充后的记录

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
    // 1. 获取基础参数
    const topicId = req.params.id;
    const { answers, issue } = req.body;
    const currentUser = await User.findById(req.user._id);

    // 2. 验证题目是否属于当前用户
    const topicInUser = currentUser.topics.find(
      (topic) => topic.topic.toString() === topicId,
    );
    if (!topicInUser) {
      res.status(400);
      throw new Error('topicId is not in your topics');
    }

    // 3. 获取题目详情
    const topic = await Topic.findById(topicId).populate('answers').populate({
      path: 'correctAnswers.answer',
      model: 'Answer',
    });
    if (!topic) {
      res.status(404);
      throw new Error('Topic not found');
    }

    // 4. 处理答案
    // FIXME: 这里的命名可能造成混淆，建议改为 submittedAnswers
    let answersToSave = [];
    if (issue === 'No Issue') {
      answersToSave = answers;
    }

    // 5. 创建记录
    const newRecord = await Record.create({
      user: currentUser._id,
      topic: topicId,
      answers: answersToSave,
      issue,
    });

    // 6. 判断答案正确性
    let status: 'pending' | 'doing' | 'success' | 'fail' = 'pending';

    // 格式化正确答案
    const normalizedCorrectAnswers = topic.correctAnswers.map(
      (correctAnswer) => ({
        answer: correctAnswer.answer._id,
        count: correctAnswer.count,
      }),
    );

    // 格式化提交的答案
    const normalizedSubmittedAnswers = answers.map((submittedAnswer: any) => ({
      answer: submittedAnswer._id,
      count: submittedAnswer.count,
    }));

    console.log('格式化后的正确答案：', normalizedCorrectAnswers);
    console.log('格式化后的提交答案：', normalizedSubmittedAnswers);

    // 使用 _.isEqual 进行深度比较
    const isAnswersEqual = _.isEqual(
      normalizedCorrectAnswers,
      normalizedSubmittedAnswers,
    );

    if (isAnswersEqual) {
      status = 'success';
    } else {
      status = 'fail';
    }

    console.log('比较结果：', status);

    newRecord.status = status;

    // 7. 更新用户的题目状态
    currentUser.topics = currentUser.topics.map((topic) => {
      if (topic.topic.toString() === topicId) {
        return { topic: topic.topic, status };
      }
      return topic;
    });

    // 8. 将下一个题目标记为 doing
    let nextTopic;
    let currentIndex = currentUser.topics.findIndex(
      (topic) => topic.topic.toString() === topicId,
    );

    console.log(
      '当前用户的所有题目状态：',
      currentUser.topics.map((t) => ({
        topicId: t.topic.toString(),
        status: t.status,
      })),
    );
    console.log('当前题目索引：', currentIndex);

    // 先从当前位置往后找
    for (let i = currentIndex + 1; i < currentUser.topics.length; i++) {
      if (
        !currentUser.topics[i].status ||
        currentUser.topics[i].status === 'pending'
      ) {
        nextTopic = currentUser.topics[i];
        // 将找到的下一题标记为 doing
        currentUser.topics[i].status = 'doing';
        break;
      }
    }

    // 如果没找到，从头开始找
    if (!nextTopic) {
      for (let i = 0; i < currentIndex; i++) {
        if (
          !currentUser.topics[i].status ||
          currentUser.topics[i].status === 'pending'
        ) {
          nextTopic = currentUser.topics[i];
          // 将找到的下一题标记为 doing
          currentUser.topics[i].status = 'doing';
          break;
        }
      }
    }

    // 9. 只有真的没有待做题目时才抛出错误
    if (!nextTopic) {
      const pendingCount = currentUser.topics.filter(
        (t) => !t.status || t.status === 'pending',
      ).length;

      if (pendingCount === 0) {
        res.status(400);
        throw new Error('所有题目都已经完成了');
      } else {
        res.status(500);
        throw new Error('查找下一题时出现异常');
      }
    }

    console.log('找到下一个题目：', {
      topicId: nextTopic.topic.toString(),
      status: nextTopic.status,
    });

    // 10. 更新当前用户的当前题目
    currentUser.currentTopic = nextTopic.topic;

    // 11. 保存所有更改
    await newRecord.save();
    await currentUser.save();

    // 12. 获取下一个题目的详细信息
    const currentTopic = await Topic.findById(currentUser.currentTopic)
      .populate('answers')
      .populate({
        path: 'correctAnswers.answer',
        model: 'Answer',
      });

    // 13. 返回结果
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

    if (!req.user.topics || req.user.topics?.length === 0) {
      const allTopics = await Topic.aggregate([
        { $sample: { size: await Topic.countDocuments().exec() } },
      ]);

      req.user.topics = allTopics.map((topic) => ({
        topic: topic._id,
        status: 'pending',
      }));

      // 设置第一个题目为 doing 状态
      if (req.user.topics.length > 0) {
        req.user.topics[0].status = 'doing';
      }

      req.user.currentTopic = req.user.topics[0].topic;

      await req.user.save();
    } else {
      // 确保当前题目状态为 doing
      const currentTopicIndex = req.user.topics.findIndex(
        (topic) => topic.topic.toString() === req.user.currentTopic.toString(),
      );
      if (currentTopicIndex !== -1) {
        req.user.topics[currentTopicIndex].status = 'doing';
        await req.user.save();
      }
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
        isHasTopics: currentUser.topics?.length > 0,
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
