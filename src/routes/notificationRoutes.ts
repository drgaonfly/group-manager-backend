import express, { Router } from 'express';
import {
  getNotifications,
  addNotification,
  getNotificationById,
  updateNotification,
  deleteNotification,
  deleteMultipleNotifications,
  getCustomerNotifications,
} from '../controllers/notificationController'; // 确保路径正确
import { protect, checkPermission } from '../middlewares/authMiddleware'; // 确保路径正确

import { customerProtect } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/getCustomerNotifications')
  .get(customerProtect, getCustomerNotifications);

// 设置通知路由
router
  .route('/')
  .get(protect, checkPermission, getNotifications)
  .post(protect, checkPermission, addNotification)
  .delete(protect, checkPermission, deleteMultipleNotifications);

router
  .route('/:id')
  .get(protect, checkPermission, getNotificationById)
  .put(protect, checkPermission, updateNotification)
  .delete(protect, checkPermission, deleteNotification);

export default router;
