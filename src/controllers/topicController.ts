import { Request, Response } from 'express';
import Topic from '../models/topic';
import handleAsync from '../utils/handleAsync';
import { exclude } from '../utils/handleData';

export const getTopics = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const queryConditions: any = {};

  let topics = await Topic.find(queryConditions)
    .populate('answers')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Topic.countDocuments(queryConditions);

  res.json({
    success: true,
    data: topics,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

export const addTopic = handleAsync(async (req: Request, res: Response) => {
  const { video1, video2, issue, answers } = req.body;
  const newTopic = new Topic({ video1, video2, issue, answers });
  const savedTopic = await newTopic.save();
  res.json({
    success: true,
    data: savedTopic,
  });
});

export const getTopicById = handleAsync(async (req: Request, res: Response) => {
  const topic = await Topic.findById(req.params.id).populate('answers');
  if (!topic) {
    res.status(404);
    throw new Error('Topic not found');
  }
  res.json({
    success: true,
    data: topic,
  });
});

export const updateTopic = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedTopic = await Topic.findByIdAndUpdate(id, req.body, {
    new: true,
  });
  if (!updatedTopic) {
    res.status(404);
    throw new Error('Topic not found');
  }
  res.json({
    success: true,
    data: updatedTopic,
  });
});

export const deleteTopic = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
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
