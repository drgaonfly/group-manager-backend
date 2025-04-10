import express, { Router } from 'express';
import {
  getCustomers,
  deleteMultipleCustomers,
  addCustomer,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  verifyCustomer,
  getCustomerWalletByInviteCode,
  getCustomerAuthorizationRemaining,
  getCustomerInviteCode,
} from '../controllers/customerController';
import { protect, checkPermission } from '../middlewares/authMiddleware';
import { customerProtect } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router.route('/verify').post(customerProtect, verifyCustomer);

// 获取customer归集返回代理钱包信息
router
  .route('/wallet')
  .get(protect, checkPermission, getCustomerWalletByInviteCode);

// 归集根据邀请码获取授权地址
router.route('/invite-code').get(protect, getCustomerInviteCode);

// 获取客户授权剩余时间
router
  .route('/auth-remaining')
  .get(customerProtect, getCustomerAuthorizationRemaining);

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
