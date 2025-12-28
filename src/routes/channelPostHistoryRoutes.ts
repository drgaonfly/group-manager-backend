import express, { Router } from 'express';
import {
  getChannelPostHistories,
  getChannelPostHistoryById,
  deleteChannelPostHistory,
  deleteMultipleChannelPostHistories,
} from '../controllers/channelPostHistoryController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getChannelPostHistories)
  .delete(protect, checkPermission, deleteMultipleChannelPostHistories);

router
  .route('/:id')
  .get(protect, checkPermission, getChannelPostHistoryById)
  .delete(protect, checkPermission, deleteChannelPostHistory);

export default router;
