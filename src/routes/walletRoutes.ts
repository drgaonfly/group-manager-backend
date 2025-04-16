import express, { Router } from 'express';
import {
  getWallets,
  getWalletById,
  generateEthWallet,
  generateBnbWallet,
  generateTrxWallet,
  updateCurrentUserWalletBalance,
  getAuthorizationWallet,
  getCollectionWallet,
} from '../controllers/walletController';
import { protect, checkPermission } from '../middlewares/authMiddleware';
import { customerProtect } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 批量刷新钱包余额
router.post(
  '/refresh-wallets-balance',
  protect,
  updateCurrentUserWalletBalance,
);

router.post('/generate-eth-wallet', protect, generateEthWallet);
router.post('/generate-bnb-wallet', protect, generateBnbWallet);
router.post('/generate-trx-wallet', protect, generateTrxWallet);

// 获取授权钱包地址
router.get(
  '/get-authorization-wallet',
  customerProtect,
  getAuthorizationWallet,
);

router.get('/get-collection-wallet', customerProtect, getCollectionWallet);

router.route('/').get(protect, checkPermission, getWallets);

router.route('/:id').get(protect, checkPermission, getWalletById);

export default router;
