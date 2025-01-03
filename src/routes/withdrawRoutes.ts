import express, { Router } from 'express';
import {
  getWithdraws,
  addWithdraw,
  getWithdrawById,
  updateWithdraw,
  deleteWithdraw,
  deleteMultipleWithdraws,
} from '../controllers/withdrawController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 设置提现记录的路由
router
  .route('/')
  .get(protect, checkPermission, getWithdraws)
  .post(protect, checkPermission, addWithdraw)
  .delete(protect, checkPermission, deleteMultipleWithdraws);

router
  .route('/:id')
  .get(protect, checkPermission, getWithdrawById)
  .put(protect, checkPermission, updateWithdraw)
  .delete(protect, checkPermission, deleteWithdraw);

export default router;
