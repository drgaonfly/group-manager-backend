import { Request, Response } from 'express';
import Question from '../models/question';
import handleAsync from '../utils/handleAsync';
import { IdGen } from '../utils/idGen';

// Helper function to build query
const buildQuestionQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.lang) {
    query.lang = queryParams.lang;
  }

  if (queryParams.title) {
    query.title = queryParams.title;
  }

  return query;
};

// Get all questions
const getQuestions = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildQuestionQuery(req.query);

  const questions = await Question.find(query)
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Question.countDocuments(query).exec();

  res.json({
    success: true,
    data: questions,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// Add a question
const addQuestion = handleAsync(async (req: Request, res: Response) => {
  const newId = await IdGen.next(Question, 'id', 6); // Generate a 6-digit unique ID

  // Create the new question with the generated id
  const newQuestion = new Question({
    ...req.body,
    id: newId, // Set the new unique id
  });

  // Save the new question
  const savedQuestion = await newQuestion.save();

  res.json({
    success: true,
    data: savedQuestion,
  });
});

// Get a question by ID
const getQuestionById = handleAsync(async (req: Request, res: Response) => {
  const question = await Question.findById(req.params.id);

  if (!question) {
    res.status(404);
    throw new Error('Question not found');
  }

  res.json({
    success: true,
    data: question,
  });
});

// Update a question
const updateQuestion = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedQuestion = await Question.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  );

  if (!updatedQuestion) {
    res.status(404);
    throw new Error('Question not found');
  }

  res.json({
    success: true,
    data: updatedQuestion,
  });
});

// Delete a question
const deleteQuestion = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const question = await Question.findByIdAndDelete(id);

  if (!question) {
    res.status(404);
    throw new Error('Question not found');
  }

  res.json({
    success: true,
    data: { message: 'Question deleted successfully' },
  });
});

// Batch delete questions
const deleteMultipleQuestions = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Question.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} questions deleted successfully`,
    });
  },
);

export {
  getQuestions,
  addQuestion,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  deleteMultipleQuestions,
};
