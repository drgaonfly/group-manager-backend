import { Request, Response } from 'express';
import Answer from '../models/answer';
import handleAsync from '../utils/handleAsync';

export const getAnswers = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const queryConditions: any = {};

  let answers = await Answer.find(queryConditions)
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Answer.countDocuments(queryConditions);

  res.json({
    success: true,
    data: answers,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

export const addAnswer = handleAsync(async (req: Request, res: Response) => {
  const { name, image } = req.body;
  const newAnswer = new Answer({ name, image });
  const savedAnswer = await newAnswer.save();
  res.json({
    success: true,
    data: savedAnswer,
  });
});

export const getAnswerById = handleAsync(
  async (req: Request, res: Response) => {
    const answer = await Answer.findById(req.params.id);
    if (!answer) {
      res.status(404);
      throw new Error('Answer not found');
    }
    res.json({
      success: true,
      data: answer,
    });
  },
);

export const updateAnswer = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedAnswer = await Answer.findByIdAndUpdate(id, req.body, {
    new: true,
  });
  if (!updatedAnswer) {
    res.status(404);
    throw new Error('Answer not found');
  }
  res.json({
    success: true,
    data: updatedAnswer,
  });
});

export const deleteAnswer = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
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
