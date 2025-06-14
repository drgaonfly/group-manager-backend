import express, { Router } from 'express';
import {
  getWalletById,
  updateWallet,
  deleteWallet,
  getWallets,
  deleteMultipleWallets,
} from '../controllers/walletController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getWallets)
  .delete(protect, checkPermission, deleteMultipleWallets);

router
  .route('/:id')
  .delete(protect, checkPermission, deleteWallet)
  .get(protect, checkPermission, getWalletById)
  .put(protect, checkPermission, updateWallet);

export default router;
