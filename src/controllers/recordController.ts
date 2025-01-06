import { Request, Response } from 'express';
import Record from '../models/record';
import handleAsync from '../utils/handleAsync';
import Topic, { ITopic } from '../models/topic';
import { RequestCustom } from '../types/user';
import { exclude } from '../utils/handleData';
import User from '../models/user';
import { isProxy, isEmployee } from '../middlewares/authMiddleware';
import {
  transformDocumentImage,
  transformDocumentImages,
} from '../utils/transformUtils';
import * as _ from 'lodash';

const buildQuery = async (
  queryParams: any,
  req: RequestCustom,
): Promise<any> => {
  const query: any = {};

  if (queryParams.status) {
    query.status = queryParams.status; // 直接将 status 参数添加到查询中
  }

  if (queryParams.issue) {
    query.issue = queryParams.issue; // 直接将 status 参数添加到查询中
  }

  if (isProxy(req.user)) {
    const employees = await User.find({ proxy: req.user._id });
    const employeeIds = employees.map((employee) => employee._id);
    query.user = { $in: [...employeeIds, req.user._id] };
  }

  if (isEmployee(req.user)) {
    query.user = req.user._id;
  }

  return query;
};

//获取记录管理列表
export const getRecords = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { current = '1', pageSize = '10' } = req.query;

    const query = await buildQuery(req.query, req);

    // 查询记录
    const records = await Record.find(query)
      .populate('user')
      .populate('topic') // 确保填充 topic
      .sort('-createdAt')
      .skip((+current - 1) * +pageSize)
      .limit(+pageSize)
      .exec();

    const total = await Record.countDocuments(query);

    // 处理记录数据，将 topic 中的视频信息添加到记录中
    const processedRecords = await Promise.all(
      records.map(async (record) => {
        const recordObj = record.toObject();
        if (recordObj.topic) {
          const transformedRecord = {
            ...recordObj,
            video1: (recordObj.topic as ITopic).video1,
            video2: (recordObj.topic as ITopic).video2,
          };
          // 转换图片 URL
          return await transformDocumentImage(transformedRecord, [
            'video1',
            'video2',
          ]);
        }
        return recordObj;
      }),
    );

    res.json({
      success: true,
      data: processedRecords,
      total,
      current: +current,
      pageSize: +pageSize,
    });
  },
);

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

    // 5. 创建记录
    const newRecord = await Record.create({
      user: currentUser.id,
      topic: topicId,
      answers: answers, // 使用转换后的 _id
      issue,
    });

    // 6. 判断答案正确性
    let status: 'pending' | 'doing' | 'success' | 'fail' = 'pending';

    if (issue === 'No Issue') {
      // 格式化正确答案
      const normalizedCorrectAnswers = topic.correctAnswers.map(
        (correctAnswer) => ({
          answer: correctAnswer.answer.id,
          count: correctAnswer.count,
        }),
      );

      // 格式化提交的答案
      const normalizedSubmittedAnswers = answers.map(
        (submittedAnswer: any) => ({
          answer: submittedAnswer.id,
          count: submittedAnswer.count,
        }),
      );

      const isAnswersEqual = _.isEqual(
        _.sortBy(normalizedCorrectAnswers, 'answer'),
        _.sortBy(normalizedSubmittedAnswers, 'answer'),
      );

      status = isAnswersEqual ? 'success' : 'fail';
    } else {
      status = 'fail';
    }

    newRecord.status = status;

    // 7. 更新用户的题目状态
    currentUser.topics = currentUser.topics.map((topic) => {
      if (topic.topic.toString() === topicId) {
        return { topic: topic.topic, status };
      }
      return topic;
    });

    // 8. 查找下一个待做的题目
    const nextPendingTopic = currentUser.topics.find(
      (topic) => !topic.status || topic.status === 'pending',
    );

    if (nextPendingTopic) {
      currentUser.topics = currentUser.topics.map((topic) => {
        if (topic.topic.toString() === nextPendingTopic.topic.toString()) {
          return { topic: topic.topic, status: 'doing' as const };
        }
        return topic;
      });

      // 更新当前题目
      currentUser.currentTopic = nextPendingTopic.topic;

      console.log('找到下一个题目：', {
        topicId: nextPendingTopic.topic.toString(),
        status: nextPendingTopic.status,
      });
    } else {
      // 如果没有下一题，清空当前题目
      currentUser.currentTopic = null;
    }

    // 10. 保存所有更改
    await newRecord.save();
    await currentUser.save();

    // 11. 获取下一个题目的详细信息（如果有的话）
    const currentTopic = nextPendingTopic
      ? await Topic.findById(currentUser.currentTopic)
          .populate('answers')
          .populate({
            path: 'correctAnswers.answer',
            model: 'Answer',
          })
      : null;

    // 12. 返回结果
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
        req.user.currentTopic = req.user.topics[0].topic;
      }

      await req.user.save();
    } else if (req.user.currentTopic) {
      // 添加 null 检查
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

    // 只在有 currentTopic 时获取题目详情
    const currentTopic = currentUser.currentTopic
      ? await Topic.findById(currentUser.currentTopic)
          .populate('answers')
          .populate({
            path: 'correctAnswers.answer',
            model: 'Answer',
          })
      : null;

    const processedCurrentTopic = currentTopic
      ? await transformDocumentImage(currentTopic, ['video1', 'video2'])
      : null;

    const processedAnswers = currentTopic
      ? await transformDocumentImages(currentTopic.answers, ['image'])
      : [];

    // 计算是否所有题目都已完成
    const isAllCompleted = !currentUser.topics.some(
      (topic) => !topic.status || topic.status === 'pending',
    );

    console.log('isAllCompleted', isAllCompleted);

    res.json({
      success: true,
      data: {
        currentUser: { ...exclude(currentUser.toObject(), 'password') },
        currentTopic: processedCurrentTopic,
        answers: processedAnswers,
        topics: currentUser.topics,
        isAllCompleted,
        isHasTopics: currentUser.topics?.length > 0,
      },
    });
  },
);

// 提交新手训练记录
export const submitExam = handleAsync(
  async (req: RequestCustom, res: Response) => {
    // 1. 获取基础参数
    const topicId = req.params.id;
    const { answers, issue } = req.body;
    const currentUser = await User.findById(req.user._id);

    // 2. 验证题目是否属于当前用户
    const topicInUser = currentUser.examTopics.find(
      (topic) => topic.topic.toString() === topicId,
    );
    if (!topicInUser) {
      res.status(400);
      throw new Error('topicId is not in your examTopics');
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

    // 5. 创建记录
    const newRecord = await Record.create({
      user: currentUser.id,
      topic: topicId,
      answers: answers,
      issue,
    });

    // 6. 判断答案正确性
    let status: 'pending' | 'doing' | 'success' | 'fail' = 'pending';

    if (issue === 'No Issue') {
      // 格式化正确答案
      const normalizedCorrectAnswers = topic.correctAnswers.map(
        (correctAnswer) => ({
          answer: correctAnswer.answer.id,
          count: correctAnswer.count,
        }),
      );

      // 格式化提交的答案
      const normalizedSubmittedAnswers = answers.map(
        (submittedAnswer: any) => ({
          answer: submittedAnswer.id,
          count: submittedAnswer.count,
        }),
      );

      const isAnswersEqual = _.isEqual(
        _.sortBy(normalizedCorrectAnswers, 'answer'),
        _.sortBy(normalizedSubmittedAnswers, 'answer'),
      );

      status = isAnswersEqual ? 'success' : 'fail';
    } else {
      status = 'fail';
    }

    newRecord.status = status;

    // 7. 更新用户的题目状态
    currentUser.examTopics = currentUser.examTopics.map((topic) => {
      if (topic.topic.toString() === topicId) {
        return { topic: topic.topic, status };
      }
      return topic;
    });

    // 8. 查找下一个待做的题目
    const nextPendingTopic = currentUser.examTopics.find(
      (topic) => !topic.status || topic.status === 'pending',
    );

    if (nextPendingTopic) {
      currentUser.examTopics = currentUser.examTopics.map((topic) => {
        if (topic.topic.toString() === nextPendingTopic.topic.toString()) {
          return { topic: topic.topic, status: 'doing' as const };
        }
        return topic;
      });

      // 更新当前题目
      currentUser.currentExamTopic = nextPendingTopic.topic;

      console.log('找到下一个题目：', {
        topicId: nextPendingTopic.topic.toString(),
        status: nextPendingTopic.status,
      });
    } else {
      // 如果没有下一题，清空当前题目
      currentUser.currentExamTopic = null;
    }

    // 10. 保存所有更改
    await newRecord.save();
    await currentUser.save();

    // 11. 获取下一个题目的详细信息（如果有的话）
    const currentExamTopic = nextPendingTopic
      ? await Topic.findById(currentUser.currentExamTopic)
          .populate('answers')
          .populate({
            path: 'correctAnswers.answer',
            model: 'Answer',
          })
      : null;

    // 12. 返回结果
    res.json({
      success: true,
      data: {
        record: newRecord,
        currentExamTopic,
        user: exclude(currentUser.toObject(), 'password'),
      },
    });
  },
);

// 获取题目数据
export const getExam = handleAsync(
  async (req: RequestCustom, res: Response) => {
    const { emptyRecordFlag } = req.query;

    if (!req.user.isOnline) {
      res.json({
        success: true,
        data: {
          isOnline: false,
        },
      });
      return;
    }

    if (emptyRecordFlag === 'true') {
      req.user.examTopics = [];
      req.user.currentExamTopic = null;
      await req.user.save();
    }

    if (!req.user.examTopics || req.user.examTopics?.length === 0) {
      const allTopics = await Topic.aggregate([
        { $sample: { size: req.user.topicCount } },
      ]);

      req.user.examTopics = allTopics.map((topic) => ({
        topic: topic._id,
        status: 'pending',
      }));

      // 设置第一个题目为 doing 状态
      if (req.user.examTopics.length > 0) {
        req.user.examTopics[0].status = 'doing';
        req.user.currentExamTopic = req.user.examTopics[0].topic;
      }

      await req.user.save();
    } else if (req.user.currentExamTopic) {
      // 添加 null 检查
      // 确保当前题目状态为 doing
      const currentTopicIndex = req.user.examTopics.findIndex(
        (topic) =>
          topic.topic.toString() === req.user.currentExamTopic.toString(),
      );
      if (currentTopicIndex !== -1) {
        req.user.examTopics[currentTopicIndex].status = 'doing';
        await req.user.save();
      }
    }

    const currentUser = await User.findById(req.user._id)
      .populate({ path: 'currentExamTopic', model: 'Topic' })
      .populate({
        path: 'examTopics',
        populate: { path: 'topic', model: 'Topic' },
      });

    // 只在有 currentExamTopic 时获取题目详情
    const currentExamTopic = currentUser.currentExamTopic
      ? await Topic.findById(currentUser.currentExamTopic)
          .populate('answers')
          .populate({
            path: 'correctAnswers.answer',
            model: 'Answer',
          })
      : null;

    const processedCurrentTopic = currentExamTopic
      ? await transformDocumentImage(currentExamTopic, ['video1', 'video2'])
      : null;

    const processedAnswers = currentExamTopic
      ? await transformDocumentImages(currentExamTopic.answers, ['image'])
      : [];

    // 计算是否所有题目都已完成
    const isAllCompleted = !currentUser.examTopics.some(
      (topic) => !topic.status || topic.status === 'pending',
    );

    console.log('isAllCompleted', isAllCompleted);

    res.json({
      success: true,
      data: {
        currentUser: { ...exclude(currentUser.toObject(), 'password') },
        currentExamTopic: processedCurrentTopic,
        answers: processedAnswers,
        examTopics: currentUser.examTopics,
        isAllCompleted,
        isHasTopics: currentUser.examTopics?.length > 0,
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
