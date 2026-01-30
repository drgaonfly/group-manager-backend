import express, { Router } from 'express';
import {
  getCheckinRules,
  getCheckinRuleById,
  addCheckinRule,
  updateCheckinRule,
  deleteCheckinRule,
  deleteMultipleCheckinRules,
} from '../controllers/checkinRuleController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getCheckinRules)
  .post(protect, checkPermission, addCheckinRule)
  .delete(protect, checkPermission, deleteMultipleCheckinRules);

router
  .route('/:id')
  .get(protect, checkPermission, getCheckinRuleById)
  .put(protect, checkPermission, updateCheckinRule)
  .delete(protect, checkPermission, deleteCheckinRule);

export default router;
