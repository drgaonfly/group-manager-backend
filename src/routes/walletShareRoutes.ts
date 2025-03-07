import express, { Router } from 'express';
import {
  getWalletShares,
  addWalletShare,
  getWalletShareById,
  updateWalletShare,
  deleteWalletShare,
  deleteMultipleWalletShares,
} from '../controllers/walletShareController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 设置提现记录的路由
router
  .route('/')
  .get(protect, checkPermission, getWalletShares)
  .post(protect, checkPermission, addWalletShare)
  .delete(protect, checkPermission, deleteMultipleWalletShares);

router
  .route('/:id')
  .get(protect, checkPermission, getWalletShareById)
  .put(protect, checkPermission, updateWalletShare)
  .delete(protect, checkPermission, deleteWalletShare);

export default router;
