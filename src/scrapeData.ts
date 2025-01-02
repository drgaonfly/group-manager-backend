import axios from 'axios';
import ossClient from './utils/oss';
import Answer from './models/answer';
import mongoose from 'mongoose';
import { generateUniqueNumber } from './controllers/topicController';
import Topic from './models/topic';
import setupDB from './utils/db';
const url = 'https://api.cabinet-rgshb.hetuntech.cn/graphql';
const token =
  'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOnsic291cmNlIjoiQ09OU09MRSIsImFkbWluSWQiOiI1NTg3NTE4ZS03OGQzLTRhNjAtODc1OS0wN2UzMzQzMWZhZWYiLCJzZXNzaW9uSWQiOiJiMDNiNGU2OC01NmMwLTQwMDAtYmY0Ny1mYmNhMGFmNDljNGMifSwiaWF0IjoxNzM1MDMxMDAyfQ.GbV2uiqkC2qOxV3SKwSSQmSitcimOwceSyfunqlVyrI';

// 第一个请求
const getAllTopics = async (token: string): Promise<any[]> => {
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
const getTopicDetails = async (token: string, id: string): Promise<any> => {
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
const getAnswersBySns = async (
  token: string,
  snList: string[],
): Promise<any[]> => {
  const response = await axios.post(
    url,
    {
      operationName: null,
      variables: {
        storeId: '',
        snList,
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
  return response.data?.data?.result?.list;
};

const uploadFileToOSS = async (url: string): Promise<string> => {
  const filename = url.split('/').pop() ?? '';
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

// const uploadFileToS3 = async (url: string) => {
//   const filename = url.split('/').pop() ?? '';
//   const key = `s3Uploads/${filename}`;

//   // Download the file from URL
//   const response = await axios({
//     url,
//     method: 'GET',
//     responseType: 'stream',
//   });

//   // Upload the file content to S3
//   const params = {
//     Bucket: process.env.AWS_BUCKET_NAME,
//     Key: key,
//     Body: response.data,
//     ContentType: response.headers['content-type'],
//   };

//   await s3.upload(params).promise();

//   return key;
// };

const scrapeData = async () => {
  console.log('开始连接数据库');
  await setupDB();

  console.log('开始爬取数据');
  const topics = await getAllTopics(token);

  if (!topics || topics.length === 0) {
    console.log('topics not found');
  }

  for (const topic of topics) {
    // 查找所有的题目
    const topicDetails = await getTopicDetails(token, topic.id);

    console.log('获取 topicDetails', topic.id);
    console.log(topicDetails);

    if (!topicDetails) {
      console.log(`${topic.id} topicDetails not found`);
      process.exit(1);
    }

    console.log('正在处理 topic: ' + topic.id);

    const topicExists = await Topic.findOne({
      id: topic.id,
    });

    if (topicExists) {
      console.log(`${topic.id} topic already exists`);
      continue;
    }

    const uniqueNum = await generateUniqueNumber(); // 直接调用 generateUniqueNumber

    const newTopic = new Topic({
      topicNumber: uniqueNum,
      video1: await uploadFileToOSS(topicDetails.videoList[0]),
      video2: topicDetails.videoList?.[1]
        ? await uploadFileToOSS(topicDetails.videoList[1])
        : undefined,
    });

    const snList = topicDetails.itemInfoList.map(
      (item: { sn: string }) => item.sn,
    );

    const correctAnswers = topicDetails.chooseItemList;

    // 获取答案
    const answers = await getAnswersBySns(token, snList);

    if (!answers || answers.length === 0) {
      console.log(`${topic.id} answers not found`);
    }

    // 创建答案
    for (const answer of answers) {
      const newAnswer = new Answer({
        image: await uploadFileToOSS(answer.packageImageUrl),
        topic: newTopic._id,
        skuName: answer.skuName,
        brandName: answer.brandName,
        sn: answer.sn,
        spec: answer.spec,
        id: answer.id,
        rowNumber: topicDetails.itemInfoList.find(
          (item: { sn: string }) => item.sn === answer.sn,
        )?.row,
      });

      await newAnswer.save();

      console.log('创建答案: ' + newAnswer.skuName + ' 完成');
      console.log(newAnswer.toObject());
    }

    // 创建正确答案
    for (const correctAnswer of correctAnswers) {
      const answer = await Answer.findOne({
        sn: correctAnswer.sn,
      });

      if (answer) {
        // 确保找到 answer
        newTopic.correctAnswers.push({
          answer: answer._id as mongoose.Types.ObjectId, // 确保这是一个有效的 ObjectId
          count: correctAnswer?.number || 1, // 确保 count 有默认值
        });
      } else {
        console.warn(`Answer not found for SN: ${correctAnswer.sn}`);
      }
    }

    await newTopic.save();
    console.log(newTopic.toObject());
    console.log('处理 topic: ' + topic.id + ' 完成');
    console.log('----------------------------');
  }
};

scrapeData();
