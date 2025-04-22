import express, { Router } from 'express';
import {
  getTransfers,
  addTransfer,
  getTransferById,
  updateTransfer,
  deleteTransfer,
  deleteMultipleTransfers,
  addCollectionTransfer,
} from '../controllers/transferController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 添加收款转账记录的路由
router.post('/:id/collection', protect, checkPermission, addCollectionTransfer);

router
  .route('/')
  .get(protect, checkPermission, getTransfers)
  .post(protect, checkPermission, addTransfer)
  .delete(protect, checkPermission, deleteMultipleTransfers);

router
  .route('/:id')
  .get(protect, checkPermission, getTransferById)
  .put(protect, checkPermission, updateTransfer)
  .delete(protect, checkPermission, deleteTransfer);

export default router;
