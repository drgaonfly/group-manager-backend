import express, { Router } from 'express';
import {
  getTelegrams,
  getTelegramById,
  addTelegram,
  updateTelegram,
  deleteTelegram,
  deleteMultipleTelegrams,
} from '../controllers/telegramsController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 批量路由处理
router
  .route('/')
  .get(protect, checkPermission, getTelegrams) // 获取机器人列表
  .post(protect, checkPermission, addTelegram) // 添加新机器人
  .delete(protect, checkPermission, deleteMultipleTelegrams); // 批量删除机器人

// 单个机器人路由处理
router
  .route('/:id')
  .get(protect, checkPermission, getTelegramById) // 获取单个机器人
  .put(protect, checkPermission, updateTelegram) // 更新机器人
  .delete(protect, checkPermission, deleteTelegram); // 删除机器人

export default router;
