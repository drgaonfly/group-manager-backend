import { Request, Response } from 'express';
import Record from '../models/record';
import handleAsync from '../utils/handleAsync';
import Topic from '../models/topic';
import { RequestCustom } from '../types/user';
import { exclude } from '../utils/handleData';
import User from '../models/user';
import axios from 'axios';
import { generateUniqueNumber } from './topicController';
import ossClient from '../utils/oss';

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

const url = 'https://api.cabinet-rgshb.hetuntech.cn/graphql';
const token =
  'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOnsic291cmNlIjoiQ09OU09MRSIsImFkbWluSWQiOiI1NTg3NTE4ZS03OGQzLTRhNjAtODc1OS0wN2UzMzQzMWZhZWYiLCJzZXNzaW9uSWQiOiJiMDNiNGU2OC01NmMwLTQwMDAtYmY0Ny1mYmNhMGFmNDljNGMifSwiaWF0IjoxNzM1MDMxMDAyfQ.GbV2uiqkC2qOxV3SKwSSQmSitcimOwceSyfunqlVyrI';

// 第一个请求
const getAllTopics = async (token: string) => {
  const response = await axios.post(
    url,
    {
      operationName: null,
      variables: {
        limit: 1,
        privilege: 'ADMIN',
      },
      query: `query ($limit: Int, $offset: Int, $privilege: StaffNoviceTrainingCachePrivilegeEnum, $id: String) {
        result: staffNoviceTrainingCacheConnection(
          limit: $limit
          offset: $offset
          privilege: $privilege
          id: $id
        ) {
          nodes {
            id
            createdAt
            updatedAt
            subjectList
            result
            __typename
          }
          totalCount
          __typename
        }
      }`,
    },
    {
      headers: {
        Authorization: token,
      },
    },
  );
  return response.data?.data?.result?.nodes[0]?.subjectList;
};

//
const getTopicDetails = async (token: string, id: string) => {
  const response = await axios.post(
    url,
    {
      operationName: null,
      variables: {
        id,
        limit: 1,
        privilege: 'STAFF',
      },
      query: `query ($limit: Int, $offset: Int, $privilege: OrderLibraryPrivilegeEnum, $id: String) {
        result: orderLibraryConnection(
          limit: $limit
          offset: $offset
          privilege: $privilege
          id: $id
        ) {
          nodes {
            id
            createdAt
            updatedAt
            trade
            type
            videoList
            itemInfoList
            chooseItemList
            preselectedItem
            __typename
          }
          totalCount
          __typename
        }
      }`,
    },
    {
      headers: {
        Authorization: token,
      },
    },
  );
  return response.data?.data?.result?.nodes[0];
};

// 获取answer
const getAnswersBySns = async (token: string) => {
  const response = await axios.post(
    url,
    {
      operationName: null,
      variables: {
        storeId: '',
        snList: ['09974444221'],
        privilege: 'ADMIN',
      },
      query: `query ($snList: [String!]!, $storeId: String!) {
        result: optionalItemList(snList: $snList, storeId: $storeId) {
          totalCount
          list {
            id: sysSkuId
            brandName
            createdTime
            sn: productCode
            skuName
            spec
            packageImageUrl
            __typename
          }
          __typename
        }
      }`,
    },
    {
      headers: {
        Authorization: token,
      },
    },
  );
  return response.data.data.result;
};

// 上传视频到OSS
const uploadVideoToOSS = async (url: string) => {
  const regex = /\/([^\/]+)\.mp4/g;
  const results = [];
  let match;

  while ((match = regex.exec(url)) !== null) {
    results.push(match[1]);
  }

  const filename = results[0];
  const ossPath = `taskOssUploads/${filename}`;

  // Download the file from URL
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  // Upload the file content to OSS
  await ossClient.put(ossPath, response.data);

  return ossPath;
};

// 爬取数据的主接口
export const scrapeData = handleAsync(async (req: Request, res: Response) => {
  const topics = await getAllTopics(token);

  if (!topics || topics.length === 0) {
    res.status(404);
    throw new Error('Topics not found');
  }

  // for (const topic of topics) {
  const topicDetails = await getTopicDetails(token, topics[0].id);

  console.log(topicDetails);

  if (!topicDetails) {
    res.status(404);
    throw new Error('Topic details not found');
  }

  const uniqueNum = await generateUniqueNumber(); // 直接调用 generateUniqueNumber

  const newTopic = new Topic({
    topicNumber: uniqueNum,
    video1: await uploadVideoToOSS(topicDetails.videoList[0]),
    video2: topicDetails.videoList?.[1]
      ? await uploadVideoToOSS(topicDetails.videoList[1])
      : undefined,
  });

  await newTopic.save();

  // 返回所有数据
  res.json({
    success: true,
    data: {
      topicDetails: topicDetails,
    },
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

    const topic = await Topic.findById(topicId)
      .populate({
        path: 'answers',
        model: 'Answer',
      })
      .populate({
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
      nextTopic = currentUser.topics[currentIndex];
    } while (nextTopic.status === 'pending');

    if (!nextTopic) {
      res.status(400);
      throw new Error('所有题目都已经完成了');
    }

    console.log('下一个对象：', nextTopic);
    currentUser.currentTopic = nextTopic.topic;

    await newRecord.save();

    await currentUser.save();

    const currentTopic = await Topic.findById(currentUser.currentTopic)
      .populate({
        path: 'answers',
        model: 'Answer',
      })
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

      await req.user.save();
    }

    const currentUser = await User.findById(req.user._id)
      .populate({ path: 'currentTopic', model: 'Topic' })
      .populate({
        path: 'topics',
        populate: { path: 'topic', model: 'Topic' },
      });

    const currentTopic = await Topic.findById(currentUser.currentTopic)
      .populate({
        path: 'answers',
        model: 'Answer',
      })
      .populate({
        path: 'correctAnswers.answer',
        model: 'Answer',
      });

    res.json({
      success: true,
      data: {
        currentUser: { ...exclude(currentUser.toObject(), 'password') },
        currentTopic,
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
