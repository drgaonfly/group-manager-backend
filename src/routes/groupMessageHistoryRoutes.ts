import express, { Router } from 'express';
import {
  getGroupMessageHistories,
  getGroupMessageHistoryById,
  deleteGroupMessageHistory,
  deleteMultipleGroupMessageHistories,
} from '../controllers/groupMessageHistoryController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getGroupMessageHistories)
  .delete(protect, checkPermission, deleteMultipleGroupMessageHistories);

router
  .route('/:id')
  .get(protect, checkPermission, getGroupMessageHistoryById)
  .delete(protect, checkPermission, deleteGroupMessageHistory);

export default router;
