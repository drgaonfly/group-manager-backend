import { Request, Response } from 'express';
import Answer from '../models/answer';
import handleAsync from '../utils/handleAsync';
import { exclude } from '../utils/handleData';

export const getAnswers = handleAsync(async (req: Request, res: Response) => {
  const answers = await Answer.find().exec();
  res.json({
    success: true,
    data: answers,
  });
});

export const addAnswer = handleAsync(async (req: Request, res: Response) => {
  const { name, image } = req.body;
  const newAnswer = new Answer({ name, image });
  const savedAnswer = await newAnswer.save();
  res.json({
    success: true,
    data: exclude(savedAnswer.toObject(), '__v'),
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
      data: exclude(answer.toObject(), '__v'),
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
    data: exclude(updatedAnswer.toObject(), '__v'),
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
