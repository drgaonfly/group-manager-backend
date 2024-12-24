import express, { Router } from 'express';
import {
  getAnswers,
  addAnswer,
  getAnswerById,
  updateAnswer,
  deleteAnswer,
} from '../controllers/answerController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getAnswers)
  .post(protect, checkPermission, addAnswer);

router
  .route('/:id')
  .get(protect, checkPermission, getAnswerById)
  .put(protect, checkPermission, updateAnswer)
  .delete(protect, checkPermission, deleteAnswer);

export default router;
