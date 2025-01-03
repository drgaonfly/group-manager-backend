import { Request, Response } from 'express';
import Answer from '../models/answer';
import handleAsync from '../utils/handleAsync';
import { CustomRequest } from './uploadController';
import {
  transformDocumentImage,
  transformDocumentImages,
} from '../utils/transformUtils';
import { generateUniqueNumber } from './topicController';

// dataPermissionController.ts
const buildQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.brandName) {
    query.brandName = queryParams.brandName;
  }

  if (queryParams.skuName) {
    query.skuName = { $regex: new RegExp(queryParams.skuName, 'i') };
  }

  if (queryParams.sn) {
    query.sn = queryParams.sn;
  }

  return query;
};

// 获取所有答案
const getAnswers = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuery(req.query);

  const answers = await Answer.find(query)
    .populate('topic')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  // 处理图片路径
  const processedAnswers = await transformDocumentImages(answers, ['image']);

  const total = await Answer.countDocuments(query).exec();

  res.json({
    success: true,
    data: processedAnswers,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 添加答案
const addAnswer = handleAsync(async (req: CustomRequest, res: Response) => {
  const uniqueNum = await generateUniqueNumber(); // 直接调用 generateUniqueNumber
  const newAnswer = new Answer({
    ...req.body,
    id: uniqueNum, // 新建编号自动生成
  });

  const savedAnswer = await newAnswer.save();

  res.json({
    success: true,
    data: savedAnswer,
  });
});

// 根据ID获取答案
const getAnswerById = handleAsync(async (req: Request, res: Response) => {
  const answer = await Answer.findById(req.params.id).populate('topic');

  if (!answer) {
    res.status(404);
    throw new Error('答案不存在');
  }

  // 处理图片路径
  const processedAnswer = await transformDocumentImage(answer, 'image');

  res.json({
    success: true,
    data: processedAnswer,
  });
});

// 更新答案
const updateAnswer = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { image, ...otherFields } = req.body;

  const answer = await Answer.findById(id);
  if (!answer) {
    res.status(404);
    throw new Error('答案不存在');
  }

  // 更新字段
  const updates = {
    ...(image && !image.startsWith('http') && { image }),
    ...otherFields,
  };

  const updatedAnswer = await Answer.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  // 处理图片路径
  const processedAnswer = await transformDocumentImage(updatedAnswer, [
    'image',
  ]);

  res.json({
    success: true,
    data: processedAnswer,
  });
});

// 删除答案
const deleteAnswer = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 删除答案
  const answer = await Answer.findByIdAndDelete(id);

  if (!answer) {
    res.status(404);
    throw new Error('Answer not found');
  }

  res.json({
    success: true,
    data: { message: 'Answer deleted successfully' },
  });
});

// 批量删除答案1
const deleteMultipleAnswers = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    // 使用 Mongoose 的 deleteMany 方法进行批量删除
    await Answer.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} answers deleted successfully`,
    });
  },
);

export {
  getAnswers,
  addAnswer,
  getAnswerById,
  updateAnswer,
  deleteAnswer,
  deleteMultipleAnswers,
};
