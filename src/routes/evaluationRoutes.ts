import express, { Router } from 'express';
import {
  getEvaluations,
  approveEvaluation,
  rejectEvaluation,
  deleteEvaluation,
  addEvaluation,
} from '../controllers/evaluationController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getEvaluations)
  .post(protect, checkPermission, addEvaluation);

router.route('/:id/approve').put(protect, checkPermission, approveEvaluation);

router.route('/:id/reject').put(protect, checkPermission, rejectEvaluation);

router.route('/:id').delete(protect, checkPermission, deleteEvaluation);

export default router;
