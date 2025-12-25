import express, { Router } from 'express';
import {
  getReplyRules,
  getReplyRuleById,
  addReplyRule,
  updateReplyRule,
  deleteReplyRule,
  deleteMultipleReplyRules,
} from '../controllers/replyRuleController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getReplyRules)
  .post(protect, checkPermission, addReplyRule)
  .delete(protect, checkPermission, deleteMultipleReplyRules);

router
  .route('/:id')
  .get(protect, checkPermission, getReplyRuleById)
  .put(protect, checkPermission, updateReplyRule)
  .delete(protect, checkPermission, deleteReplyRule);

export default router;
