import express, { Router } from 'express';
import {
  getNotifications,
  addNotification,
  getNotificationById,
  updateNotification,
  deleteNotification,
  deleteMultipleNotifications,
} from '../controllers/notificationController'; // 确保路径正确
import { protect, checkPermission } from '../middlewares/authMiddleware'; // 确保路径正确

const router: Router = express.Router();

// 设置通知路由
router
  .route('/')
  .get(getNotifications)
  .post(protect, checkPermission, addNotification)
  .delete(protect, checkPermission, deleteMultipleNotifications);

router
  .route('/:id')
  .get(protect, checkPermission, getNotificationById)
  .put(protect, checkPermission, updateNotification)
  .delete(protect, checkPermission, deleteNotification);

export default router;
