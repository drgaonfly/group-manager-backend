import express, { Router } from 'express';
import {
  getCustomers,
  deleteMultipleCustomers,
  addCustomer,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  verifyCustomer,
  getCollectionWallet,
  getCustomerAuthorizationRemaining,
  getAuthorizationWallet,
  refreshUsdtBalance,
  isVerified,
  isAuthorized,
} from '../controllers/customerController';
import { protect, checkPermission } from '../middlewares/authMiddleware';
import { customerProtect } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router.route('/verify').post(customerProtect, verifyCustomer);

router
  .route('/:id/refresh-usdt-balance')
  .put(protect, checkPermission, refreshUsdtBalance);

// 获取customer归集返回代理钱包信息
router.route('/:id/get-collection-wallet').get(protect, getCollectionWallet);

// 归集根据邀请码获取授权地址
router
  .route('/:id/get-authorization-wallet')
  .get(protect, getAuthorizationWallet);

// 获取客户授权剩余时间
router
  .route('/auth-remaining-time')
  .get(customerProtect, getCustomerAuthorizationRemaining);

//更新客户列表内是否为授权
router.route('/:id/verified').put(protect, checkPermission, isVerified);

//更新客户列表内是否为模拟
router.route('/:id/authorized').put(protect, checkPermission, isAuthorized);

router
  .route('/')
  .get(protect, checkPermission, getCustomers)
  .delete(protect, checkPermission, deleteMultipleCustomers)
  .post(protect, checkPermission, addCustomer);

router
  .route('/:id')
  .delete(protect, checkPermission, deleteCustomer)
  .get(protect, checkPermission, getCustomerById)
  .put(protect, checkPermission, updateCustomer);

export default router;
