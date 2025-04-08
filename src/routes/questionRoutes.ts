import express, { Router } from 'express';
import {
  getQuestions,
  addQuestion,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  deleteMultipleQuestions,
} from '../controllers/questionController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getQuestions)
  .post(protect, checkPermission, addQuestion)
  .delete(protect, checkPermission, deleteMultipleQuestions);

router
  .route('/:id')
  .get(getQuestionById)
  .put(protect, checkPermission, updateQuestion)
  .delete(protect, checkPermission, deleteQuestion);

export default router;
