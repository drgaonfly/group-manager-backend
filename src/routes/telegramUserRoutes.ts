import express, { Router } from 'express';
import {
  getTelegramUsers,
  getTelegramUserById,
  addTelegramUser,
  updateTelegramUser,
  deleteTelegramUser,
  deleteMultipleTelegramUsers,
} from '../controllers/telegramUserController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 批量路由处理
router
  .route('/')
  .get(protect, checkPermission, getTelegramUsers) // 获取机器人列表
  .post(protect, checkPermission, addTelegramUser) // 添加新机器人
  .delete(protect, checkPermission, deleteMultipleTelegramUsers); // 批量删除机器人

// 单个机器人路由处理
router
  .route('/:id')
  .get(protect, checkPermission, getTelegramUserById) // 获取单个机器人
  .put(protect, checkPermission, updateTelegramUser) // 更新机器人
  .delete(protect, checkPermission, deleteTelegramUser); // 删除机器人

export default router;
