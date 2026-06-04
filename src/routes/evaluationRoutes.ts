import express, { Router } from 'express';
import {
  getEvaluations,
  approveEvaluation,
  rejectEvaluation,
  deleteEvaluation,
  addEvaluation,
} from '../controllers/evaluationController';
import {
  submitEvaluationPublic,
  getMyReviews,
} from '../controllers/evaluationController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// ── 公开路由（Mini App 调用，无需登录） ────────────────────────────
router.post('/public', submitEvaluationPublic);
router.get('/public/my-reviews', getMyReviews);

// ── 需要认证的路由 ─────────────────────────────────────────────────
router
  .route('/')
  .get(protect, checkPermission, getEvaluations)
  .post(protect, checkPermission, addEvaluation);

router.route('/:id/approve').put(protect, checkPermission, approveEvaluation);

router.route('/:id/reject').put(protect, checkPermission, rejectEvaluation);

router.route('/:id').delete(protect, checkPermission, deleteEvaluation);

export default router;
