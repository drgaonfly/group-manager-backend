import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync';
import {
  transformDocumentImages,
  transformDocumentImage,
} from '../utils/transformUtils';
import Video from '../models/video';
import { IdGen } from '../utils/idGen';

// 构建查询条件
const buildQuery = async (queryParams: any): Promise<any> => {
  const query: any = {};

  // 通过用户名称查询
  if (queryParams.name) {
    query.name = queryParams.name;
  }

  return query;
};

// 获取视频列表
const getVideos = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = await buildQuery(req.query);

  const videos = await Video.find(query)
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  // 处理图片路径
  const processedVideos = await transformDocumentImages(videos, ['url']);

  const total = await Video.countDocuments(query).exec();

  res.json({
    success: true,
    data: processedVideos,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// 创建新视频
const addVideo = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(Video, 'id', 6);

  const newVideo = new Video({
    ...req.body,
    id: newId,
  });

  const savedVideo = await newVideo.save();

  res.status(201).json({
    success: true,
    data: savedVideo,
  });
});

// 获取单个视频
const getVideoById = handleAsync(async (req: Request, res: Response) => {
  const video = await Video.findById(req.params.id);

  if (!video) {
    res.status(404);
    throw new Error('视频不存在');
  }

  // 处理图片路径
  const processedVideo = await transformDocumentImage(video, ['url']);

  res.json({
    success: true,
    data: processedVideo,
  });
});

// 更新视频
const updateVideo = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { url, ...otherFields } = req.body;

  const video = await Video.findById(id);
  if (!video) {
    res.status(404);
    throw new Error('视频不存在');
  }

  // 构建更新字段
  const updates = {
    ...(url && !url.startsWith('http') && { url }),
    ...otherFields,
  };

  const updatedVideo = await Video.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  // 处理图片路径
  const processedVideo = await transformDocumentImage(updatedVideo, ['url']);

  res.json({
    success: true,
    data: processedVideo,
  });
});

// 删除视频
const deleteVideo = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const video = await Video.findByIdAndDelete(id);

  if (!video) {
    res.status(404);
    throw new Error('视频不存在');
  }

  res.json({
    success: true,
    data: { message: '视频删除成功' },
  });
});

// 批量删除视频
const deleteMultipleVideos = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Video.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `成功删除 ${ids.length} 个视频`,
    });
  },
);

export {
  getVideos,
  addVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  deleteMultipleVideos,
};
