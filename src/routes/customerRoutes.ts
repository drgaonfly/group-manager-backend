import express, { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  deleteMultipleCustomers,
} from '../controllers/customerController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 批量路由处理
router
  .route('/')
  .get(protect, checkPermission, getCustomers) // 获取客户列表
  .post(protect, checkPermission, addCustomer) // 添加新客户
  .delete(protect, checkPermission, deleteMultipleCustomers); // 批量删除客户

// 单个客户路由处理
router
  .route('/:id')
  .get(protect, checkPermission, getCustomerById) // 获取单个客户
  .put(protect, checkPermission, updateCustomer) // 更新客户
  .delete(protect, checkPermission, deleteCustomer); // 删除客户

export default router;
