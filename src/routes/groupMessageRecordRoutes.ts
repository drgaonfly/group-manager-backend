import express, { Router } from 'express';
import {
  getGroupMessageRecords,
  getGroupMessageRecordById,
  deleteGroupMessageRecord,
  deleteMultipleGroupMessageRecords,
} from '../controllers/groupMessageRecordController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getGroupMessageRecords)
  .delete(protect, checkPermission, deleteMultipleGroupMessageRecords);

router
  .route('/:id')
  .get(protect, checkPermission, getGroupMessageRecordById)
  .delete(protect, checkPermission, deleteGroupMessageRecord);

export default router;
